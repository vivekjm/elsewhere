"""Real-browser acceptance tests against a running Elsewhere Worker.

The application uses its production fetch repository, visitor cookies, D1 and R2.
Only the explicit failed-save test intercepts PUT to simulate a network failure.
Run against a disposable local database, never a production workspace.
"""
import base64
import json
import os
from pathlib import Path
import re
import time
import traceback
from datetime import datetime

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('ELSEWHERE_TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
OUT = Path(os.environ.get('ELSEWHERE_E2E_OUTPUT', 'test-results/browser'))
OUT.mkdir(parents=True, exist_ok=True)
RESULTS = []
ERRORS = []
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6eTQAAAAASUVORK5CYII=')


def case(name, fn):
    try:
        fn()
        RESULTS.append({'name': name, 'passed': True})
        print('PASS', name, flush=True)
    except Exception as exc:
        RESULTS.append({'name': name, 'passed': False, 'error': str(exc)})
        print('FAIL', name, str(exc), flush=True)
        traceback.print_exc()


def fresh(browser, width=1440):
    context = browser.new_context(viewport={'width': width, 'height': 900}, accept_downloads=True)
    page = context.new_page()
    page.set_default_timeout(10000)
    page.on('pageerror', lambda error: ERRORS.append(str(error)))
    page.goto(BASE, wait_until='networkidle')
    expect(page.locator('.ew-main h1')).to_have_text('Your trip, all together.')
    return context, page


def nav(page, name):
    mobile = page.viewport_size['width'] <= 900
    if mobile and name == 'Packing list':
        name = 'Packing'
    page.get_by_role('navigation', name='Mobile navigation' if mobile else 'Main navigation').get_by_role('link', name=re.compile(name)).click()


def saved(page):
    page.wait_for_function("Array.from(document.querySelectorAll('.ew-save-status')).some(e=>e.textContent.trim()==='All changes saved') && !document.querySelector('.ew-save-banner')")


def stored(page):
    return page.evaluate("fetch('/api/workspace').then(r=>r.json())")


def wait_record(page, expression):
    deadline = time.monotonic() + 12
    while time.monotonic() < deadline:
        data = stored(page)
        if expression(data['workspace']):
            saved(page)
            return data
        page.wait_for_timeout(150)
    raise AssertionError('Expected data was not persisted before timeout')


def choose(page, scope, label, option):
    scope.get_by_label(label, exact=True).click()
    page.get_by_role('option', name=option, exact=True).click()


def choose_date(page, scope, label, date):
    scope.get_by_label(label, exact=True).click()
    picker = page.locator('.ew-picker-panel')
    target = date[:7]
    for _ in range(120):
        shown = datetime.strptime(picker.locator('.ew-picker-period').inner_text().strip(), '%B %Y').strftime('%Y-%m')
        if shown == target:
            break
        picker.get_by_role('button', name='Next month' if shown < target else 'Previous month', exact=True).click()
    else:
        raise AssertionError('Requested month was not reachable')
    picker.locator(f'[data-picker-date="{date}"]').click()


with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    context, page = fresh(browser)

    def day_and_reload():
        page.get_by_role('button', name='Edit day details', exact=True).click()
        d = page.get_by_role('dialog')
        d.get_by_label('Day title', exact=True).fill('Markets and sunset')
        d.get_by_label('Accommodation', exact=True).fill('River guesthouse')
        d.get_by_role('tab', name='Outfits', exact=True).click()
        d.locator('.ew-pick-look').filter(has_text='Dinner at sunset').locator('input').check()
        d.get_by_role('tab', name='Essentials', exact=True).click()
        d.locator('.ew-pick-item').filter(has_text='Camera').locator('input').check()
        d.get_by_role('button', name='Save changes', exact=True).click()
        wait_record(page, lambda w: w['trips'][0]['days']['2026-09-21'].get('title') == 'Markets and sunset')
        page.reload(wait_until='networkidle')
        expect(page.get_by_role('complementary', name='Selected day')).to_contain_text('Markets and sunset')
        day = stored(page)['workspace']['trips'][0]['days']['2026-09-21']
        assert len(day['outfitIds']) == 2 and day['gear'] == ['camera']
        assert day['stay'] == 'River guesthouse'
    case('Daily details, multiple outfits and gear survive a real page reload', day_and_reload)

    def activity_and_undo():
        page.get_by_role('button', name='Add a plan', exact=True).click()
        d = page.get_by_role('dialog')
        d.get_by_label('Activity', exact=True).fill('Museum reservation')
        d.get_by_label('Start time', exact=False).fill('11:00')
        d.get_by_label('End time (optional)', exact=True).fill('12:30')
        d.get_by_label('Place', exact=True).fill('City museum')
        d.locator('.ew-editor-more > summary').click()
        d.get_by_label('Estimated cost (EUR)', exact=True).fill('19.50')
        d.get_by_label('Reference link (optional)', exact=True).fill('https://example.com/reservation')
        choose(page, d, 'Outfit for this activity', 'A breezy afternoon')
        d.get_by_role('button', name='Save changes', exact=True).click()
        wait_record(page, lambda w: any(a['title'] == 'Museum reservation' for a in w['trips'][0]['activities']))
        page.get_by_role('button', name='View full day', exact=True).click()
        page.get_by_role('button', name='Edit Museum reservation', exact=True).click()
        d = page.get_by_role('dialog')
        choose_date(page, d, 'Date', '2026-09-24')
        d.get_by_role('button', name='Save changes', exact=True).click()
        data = wait_record(page, lambda w: any(a['title'] == 'Museum reservation' and a['date'] == '2026-09-24' for a in w['trips'][0]['activities']))
        a = next(a for a in data['workspace']['trips'][0]['activities'] if a['title'] == 'Museum reservation')
        assert a['cost'] == 19.5 and a['endTime'] == '12:30' and a['outfitId'] == 'coast'
        expect(page.locator('.ew-day-dialog .ew-dialog-header')).to_contain_text('Thursday 24 September')
        page.get_by_role('button', name='Delete Museum reservation', exact=True).click()
        page.get_by_role('dialog').get_by_role('button', name='Delete', exact=True).click()
        page.get_by_role('button', name='Undo last deletion').click()
        wait_record(page, lambda w: any(a['title'] == 'Museum reservation' for a in w['trips'][0]['activities']))
        page.keyboard.press('Escape')
    case('Activity creation, rescheduling and deletion undo use durable server writes', activity_and_undo)

    def photo_outfit_packing():
        nav(page, 'Wardrobe')
        page.get_by_role('button', name='Add a piece', exact=True).click()
        d = page.get_by_role('dialog')
        d.get_by_label('Item name', exact=True).fill('Photo jacket')
        choose(page, d, 'Category', 'Layers')
        d.get_by_label('Weight (g)', exact=True).fill('430')
        d.locator('input[type=file]').set_input_files({'name': 'fixture.png', 'mimeType': 'image/png', 'buffer': PNG})
        expect(d.locator('.ew-item-preview img')).to_be_visible()
        d.get_by_role('button', name='Save changes', exact=True).click()
        data = wait_record(page, lambda w: any(i['name'] == 'Photo jacket' and i['image'] for i in w['items']))
        image = next(i['image'] for i in data['workspace']['items'] if i['name'] == 'Photo jacket')
        assert context.request.get(BASE + image).status == 200
        page.get_by_role('button', name=re.compile('^Outfits')).click()
        page.get_by_role('button', name='Create outfit', exact=True).click()
        d = page.get_by_role('dialog')
        d.get_by_label('Outfit name', exact=True).fill('Mountain mornings')
        d.locator('.ew-pick-item').filter(has_text='Photo jacket').locator('input').check()
        d.locator('.ew-pick-item').filter(has_text='Everyday trousers').locator('input').check()
        d.get_by_role('button', name='Save changes', exact=True).click()
        wait_record(page, lambda w: any(o['name'] == 'Mountain mornings' for o in w['outfits']))
        nav(page, 'Calendar')
        page.get_by_role('button', name='Edit day details', exact=True).click()
        d = page.get_by_role('dialog')
        d.get_by_role('tab', name='Outfits', exact=True).click()
        d.locator('.ew-pick-look').filter(has_text='Mountain mornings').locator('input').check()
        d.get_by_role('button', name='Save changes', exact=True).click()
        nav(page, 'Packing list')
        expect(page.get_by_role('checkbox', name='Pack Photo jacket', exact=True)).to_have_count(1)
        page.get_by_role('checkbox', name='Pack Photo jacket', exact=True).check()
        wait_record(page, lambda w: next(i['id'] for i in w['items'] if i['name'] == 'Photo jacket') in w['trips'][0]['packed'])
        page.reload(wait_until='networkidle')
        expect(page.get_by_role('checkbox', name='Pack Photo jacket', exact=True)).to_be_checked()
    case('Private photo upload, outfit creation and connected packing survive reload', photo_outfit_packing)

    def export_restore_photos():
        page.get_by_role('button', name='Settings & backups', exact=True).click()
        with page.expect_download() as download:
            page.get_by_role('button', name='Download workspace backup', exact=True).click()
        target = OUT / 'roundtrip-backup.json'
        download.value.save_as(target)
        data = json.loads(target.read_text())
        assert data['format'] == 'elsewhere-backup' and len(data['photos']) == 1
        assert data['photos'][0]['data'].startswith('data:image/png;base64,')
        other, p2 = fresh(browser)
        try:
            old_image = next(i['image'] for i in data['workspace']['items'] if i['name'] == 'Photo jacket')
            assert other.request.get(BASE + old_image).status == 404
            p2.get_by_role('button', name='Settings & backups', exact=True).click()
            p2.get_by_label('Restore backup file').set_input_files(target)
            p2.get_by_role('dialog').get_by_role('button', name='Restore backup', exact=True).click()
            restored = wait_record(p2, lambda w: any(i['name'] == 'Photo jacket' for i in w['items']))
            new_image = next(i['image'] for i in restored['workspace']['items'] if i['name'] == 'Photo jacket')
            assert new_image != old_image
            assert other.request.get(BASE + new_image).status == 200
            assert context.request.get(BASE + new_image).status == 404
            p2.reload(wait_until='networkidle')
            assert any(o['name'] == 'Mountain mornings' for o in stored(p2)['workspace']['outfits'])
        finally:
            other.close()
    case('Photo-inclusive backup restores into an isolated visitor workspace', export_restore_photos)

    def create_trip():
        nav(page, 'All trips')
        page.get_by_role('button', name='New trip', exact=True).click()
        d = page.get_by_role('dialog')
        d.get_by_label('Trip name', exact=True).fill('A week in the hills')
        d.get_by_label('Destination', exact=True).fill('Gangtok & Lachung')
        choose_date(page, d, 'Departure', '2026-11-01')
        choose_date(page, d, 'Return', '2026-11-07')
        d.get_by_role('button', name='Save changes', exact=True).click()
        wait_record(page, lambda w: len(w['trips']) == 2)
        page.reload(wait_until='networkidle')
        expect(page.get_by_role('heading', name='A week in the hills', exact=True)).to_be_visible()
        assert 'November' in page.locator('.ew-month-toolbar').inner_text()
    case('New trips and selected-trip deep links survive reload', create_trip)
    context.close()

    context, page = fresh(browser)
    def retry_real_save():
        def fail_put(route):
            if route.request.method == 'PUT':
                route.fulfill(status=503, json={'error': 'Simulated unavailable server'})
            else:
                route.continue_()
        page.route('**/api/workspace', fail_put)
        nav(page, 'Packing list')
        page.get_by_role('checkbox', name='Pack Camera', exact=True).check()
        expect(page.locator('.ew-save-banner')).to_contain_text('Not saved yet.')
        page.unroute('**/api/workspace', fail_put)
        page.get_by_role('button', name='Retry save', exact=True).click()
        wait_record(page, lambda w: 'camera' in w['trips'][0]['packed'])
        page.reload(wait_until='networkidle')
        expect(page.get_by_role('checkbox', name='Pack Camera', exact=True)).to_be_checked()
    case('A failed PUT preserves edits; retry persists to the real database', retry_real_save)

    def revision_conflict():
        data = stored(page)
        w = data['workspace']
        w['trips'][0]['name'] = 'Saved by another tab'
        response = context.request.put(BASE + '/api/workspace', headers={'Origin': BASE}, data={'workspace': w, 'revision': data['revision']})
        assert response.status == 200
        page.get_by_role('checkbox', name='Pack Linen shirt', exact=True).check()
        expect(page.locator('.ew-save-banner')).to_contain_text('Another tab saved newer changes.')
        page.wait_for_timeout(700)
        assert stored(page)['workspace']['trips'][0]['name'] == 'Saved by another tab'
        assert 'linen' not in stored(page)['workspace']['trips'][0]['packed']
        expect(page.locator('.ew-save-banner').get_by_role('button', name='Back up edits')).to_be_visible()
        page.get_by_role('checkbox', name='Pack Walking trainers', exact=True).click()
        expect(page.get_by_role('checkbox', name='Pack Walking trainers', exact=True)).not_to_be_checked()
        assert 'trainers' not in stored(page)['workspace']['trips'][0]['packed']
    case('Real optimistic-revision conflicts never overwrite another tab', revision_conflict)
    context.close()


    context, page = fresh(browser)
    def visual_moods():
        for label, theme in [('Into the forest','forest'), ('Desert days','desert'), ('Snow & silence','snow'), ('Golden hour','sunset'), ('Under the stars','night'), ('Quiet mountains','mountains'), ('By the coast','coast'), ('City wandering','city')]:
            page.get_by_role('button', name='Change cover mood').click()
            expect(page.get_by_role('radio')).to_have_count(8)
            page.get_by_role('radio', name=label, exact=True).click()
            wait_record(page, lambda w: w['trips'][0]['theme'] == theme)
        page.reload(wait_until='networkidle')
        expect(page.locator('.ew-hero .ew-scene-city')).to_be_visible()
        page.get_by_role('button', name='Pause animations').click()
        assert page.locator('.ew-hero .ew-scene-windows').evaluate('e => getComputedStyle(e).animationPlayState') == 'paused'
        page.reload(wait_until='networkidle')
        expect(page.get_by_role('button', name='Resume animations')).to_be_visible()
        page.emulate_media(reduced_motion='reduce')
        assert page.locator('.ew-hero .ew-scene-windows').evaluate('e => getComputedStyle(e).animationName') == 'none'
        page.emulate_media(reduced_motion='no-preference')
    case('Eight moods persist; motion preferences survive reload and respect reduced motion', visual_moods)

    def calendar_quick_add():
        tile = page.locator('[data-date="2026-09-22"]')
        tile.click()
        preview = page.get_by_role('dialog')
        expect(preview.get_by_role('heading', name='Tuesday 22 September', exact=True)).to_be_visible()
        preview.get_by_role('button', name='Outfit', exact=True).click()
        d = page.get_by_role('dialog')
        expect(d.get_by_role('tab', name='Outfits', exact=True)).to_have_attribute('aria-selected', 'true')
        d.locator('.ew-pick-look').filter(has_text='Dinner at sunset').locator('input').check()
        d.get_by_role('tab', name='Essentials', exact=True).click()
        d.locator('.ew-pick-item').filter(has_text='Camera').locator('input').check()
        d.get_by_role('button', name='Save changes', exact=True).click()
        wait_record(page, lambda w: 'camera' in w['trips'][0]['days'].get('2026-09-22', {}).get('gear', []))
        expect(page.get_by_role('dialog').get_by_role('button', name='Edit outfit Dinner at sunset')).to_be_visible()
        page.get_by_role('dialog').get_by_role('button', name='Next day', exact=True).click()
        expect(page.get_by_role('dialog').get_by_role('heading', name='Wednesday 23 September', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        assert tile.locator('.ew-snapshot-piece').count() > 0
        page.reload(wait_until='networkidle')
        assert page.locator('[data-date="2026-09-22"] .ew-snapshot-piece').count() > 0
    case('Calendar tap opens full day; focused outfit and essential adds update durable snapshots', calendar_quick_add)

    def picker_keyboard():
        page.get_by_role('button', name='Add a plan', exact=True).click()
        d = page.get_by_role('dialog')
        trigger = d.get_by_label('Activity type', exact=True)
        trigger.focus(); page.keyboard.press('ArrowDown')
        expect(page.get_by_role('listbox')).to_be_visible()
        page.keyboard.press('Escape')
        expect(trigger).to_be_focused(); expect(d).to_be_visible()
        d.get_by_label('Date', exact=True).click()
        picker = page.locator('.ew-picker-panel')
        expect(picker.locator('[data-picker-date="2026-09-20"]')).to_be_disabled()
        page.keyboard.press('ArrowRight'); page.keyboard.press('Enter')
        expect(d.get_by_label('Date', exact=True)).to_contain_text('24 Sept 2026')
        d.get_by_role('button', name='Choose start time').click()
        picker = page.locator('.ew-picker-panel')
        picker.get_by_role('listbox', name='Hour', exact=True).get_by_role('option', name='13', exact=True).click()
        picker.get_by_role('button', name=':15', exact=True).click()
        expect(d.get_by_label('Start time', exact=True)).to_have_value('13:15')
        assert page.locator('select,input[type=date],input[type=time],input[type=color]').count() == 0
        d.get_by_label('Activity', exact=True).fill('Custom picker check')
        d.get_by_role('button', name='Save changes', exact=True).click()
        wait_record(page, lambda w: any(a['title'] == 'Custom picker check' and a['time'] == '13:15' for a in w['trips'][0]['activities']))
    case('Custom pickers support bounded dates, keyboard navigation, Escape and time selection', picker_keyboard)
    context.close()

    for width in [320, 390, 600, 768, 900, 1024, 1280, 1440, 1920]:
        context, page = fresh(browser, width)
        def preview_layout():
            page.locator('[data-date="2026-09-21"]').click()
            assert page.locator('.ew-day-dialog').bounding_box()['width'] <= width
            if width in (390, 1440):
                page.screenshot(path=str(OUT / f'day-preview-{width}.png'))
            page.get_by_role('dialog').get_by_role('button', name='Plan', exact=True).click()
            page.get_by_label('Date', exact=True).click()
            bounds = page.locator('.ew-picker-panel').bounding_box()
            assert bounds['x'] >= 0 and bounds['x'] + bounds['width'] <= width
            assert bounds['y'] >= 0 and bounds['y'] + bounds['height'] <= 900
            page.keyboard.press('Escape'); page.keyboard.press('Escape'); page.keyboard.press('Escape')
        case(f'{width}px full preview and nested date picker stay within viewport', preview_layout)
        for name, key in [('Calendar', 'calendar'), ('Wardrobe', 'wardrobe'), ('Packing list', 'packing'), ('All trips', 'trips')]:
            if key != 'calendar':
                nav(page, name)
            def responsive():
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                expect(page.locator('.ew-main h1')).to_be_visible()
                assert page.locator('main button:visible').count() > 0
            case(f'{width}px {key} has no horizontal overflow', responsive)
            if width in (390, 1440):
                page.screenshot(path=str(OUT / f'{key}-{width}.png'), full_page=True)
        def editor():
            page.get_by_role('button', name='New trip', exact=True).click()
            d = page.get_by_role('dialog')
            expect(d).to_be_visible()
            assert page.evaluate("document.querySelector('dialog').getBoundingClientRect().width <= innerWidth")
            d.get_by_label('Trip name', exact=True).fill('Unsaved form')
            page.keyboard.press('Escape')
            expect(d.get_by_text('Discard your unsaved form changes?')).to_be_visible()
            d.get_by_role('button', name='Discard changes', exact=True).click()
            expect(d).not_to_be_visible()
        case(f'{width}px editor fits and protects unsaved input', editor)
        context.close()
    browser.close()

RESULTS.append({'name': 'No browser JavaScript errors', 'passed': not ERRORS, 'errors': ERRORS})
(OUT / 'results.json').write_text(json.dumps(RESULTS, indent=2))
print(f"{sum(r['passed'] for r in RESULTS)}/{len(RESULTS)} browser checks passed", flush=True)
if any(not result['passed'] for result in RESULTS):
    raise SystemExit(1)
