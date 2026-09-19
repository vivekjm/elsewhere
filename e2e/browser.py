"""Real-browser acceptance tests against a running Trips Loom Worker.

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

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('TRIPS_LOOM_TEST_URL', os.environ.get('ELSEWHERE_TEST_URL', 'http://127.0.0.1:4173')).rstrip('/')
OUT = Path(os.environ.get('TRIPS_LOOM_E2E_OUTPUT', os.environ.get('ELSEWHERE_E2E_OUTPUT', 'test-results/browser')))
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


def set_date(field, value):
    """Type an ISO date into a custom date picker and commit it."""
    field.fill(value)
    field.press('Enter')
    expect(field).to_have_value(re.compile(r'\d{1,2} \w{3} \d{4}'))


def pick_date(page, value):
    """Choose a date straight from the open calendar popover."""
    page.locator(f'.ew-day-cell[data-date="{value}"]').click()
    page.wait_for_selector('.ew-calendar-popover', state='detached')


def set_time(field, value):
    """Type 24-hour time into a custom time picker and commit it."""
    field.fill(value)
    field.press('Enter')
    expect(field).to_have_value(re.compile(r'^\d{2}:\d{2}$'))


def choose(page, label, option):
    """Choose from a custom listbox picker: trigger button, then option."""
    page.get_by_role('button', name=label, exact=True).click()
    page.get_by_role('option', name=option, exact=True).click()
    page.wait_for_selector('.ew-select-panel', state='detached')


def wait_record(page, expression):
    deadline = time.monotonic() + 12
    while time.monotonic() < deadline:
        data = stored(page)
        if expression(data['workspace']):
            saved(page)
            return data
        page.wait_for_timeout(150)
    raise AssertionError('Expected data was not persisted before timeout')


with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    context, page = fresh(browser)

    def day_and_reload():
        page.get_by_role('button', name='Edit day details', exact=True).click()
        d = page.get_by_role('dialog')
        d.get_by_label('Day title', exact=True).fill('Markets and sunset')
        d.get_by_label('Accommodation', exact=True).fill('River guesthouse')
        d.locator('.ew-pick-look').filter(has_text='Dinner at sunset').locator('input').check()
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
        set_time(d.get_by_role('combobox', name='Start time', exact=True), '11:00')
        set_time(d.get_by_role('combobox', name='End time (optional)', exact=True), '12:30')
        d.get_by_label('Place', exact=True).fill('City museum')
        d.get_by_label('Estimated cost (EUR)', exact=True).fill('19.50')
        d.get_by_label('Reference link (optional)', exact=True).fill('https://example.com/reservation')
        choose(page, 'Outfit for this activity', 'A breezy afternoon')
        d.get_by_role('button', name='Save changes', exact=True).click()
        wait_record(page, lambda w: any(a['title'] == 'Museum reservation' for a in w['trips'][0]['activities']))
        page.get_by_role('button', name='Edit Museum reservation', exact=True).click()
        d = page.get_by_role('dialog')
        date_field = d.get_by_label('Date', exact=True)
        date_field.click()
        pick_date(page, '2026-09-24')
        expect(date_field).to_have_value('24 Sep 2026')
        d.get_by_role('button', name='Save changes', exact=True).click()
        data = wait_record(page, lambda w: any(a['title'] == 'Museum reservation' and a['date'] == '2026-09-24' for a in w['trips'][0]['activities']))
        a = next(a for a in data['workspace']['trips'][0]['activities'] if a['title'] == 'Museum reservation')
        assert a['cost'] == 19.5 and a['endTime'] == '12:30' and a['outfitId'] == 'coast'
        assert a['category'] == 'Explore'
        expect(page.get_by_role('complementary', name='Selected day')).to_contain_text('Thursday 24 Sept')
        page.get_by_role('button', name='Delete Museum reservation', exact=True).click()
        page.get_by_role('dialog').get_by_role('button', name='Delete', exact=True).click()
        page.get_by_role('button', name='Undo last deletion').click()
        wait_record(page, lambda w: any(a['title'] == 'Museum reservation' for a in w['trips'][0]['activities']))
    case('Activity creation, rescheduling and deletion undo use durable server writes', activity_and_undo)

    def photo_outfit_packing():
        nav(page, 'Wardrobe')
        page.get_by_role('button', name='Add a piece', exact=True).click()
        d = page.get_by_role('dialog')
        d.get_by_label('Item name', exact=True).fill('Photo jacket')
        choose(page, 'Category', 'Layers')
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
        assert data['format'] == 'tripsloom-backup' and len(data['photos']) == 1
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
        set_date(d.get_by_label('Departure', exact=True), '2026-11-01')
        set_date(d.get_by_label('Return', exact=True), '2026-11-07')
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

    for width in [320, 390, 600, 768, 900, 1024, 1280, 1440, 1920]:
        context, page = fresh(browser, width)
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
            expect(d).not_to_be_visible()
        case(f'{width}px editor fits and dismisses directly', editor)
        context.close()

    for width in (1024, 1440):
        context, page = fresh(browser, width)

        def cover_and_day_cells():
            box = page.evaluate(
                """() => {
                  const svg = document.querySelector('.ew-hero-landscape .landscape');
                  const hero = document.querySelector('.ew-hero').getBoundingClientRect();
                  const drawn = svg.querySelector('path').getBoundingClientRect();
                  const cell = document.querySelector('td.ew-in-trip');
                  const add = cell.querySelector('.ew-cell-add').getBoundingClientRect();
                  const chip = cell.querySelector('.ew-event-chip em');
                  const cellBox = cell.getBoundingClientRect();
                  return {
                    scale: svg.getAttribute('preserveAspectRatio'),
                    slice: svg.preserveAspectRatio.baseVal.meetOrSlice,
                    coversHeader: drawn.width >= hero.width - 1,
                    addHeight: add.height,
                    cellHeight: cellBox.height,
                    chipSpills: chip
                      ? chip.getBoundingClientRect().right > cellBox.right + 1
                      : false,
                  };
                }"""
            )
            assert box['scale'].endswith('slice'), box
            assert box['slice'] == 2, box
            assert box['coversHeader'], box
            assert box['addHeight'] <= 32 and box['addHeight'] * 2 < box['cellHeight'], box
            assert not box['chipSpills'], box

        case(f'{width}px trip cover fills the header and day cells stay readable', cover_and_day_cells)
        context.close()
    browser.close()

RESULTS.append({'name': 'No browser JavaScript errors', 'passed': not ERRORS, 'errors': ERRORS})
(OUT / 'results.json').write_text(json.dumps(RESULTS, indent=2))
print(f"{sum(r['passed'] for r in RESULTS)}/{len(RESULTS)} browser checks passed", flush=True)
if any(not result['passed'] for result in RESULTS):
    raise SystemExit(1)
