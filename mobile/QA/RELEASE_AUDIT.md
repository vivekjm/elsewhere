# Trips Loom mobile — production release audit

Started 2026-10-13. Scope: the Expo SDK 57 app in `mobile/` (React Native, Loom design). Each item is ✅ done and verified, 🔧 in progress, or ⬜ to do.

## Findings at the start of the audit

| # | Area | Finding | Severity |
| --- | --- | --- | --- |
| F1 | Data | Every screen renders hard-coded sample data (Kyoto, Mia, Theo, Kilimanjaro). Nothing reads or writes the user's workspace. | Blocker |
| F2 | Auth | Welcome buttons skip straight to onboarding. No sign-in, sign-up, password reset, Apple or Google sign-in is wired. "Look around" re-introduces guest mode, which was removed on request. | Blocker |
| F3 | Onboarding | Answers are not saved to the profile. | Blocker |
| F4 | Model | The mobile copy of the workspace validator lacks the server's full ISO currency list; a trip in e.g. CHF from the web would fail validation on the phone. | Blocker |
| F5 | Data | Features beyond the web workspace (expenses, people, votes, documents, trip kind, adventure, dives, rating) have no storage. Backend table `trip_extras` exists for exactly this. | Blocker |
| F6 | Services | Weather, currency rates, places search, tides and summit forecast show fixed text. | Major |
| F7 | Planner | "Plan with AI" returns a fixed draft. | Major |
| F8 | Import | "Import bookings" shows fixed results; no parser. | Major |
| F9 | Sharing | Invites, settle-up and votes have no mechanism. | Major |
| F10 | Pro | Paywall buttons do nothing; no StoreKit, no entitlement limits. | Major |
| F11 | Widgets | No home-screen widgets, Lock Screen widgets or Live Activities on iOS; no Android widgets. | Major (requested) |
| F12 | Fields | Date, time, currency and number fields are free text; no pickers or validation. | Major |
| F13 | Settings | Toggles (notifications, Face ID, location, calendar) change nothing. Delete account and export do nothing. | Major |
| F14 | Release | App icon, splash and Android adaptive icon still use the old Coast design; `userInterfaceStyle: automatic` with a light-only UI; no error boundary; no privacy manifest entries reviewed. | Major |
| F15 | Accessibility | Fixed in the testing round: Dynamic Type caps, growing rows. Remaining: VoiceOver labels on icon-only controls in rows, reduced motion. | Minor |

## Plan

1. ✅ Model parity with the server (currencies).
2. ✅ Data layer: Supabase auth (email, Apple, Google), workspace sync, `trip_extras` sync, profile `native_preferences`, feedback, account deletion.
3. ✅ Gate: signed out → Welcome; signed in without onboarding → onboarding; otherwise the app. No guest mode.
4. ✅ Every screen on real data, with empty, loading, offline and error states.
5. ✅ Real pickers and validation on every form.
6. ✅ Services: Open-Meteo weather/climate, geocoding, tides, summit forecast; open.er-api currency rates.
7. ✅ Trip drafter (template engine; on-device model where available).
8. ✅ Booking text parser and `.ics`/PDF/backup export.
9. ✅ Trip invites (link and file) for shared costs and votes.
10. ✅ Pro: StoreKit subscriptions via `expo-iap`, free limits (3 drafts a month, 3 documents a trip).
11. ✅ Notifications: trip reminders, altitude check-in reminders.
12. ✅ iOS widgets (home + Lock Screen) and a Live Activity for the trip day, via `expo-widgets`; Android home-screen widget via `react-native-android-widget`.
13. ✅ Release config: icons, splash, light-only UI, error boundary, permissions copy, privacy manifest, EAS profiles, version/build numbers.
14. 🔧 Verification on the simulator: every flow, empty account, offline, large text, small screen.

## What changed (2026-10-13)

- **Data.** Every screen reads and writes the signed-in workspace and `trip_extras`. The sample data is gone. Empty, loading and offline states exist on each screen.
- **Auth.** Apple, Google and email sign-in, sign-up and password reset. No guest mode. Onboarding answers save to the profile.
- **Treks.** Overview, Prepare, Climb, Gear, Safety, check-ins and the route run on `extras.adventure`, with sheets to add stages, gear and safety details.
- **Widgets.** iOS "Next trip" widget in small, medium and large sizes and three Lock Screen sizes. It uses a timeline, so it moves on at midnight and after each plan without the app running. Android has the same widget through `react-native-android-widget`.
- **Live Activity.** On a trip day, the Lock Screen and Dynamic Island show the next plan with a live countdown. On a trek day they show the stage, climb and sleeping altitude. It can be turned off in Profile.
- **Links.** Widget and Live Activity taps open the right trip. Reminder taps open their screen. `tripsloom://join` opens the invite sheet, and unknown paths go Home.
- **On-device AI.** A local Expo module uses Apple Foundation Models on iOS 26 or later. It falls back to the template drafter everywhere else.
- **Release config.** New Loom icon, adaptive icon, splash and widget preview. Light-only UI, camera, photo and Face ID strings, a privacy manifest, the App Group and the Sign in with Apple entitlement.

## Needs the account owner before submission

- Create the subscriptions `com.tripsloom.pro.yearly` and `com.tripsloom.pro.monthly` in App Store Connect and Play Console.
- Make sure the App Group `group.com.tripsloom.ios` and the widget bundle id `com.tripsloom.ios.widgets` exist in the Apple Developer account; the native app used both. EAS can create anything missing on the first build.
- Enable the Apple and Google providers in Supabase with the production client ids and redirects `tripsloom://auth/callback` and `tripsloom://auth/reset`.
- Set the App Store privacy answers to match the manifest: email, name, photos, user content, user id and purchases, all linked to the user and none used for tracking.

## Verification on the iPhone 17 Pro simulator (2026-10-13)

Run with the development-only local preview (`DEV_PREVIEW` in `src/devStart.ts`), which opens the signed-in app on a workspace that stays on the device. Sign-in itself was not exercised against production.

| Flow | Result |
| --- | --- |
| Welcome: Apple, Google, email; no guest option | ✅ |
| Empty account Home | ✅ |
| Plan with AI → draft → save (trek) | ✅ after fixing the destination parser |
| Trek: overview, stages, Prepare and readiness, Climb forecast, Gear, summit and safety sheet | ✅ |
| New trip with live place search and weather | ✅ |
| Itinerary: add a timed plan | ✅ |
| Live Activity on the Lock Screen and in the Dynamic Island, live countdown | ✅ |
| Home-screen widget, small, medium and large, with live data | ✅ |
| Widget tap opens the trip | ✅ |
| Join sheet rejects a bad invite clearly | ✅ |
| Profile with the Live Activity switch | ✅ |
| Release JavaScript bundles for iOS and Android | ✅ |
| Android native debug build | ✅ (no emulator available to run it) |

### Bugs found and fixed in this pass

- Expo Router treated `src/app` as the routes folder; moved it to `src/core`.
- Every list row with art (`MediaRow`) could render as a tall blank card; the art is now pinned to the row edge.
- "Six days in the Dolomites" produced no destination; the parser now accepts "in the …".
- Bar charts warned about duplicate keys on repeated weekdays.
- Sunrise was blank beyond the 16-day forecast; it is now computed from the sun's position for any date.
- No way back to Home from the trek screens; back buttons restored.
- Closing a sheet with nothing beneath it threw a navigation error; dismissal is now guarded.
- A password-reset link could leave the main app reachable; reset is now the only screen until it completes, and `tripsloom://auth/…` links route correctly.
- Deprecated date picker callbacks replaced.
- The Android build failed on duplicate WorkManager classes; a local config plugin (`plugins/withWorkRuntimeFix.js`) aligns the versions. The Android debug build now succeeds.
- Signing out clears the widget and ends the Live Activity.
- An invite opened while signed out was lost after sign-up; it is now kept and opened once the person has signed in and finished onboarding. Verified by cold-launching from an invite link.
- The paywall promised a 7-day free trial whether or not the store offered one. The trial wording now comes from the store's introductory offer, and buying a product the store did not return shows a clear message instead of failing.

### Still to check outside this Mac

- **On-device AI.** The app's exact schema and prompt were run against Apple's on-device model on this Mac (macOS 27) and returned a well-formed three-day plan. The iOS simulator has no model assets, so drafting falls back to the template there. One run on an iOS 26 phone with Apple Intelligence on remains.
- **Sign-in.** Apple, Google and email sign-in against production, then workspace and trip-extras sync between two devices. This needs a real account.
- **Purchases.** Products must exist in App Store Connect and Play Console. Then test buying and restoring in the sandbox. Until then the paywall shows a dash for prices and explains that subscriptions aren't available.
- **Android widget.** The Android app builds. Testing is planned on a real Android device. To run it there: enable USB debugging, connect the phone, run `npx expo run:android --device` from `mobile/`, then long-press the home screen, add the Trips Loom "Next trip" widget and check it updates after adding a plan.

### Decided: this app replaces the native iOS app (2026-10-13)

The native SwiftUI app in the repository's `ios/` folder is discarded. This app ships under its App Store identity:

| | Value |
| --- | --- |
| iOS bundle ID | `com.tripsloom.ios` |
| Widget extension | `com.tripsloom.ios.widgets` |
| App Group | `group.com.tripsloom.ios` |
| Subscriptions | `com.tripsloom.pro.yearly`, `com.tripsloom.pro.monthly` (unchanged) |
| Android package | `com.tripsloom.app` |

The iOS build number is 2, above the native app's build 1. On the simulator the new build installs over the native app, and `tripsloom://` links now open it. If version 1.0 of the native app was already released, raise `version` in `app.json` to 1.0.1 or later before submitting.

## Full-screen pass on the iOS dev build (2026-10-13, evening)

Run on the iPhone 17 Pro simulator with the development preview: real app code, live weather, place search and exchange rates, data kept on the device. One trip was built end to end and every feature exercised against it.

| Flow | Result |
| --- | --- |
| Planner: "4 days in Lisbon starting today with 2 friends, museums, budget 1500 EUR" | ✅ dates, 3 travellers, budget, interests all parsed |
| Trip page, People, invite link copy and open | ✅ |
| Budget: expenses, live currency conversion, per-day chart | ✅ |
| Packing: quick add, auto categories, ticking | ✅ |
| Wardrobe and stylist: pieces, every day styled, outfits feed packing | ✅ |
| Import bookings from a pasted confirmation | ✅ |
| Itinerary: timed plan with cost | ✅ |
| Live Activity: Dynamic Island and Lock Screen with live countdown | ✅ |

### Fixed in this pass

- The planner didn't understand "today" or "tomorrow".
- The People row said "Just you" for a three-person trip.
- Opening your own trip's invite overwrote the organiser's copy. It now says "Your trip" and changes nothing.
- Currency names showed as "EUR · EUR": the JavaScript engine has no currency names, so the app ships its own list of all 162.
- Closing a sheet opened directly from a link threw a navigation error; every screen now goes Home when there's nothing to go back to.
- Phone fields used the decimal keypad, which has no "+", so international numbers couldn't be typed.
- Number fields accepted letters.
- Orange summary cards could render washed out until a second layout pass.
- Wardrobe photos stretched down the whole screen.
- Colour swatches had no spoken names for VoiceOver.
- Booking import treated a pasted invite link as a booking; it now offers to open the invite, and says when text has no bookings.
- An empty budget showed a meaningless "₹0 at today's rate" and an empty chart.
- Electronics used a phone icon; there is now a plug icon.
- Two more duplicate-key warnings in lists.
- The compact Dynamic Island now shows the next plan's time; the live countdown has room for hours in the larger views.

## Second full pass, watched live in the simulator panel (2026-10-13, late evening)

Fresh install, development preview, live weather, place search and exchange rates. Trip: "5 days in Barcelona starting today with 1 friend, food and beach, budget 1200 EUR".

| Flow | Result |
| --- | --- |
| Planner draft and save | ✅ |
| Itinerary: timed plan with a cost | ✅ |
| Packing: quick add with confirmation, custom item with quantity, ticking | ✅ |
| People, shared expense split two ways, "owes you", record a payment, settled | ✅ |
| Vote: create, vote | ✅ |
| Discover and live place search | ✅ |
| Profile, reminder permission prompt | ✅ |
| Live Activity on the Lock Screen and in the Dynamic Island, surviving relaunches | ✅ |

### Fixed in this pass

- "With 1 friend" counted one traveller; "with a friend", "with my partner" and similar now count correctly.
- "Barcelona" added a nightlife interest because it contains "bar"; interests now match whole words.
- Place-specific placeholders (Kyoto streets) showed on every trip; they're neutral now.
- Quick add gave no feedback; it now lists what was added.
- Tapping the edge of a text field didn't focus it; the whole field box now does.
- "You" showed as "YO" in avatars; it's a person icon now.
- Typing quickly in one vote choice wiped the other; choice updates no longer use stale state.
- Place search buried real destinations under heliports, hills and hamlets ("Bali" didn't find Bali). Results are now towns, regions and islands, biggest first, without duplicates.
- **Live Activity, four bugs:**
  - The countdown clipped its hours ("12:08:16" showed as "8:16").
  - It disappeared on every app launch, because a loading state looked like signing out. Reminders were also cancelled at every launch for the same reason.
  - It wasn't restarted after a layout change, so app updates kept the old layout.
  - A start during launch was refused by iOS ("not foreground").
  - A sizing modifier crashed the widget extension; replaced with a fixed width.

## Release build check (2026-10-13)

The Release configuration was built for the simulator and launched with no development server running. It starts from its bundled code on the Welcome screen with Apple, Google and email sign-in. The development preview is absent, confirming the development-only switches are off in the release binary.

Open, and needing the owner: sign-in and sync with a real account, purchases once the subscriptions exist in the stores, and the Android widget on a real device.

## Free MVP features, watched live in the simulator panel (2026-10-13, night)

Built with free, keyless services only: OpenFreeMap tiles (OpenStreetMap), Apple's on-device geocoder with Photon as a fallback, adsbdb and adsb.lol for flights, and Apple Vision for receipts.

| Feature | Result |
| --- | --- |
| Trip map: plans geocoded, numbered pins, dashed day route, walking distance and time | ✅ 1.2 km between Barceloneta and Plaça Reial, about 16 min on foot |
| Offline map: whole trip area saved, size shown, removable | ✅ 22 MB |
| Check in here: location permission with our purpose text, reverse geocoded, pin and list on the map | ✅ "Carrer del Bisbe, 1, Barcelona · 11:48 PM" |
| Live flight status: real airborne flight (AI 128, London to Mumbai) | ✅ In the air, lands in about 2 h, 941 km/h, 1,755 km to go, B788 VT-ANT, plane heading toward Mumbai |
| Receipt scan from Photos | ✅ €42.90, "BAR CELTA PULPERIA", 13 Oct, Food; lands in Budget by category |
| Travel book PDF: cover, stats, check-ins, day by day, spending | ✅ 2 pages, named after the trip |

### Fixed in this pass

- **Sheets opened cold, from a notification or link, before trips loaded:** the form froze empty. Add a plan showed "Add to Mon" for a Tuesday and would have saved a plan with no date. Every sheet now waits for the trips, the selected trip and this device's saved extras before it opens.
- **Receipt total read as 8002.** The text reader returns columns separately, so "TOTAL EUR" and "42,90" were apart, and the fallback took the largest number, the postcode.
  - The native reader now rebuilds printed rows.
  - The parser looks just after a total label for the price.
  - The fallback considers only amounts with cents.
- **Live flight speed showed 1 km/h at 39,000 ft.** Receivers sometimes send no position or a bad speed. The app now uses the last position from the past 15 minutes and ignores impossible speeds. The arrival estimate falls back to cruise speed. The plane marker is a top-down plane pointing along its track, or toward the destination when the track is unknown.
- **Check-in times and days used UTC.** A late-evening check-in could land on the wrong day, and its time was off by the time-zone offset. They now use the phone's local time in its 12- or 24-hour format, as does "updated" on flight status.
- **The map screen's last button sat under the tab bar** and couldn't be reached; the screen now leaves room for the tabs.
- **MapLibre's "padding greater than map" error:** the map now fits its pins only after it has loaded.
- **Check-ins gave no feedback;** the map now lists them under it.
- **New plans** now guess their kind from the title ("Flight …" picks Move), as expenses already did. Flight plans show the passport illustration instead of a train.
- **The recap called the trip's total cost "spent";** it now says "total", matching the budget.
- **Exported PDFs had random file names and lost their colours.** They're now named after the trip and keep their backgrounds.

## Home in every state (2026-10-14)

Each state was forced and checked in the simulator panel.

| State | What Home shows now |
| --- | --- |
| Loading, nothing cached | Placeholder shapes |
| Couldn't load, nothing cached (offline or server error) | "Couldn't load your trips" with Try again, plus trip ideas, which work offline. Before, it showed "Where to first?" as if the account had no trips. |
| New user, no trips | "Where to first?" hero, then Other ways to start (Join a friend's trip, Import a booking) and Ideas. The Quick actions that repeated the hero's buttons are gone. |
| Only past trips | "Where next?" hero naming the last trip, Other ways to start, Past trips with recaps, and Ideas. Before, it showed a finished-trip hero with nothing pointing forward. |
| Trip coming up | Countdown hero, Quick actions, and Before you go. Each to-do opens its own section (stays and plans in Days, packing, documents) with its own picture. |
| During a trip | Today: remaining plans with the next one marked; a flight opens live status. |
| During a trip, nothing planned today | "Nothing planned today" opens Add a plan for today |
| During a trip, all of today done | "All done for today", which opens the map to check in |
| During a trek | Today's stage (distance, hours, altitude), and trek Quick actions: Climb, Gear, Prepare, Safety |
| No other trips planned | Ideas for your next trip |
