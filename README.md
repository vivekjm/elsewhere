# Elsewhere

The trip, all together. Calendar-first travel planning that connects each day's places and activities to what you'll wear and what you'll pack.

Built with **React 19, TypeScript, Vinext and Cloudflare Workers**. The interface uses a warm paper/olive design, responsive desktop and mobile navigation, and local SVG outfit illustrations. Existing visitor-scoped D1 workspaces and private R2 photo storage are preserved.

## Run locally

Use **Node.js 22.13 or newer** and npm.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_friendly_morlun.sql
npm run start -- --port 4173
```

Open `http://127.0.0.1:4173`. The migration command prepares local storage, not the hosted database. For hot-reloading development, use `npm run dev` after provisioning the local bindings. Keep the checked-in lockfile and framework/hosting scripts.

## What works together

**Trips and calendar.** Create, edit, duplicate and delete trips. Choose dates, destination, travellers, currency, estimated budget and luggage target. Calendar and itinerary views share the same selected day. Browser back/forward and URL hashes restore the view and selected trip. Keyboard arrows and Home/End navigate the calendar.

Each calendar day carries a snapshot of what is already planned: up to two timed plans with their category colour, the outfit for the day and how much gear to carry. Selecting a day opens a full day preview — a mini timeline, the outfit art, the carry list and any accommodation or notes — with previous/next day arrows and one-tap routes into each editor. Hovering a day reveals an add button, and an empty day offers quick starting points (coffee, museum, dinner, travel day) so adding a plan never starts from a blank form.

**Each day.** Schedule timed or all-day activities with places, reference links, notes, estimated costs and optional end times. Attach an outfit and additional clothes/equipment to an activity. Assign several outfits and essentials to the whole day, along with a title, accommodation and notes. Overlapping timed activities receive a visible warning.

**Wardrobe and outfits.** Search and filter clothing, choose a garment illustration and colour, or upload a JPEG, PNG or WebP photo. Record per-piece weights and notes. Combine pieces into reusable outfits with an occasion. Missing or inaccessible photos fall back to illustrations rather than breaking the layout.

**Custom controls, not native ones.** Every date, time, list and colour control is a project component, so the planner looks and behaves the same in every browser. Dates accept typing (`1 Nov 2026`, `01/11/2026`, `2026-11-01`) and a calendar panel; times accept typing (`14:30`, `2:30 pm`, `1430`) and quick presets with hour/minute columns; lists are keyboard-driven listboxes with search; colours are a travel palette plus a custom pick.

**Covers and motion.** Each trip picks one of eight animated mood covers — mountains, coast, city, forest, lake, desert, island or northern lights — previewed live in the trip editor. Scenes drift, ripple, twinkle and sway; the interface adds restrained entrance, hover and progress motion, and the whole layer turns itself off under `prefers-reduced-motion`. Movement is written with transform and opacity only, with the crop focus tuned per mood so a wide cover still reads well.

**Connected packing.** Daily and activity outfits plus equipment produce one deduplicated list of physical items. Reuse a jacket all week without packing seven jackets. Add manual essentials by category, quantity and per-piece weight, mark items packed, and see progress and the total known weight. Budgets and luggage targets are planning estimates, not live prices or airline allowances.

**Recovery and exports.** Destructive changes require confirmation and expose undo until the next edit. Shortening a trip cannot silently remove activities or day notes, stays, looks or gear. Moving a trip can shift its entire itinerary. Download calendar events, a packing CSV, or a printable itinerary. Backups can include the actual photo bytes and be restored in another visitor workspace.

## Data and privacy

No account or ChatGPT login is required. A random **HttpOnly, SameSite visitor cookie** identifies the workspace. D1 stores that visitor's plans; R2 stores photos under that visitor's private namespace. Sharing the site's public URL does not share your plans.

Clearing cookies or changing browsers creates a different workspace. **Export a photo-inclusive JSON backup first.** Restore checks the entire file and asks before replacing anything. Photos are uploaded into the receiving visitor's private namespace before the restored workspace is applied. Data-only backups retain private image references and do not transfer the photos.

The hosted persisted schema remains `version: 1`, with backward-compatible optional fields. Existing workspaces keep their IDs and storage. Import also supports the earlier portable HTML and React `schemaVersion: 1` / `schemaVersion: 2` backups. New portable backup envelopes use `backupVersion: 2` and support up to 24 MB. Wardrobe photo uploads remain limited to 5 MB each.

Autosaves serialize optimistic-revision writes. A failed save leaves edits in the current tab and exposes retry. A concurrent edit conflict blocks further writes rather than overwriting the newer server data; back up your edits before reloading the server version. This is **not an offline-synced account**: keep the tab open until a failed save is resolved. Accounts, shared editing, cross-device automatic sync and live weather are not included.

The Lisbon itinerary is illustrative sample data, separately copied for each new visitor. It is not a booking or destination recommendation.

## Project layout

```text
app/page.tsx                    React entry point
app/globals.css                 Framework tokens and imports
app/elsewhere.css               Scoped responsive design system
app/elsewhere-motion.css        Motion tokens, keyframes and the animated covers
components/travel/workspace.tsx Navigation, editor coordination and recovery
components/travel/screen.tsx    Shared view types, navigation and page labels
components/travel/views.tsx     Itinerary, wardrobe, packing and trips
components/travel/calendar.tsx  Month grid, day snapshots and the day preview
components/travel/editor.tsx    Accessible editing dialogs
components/travel/pickers.tsx   Date, time, list and colour pickers plus popover
components/travel/primitives.tsx Shared controls and outfit cards
components/travel/landscape.tsx Animated mood scenes (one function per mood)
components/travel/garment.tsx   Local garment illustrations and photo fallback
hooks/use-workspace.ts          Serialized loading and optimistic autosaves
lib/model.ts                    Typed domain model and validation
lib/planning.ts                 Calendar, trip date changes and duplication
lib/time.ts                     Date and time parsing for the custom pickers
lib/backup.ts                   Backup migration and private photo round-trips
lib/exports.ts                  Calendar, CSV and download helpers
app/api/                        Existing visitor-scoped workspace and photo APIs
scripts/, db/, drizzle/         Existing hosting/build and storage setup
```

## Extending it

**A new cover mood.** Add the id to `TRIP_MOODS` in `lib/model.ts`, add its label
in `components/travel/landscape.tsx` and write one scene function returning a
`Frame` with the existing sky and terrain elements. Give it a `focusY` (where the
wide cover crop should look) and reuse the `ew-` animation classes already defined
in `app/elsewhere-motion.css`; a scene built from those needs no new CSS.

**A new picker.** Every picker accepts `id`, `aria-label` and `aria-describedby`,
so it drops straight into the editor's `Field` wrapper, and `Popover` handles
placement, viewport clamping and top-layer behaviour inside modal dialogs.

**Motion.** Movement lives in `app/elsewhere-motion.css` only. Add transform and
opacity based keyframes there and reuse the `--ew-ease`, `--ew-base` and
`--ew-stagger` tokens; the reduced-motion block disables all of it automatically.

## Verification

```sh
npm run typecheck
npm run lint
node --experimental-strip-types --test tests/*.test.ts
npm run build
```

With a disposable local Worker running:

```sh
ELSEWHERE_TEST_URL=http://127.0.0.1:4173 node tests/api-smoke.mjs
python -m pip install playwright==1.57.0
python -m playwright install chromium
ELSEWHERE_TEST_URL=http://127.0.0.1:4173 python e2e/browser.py
```

GitHub Actions performs the locked install, type check, lint, domain tests, Worker build, local database setup, API checks and real-browser acceptance tests. Browser tests include reload persistence, private photo upload/restore, failed-save retry, real revision conflicts, and layouts from 320 to 1920 CSS pixels. Screenshots and results are uploaded as the `elsewhere-verification` artifact.

See [the verification notes](docs/VERIFICATION.md) for the distinction between local component checks and real Worker tests.

## Deployment

The existing Site identity and storage bindings remain in `.openai/hosting.json`. Publish the Worker and migrations through the configured Sites deployment flow. A GitHub code push is not, by itself, proof that the hosted Site has been republished.

For a wider public release, add retention/cleanup controls and traffic limits appropriate to anonymous usage. Guest workspaces intentionally do not offer account recovery or shared-trip collaboration.
