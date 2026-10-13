# Trips Loom for iOS and Android

This is the native Expo client for the existing Trips Loom workspace at [tripsloom.com](https://tripsloom.com). It shares the same accounts and trip data. The mobile project lives in `mobile/` so the web build stays independent. See [DESIGN.md](DESIGN.md) for colors, typography, spacing, motion, accessibility, and screen rules.

## Run it

Use Node 22.13 or newer, Xcode for iOS, and Android Studio for Android. From this directory:

```sh
npm ci
npm run typecheck
npm run doctor
npm run ios
# or: npm run android
```

The native development build uses Metro. `npm start` reconnects an installed development build. Expo Go can preview many screens, but email confirmation and password-recovery links require an installed development or release build with the app's `tripsloom` URL scheme.

The default API is `https://tripsloom.com`. Copy `.env.example` to `.env.local` only to target another deployed Worker. The app obtains Supabase's **publishable** URL/key from `/api/auth/config`; never place a service-role key in the mobile app.

## Account setup

In the Supabase project used by the deployed Trips Loom Worker, add these two URLs to **Authentication → URL Configuration → Redirect URLs** before testing email links:

```text
tripsloom://auth/callback
tripsloom://auth/reset
```

The app uses email/password sign-in, account creation, reset, four-step travel-profile onboarding, and a visitor workspace. Existing account data stays in the Worker-backed workspace and Supabase profile. SecureStore holds the mobile session; SQLite holds a per-account or per-visitor workspace cache. Edits save locally first and sync automatically with revision checks. A concurrent-edit conflict requires an explicit recovery choice in Settings; local edits are retained until that choice.

## Product scope

The native screens cover trip creation/editing/copying, calendar and day details, activities, wardrobe with private photo upload, outfits, essentials, automatic/manual packing, profile/theme settings, and workspace/calendar/packing exports. The five primary tabs are Calendar, Wardrobe, Essentials, Packing, and All trips. Outfits sit within Wardrobe; Settings opens from the header. UI uses React Native controls, Expo modules, and the existing Supabase SDK, without an added UI component framework.

## Verification and release

Run `npm run typecheck`, `npm run doctor`, and `npm run export` before each release. The `eas.json` profiles support a simulator build, an internal preview, and production builds. Link this app to the Trips Loom Expo account (`npx eas-cli init`), then add platform signing credentials and build with `npx eas-cli build --platform all --profile production`. Store submission and the Supabase redirect allowlist need the owner's account access. This app replaces the earlier native iOS app and ships as an update to the same App Store listing: the iOS bundle ID is `com.tripsloom.ios`, the widget extension is `com.tripsloom.ios.widgets` and the App Group is `group.com.tripsloom.ios`. The Android package is `com.tripsloom.app`. The build number must stay above the last build uploaded for the native app.

Before release, check sign-up/confirmation, password reset, guest-to-account data claim, private wardrobe photo upload, offline edits and reconnection, conflicting edits from a second device, calendar/packing exports, dark and light appearance, large text, and the phone/tablet layouts on physical iOS and Android devices. JS exports alone do not prove native behavior.
