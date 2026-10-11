# Trips Loom for iOS (native)

A SwiftUI app for iOS 26, built from the **Nightglass** design (`Trips Loom iOS Nightglass.dc.html` in the Claude Design handoff). It is separate from the Expo app in `mobile/` and shares no code with it.

The current implementation, testing evidence, and remaining launch requirements are recorded in [the product audit](QA/PRODUCT_AUDIT.md). Local passing checks do not mean the backend changes or a native release have been published.

## Run it

Open `TripsLoom.xcodeproj` in Xcode 26 or later, pick the **TripsLoom** scheme and an iPhone simulator, and run. From the command line:

```sh
xcodebuild -project TripsLoom.xcodeproj -scheme TripsLoom \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

To run on a device, set your team under **Signing & Capabilities** for both targets. The bundle IDs are `com.tripsloom.ios` and `com.tripsloom.ios.widgets`.

The project uses folder-synced groups, so new `.swift` files in `TripsLoom/`, `TripsLoomWidgets/` or `Shared/` are picked up without editing the project file. `scripts/make-icon.swift` redraws the app icon.

## Layout

| Folder | What's in it |
| --- | --- |
| `TripsLoom/Design` | Nightglass tokens (lime, mint, coral, SF Pro and SF Mono), glass surfaces, the photo backdrop, pill controls, rings, the pill bar chart and the elevation chart |
| `TripsLoom/Model` | `Trip` and related types, `TripStore` (JSON in Application Support), legacy sample fixtures; fresh stores are empty |
| `TripsLoom/Services/Backend` | Supabase Auth, the tripsloom.com workspace and photo APIs, the web-format mapper and the sync engine |
| `TripsLoom/Services` | On-device trip drafting, booking parser, packing suggestions, stylist, reminders, Live Activities |
| `TripsLoom/Screens` | Common (C1–C14), trip (L1–L5), adventure (A1–A7), plus Tides and Stops |
| `TripsLoomWidgets` | The flight and trail Live Activities (C13, A8) |
| `Shared` | `TripActivityAttributes`, used by both targets |

The tab bar changes with the trip type, as in the design: global (Trips · Discover · Shared · Profile), city (Trip · Days · Wardrobe · Packing), trek and camp (Trip · Route · Gear · Safety), climb (Trip · Climb · Gear · Safety), beach (Trip · Days · Tides · Packing), road (Trip · Route · Stops · Packing). Each bar has the separate search circle.

## Motion

`Design/Motion.swift` holds the motion system, and everything in it follows Reduce Motion:
- **Zoom transitions**: trips open out of the card you tapped (home, Up next, Shared, Search) and close by pulling down. The planner, new trip, Pro, garments, outfits and recaps zoom from their source too.
- **Screens** (`NightScreen`): cards rise in one after another on first appearance and ease back under the bars while scrolling. Big titles hand off to a toolbar title, and heroes stretch on pull-down and drift at half speed.
- **Data**: rings draw in, bars grow, and numbers roll when they change. The pill charts rise bar by bar, and you can tap a bar to see its value. Elevation lines draw from left to right.
- **Controls**: the lime selection slides between days, filters and segments with haptics. The day's plans slide in the direction you move, and a sideways swipe changes day. Checks pop, and packing the last item pulses the ring.
- The tab bar minimizes while scrolling down, on iOS 26.

## Accounts and sync

The app uses the same backend as tripsloom.com, so the same account works in both places.
- **Sign-in**: Supabase Auth (project `vofbzrydjbappwuhgcik`) over its REST API. The app reads the URL and publishable key from `https://tripsloom.com/api/auth/config`.
  - **Methods**: email and password, create account, password reset, and email links through the `tripsloom://auth/callback` and `tripsloom://auth/reset` schemes.
  - **Apple**: Sign in with Apple only appears when the Apple provider is turned on in Supabase.
  - **Storage**: tokens are kept in the Keychain and refresh on their own.
- **Trips and wardrobe** sync through the Worker's `/api/workspace`, which holds one revisioned document per account.
  - **Local first**: edits save on the phone first and push after 1.5 seconds.
  - **Conflicts**: a conflict (409) fetches the newer copy and merges it. Conflicting trip edits recover the local version separately rather than silently overwriting the other version.
  - **Mapping**: `WorkspaceMapper` converts between the app's model and the web's `lib/model.ts` format, and keeps web-only fields such as links, notes, end times and occasions.
- **Native-only trip details** go in the Supabase table `public.trip_extras`, which is owner-only under RLS (migration `supabase/migrations/20260925_trip_extras.sql`). These are trip type, route stages, gear, safety settings, expenses and votes. New health check-ins remain local and are stripped from cloud writes and invitations.
- **Wardrobe photos** upload to `/api/images`.
- **Profile**: name, home airport, units, travel style and native travel preferences go to `public.profiles`. Feedback uses an owner-protected `public.feedback` table (migration `supabase/migrations/20260926_native_preferences_feedback.sql`).
- **Sample trips** never upload. They're removed when you first sign in.
- **Status**: Profile → Account shows the sync state. Tap it to sync now.
- **Checking the mapper**: build Debug and launch with `-sync-self-test`. The app writes `export-1.json` and `export-2.json` to Documents, and these should pass the web validator and be identical.

### Testing sync end to end

`scripts/e2e/run.sh` starts a local replica of the backend on `http://127.0.0.1:8787`, seeded with a workspace made on the website. It copies the Worker's workspace and photo routes and checks every save with the web's real `workspaceSchema`, including its 409 on a stale revision and its stripping of unknown fields. It also imitates Supabase Auth and the `profiles` and `trip_extras` tables with per-user access.
- **Launch**: start a Debug build with `-backend-url http://127.0.0.1:8787`. Release builds always use tripsloom.com.
- **Sign in without a password**: `curl localhost:8787/__admin/mint` returns a session. Open `tripsloom://auth/callback#access_token=…&refresh_token=…&expires_in=3600&type=signup` with `xcrun simctl openurl booted`, which is the same path as the link in a confirmation email.
- **Act as the website**: `POST /__admin/web-edit` with a workspace saves a change. `POST /__admin/edit-before-next-put` makes the website save in the gap between the phone's fetch and its PUT.
- **Other controls**:
  - `GET /__admin/offline?on=1` drops every connection.
  - `/__admin/mint?ttl=70` issues short-lived tokens, to test refresh.
  - `/__admin/state` and `/__admin/log` show what the server holds and received.

Scenarios covered so far:
- A guest's own trips move into a new account, and the sample trips and unused sample wardrobe are dropped.
- Web IDs that aren't UUIDs are kept.
- Web-only fields survive: links, notes, end times, completed, occasions, day titles.
- Edits made on the website arrive on the phone.
- Edits from both sides merge per record, including the 409 race.
- Deletions work in both directions.
- Edits made offline and while signed out go up later.
- Refresh and rotation of tokens work.
- A session revoked on the server ends in "Sign in again" with the trips kept.
- A reinstall doesn't reuse a stale Keychain session.
- A new device restores native trip types from `trip_extras`.
- Wardrobe photos upload and download.

Supabase settings to check in the dashboard:
- **Redirect URLs**: add `tripsloom://auth/callback` and `tripsloom://auth/reset` under Auth → URL Configuration.
- **Sign in with Apple**: turn on the Apple provider, add the bundle ID `com.tripsloom.ios` as a client ID, and add the capability to a signed build.
- **Leaked password protection**: turn it on under Auth → Passwords. The security advisor flags it as off.

## What's real and what isn't yet

Working:
- Trips, plans, route stages, packing, wardrobe (with photos), gear, budgets, votes and check-ins. All of it is saved on the device. If the saved file ever can't be read, a copy is kept beside it rather than overwritten.
- Empty first-use trips/wardrobe, skippable travel preferences, and Profile links for data/privacy, preferences and feedback. Legacy sample notices appear only for actual sample records.
- Units (metric or imperial), destination-local dates and currency-aware input/formatting. Text follows Dynamic Type including accessibility sizes; Home adapts its layout at large sizes.
- Local notifications for trip-eve and trail check-in reminders.
- Flight and trail Live Activities.
- Booking import from pasted text or a scanned document (VisionKit and Vision).
- Share sheets, and hand-offs to Maps, Find My and emergency calls.
- **Weather**: a live daily forecast (Open-Meteo, no key) for each day within 16 days, placed where you sleep that night (the latest stay's place). Beyond 16 days, last year's actual weather on the same dates, labelled "Last year on this date". Places are geocoded with Apple Maps (`Services/Places.swift`), preferring the phone's country, so "Kerala" is India, not Kerälä in Finland.
- **Invites**: Invite people (trip ⋯ menu, the share button, or Shared → Invite) sends a `tripsloom://join` link plus a `.tripsloom` file. The recipient picks who they are; costs are re-labelled from their side ("You owe Vivek ₹600"). Sharing again updates their copy and keeps their packing, outfits and cover. Links carry a compact LZMA copy and are dropped (file only) past ~1,900 characters, because iOS cuts opened links at 2,047. Opening your own invite is recognised and changes nothing. No server is involved: updates travel only when re-shared.
- **Cover photos**: Edit trip → Cover → Use your own photo. Stored on the device, uploaded to the account's private photos when signed in (`coverRemote`), and shown everywhere the trip's photo appears via the `customCover` environment value.
- **Route map**: Safety shows the route on Apple Maps satellite imagery, with stops geocoded from stage names (stray matches far from the rest are dropped). Tap for the full map; a snapshot is saved for offline use and redrawn when the route changes. For turn-by-turn without signal, the app points to Apple Maps offline maps. Trek and road-trip weather uses these stops.
- **Summit wind**: Climb → Set up summit (peak, summit and high-camp heights). Wind and dawn temperature at the summit's height come from Open-Meteo pressure levels, interpolated, for 01:00–11:00 each day; the go window is picked from your summit days. Sample climbs keep sample data.
- **Split costs**: add the people on a trip in Edit trip; expenses record who paid and who shares them. The Shared tab computes who owes whom and records settlements. Stored in the trip, so it syncs through `trip_extras`.
- **Planner without Apple Intelligence**: `PromptFacts` reads length, dates ("in December", "from 12 Nov"), people ("with my parents"), budget ("60000 rupees", "1.5 lakh") and interests; `Destinations` has real highlights for ~25 popular places. Plans get a category, time and area; stays get a Map button.
- **Documents**: per-trip tickets, IDs, vouchers and permits from the document scanner, Photos or Files. Stored only on the device with complete file protection, never synced, and removed when the trip leaves the phone. Required items on the packing list are suggested.
- **Currency**: trips in a currency other than the phone's show the total in home currency and a two-way converter (open.er-api.com, cached for offline use).
- **Itinerary PDF**: A4 export of every day, stay, cost, note and must-bring document, from the trip's ⋯ menu.
- **Review prompt**: asked once per version, after a real trip's packing list (8+ items) is complete.

Partial or not connected:
- **AI planner** uses Apple's on-device Foundation Models when Apple Intelligence is available and falls back to a rule-based template otherwise. The draft is labelled "AI draft" or "Quick draft" so you know which one ran. In the iOS 26.1 simulator the model reports available but fails when generating, so only the fallback has been tested.
- **Pro**: purchases go through StoreKit 2 with the product IDs `com.tripsloom.pro.yearly` and `com.tripsloom.pro.monthly`. These have to be created in App Store Connect before real purchases work. Pro is re-checked with the App Store at launch, on every foreground and via `Transaction.updates`, so lapsed or refunded plans are removed.
  - Free plan: 3 AI drafts a month (template drafts don't count), 3 documents per trip. Pro: unlimited drafts and documents, Face ID lock for documents, itinerary PDF. Trips, packing, budgets, weather, wardrobe, shared trips and safety check-ins stay free.
  - To test purchases in the simulator, choose `TripsLoom.storekit` under Edit Scheme → Run → Options → StoreKit Configuration. It has both plans with a one-week free trial.
  - The paywall includes privacy and Apple's standard Terms of Use links, uses StoreKit prices/trial eligibility and supports restore. The public privacy route still needs deployment, and real App Store products/signing/Sandbox checks remain release requirements.
- **Sample data**: tides are calculated from the lunar cycle, and the sample Island Peak climb keeps its sample wind. Each is labelled on screen.
- **Not connected**: Apple Health readiness, email forwarding (labelled "Coming soon") and partner bookings.
- **Photos** are the design's Unsplash images, cached on the device, with gradient fallbacks when offline.
- **Data controls**: versioned JSON export/restore excludes photo/document assets and credentials; the UI explains those limits. Account deletion needs the newly implemented Worker route and a server-only Supabase admin secret deployed before it can work in production.
- **Weather licensing**: free Open-Meteo endpoints are limited to noncommercial use. A paid product needs a permitted provider/plan; see the audit before enabling real subscriptions.
