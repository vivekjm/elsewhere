# Release checklist: checks that need the company account or a real iPhone

Everything else is covered by the automated suite (unit, backend
integration and UI tests), which passes on a freshly erased simulator.
Run these once before the first App Store submission.

## 1. Signing (company Apple Developer account)

1. Xcode → Settings → Accounts → add the company Apple ID.
2. Build to a phone with the company team:
   `xcodebuild -project TripsLoom.xcodeproj -scheme TripsLoom -destination 'id=<iPhone UDID>' DEVELOPMENT_TEAM=<TEAM_ID> -allowProvisioningUpdates build`
3. In the developer portal, confirm the app group `group.com.tripsloom.ios`
   is on both `com.tripsloom.ios` and `com.tripsloom.ios.widgets`.

## 2. Purchases (App Store Connect)

1. Create the subscriptions `com.tripsloom.pro.yearly` and
   `com.tripsloom.pro.monthly` with the prices in `TripsLoom.storekit`
   (₹2,499 with a 7-day trial; ₹349).
2. On the phone, sign in with a Sandbox tester (Settings → App Store).
3. Profile → "Free · see Pro" → buy yearly → the chip reads "Pro · Yearly".
4. Delete and reinstall → Restore purchases → Pro returns.
5. Cancel in Sandbox settings → after renewal lapses, Pro turns off on next launch.

## 3. Production sign-in

1. Create an account with a real email; confirm via the email link (it
   opens the app).
2. Make a trip on the phone → it appears on tripsloom.com, and the reverse.
3. Sign out (refuses while edits are unsynced) → sign back in → trips return.
4. Delete account (Profile → Data & privacy) with a throwaway account.

## 4. Hardware

- **Document scanning:** Documents → Add → Scan a ticket; check the saved
  title, then Face ID lock → leave the app → returning asks once.
- **Reminders:** turn on Trip reminders with a trip starting tomorrow →
  "starts tomorrow" arrives at 6 pm destination time.
- **Live Activity:** Ticket → Show on Lock Screen; delete the trip → it
  disappears.
- **Widget:** add Next trip to the home screen; pack gear → count updates.

## 5. Supabase (when on a paid plan)

- Auth → Passwords → turn on leaked-password protection.

## 6. Social sign-in (Supabase dashboard)

Release builds show the Apple and Google buttons only once the provider is
switched on in Supabase, so the app ships safely before this is done.

1. Auth → URL Configuration: add `tripsloom://auth/callback` to the
   redirect URLs.
2. Google: in Google Cloud, create an OAuth client (Web application) with the
   redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. Paste
   its client ID and secret into Auth → Providers → Google and enable it.
3. Apple (company account): turn on Sign in with Apple for
   `com.tripsloom.ios` in the developer portal, then in Auth → Providers →
   Apple add `com.tripsloom.ios` to the client IDs and enable it.
4. On the phone: Continue with Google and Continue with Apple each land in
   onboarding with the name filled in, and the account appears on the web.
