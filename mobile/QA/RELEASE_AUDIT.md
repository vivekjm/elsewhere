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

## Full user-flow test with real accounts (2026-10-14)

No preview workspace and no hard-coded data. The app ran against a local copy of the backend: Supabase with the repo's migrations, plus the web API for workspace sync. Everything was created by tapping through the app, as a user would.

**Vivek (new account):**
1. Signed up with email.
2. Onboarding: name carried over, home base Bengaluru, "already booked", focus areas plus documents, metric, INR.
3. Created "Goa with friends" (today to Sunday, beach, 3 travellers, ₹45,000 budget, notes).
4. Added plans:
   - Flight 6E 5102 with fare.
   - Sunset at Anjuna.
   - The villa as the stay for every night.
   - Spice farm and dinner on Thursday.
5. Added suggested packing items and ticked some as packed.
6. Added Arjun and Meera.
7. Expenses:
   - Scanned a Goan restaurant receipt from Photos (₹2,100, split three ways).
   - Taxi paid by Arjun.
   - Settle up showed "Meera owes you ₹1,000".
8. Started a vote and cast one.
9. Checked in at Anjuna; viewed the trip map.
10. Created a second trip, Manali in December.
11. Signed out and back in: everything returned from the server.

**Asha (second new account):** chose "Just looking". She landed on Discover, and Home showed the new-user empty state. The server keeps each account's data apart: Vivek has 2 trips, Asha has 0.

### Found and fixed during this test

- **Finishing onboarding ignored the choice of where to go** ("already booked" should open New trip, "just looking" should open Discover). The account flipped to Home before the landing was set. Fixed and rechecked with Asha.
- **Place search:**
  - "Goa" offered Genoa, the Philippines and Fiji, not Goa in India.
  - "Manali" put a Chennai suburb above the hill town.
  - Suggestions now lead with OpenStreetMap's best-known towns, states and countries. Goa, Manali, Paris, Bali and Kyoto all now come first.
- **Map:** "Kempegowda Airport" was pinned in Goa because every place was searched near the trip's city. Airports, stations and ports are no longer tied to the destination; the map now runs Bengaluru to Goa.
- **Check-ins:** a shoreline check-in was named "Arabian Sea". Names of seas and bays are skipped, so it now reads "Goa".
- **Packing:** suggested a travel adapter for a trip within India. Adapters are now suggested only when the destination's plugs don't fit home sockets.
- **Keyboard:**
  - The keyboard covered fields and pushed layouts off screen on sign-in, onboarding, sheets and forms. Footers now step aside while typing, and the focused field stays visible.
  - Number keypads had no way to close them; a Done bar was added.
- **Travellers and item counts** offered a decimal keypad; they now use whole numbers.
- **Day title** placeholder was "Temples and tea", Kyoto copy on a Goa trip.
- **Trip header** said "4 of 5 days planned" while the hero said "Plan 3 more days". A stay alone no longer counts as a planned day.
- **Small fixes:** the time placeholder wrapped onto two lines; the keypad stayed open after a receipt scan; the woven lines crossed the sign-in title.

### Not a product bug

The simulator's fast typing sometimes dropped or reordered characters in long fields, and the development menu's floating button covered sheet close buttons. Both are test-tool effects, not app behaviour.

## Motion and transitions (2026-10-14)

Everything runs on the UI thread with Reanimated 4.7, which was already in the native build, so no rebuild was needed. It is now a direct dependency, pinned to the built version. Every animation holds still when Reduce Motion is on.

**Checked in recordings of the simulator:**
- **Shared transition:** trip cards on Home (the trip hero, Up next and Past trips) grow into their card on the page they open (see the follow-up below).
- **Sticky headers:** once a screen's header scrolls away, a frosted compact bar with the title and a back arrow fades in.
- **Tabs:** screens cross-fade with a slight shift, the ember marker slides between tabs, the active icon hops, and there's a selection haptic.
- **Lists:** rows rise in with a short stagger. In Packing, items leave the "To pack" filter by sliding out, and the rest glide up to close the gap, sections included.
- **Numbers and progress:**
  - The trip day count, budget total and "N of M packed" count up.
  - The packing ring sweeps; progress bars fill; budget bars grow.
- **Controls:**
  - Cards and buttons give slightly under the finger.
  - Toggles slide with a squash, checkboxes pop with a delayed tick, and radios spring.
  - Haptics on ticks, toggles and choices; a success haptic when the last item is packed.
- **Trip cover:** parallax while scrolling, and it stretches when pulled down.

**Fixed while building:** the count-up formatter was called on the animation thread and crashed the app. It now formats on the JS thread.

## Screen-by-screen UI pass (2026-10-14)

I went through every route in the simulator as Vivek, with real data: 4 tabs, 9 trip screens, 5 trek screens, about 20 sheets and modals, the pages, Pro and onboarding. I also checked the main screens in an iPhone SE-sized frame (375 × 667). Nothing was cut off there.

### Fixed

- **Sheet tops:** the clock showed over the dimmed screen behind every sheet. The status bar now hides while a sheet is open.
- **Two native crashes ("unmount a view which has a different index"):**
  - The keyboard hook used LayoutAnimation, which reorders native views on the new architecture. It crashed when moving from a text field to a number field inside a sheet, and when closing the itinerary. Removed.
  - Day chips swapped a forecast icon for a spacer mid-update. They now use one fixed slot.
- **Unsaved work:** swiping a form sheet down, tapping X or going back silently threw away what was typed. All 15 form sheets now ask "Discard changes?". Save and Delete close without asking.
- **Times:**
  - Plan times showed as 24-hour text ("19:00") on a 12-hour phone. Times now follow the phone's setting everywhere: itinerary, Home, map, budget, flight, notifications, PDFs, AI draft, tides and the trek reminder.
- **Layout and data:**
  - Recap total wrapped mid-number ("₹21,90 / 0"). It now stays on one line and shrinks to fit.
  - Half-width date fields pushed the date pill to the edge. It is now centred.
  - Half-width currency fields were truncated ("INR · Indian…"). They now show the code.
  - Home: the status-bar area had no backing, so text ran under the clock when scrolling. It now gets a frosted band.
  - Trek route art showed six made-up stops. Stops now come from the trek's real stages, placed by altitude when the summit height is known. The single-stage "D1" picker is hidden. The readiness ring no longer shows a dot at 0%.
- **Wording and empty states:**
  - Pro plans showed "—" for prices. They now say "Price at checkout".
  - Packing showed "0 g" and "0.0 kg packed" when nothing has a weight. It now shows "N still to pack".
  - Quick add offered "Passport" and "Wallet" when "Passport or ID" and "Wallet and cards" were already listed.
  - Wardrobe filters all read "· 0" when empty, so they are hidden. The piece photo now says "Add a photo". Colour swatches are one even row.
  - Expense rows wrapped "split 3 / ways". They are compact now.
  - The "Tides & stops" row now reads correctly for beach and dive trips.
  - The trek stage form's number fields now have placeholders.
- **Links:** recap, essentials, help, privacy, preferences, trail map and flight now open from links instead of falling back to Home.

### Not product bugs

- The simulator's typing tool once killed the app while typing into a number pad. The same input tapped on the keypad works. (The separate real crash above is fixed.)
- The development menu's floating gear button sits over some screens. It isn't in release builds.

## Motion and stability pass (2026-10-14)

Reported problems: janky animations, graphs not smooth, layout shifts during transitions, screens sometimes empty, placeholder misalignment, rubbery lists.

**Root causes and fixes.** The rules now live at the top of `src/loom/motion.tsx`, so new screens follow them too.
- **Empty screens:** rows, cards and onboarding content faded in from opacity 0. Hidden tabs and fast navigation could skip the animation, leaving content invisible. Nothing mounts hidden any more; every entering and exiting animation is removed.
- **Rubbery lists:** spring layout reflow (`LinearTransition.springify`) and spring presses, toggles and radios are removed. Every state change uses one 220 ms ease-out; presses use a 110 ms dim with a 98% scale.
- **Janky numbers and graphs:**
  - Count-ups re-rendered text on the JS thread every frame. Numbers now render directly.
  - Bars, rings and fills grew from zero on every mount. They now render complete on the first frame and ease only when the value changes (`useEased`).
  - Fills are absolutely positioned, so a change never re-lays out the card.
- **Layout shifts:**
  - Form footers unmounted when the keyboard opened, resizing the content. They now stay put under the keyboard.
  - The onboarding header eased between sizes instead of jumping; its decorations fade instead of unmounting.
  - The tab-switch shift animation is removed, so tabs switch instantly as in iOS.
- **Placeholder alignment:**
  - Inputs used vertical padding to place text, which set the placeholder at a different height from typed text.
  - All inputs now share `inputText`/`singleLine`: no vertical padding, stretched to the row, and centred by iOS.
  - Multi-line fields fill their box.
  - The focused field, notes included, now scrolls fully above the keyboard.

**Verified by recording and frame-by-frame review:** switching days, tabs and packing filters, going back to Home, and the budget chart. There were no blank frames, no slide-ins and no reflow bounce. Typed text sits exactly on the placeholder line (checked at full resolution). Close (X) asks "Discard changes?" on a form with typing.

**Follow-up (2026-10-14):**
- **Opening Itinerary:** it is a tab inside the trip, and the tab switch was an instant cut. Tabs now cross-fade in 180 ms; opacity only, so nothing shifts.
- **Black corners when opening a trip:**
  - iOS zooms a snapshot of the card's wrapper, which was a square transparent box. The wrapper now has the card's rounded corners.
  - The zoom's first frame showed the window's default black background. The window background is now set to the app's canvas colour at startup.
  - Verified frame by frame: no black at any point.
- **Shared transition rebuilt in-app (replaces the iOS zoom).** The iOS zoom faded the new page in over a black container, and it still flashed dark on 2 of 3 taps after every fix. It is replaced by a container transform built in the app (`src/core/expand.tsx`) on every trip card on Home (the main card, Up next and Past trips):
  - A copy of the tapped card grows into the card's place on the new page: the trip card, the adventure card or the recap hero. Meanwhile Home fades to the page colour and the card's contents cross-fade into that page's real card (`TripCard`, `AdventureCard`, `RecapHero`, the same components the pages use). The cover and the text arrive together. Previously only the cover came first and the text appeared late, when the page faded in.
  - The page's header row and its tab bar (`TripHeader`/`AdventureHeader`/`RecapHeader`, `StaticTabBar`) fade in with the backdrop in their exact places, so the whole first view of the page is there during the grow. Only the list below the card fills in afterwards.
  - **Main card: the cover thumbnail is the shared element.** The orange card used to cross-fade into the white trip card, which read as a melt. Its 64pt cover thumbnail now grows into the page's full-width cover, much as an Up next picture becomes the page's cover. The orange turns white early, and below the cover the page's card fades in. The page's own cover is clipped out of that fade, so the picture is never shown twice. For a trek, the thumbnail only travels when it is the summit, the adventure page's cover. The transition's copy of the card never takes over the thumbnail's ref, so the morph works on every tap, not just the first.
  - **The grow starts two frames after the copy has drawn.** Starting at layout lost about half the grow to the frames spent mounting the copy, so the first visible frame was already about 60% through.
  - **A natural pace.** The grow now takes 480 ms on the standard ease-in-out curve (gentle start, even middle, short settle) instead of 360 ms on a curve that reached 60% in about 90 ms. The picture moves at the card's pace. The page is pushed at 200 ms, once the backdrop has hidden Home.

## Trip covers: gradient blur and your own photo (2026-10-15)

- **Gradient blur: tried and removed.** A gradient blur at the bottom of the covers was added, then taken out at review: too much.
- **Upload your own cover.** In Edit trip, the cover picker starts with an **Upload** tile (choose from library or take a photo). New trips can have one too. A camera button on the trip and trek covers opens it. The photo goes to the account's image store (`/api/images`) and its path is saved in the trip's extras (`cover`, validated as an `/api/images/<uuid>` path). Picking an illustration sets the photo aside, and the photo tile offers **Remove photo**. The cover shows wherever the trip's picture does: the Home card thumbnail, Up next, the trip and trek pages and the recap. If the photo can't load, the illustration underneath stays.
  - **No crop step.** iOS only offers a square crop, so the whole photo is kept and the cover frames it. Quality is 60%, to stay under the server's 5 MB limit.
  - **Picker timing.** The picker opens 450 ms after the choice alert closes. Opening it while the alert was still closing left iOS stuck, and further taps did nothing.
  - **Limitation.** Trip extras are per person, so people a trip is shared with don't see someone else's cover photo.
- **Fixed: photo uploads (wardrobe too).** Expo's fetch rejected React Native's `{ uri, name, type }` form part with "Unsupported FormDataPart implementation", so no photo could be uploaded. `uploadPhoto` now sends an `expo-file-system` `File`. Verified: `POST /api/images 200`, and the photo shows on the cover.
  - The page is pushed with no animation of its own while the card is still growing. It is shown once it has drawn, so it is never empty or half-built.
  - Going back is the normal slide.
  - Verified by recording: on the main card and an Up next trek card, no dark frame (dark-pixel count never rises above the settled page). The grow runs at 60 fps from the first frame, the open takes about half a second, and back slides.

## Motion through the whole app (2026-10-15)

Simple, even motion, built into the shared components (`src/loom/motion.tsx`, `src/loom/ui.tsx`) so every screen gets it. It uses Reanimated on the UI thread with eased timings only: no springs, no LayoutAnimation, no layout `entering` animations. Everything holds still with Reduce Motion.

- **Screens.** Every `Screen` (all tabs, trip and trek tabs, pages) and the onboarding and sign-in layout bring their content in block by block. Each block rises 14pt and fades in over 320 ms, 45 ms after the block above. The header stays put. It plays only for the screen that is showing: a tab mounted in the background, and a page opened by the card transition, show at rest.
- **Lists.** Rows, cards, media rows, photo cards, wardrobe tiles, banners and empty states that arrive after their screen has settled (added, loaded, synced in) fade up into place (`Arrive`).
- **Content that changes in place** cross-fades and lifts slightly (`Swap`):
  - Days and Stylist (another day).
  - Wardrobe, Packing, Gear and Discover (filters).
  - Tides (another day).
  - Budget's expenses (a day picked on the chart).
  - The route map's stage card.
- **Graphs:**
  - Budget and Climb bars grow from zero, one after another, the first time they are shown.
  - Rings sweep round to their value, and progress bars fill.
  - The tide chart draws itself in from the left.
  - After that, they ease between values.
- **Selections fade instead of snapping:**
  - Filter chips, the day strips, the segmented control (with a sliding marker) and onboarding steps.
  - Onboarding option cards and focus tiles, paywall plans, check-in symptom scores, budget day chips and route stage chips.
- **Touch.** Every button gives the same gentle press (98% scale and a dim): all hand-built buttons in screens and the shared pickers, the tab bar, place suggestions and currency rows.
- **Loading.** The spinner fades in only if loading takes more than 250 ms, so quick loads never flash it.
- **Safety.**
  - Only the UI-thread value hides content. Its timing starts in the same effect that hid it, and a timer shows it regardless, so nothing can be left invisible.
  - A block whose component draws nothing (the sync banner when in sync) gives its gap back. The first version left a 50pt empty band above Home's card; this was caught and fixed.
- **Verified by recording in the simulator:**
  - App start to Home, the main card into the trip (no dark frames), and the Trip, Days and Packing tabs.
  - Budget: bars grow in sequence and the fills sweep in.
  - Discover: filter swap and chip fade.
  - Profile, Preferences (segmented control) and the Add expense sheet.

## Strategy features, app side (2026-10-15)

Built from `docs/strategy/` (roadmap phases 0–2, app and web side). Each item was checked in the iPhone 17 Pro simulator against the local Supabase, using two real test accounts (Vivek, and Asha via the API).

**Phase 0: foundations**
- **Analytics** (`src/core/analytics.ts`): 26 named events, never trip content, batched to the insert-only `app_events` table (migration `20261015_app_events.sql`). Can be turned off with `native.analytics`. Verified: `app_opened` rows arrive.
- **Honest Quick start**: "Plan with AI" became "Quick start: a day-by-day outline". The 3-a-month cap is removed, and the paywall no longer sells AI drafts. Model-written days are labelled "Written with Apple Intelligence".
- **India first**: 16 Indian and short-haul ideas with per-person cost bands, shown first when the home base or currency is India. Planner suggestions follow the same rule, and onboarding suggests INR for an Indian home base.
- **UPI**: a UPI ID in Travel preferences; Pay with UPI on settle-up opens the UPI app (`upi://pay`). Only the payee can set their own ID. Verified: the sheet becomes "Pay Arjun", and with no UPI app installed it shows a clear alert.
- **Onboarding** asks "Who usually comes along?" instead of the unused focus tiles. An empty Home for a group leads with "Start a trip with my friends", which opens the invite after creating the trip.
- **Web**: `/terms`, `/help` and `/privacy` serve (they returned 404 in production before). Universal and app links (`associatedDomains`, Android intent filter, `/.well-known/*` served from API routes).

**Phase 1: the live shared trip**
- **One live trip** (migration `20261016_shared_trips.sql`, `src/data/live.ts`, `src/core/live.tsx`): membership with row-level security, an unguessable code, join, rotate (turn off a link), leave, and versioned saves.
  - The app pulls every 12 s, on resume and on Realtime changes; edits are pushed a second later with a three-way merge by record id.
  - Unit tested: concurrent edits, adds on both sides, delete vs untouched.
  - Private parts never leave the phone.
- **Verified with two accounts**: Vivek shared Goa, and Asha joined, RSVP'd and added a split expense. Vivek's app showed her joining, the new 4-way split, the estimate re-split 4 ways, and his RSVP changing on the server. No version churn while idle.
  - Asha's own trips opened from `tripsloom://t/<code>` with a preview and joined in one tap.
  - "Which one is you?" claimed a guest's costs (the server's split moved from the guest to Vivek's member id).
- **Who's coming** (I'm in, Maybe, Can't make it), a member list with "Not joined" guests, and a date poll with weekend and Indian long-weekend options. Locking dates moves the trip.
- **Per-person estimate** on the invite, in Who's coming and on the web Trip Room (a range, with its basis).
- **Web Trip Room** `/t/<code>` with Open Graph tags for chat previews, the plan, who's coming and the cost each (`view_shared_trip`, migration `20261017_trip_room_view.sql`). Checked in the browser.

**Phase 2: organiser toolkit and revenue**
- **Ready Check**: four ticks per person (paid and packed tick themselves) and a "Nudge the group" message. Verified: ticks sync to `shared_trip_members.ready`.
- **Trip kitty**: equal top-ups, "paid from the kitty" expenses, and kitty-aware balances (top-ups count only as the pot is spent). Verified: a ₹2,000 kitty synced.
- **Trip Pass** (`com.tripsloom.trippass`, consumable): unlocks the kitty, nudges and unlimited documents for one trip, shared with co-organisers. The sheet was verified; the purchase itself needs the store product.
- **Group chat sharing**: send a day's plan (Itinerary and Home's Today) and the trip in numbers (Recap).
- **Import from a screenshot** of a ticket or booking (on-device text recognition).
- **Simplified trip tab bar**: Budget replaces Wardrobe until someone adds clothes; the wardrobe stays one tap away from Packing.

**Needs the account owner**
- Apply the three new migrations to the hosted Supabase.
- Create `com.tripsloom.trippass` (consumable) in App Store Connect and Play Console.
- Set `ANDROID_CERT_SHA256` on the web deployment and deploy the web app (Trip Room, legal pages, app-link files).
- Rebuild the native app for the associated domain.

## Remaining strategy features (2026-10-15)

Migration `20261018_group_features.sql`: family view code, member preferences, trip templates.

- **Reel-to-Room shortlist (S4)**: paste a reel or post link, a Google Maps link (short links followed), a caption or typed names, or pick a screenshot (read on the phone).
  - Places are pulled out (`domain/shortlist.ts`, unit-checked on Maps URLs, 📍 captions, "at X" and plain lines) and put on the map near the destination; the person confirms them.
  - Everyone votes. **Put places on the days (F6)** spreads the most-wanted onto the quietest days, grouping places that are close together.
- **Where things stand (F8)**: one card summing up who's in, the leading dates, the most-wanted places, poll leaders and the group's food and pace needs. Built from the trip's data, with no model.
- **Group preferences**: each member sets budget style, food (veg, non-veg, Jain, anything) and pace, which feed the summary.
- **Custom Ready Check items (F18, operator use)**: the organiser adds up to 8 requirements (medical form, fitness check, deposit) on top of the standard four.
- **Referral**: organiser tools unlock free once 3 friends join a live trip; the Trip Pass sheet shows the progress.
- **Family view (F14)**: `https://tripsloom.com/f/<code>` shows the plan, stays and who's going, read-only. Verified: the code can't be used to join.
- **Do it again (F17)**: the recap shares the trip as a plan (`/r/<code>`, no costs or notes), copyable onto new dates. It has a web page with a preview card, and the link opens "Copy a trip" in the app. Verified as Asha: publish, read without signing in, web title.
- **Entry rules for Indian passports (F12)**: 41 countries (including the Schengen area) in Essentials, with "last checked 15 Oct 2026" and the official site. Only rules several sources agree on are listed; Thailand reflects the 30-day change of 15 Sep 2026.
- **Contextual offers (F15)**: in the 3 weeks before a trip, one dismissible "Still to sort" card: stays for nights without one, activities, and an eSIM abroad. Affiliate ids come from `EXPO_PUBLIC_AFFILIATE_BOOKING`, `_GETYOURGUIDE` and `_AIRALO`, and the card labels partner links.
- **Hinglish (F20)**: Travel preferences › Messages to your group; covers invites, nudges, day plans and the recap.
- **Image cards (F13, F16)**: the day plan and the recap are shared as an image (drawn natively by `renderCard`) with the message.
- **PDF import (F7)**: read a PDF ticket or booking on the phone (PDFKit `pdfText`).
- **Analytics switch**: Data & privacy › Help improve Trips Loom.

**Not built**
- **Folding trek and dive tools into sections of the trip page (T10)**: a redesign of the trek mode that should follow usage data.
- **The operator subscription and printed books**: these need sales, a print partner and validation first (experiments E6 and E2).

## Feature QA pass (2026-10-15): group features, live, on simulator

Tested live with four accounts (app + three friends via the local API) on the shared Bangkok trip.

**Verified working:** date poll votes and lock (server trip moves to the locked dates); shortlist from a caption + Maps link
(3 places found, synced with member ids); concurrent edits (app untick + two friends' votes/places merged, nothing lost);
shortlist → days (grouped by area, synced, marked planned); Ready Check custom item, friends' ticks arriving, nudge text
(skips the ready, includes custom items, live link); kitty start / mark paid / undo / kitty-paid expense; family link and
the /f/ page; invite sheet; offers card (all three for a trip abroad, Hide persists); analytics events (no trip content in props).

**Fixed in this pass:**
- Typed links auto-capitalised to `HTTPS://` were ignored by the shortlist (Maps place silently dropped).
- Place lookups could hold the shortlist sheet for 10 s+; each now gives up after 5 s.
- Places nobody wants any more (0 votes) were still offered for "Put on the days".
- Return on a single-line field submitted stale text ("Travel insuranc"): `Field` now passes the typed text to `onSubmitEditing`.
- Group summary said "Most of the group want a relaxed pace" at exactly half; now "Most" only above half, "Half" at half.
- Invite card claimed people without the app can say if they're in (the web page can't RSVP).
- Kitty: a top-up marked by mistake couldn't be undone (holder can now tap the row to undo); kitty spending wasn't converted
  to the trip currency; "held by You" capitalisation; kitty-paid expenses read "You paid" (now "From the kitty").
- Shortlisted plans showed the place twice ("Wat Arun · Wat Arun") in the itinerary, map, home, day sheet and web pages.
- Family share message promised "where we're staying each night" when no stays were set.
- `offer_shown` was logged on every visit; now once per trip per session.
- Section text actions (Hide, Add stage…) get a 44 pt touch area.
- "Paid my share" hint now says it ticks itself once costs are in.

**Open / not reproduced reliably:** once, going back from the Trip tab through tab history landed on a blank Days screen;
two retries rendered correctly. Simulator input injection stalled twice (app threads idle); a simulator reboot cleared it.

## Plan mode (reels → trip), 2026-10-16

Built: share extension (iOS `TripsLoomShare`, Android `text/*` share target) → reel inbox (on the phone) → 4-step guided
flow (Reels → Places → Trip → Days) → trip with evidence in each stop, shortlist, and invite or date poll for groups.
See `docs/strategy/07-plan-mode.md`.

Verified on the simulator with real public posts: Instagram previews give the full caption; YouTube Shorts give
title, description and keywords (private videos and embed-disabled ones handled); hidden-spot bait detected; a pasted
creator DM yields its places (not the areas they're "in"); places resolve inside the destination's boundary; the days
group by distance, put forts at the real sunset, keep arrival and departure days light, and keep a hand-moved place on
its day. Tests: 28 domain, 5 AI-module, 114 web.

Not verified: a live AI provider call (no key here; mocked in tests); the share sheet from the real Instagram and
YouTube apps (needs a device); Android. Release prerequisites: `GEMINI_API_KEY` (or `AI_PROVIDER=openai` with
`OPENAI_API_KEY`) as a Worker secret; migration `20261019_ai_usage.sql` on the hosted Supabase; EAS credentials for the
share extension target.

## Navigation fixes, 2026-10-16

Found by the user (blank Itinerary after Back) and traced with a root-stack logger:
- **Blank tab after Back:** the trip, adventure and main tab bars cross-faded scenes; going back through tab history
  could leave the returned-to tab at opacity 0 (blank, untappable). Tab fades removed in all three tab layouts.
- **Back walked through tabs:** ← on a trip tab (Trip, Days, Budget, Packing; adventure tabs) now leaves the trip in
  one tap (`useGoBack` + `TabRootsContext`); pages opened from a tab (Map, Documents, Stylist) still return to it.
- **Trips piling up / stale sheets:** opening a trip pushed a new trip page on top of whatever was open, including
  inside sheets (plan mode, invites, new trip), so Back went to an older trip and closing the pile could leave a
  sheet on screen that the app no longer knew about. `useOpenTripPage` keeps a single trip page above Home: it
  closes everything above Home first, waits for sheets to finish closing, then pushes (or just switches tab when
  the trip is already open). Used by create trip, plan mode, import bookings, joining, Home, Shared, reminders.

Verified on the simulator with the stack logged at each step: trip → Days → ← (Home); Map from Home → ← (Home);
Days → Map → ← (Days, visible); trip → plan mode → create (Home › new trip › invite, old trip closed) → close → ← (Home,
no stale sheet); trip → Documents → ← (Trip tab); Budget → Packing → Days → ← (Home). Not tested: Android
hardware back, the adventure (trek) tabs on device.

## Planning together (general planning, not just reels), 2026-10-17

Planning is now one feature for any trip, solo or shared, with AI:
- **Planning board** (`app/plan.tsx`, `screens/board.tsx`): ideas from a typed name, a sentence, a Maps link or a reel;
  hearts; Ask AI; the group's pace and food; Draft the days → Use this plan. It's live on shared trips; entry points
  are the trip page, Home, the shortlist and plan mode.
- **Plan mode** starts from anything (a sentence, places, Maps links, reels). It reads dates, length and who's going
  from the sentence, and can add to an existing trip's board.
- The merge rules are in `domain/together.ts`. See `docs/strategy/07-plan-mode.md`.

Verified live on the simulator with three test accounts writing through the API. Found and fixed:
- Place names were autocorrected.
- Market names weren't found.
- Sentence parsing: names ran across full stops, and "on my own" wasn't read as solo.
- Old answers survived a new search.
- Dinner placement around night markets.
- Civic area names were shown as neighbourhoods.
- Hand-planned ideas were drafted twice.
- Arrival and departure stops were added over hand-planned days.
- Shared notes said "You".
- **Sync:** an edit made during a pull wasn't sent until the next edit (`core/live.tsx`).

Tests: 36 domain, 114 web, 5 AI. Mobile type-check is clean, and the production iOS bundle builds.

Not verified:
- AI on the board: the on-device model errored in the simulator, and there's no cloud key.
- Android.
- A second real phone (friends were simulated through the API).

## Production AI: DeepSeek, prompts, consent, limits (2026-10-19)

**Built:**
- **Provider layer** (`lib/ai/providers.ts`): DeepSeek is the default, with Gemini and OpenAI behind one interface.
  `deepseek-flash` reads posts; `deepseek-v4-pro` suggests ideas. Thinking is off, with JSON mode.
- **Settings:** a fallback provider (`AI_FALLBACK_PROVIDER`), a kill switch (`AI_DISABLED`), and a gateway base URL
  (HTTPS, or localhost in development).
- **Versioned system prompts** (`lib/ai/prompts.ts`):
  - Reading: every place quotes its source words; no guessing; regions, bait and hotels skipped; any language.
  - Ideas: real, specific places; veg and Jain respected; nothing already on the board repeated.
  - Both treat input as data, not instructions.
- **Server checks** (`lib/reel-ai.ts`):
  - A place whose quote isn't in the post is dropped.
  - Ideas must declare a menu (`pure_veg`, `serves_meat`, `not_a_restaurant`); a veg or Jain group never gets
    `serves_meat` or an unsure answer.
- **Reliability:** one retry for busy, slow or unusable answers; setup errors go straight to the fallback; a 25 s
  deadline.
- **Limits:**
  - An edge cache: 7 days for reading, 1 day for ideas. Cached answers don't count against the allowance.
  - 40 calls per account per day, plus a cap for all accounts together (`AI_DAILY_GLOBAL_LIMIT`, migration
    `20261020_ai_global_cap.sql`).
- **Logging:** one `ai_call` log line per call, with no content and no user.
- **App:**
  - Asks permission once before the first cloud call ("Use DeepSeek for AI planning?").
  - A switch in Data & privacy.
  - Falls back to Apple's on-device model when cloud AI is off, used up or failing.
  - Explains why AI failed.
  - Ideas are checked on the map; ones the map can't find are still offered, marked "Not found on the map".
- **Planning fixes:**
  - The AI's destination corrects a wrong guess ("Sunset, Arkansas" → Goa).
  - The AI's reading replaces an unconfirmed guess ("Dil Chahta Hai" → Chapora Fort).
  - Sentence parsing moved to the tested `domain/sentence.ts`.
- **Privacy:** the policy says what goes to DeepSeek and that its servers are in China. The on-device prompts are in
  line with the server's.
- **Ops:** `npm run eval:ai` (17 live cases) and the runbook `docs/strategy/08-ai-operations.md`.

**Verified:**
- **Live DeepSeek eval:** 17 of 17 pass. Reading median 1.1 s; ideas median 3.0 s; 18 of 20 ideas on the map. About
  $0.65 per 1,000 calls at peak.
- **Through the local server, signed in:** ideas in 3.2 s, the same request from the cache in 0.11 s, a reel read in
  1.4 s. 401 without sign-in, 403 from a wrong origin, 400 for junk.
- **Caps in the database:** an account over its limit is refused; over the global cap is refused without being
  counted; anonymous callers are denied.
- **In the simulator** (native rebuild with the new Swift prompts):
  - The permission prompt appears before the first call.
  - Ask AI on the Bangkok board returns 4 Jain-safe ideas, and one added syncs to the shared trip.
  - Plan mode reads "Goa with friends in December. Sunset at the Dil Chahta Hai fort, then dinner at Gunpowder in
    Assagao" as Goa, with Gunpowder (Verla) and Chapora Fort (Anjuna) as musts.
  - "Suggest more" gives map-checked ideas.
  - With cloud AI off, the board uses on-device AI and says why.
- **Checks:** tests 123 web and 39 domain; both type-checks clean; lint clean; the production iOS bundle builds; the
  API key appears in no bundle or tracked file.

**Not verified:**
- Apple's on-device model answering: it errors in the simulator; needs a device with Apple Intelligence.
- Android.
- The Worker Cache API in production: the local dev server has no edge cache, so local repeats came from the
  Miniflare cache.

**Before release:**
- `npx wrangler secret put DEEPSEEK_API_KEY`.
- Migrations `20261019_ai_usage.sql` and `20261020_ai_global_cap.sql` on the hosted Supabase.
- Top up the DeepSeek balance.
- App Store privacy answers updated for DeepSeek.
- Alerts on the `ai_call` logs.

## Plan tab: planning with AI, reels as context (2026-10-19)

**Built:**
- **A dedicated Plan tab** (`app/(tabs)/planning.tsx`, `screens/planhub.tsx`):
  - Start from a sentence, with starters.
  - Reels and links are optional context.
  - Plans in progress are saved on the phone and resume at the same step (`services/planDrafts.ts`).
  - Each upcoming trip's planning board is linked.
- **Plan mode:**
  - Starts from the sentence and finds places automatically.
  - AI's picks arrive when few places were named, with "Add all".
  - Saved reels are under "Add context (optional)", and unreadable ones are hidden.
- **"Plan with AI" on the days** (`screens/coplanner.tsx`, `domain/coplan.ts`, `EDIT_SYSTEM`):
  - Quick changes run on the phone.
  - Richer requests go to DeepSeek as checked edits; the engine rebuilds the days.
  - Each turn lists what changed, with Undo.
  - Suggestions come from the plan.
  - AI-added restaurants are scheduled at meal times.

**Verified in the simulator** with live DeepSeek:
1. Plan tab → "4 days in Udaipur with my wife in January, we love palaces and lake views" → Udaipur found.
2. AI's picks: City Palace, Lake Pichola, Jag Mandir and more, added all.
3. Couple, 4 days, January read from the sentence.
4. Days drafted.
5. "Day 2 is too much, spread it out and add a romantic dinner with a lake view": City Palace moved to day 3, and
   Upre by 1559 AD added as dinner.
6. "add a day" changed on the phone; Undo restored it.
7. Left mid-plan and resumed from Plans in progress.
8. Created "Udaipur in January", 4 of 4 days planned, 7 ideas on the board; the draft was cleared.

**Checks:**
- Eval 25 of 25 (planning median 2.1 s).
- Tests: 126 web, 45 domain.
- Both type-checks clean; production iOS bundle builds.

**Not verified:** Android; the on-device model for planning (planning needs cloud AI; quick changes work without it).

## Accuracy: AI understands the sentence first; treks planned as treks (2026-10-19)

**Reported:** "Trek in nepal in goechala for 6 days" planned a trip to Treko, Central Java, Indonesia, with one place
called "Trek".

**Causes:**
- The rules took the first capitalised word as the destination.
- The region lookup took the map's first result even when its name didn't match.
- Lowercase "nepal" and "goechala" were never read.
- DeepSeek's correct reading only ran when the rules' guess found nothing, and here the guess "found" a place.

**Fixed:**
- **AI reads the sentence first** (new `brief` task):
  - Destination as maps name it, with region and country; kind of trip; facts; named places.
  - A note correcting wrong facts, and a question when it can't tell.
  - The destination is looked up in the country AI gave.
- **Without AI:** trip words like "trek" are never the destination, lowercase place names count, and the region lookup
  requires a name match.
- **Treks** (`domain/brief.ts`):
  - A day-by-day route with distances, hours, altitudes, the high point and permits.
  - An app-side altitude check flags fast climbs.
  - The start date is in season.
  - Route changes are asked in words, with what changed and Undo.
  - Saved as a trek trip: dated stages in the adventure view, permits under Prepare.
- **Map gaps:** Apple Maps place search on iOS (new native `searchPlaces`, MapKit), inside the destination only. It
  found Promenade Beach, Puducherry, which OpenStreetMap doesn't have.
- **Smaller fixes:**
  - "name" accepted for "title" in AI answers.
  - "Puducherry, Puducherry, India" shown as "Puducherry, India".

**Verified live (DeepSeek, simulator):** your sentence gave:
- A Goechala trek from Yuksom, Sikkim, India, with the note "Goechala is in Sikkim, India, not Nepal… in 6 days you'd
  turn back at Dzongri".
- 6 stages (1,780 → 4,020 m), Dzongri Top, two permits, and a day-3 altitude warning.
- "The full 8-day route" reached Goechala Pass (4,940 m) via Thansing and Lamuney.
- An in-season start of 14 Nov.
- A trek trip created with its stages and permits.

Also checked: "weekend in pondy… auroville and promenade beach" gave Puducherry, both places found, veg, backpacker.

**Checks:**
- Eval 33 of 33, including 8 understanding cases: Goechala, Kedarkantha, EBC, Udaipur, Pondy, "goa",
  "somewhere warm" (asks back), and an injection.
- Tests: 129 web, 52 domain.
- Type-checks and lint clean; native build and production bundle build.


## Plan mode redesign: flat and calm, with interactive parts (2026-10-19)

**Reported:** plan mode worked but looked crowded and confusing, with too many rounded cards.

**Changed:**
- **No cards.** A white page, hairline rules and small-caps section labels, with one big heading per step and one
  main action at the bottom.
- **Shared parts** (`screens/planui.tsx`) used by plan mode, the Plan tab and the planning board:
  - A step header with a thin progress line.
  - A big borderless input.
  - Line rows with a small coloured icon dot.
  - AI notes as text beside an ember rule (rose for warnings).
- **Interactive parts:**
  - Trip settings are an accordion: one line each (When, How long, Who's going, Pace, Food, Budget, Arriving and
    leaving), showing whether you or AI set it. Tap a line to change it; one is open at a time.
  - Days are tabs with a sliding underline, and each day is a vertical timeline: time, place, one line of detail,
    and the walk from the last stop.
  - A trek is an elevation chart; tap a camp to see that day, with its altitude warning.
  - Must / Maybe / Skip are words with a dot, not chips.
  - AI's picks are rows with "+ Add".
- **AI is one ask bar at the bottom.** Suggested asks sit above it and it rises with the keyboard. The last change
  shows above the days with AI's reply, what changed and Undo; earlier changes fold away. After an edit, the day tab
  switches to the day that changed.
- **Plan tab and planning board** use the same flat parts. The draft on the board uses the day tabs and timeline,
  and plans already in the trip show as "Already planned".
- **Removed:** the old co-planner screen and the card versions of days, notes and treks.

**Fixed along the way:**
- A new sentence from the Plan tab while plan mode was already open was ignored; it now starts over.
- Your message in the AI thread was cut off at the end.
- AI put a change on the wrong day when a day was named; the edit prompt now keeps the named day (prompt
  2026-10-19.11).

**Verified live (DeepSeek, simulator):**
- City plan: start → places → trip settings (accordion) → days (tabs, timeline), and an AI edit with reply, changes
  and Undo.
- Kedarkantha trek: route chart, tapping a camp, and the review step. The ask bar sits right on top of the
  keyboard.
- Plan tab and the planning board, including the draft's day tabs.

**Checks:**
- Tests: 129 web, 52 domain.
- Type-checks and lint clean.
- Production iOS bundle builds (6.9 MB).

## Plan mode, second pass: visual, less like a form (2026-10-19)

**Reported:** after the first pass, the days step was still crowded: the AI conversation sat above the days and a
red "full day" note repeated on every day. The steps still felt like plain forms.

**Changed:**
- **The days step:**
  - **A map of the day across the page:** stops numbered in order and joined by the route. It glides to the next
    day when you switch, and a day with nowhere to go shows the trip's places faintly.
  - **A day strip:** each day's number in a circle, its date, and a short bar for how full it is (rose when too
    full). An ember dot marks a day AI just changed.
  - **The day as a timeline:** numbered stops that match the pins, the travel time on the line between stops, and
    meals as one quiet line. "Suggested by AI" no longer repeats on every stop.
  - **A packed day:** "A packed day. Lighten it" under the date (one tap asks AI), instead of a red banner.
- **AI changes, without a conversation down the page:**
  - What you asked, AI's reply, what changed and Undo appear in a dark notice above the ask bar. You can close it,
    and the suggested asks come back.
  - Changed stops get a "New" or "Moved here" label, their pins are ringed, and the plan jumps to the first day that
    changed.
- **The trip is one sentence.** For example: "3 days in Jaipur, starting Fri 25 Dec, for you and 3 friends. A
  balanced pace, any food, and a comfortable budget…"
  - Words AI suggested are ember with a dotted underline; your words are dark.
  - Tap a word to change it under the sentence, with the reason AI chose it.
  - Treks read "A 5-day trek from Manali… Up to Hampta Pass at 4,270 m."
- **Places are chips over a map:**
  - Pins: yours filled in their kind's colour, maybes and AI's picks as outlines.
  - Tap an AI pick to add it. Touch and hold to see why AI picked it.
  - Tap one of yours to see where it came from and choose Must-do, Maybe or Leave it out.
- **Trek route:** the chosen day opens in place in the day list (no separate block); tapping a camp on the chart
  opens it.
- **The start:**
  - Example sentences type themselves out in the empty field (also on the Plan tab; still with reduced motion).
  - Short step marks replace "STEP 2 OF 4".
- **The planning board:**
  - The draft has the same map, day strip and numbered timeline.
  - "How the days go" is a sentence too.
  - Ideas that didn't fit are chips.

**Fixed along the way:**
- Pins added after the map loaded didn't appear (map views). Pins are now drawn as a map layer.
- "Added Raja Seat" stayed on the board after that idea was removed.

**Verified live (DeepSeek, simulator):**
- Jaipur: places as chips and pins, the trip sentence (tapped "balanced"), and the days with the map. An AI edit
  ("add one offbeat place…") jumped to day 2 with "New" and a ringed pin, and the notice had Undo.
- Hampta Pass trek: route, sentence and day list.
- Coorg board draft: map and day strip.
- Test plans and ideas were removed afterwards.

**Checks:**
- Tests: 129 web, 52 domain.
- Type-checks and lint clean.
- Production iOS bundle builds (7 MB).

## Trips Loom 3.0: the frosted GymSync design across the app (2026-10-19)

**Asked:** apply the 3.0 design system (one dark theme taken from GymSync: frosted glass over sepia photos) to the
app, starting with plan mode.

**Changed:**
- **The design layer (`src/loom`):**
  - `tokens.ts`: the 3.0 palette. Older role names (`card`, `stone`, `ember`…) keep working with the new values.
  - Radii are 2–4pt (8 for sheets and the dock).
  - The font is Outfit (200–600), and every weight moved one step lighter.
  - `glass.tsx` (new): `Backdrop` (the photo, toned and veiled, behind every `Screen` and `Sheet`), `GlassFill` and
    `Glass` (a blur, a warm tint, a sheen and a hairline edge), `Mosaic`, `Photo` and `PhotoTone`.
  - `instruments.tsx` (new): `Numeral`, `Barcode`, `Gauge`, `Blocks` and `StepMarks`.
  - `mapStyle.ts` (new): OpenFreeMap's dark style, recoloured to the warm map palette on the phone.
  - Cards, groups, fields, chips, segments, toggles, day chips and sheets are now glass.
  - The primary button and the live tile (hero) are khaki. Keys are square.
  - The tab bar is a floating glass dock, with a raised pane and an orange tick on the current tab.
  - Illustrations are toned like the photos.
  - A light status bar. `app.json` asks for dark appearance; that applies from the next native build.
- **Plan mode, the Plan tab and the planning board (`planui`, `planparts`, `planmap`, `planmode`, `planhub`,
  `board`):**
  - The start: a khaki "Live planning" panel (ideas and Add a reel), touching the composer.
  - Places: a dark map tile, the place in light display type, and chips (raised for must-dos, dashed for maybes,
    sand and dashed for AI's picks).
  - The trip sentence: AI's words in sand with a dotted underline. A tapped word opens a frosted tile with a
    segmented control.
  - The days:
    - The map and the day tiles form one mosaic (khaki for the chosen day, orange when a day is too full).
    - Each day shows as a barcode from 07:00 to 22:00, with the sunset in orange.
    - Stops have square, numbered marks in their kind's colour.
    - AI's notice is raised glass. The ask bar is frosted, with a khaki Send and Create.
  - Step marks: ink when done, orange and long for the current step.
- **Other screens:**
  - The welcome and onboarding screens sit on the photo, with a glass wordmark and Skip, and a frosted sheet.
  - The trip map and flight map use the warm dark map, with square pins edged in the ground colour.
  - Light fills are gone: a map note, the readiness ring centre, the over-limit bar (now the danger colour) and
    round preference chips.

**Verified live (simulator):**
- Home, Plan tab, Discover, Shared, Profile and travel preferences.
- An adventure trip page.
- Plan mode, Jaipur:
  - Places, with Amber Fort, Hawa Mahal and Nahargarh Fort added and pinned.
  - The trip sentence, with Pace opened.
  - The days: map and strip, the barcode with sunset, and the itinerary.
- The Geochala planning board.

**Known:**
- Map pins are still circles; the 3.0 design has squares, which needs a symbol layer.
- The splash screen keeps its light background until the native build changes.

**Checks:**
- Tests: 52 domain, 129 web.
- Type-checks clean in the root and mobile; lint clean.
- Production iOS bundle builds (7 MB).

### Follow-up: no photo behind pages; Home as the trip overview (2026-10-20)

**Reported:** the photo behind every screen was "terrible". Use images only where they're needed. The 3.0 trip
screen (a photo hero, then tiles) is the version to follow.

**Changed:**
- **Pages are plain near-black** (`ground`), with no photo behind them. Sheets are flat too.
  - `Screen` only draws a photo when given a `backdrop`. No screen does now.
- **Panes are solid:**
  - Tiles are warm charcoal `#2a2823`, raised panes `#36322b`, and keys and fields `#1f1d19` with a faint edge.
  - Khaki is solid `#706959`, as in the reference screen.
  - Tiles have no border: the 2pt gaps separate them.
  - Blur is kept only for see-through glass over a photo or a map, and for bars that content scrolls under.
- **Photos only where they say something:**
  - Home's trip hero (`TripPhoto`: the trip's own cover, else a brand photo that fits its mood).
  - Trip covers and thumbnails.
  - The welcome and onboarding header.
- **Home's trip is one panel of touching tiles, like the reference:**
  - **Photo hero:**
    - Overview · Days/Route · Budget/Gear links.
    - "Hi Vivek, you've **planned 14%** of your Moshi trek." (the share of days with plans or stages).
    - A glass "My trip" card: who's going and whether it's in sync (it opens Invite).
    - "Starts in: 11 days" (or "Today: Day 3 of 7").
    - Map and share keys, and the days as a barcode.
  - **Tiles:**
    - Planned costs or Total spent, with "A day" and "Each".
    - Budget pace as a gauge (Normal, Tight or Over; "Not set" without a needle).
    - Places a day as blocks (today or the busiest day in orange), or Altitude for a trek.
    - Left to do.
  - **A khaki live tile:**
    - During the trip: today's stage ("Start the day") or the next plan.
    - Before the trip: the first stage ("Prepare") or the next step.
  - Quick actions and "Before you go" were removed; the tiles cover them.

**Verified live (simulator):** Home with the Moshi trek, the Plan tab, and plan mode's days step (Jaipur).

**Checks:**
- Domain tests: 52.
- Mobile type-check clean.
- Production iOS bundle builds (7 MB).

### Follow-up: iOS corners, full-screen flows, no extra card (2026-10-20)

**Reported:**
- An extra card was added that isn't needed.
- The corners and the bottom tabs don't match iOS's own rounded corners.

**Changed:**
- **Whole flows open full screen**, sliding up: new trip, quick start, its draft, import bookings and plan mode.
  - Before, they were page sheets, which stack a rounded card over the screen beneath.
  - Add/edit sheets stay as sheets.
  - `Screen` lost its `modal` prop: it always clears the status bar.
- **The tab dock is a capsule**, inset 20pt from the sides and the bottom so its ends sit evenly inside the phone's
  rounded corners. The chosen tab is a capsule inside it.
- **What sits along the bottom edge follows the corners** (`AtEdge` / `useAtEdge`). In a screen's or sheet's
  footer:
  - Buttons and plan mode's Next are capsules.
  - Round keys are circles.
  - The ask bar is a capsule field with a round Send and a capsule Create.
  - Tiles in the page stay near-square.
- **Home no longer has the "Plan a trip with AI" card**; the Plan tab is in the dock.

**Verified live (simulator):**
- The Shared and Home docks.
- Plan mode full screen: start, trip sentence and days, with the capsule ask bar.
- Home without the extra card.

**Checks:** 52 domain tests, mobile type-check clean, iOS bundle builds.
