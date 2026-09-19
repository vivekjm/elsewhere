# UI restoration verification

## Verified production path — 17 September 2026

The complete `Elsewhere quality` run [35213245795](https://github.com/vivekjm/elsewhere/actions/runs/35213245795) passed against PR head `e7f02336ea56ecf80d62a08ce3a4b1ca7484a1b1`, merged with the then-current main for testing. It used the repository's locked application dependencies, not a substitute app or storage implementation.

| Check | Result |
| --- | --- |
| `npm ci` | Passed |
| Repository TypeScript check | Passed |
| ESLint | Passed; the two image-directive warnings were subsequently cleaned up |
| Original and new domain regressions | **93 / 93 passed** |
| Production Vinext / Cloudflare Worker build | Passed |
| Disposable local D1 migration and Worker startup | Passed |
| API workspace isolation, durable saves, revision conflicts, invalid data, CSRF and image ownership | Passed |
| Chromium application workflows and responsive checks | **53 / 53 passed** |

The browser suite covers seven real application workflows, 36 layout checks across four views at nine widths, nine dialog-layout/unsaved-input checks, and a no-JavaScript-page-errors check. Widths: **320, 390, 600, 768, 900, 1024, 1280, 1440 and 1920 px**.

The real workflows verify:

- Daily details, multiple outfits and gear surviving reload.
- Activity creation, rescheduling and deletion undo backed by server writes.
- Private image upload, outfit creation and connected packing surviving reload.
- Photo-inclusive backup restoration into an independent guest browser, with original-owner images remaining inaccessible to that new guest.
- New trips and selected-trip deep links surviving reload.
- A deliberately failed save preserving in-tab edits and a subsequent retry writing them to the actual database.
- A real optimistic-revision conflict not overwriting a concurrent server edit.

Browser screenshots at 390 and 1440 px were downloaded and visually reviewed. Results and screenshots are saved in the run's `elsewhere-verification` artifact with a seven-day retention period. Later commits rerun the full workflow; consult their check results rather than assuming this historical run covers future changes.

### Test environment boundaries

The acceptance suite uses the built Worker with Wrangler's **local D1 and R2 implementations**, isolated guest browser contexts and actual HTTP requests. It does not modify the hosted database or verify a production deployment. One request is deliberately intercepted with HTTP 503 to test failure recovery; after interception is removed, the test checks a successful real database write and reload.

Chromium viewport coverage is not a claim of testing physical phones, Safari, Firefox, every assistive technology, or every possible user dataset. Printing and CSV/calendar export also have local interface/domain coverage, but have not been imported into every external calendar or spreadsheet application.

## Additional local checks

Before the connected CI run, the interface was compiled with the actual **React 19.2.6 runtime and React 19 type definitions** from the repository's locked install. A strict local TypeScript check and **86 new domain checks** passed.

A separate local interface suite completed **64 checks**: 18 functional flows, 36 layout checks, nine dialog checks and a no-JavaScript-errors check. These used an explicitly isolated mock transport because the execution container blocks HTTP browser navigation. Those local checks alone were not treated as evidence of D1 persistence; the real Worker checks above supplied that evidence.

## Reproduction

Follow README's build and local-storage setup, start the application at `http://127.0.0.1:4173`, then run:

```bash
npm run typecheck
npm run lint
npm test
TRIPS_LOOM_TEST_URL=http://127.0.0.1:4173 npm run test:api
python3 -m pip install playwright==1.57.0
python3 -m playwright install chromium
TRIPS_LOOM_TEST_URL=http://127.0.0.1:4173 npm run test:e2e
```

Linux machines without browser libraries may need `python3 -m playwright install --with-deps chromium`. Run the write tests only against a disposable local instance. CI provisions that instance automatically.

## Scope

This remains a private visitor-cookie workspace, not an account-based collaboration service. Failed-save edits are retained in the open tab, not guaranteed across a forced browser close. Photo-inclusive JSON backups are the explicit portable recovery mechanism. No offline-sync or live-weather service is claimed.

The existing hosting identity, API routes, D1 schema and private R2 ownership model were retained. No production database migration or publish operation was performed as part of this source restoration.
