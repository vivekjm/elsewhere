# Trips Loom native iOS power-user QA

Date: 26 September 2026. Target: native SwiftUI Nightglass app, iOS 26.1 Simulator. This report distinguishes local product verification from production release readiness.

The traveller workspace is synthetic. It was populated through the app's controls and native photo/file/share pickers on **Trips Loom Product QA**, iPhone 16e. Photos come from the repository's travel illustrations. No private passport, payment card or real booking was used. The user's original iPhone 17 Pro workspace was kept separate.

## Scenarios and evidence

Final run results are being recorded below as each scenario completes. A screenshot alone is not a passed end-to-end scenario.

| Scenario | Actions exercised | Evidence |
| --- | --- | --- |
| City trip | Paris plans, four wardrobe pieces, system photo import, generated capsule/outfits, packing, companions, three expenses, daily budget, saved photo document, app restart | [Plans](evidence/02-city-plans.png), [capsule](evidence/05-generated-capsule-outfits.png), [budget](evidence/08-budget-daily.png), [document](evidence/09-offline-documents-with-photo.png) |
| Adventure trips | Trek, climb, camping; route stages, distances/ascent/sleeping altitude, summit validation, gear, permits, check-in contact, altitude log and emergency confirmation | [Summit](evidence/20-climb-summit.png), [altitude check-in](evidence/24-altitude-check-in.png), [emergency confirmation](evidence/25-emergency-confirmation.png) |
| Road and coast | Road stages/stops and beach dive log | Final evidence pending rerun |
| Personalisation | Name/home base, Imperial units, Vegetarian food and Relaxed pace, persistence after restart | [Preferences](evidence/52-personalised-units-diet-and-pace.png), [restart](evidence/53-preferences-persist-after-relaunch.png) |
| Guide and insurance | Independently arranged guide details/rate/contact and policy notes; permit paid state | [Preparation](evidence/50-guide-permits-and-insurance.png) |
| Offline map failure | Attempted snapshot with non-geocodable stage names; actionable failure appears and no false saved state | [Failure state](evidence/51-map-save-result.png) |
| Search/discovery | Search saved activities across trips, open matching trip, browse city inspiration | [Search](evidence/30-search-across-trips.png), [discovery](evidence/31-discover-city-ideas.png) |
| Account and feedback | Invalid/valid synthetic email login, sync acknowledgement and local support submission | Final results pending rerun |
| Numeric limits | Long title, negative and overflowing weights/cost, valid decimal cost/distance, edit garment weight | [Photo card bounds](evidence/41-wardrobe-photo-grid-stays-in-bounds.png); remaining evidence pending |
| Native sharing | Custom cover photo, calendar file, trip invitation copy, shared expense settlement and StoreKit paywall | Final results pending rerun |
| Booking import | Scanner dismissal, paste fictional flight, repeated paste deduplication and editable ticket | Final results pending rerun |
| Portable recovery | Export asset-inclusive bundle; reject malformed file; restore on separate clean QA simulator; open restored garment/document | Pending second-device drill |

## Defects fixed before or during the scenarios

| Finding | Change and verification |
| --- | --- |
| Uploaded garment photo expanded its grid card | Constrained image overlay and adaptive card layout. [Before](evidence/04-wardrobe-photo-before-fix.png), [after](evidence/41-wardrobe-photo-grid-stays-in-bounds.png). |
| Photo-free garment cards were blank blocks | Added category SF Symbols with contrast appropriate to the garment colour; uploaded photos retain their full card area. |
| No way to edit an existing wardrobe piece | Added editing with title/weight limits and updates to linked packing items. |
| Huge numeric input could trap converting Double to Int | Checked conversion; invalid/overflowing text stays visibly invalid and cannot save. Cost, stage, altitude, gear and packing bounds are enforced. |
| Photos/documents omitted by backup | Version 2 bundles include locally available trip covers, garment photos and saved documents, with byte/count/reference validation and staged restore rollback. Exports omit credentials and verified purchase state. |
| Malformed/oversized documents could enter storage | Image/PDF content validation, bounded decode/import, atomic index writes and visible errors. |
| Concurrent garment edits could overwrite local work | Recover the local garment/photo and remap its outfit/capsule/packing references while preserving the remote version. |
| Repeated pasted bookings duplicated preview/trip plans | Deduplicate by booking content rather than generated UUID; use destination civil day for printed booking dates; bound clipboard size. |
| Small sheets hid dive/reset controls | Expanded dive/password sheets; feedback has an explicit keyboard Done control. |
| Gear weight legend clipped | Adaptive column layout replaces the overcrowded horizontal legend. |
| Map failure looked like a successful offline save | Save state changes only after a snapshot is written; failure keeps existing snapshot and shows an explanation. |
| Guide/insurance UI implied a real booking | User-entered records explicitly describe arrangements made independently. |
| Recap labelled estimates as spent | Label now says “planned.” |
| Weak/inconsistent create/reset password UI | Minimum eight characters in both forms; backend policy failures remain visible. |
| Feedback had no submission quota | Applied owner-enforced five-per-hour Supabase trigger; accepted/rejected requests verified in a rolled-back transaction. No real support message was inserted. |

## Regression verification

The initial follow-up run passed **39 native unit/integration tests, zero skips**: 22 product cases, 10 backend concurrency/fault cases, six power-user cases and one StoreKit purchase/refund test. A subsequent category-symbol check and final build/run will be recorded here.

Covered service edge cases include locale decimals, currency precision, DST/destination date boundaries, notification capacity/end dates, bounded invitation decompression, exclusion of private health data, invalid backup references/assets, failed restore preserving existing data/documents, concurrent token rotation/logout, stale workspace/garment edits, partial native-extra failures, photo deletion during upload and private-photo URL ownership.

The large-workspace serialization benchmark uses 500 trips, 5,000 plans and 500 wardrobe items. This measures backup serialization, not UI startup, scrolling or a production latency target.

## Boundaries and outstanding release gates

- Local app changes have not been shipped to TestFlight or the App Store. The separate Cloudflare account/privacy fixes remain a deployment requirement described in [the product audit](../PRODUCT_AUDIT.md).
- Account email delivery, Apple sign-in, actual purchases/refunds, physical document scanning, Face ID, notifications/Live Activities and device-only emergency/satellite behavior still require signed-device/provider testing.
- The local Auth/support harness acknowledges synthetic requests. This does not prove a staffed production support inbox or real confirmation/reset email delivery.
- No emergency call or invitation message was sent to another person. Native share sheets were opened/dismissed or copied locally.
- Route snapshots are not guaranteed offline navigation. Non-geocodable route names were deliberately tested as a failure case. Tides come from Open-Meteo Marine sea-level data where the model covers the date (about two weeks ahead); beyond that the app shows a labelled lunar estimate. Commercial licensing for Open-Meteo weather and marine data still needs resolution before monetisation.
- Invitations share copies; they do not establish real-time multi-user collaboration.
- Asset exports contain local photos/documents and are **not password encrypted**. Uncached remote-only photos are outside the local bundle; documents are not automatically cloud-synced.
- English-first catalogues and date/currency foundations are present. This exercise is not a worldwide accessibility, legal or localization certification.

## Reproduction and retained evidence

Source scenarios are in `ios/TripsLoomUITests/PowerUser*Tests.swift`; service regressions are in `ios/TripsLoomTests`. Use dedicated simulators. Preserve the populated store ID `B6D8F18B-EA54-4CFD-94AD-B8C568219925` to inspect this workspace.

Run power-user UI scenarios against the local harness on port 8787. Run destructive/fault-injection unit tests against a **separate** harness on port 8788. Never reset the power-user harness while a signed-in UI scenario is using it. XCTest screenshots are retained here; detailed local logs/results are under `/tmp/tripsloom-power-user`.
