# Trips Loom product audit — 26 September 2026

This sweep covers the current **native SwiftUI iOS app**, its shared Cloudflare workspace API, and the connected Trips Loom Supabase project. The older Expo app is a separate implementation. This is a substantial implementation and verification pass, not a claim that every defect or worldwide launch requirement has been eliminated.

Release state: changes are local and uncommitted. The additive Supabase preferences/feedback migration was applied and its access policies checked. The new Cloudflare routes have been tested locally but are **not deployed**. No signed archive, TestFlight upload or App Store submission was made.

## Changes implemented

| Area | Problem found | Result |
| --- | --- | --- |
| First use | New users inherited demonstration trips; a sample banner could appear on real trips | Fresh stores contain no trips or wardrobe items. The legacy notice requires an actual sample record. Existing user trips are retained. |
| Onboarding | No useful editable travel preferences | Skippable travel preferences cover pace, dietary preferences and budget style; those preferences influence drafts and can be edited from Profile. Native preferences sync to the account. |
| Trip creation | Creating a new trip could crash in the hero badge builder | Replaced the unstable stored builder with explicitly initialized view content. City and trek creation pass simulator flows. |
| Local storage | Failed saves were silent; a read error could look like a new workspace | Visible storage errors, recovery copies for malformed saves, preserved in-memory edits, and blocked overwrites when an existing file cannot be read. |
| Authentication | Concurrent refreshes consumed the same rotating token; late logout could clear a new session | Coalesced refreshes, account-generation checks and immediate local sign-out. A rate-limited refresh keeps the session available for retry. Credentials remain in Keychain. |
| Sync | Native-detail/preference failures could be reported as saved; unchanged workspace revisions hid native edits | Failures retain pending edits, successful uploads acknowledge actual content, and native extras merge independently of the web revision. |
| Trip conflicts | Simultaneous edits could silently overwrite a trip | Conflicting trip versions preserve the remote trip and recover local edits in another trip, with a notice. |
| Photo uploads | Deleting a trip during an upload could crash or resurrect it | Completion checks the current record identity instead of assuming an array index still exists. |
| International dates | Phone time zone/DST could shift itinerary days | Destination time zone and Gregorian civil-day keys persist across sync, invitation and export; day labels, activities, reminders and weather use those days. |
| Money | Local decimal input and currency rounding were inconsistent | Strict locale-aware parsing, correct zero/three-decimal currencies and rounding carry, visible small split balances, and 162 accepted web currency codes. The expanded validator still needs production deployment. |
| Calendar export | Inclusive end dates and long Unicode lines produced invalid calendar files | RFC-compatible exclusive all-day end, UTC event times, escaping and UTF-8 folding; calendar export uses the system share sheet. |
| Data controls | No native versioned export/restore or account-deletion entry point | Profile → Data & privacy includes bounded, validated export/restore and deletion for signed-in users. Version 2 bundles include local trip covers, wardrobe photos and saved documents. Credentials and purchase entitlements are excluded. JSON is not password encrypted; users are told to keep exports private. |
| Account deletion | Missing server route; old requests could recreate a deleted workspace | Verified account identity, origin guard, server-secret preflight, payload-free D1 deletion marker, paginated owner-scoped R2 cleanup and identity deletion last. Partial cleanup remains retryable. Late revisioned writes and new uploads are rejected. |
| Request size | Limits were checked after buffering the entire request | Workspace JSON and photo multipart input enforce byte limits while reading, including requests without Content-Length. Invalid multipart data receives a client error. |
| Privacy | Private health logs were included in cloud extras and invitations | New writes/invitations exclude health logs. Existing local health records survive invitation updates. Older cloud copies are removed when the affected trip is saved; no bulk deletion of unrelated production data was performed. |
| Untrusted imports | Compressed invitations could expand without a bound; restore accepted malformed records | Bounded decompression/file size, duplicate/date/amount/reference validation and restore confirmation before replacing data. Account identity and verified purchase state are preserved on restore. |
| Support | No feedback flow | Help & feedback submits a signed-in user's message, version and locale to owner-protected Supabase rows; success appears only after server acknowledgement. No test message was sent to the real production support table. |
| Purchases | Hardcoded prices and trial promises; unavailable products still looked purchasable | StoreKit prices and trial eligibility, disabled unavailable checkout with retry, restore, and Terms/privacy links. Verified local purchase/refund updates remove expired/refunded Pro access. |
| Reminders | Repeating check-ins could outlive the trip or exceed notification capacity | Destination-local check-ins stop with the trip, share a bounded capacity and refresh when the app opens. |
| Safety claims | Fake signal/SOS wording and unsupported altitude/summit assurances | Actual network state, configured emergency number with confirmation, honest satellite handoff, non-diagnostic altitude copy and “lower-wind outlook” wording. Calculated tides remain labelled as illustrative. |
| Accessibility | Font scaling stopped at a small cap; large text broke the Home header/actions | Uncapped role-aware Dynamic Type, adaptive Home layout and native menu, persistent onboarding Done, reachable main action, native trip-kind buttons, and Reduce Transparency/contrast fallbacks. |
| Copy and metrics | Clipped decorative greeting; trip-duration total labelled “Days away” | Removed the clipped greeting; the total is labelled “Trip days.” |
| English release | Strings were scattered without a translation catalog | English source catalog and a repeatable compiler-key collection script. Additional languages are not advertised as supported. |

## Verification

Test accounts, fault injection and destructive deletion tests used isolated **local** backends. UI tests used unique local store files on the “Trips Loom Product QA” simulator. The original iPhone 17 Pro store was backed up before installation; its three existing trip IDs were checked after updating the app.

| Check | Evidence and scope |
| --- | --- |
| Native unit/integration | The initial audit passed 32 tests. The follow-up power-user sweep adds photo/document recovery, wardrobe conflict, input overflow and booking-import regressions; see the current [power-user report](power-user/POWER_USER_QA.md) for final counts. |
| Simulator UI | 5 flows: onboarding/profile/help; trek creation without samples; city creation/activity/packing; immediate draft close; largest accessibility text size with a reachable New trip action. |
| Web tests | 109 tests, including account cleanup ordering/isolation, deletion-marker SQL and streaming request bounds. |
| Real local Worker smoke | Guest isolation, valid saves, stale-revision conflict, invalid input, origin guards, photo upload and ownership. Separate authenticated mock-Auth test covers deletion failure/retry, blocked stale writes/uploads, account isolation and oversized/malformed requests. |
| Build checks | Web typecheck, lint and production bundle; unsigned native Release build for generic iOS. Signing and distribution were not tested. |
| Supabase | Preferences column and feedback table applied to `vofbzrydjbappwuhgcik`; RLS enabled on profiles, trip extras and feedback; owner policies and restricted grants checked. Anonymous feedback access rejected. No real user account was deleted. |
| Production read-only checks | Auth configuration responds. `/privacy` and the new `/api/account` route were absent on the live deployment at the time checked. |

Selected simulator evidence uses synthetic QA data:

- [Fresh empty Home](evidence/empty-home.png)
- [Created trek](evidence/new-trek.png)
- [Saved city activity](evidence/city-activity.png)
- [Packing](evidence/packing.png)
- [Data controls](evidence/data-privacy.png)
- [Support](evidence/help.png)
- [Largest text Home](evidence/large-text-home.png)

Full run logs and XCTest result bundles are under `/tmp/tripsloom-product-audit/` on this machine. They are local evidence, not permanent CI artifacts. Source tests live in `ios/TripsLoomTests`, `ios/TripsLoomUITests` and `tests/`.

## Requirements before a paid public release

| Priority | Outstanding requirement | Concrete next step |
| --- | --- | --- |
| Launch | Deploy the matching backend | Resolve the real Cloudflare D1/R2 bindings and account authentication. The generated local config contains placeholder resource IDs and Wrangler is not logged in. Deploy the currency validator, bounded APIs, public privacy page and account route together; verify with a disposable signed-in staging account. |
| Launch | Configure deletion securely | Set `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` as a server-only Worker secret. Verify actual Supabase identity deletion, cascading rows and R2 cleanup in staging, including retries. No admin key belongs in the iOS bundle or public auth configuration. |
| Launch | Real App Store commerce and signed builds | Create/verify the monthly and yearly product IDs, agreements, signing capabilities and store availability. Test purchases, restore, refunds, cancellation and grace period with Apple Sandbox/TestFlight on a physical device. Local StoreKit tests do not establish real billing readiness. |
| Launch | Working public privacy/support details | Publish and review the privacy page against the actual operating entity and retention practices. Configure a monitored support channel. `support@tripsloom.com` is a proposed address; a working mailbox was not verified and no MX answer was found during this sweep. |
| Launch | Commercial weather service | The current app calls Open-Meteo's free endpoints. Its free API is restricted to noncommercial apps; subscriptions make this app commercial. Select a permitted service/plan and keep any paid API key on the server before monetizing. [Provider terms](https://open-meteo.com/en/terms). |
| Launch | Production authentication | Enable leaked-password protection (the live security advisor still flags it as disabled). Verify email delivery, confirmation/reset redirects, Apple provider and signed-device entitlement against the live project. [Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). |
| Launch | Store disclosures and release review | Check App Store privacy responses against the included privacy manifest, permissions and actual data flows; supply support/privacy URLs and accurate screenshots. Account-creating apps need a working deletion flow. [Apple deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [review guidelines](https://developer.apple.com/app-store/review/guidelines/). |
| High | More device and accessibility coverage | Physical-device checks for document scanning, Face ID, notifications, background/foreground sync and Live Activities; full VoiceOver/Switch Control, long names, all trip types, small screens, iPad and right-to-left layouts. Large-text onboarding/Home checks are not a full accessibility certification. |
| High | Recoverability and operations | End-to-end account backup/restore drill, cleanup retries for interrupted cross-service deletion, release rollback, privacy-safe crash/support monitoring, and an owned support-response process. D1/R2/Supabase cleanup is not one atomic transaction. |

The privacy manifest and English/date/currency foundations do not establish legal compliance in every jurisdiction or coverage of every language. The current native target requires iOS 26; Android/older iOS support is a separate product/release decision.

## Remaining product and engineering gaps

These are concrete next increments; the current UI must continue describing partial features honestly.

| Priority | Gap | User/business value and acceptance target |
| --- | --- | --- |
| High | True shared-trip collaboration | Invitations currently distribute copies and require re-sharing. Add server-backed invitations, membership/roles, revocation and conflict handling before claiming live collaboration. Two separate accounts must see authorised edits and lose access when removed. |
| High | Protected cloud document recovery | Local asset-inclusive backups now exist. Documents are not automatically uploaded by workspace sync. Add an encrypted account document service and verify recovery before promising automatic passport/ticket cloud backup. |
| High | Support delivery | A per-account five-per-hour feedback limit now exists and was transaction-tested in Supabase. A staffed queue and response mechanism still need operational verification before promising response times. |
| Medium | Booking/flight integrations | Text/scanned booking import works locally. Email forwarding, live flight changes and partner bookings are not connected. Add a real provider contract and webhook/retry handling before displaying live status or accepting bookings. |
| Medium | Localization completion | Compiler-extracted English keys provide a baseline; custom components and interpolated copy still need a localization pass, pluralization, pseudo-localization, translator review and RTL tests before adding languages. [Apple localization guidance](https://developer.apple.com/documentation/xcode/supporting-multiple-languages-in-your-app). |
| Medium | Measured performance and reliability | Add repeatable startup/scroll/memory baselines, large-account and poor-network tests, privacy-safe production diagnostics and CI retention for native UI results. This sweep did not establish crash-free or latency targets. |
| Medium | Adventure-provider guarantees | Route snapshots and forecast data are helpful planning tools; they do not provide guaranteed offline navigation, authoritative tide forecasts, satellite communication or medical assessment. Validate provider data and physical-device flows before expanding those claims. |

## Reproduce the checks

Use Node 22 or later. From the repository root:

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Start the native local backend in a separate terminal:

```sh
./ios/scripts/e2e/run.sh
```

Use a dedicated QA simulator; never erase the user's simulator or run the destructive test backend against production:

```sh
xcodebuild test -project ios/TripsLoom.xcodeproj -scheme TripsLoom \
  -destination 'platform=iOS Simulator,name=Trips Loom Product QA' \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO

xcodebuild build -project ios/TripsLoom.xcodeproj -scheme TripsLoom \
  -configuration Release -destination generic/platform=iOS CODE_SIGNING_ALLOWED=NO
```

After compiling, refresh the English source catalog with `python3 ios/scripts/update-localizations.py <DerivedData>`. This does not generate translations or touch user content.

`tests/account-api-smoke.mjs` starts mock Auth on `127.0.0.1:8790` and only permits a local target. Run a built Worker on port 8789 with **local** D1/R2 persistence, `SUPABASE_URL=http://127.0.0.1:8790`, `SUPABASE_PUBLISHABLE_KEY=sb_publishable_test` and `SUPABASE_SERVICE_ROLE_KEY=test-only-service-secret`; create the normal `workspaces` table in that local database. Then run `TRIPS_LOOM_TEST_URL=http://127.0.0.1:8789 node tests/account-api-smoke.mjs`. Those values are mock fixtures and must never be used for production.
