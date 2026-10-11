export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: "48px auto", padding: 24, lineHeight: 1.7, color: "#172329", background: "#fff" }}>
      <h1>Trips Loom privacy</h1>
      <p>Updated 26 September 2026. Trips Loom stores the travel information you choose to add so you can plan, pack and use your trips across devices.</p>
      <h2>Information and storage</h2>
      <p>Accounts use Supabase for authentication and travel profiles. Signed-in trips, plans, packing lists and wardrobe information are stored using Cloudflare and Supabase. Uploaded wardrobe and cover photos are private to your account. The native iOS app keeps travel documents and new health check-ins on your device with iOS file protection. New app versions do not upload health logs or include them in invitations. Data already uploaded by older versions is removed when its trip is next saved, or when the account is deleted. Guest data is tied to your device or browser.</p>
      <h2>External services</h2>
      <p>The native app uses Apple Maps and Open-Meteo for destination lookup and weather, ExchangeRate-API for currency rates, and Unsplash for cover imagery. Requests may disclose your destination query and IP address to the relevant provider. Apple&apos;s on-device AI drafts trips when available. App Store purchases are processed by Apple.</p>
      <h2>Permissions and sharing</h2>
      <p>Notifications are optional. Photos and document selection use system pickers. Face ID or your passcode can protect the document viewer. The app does not request contacts or current-location access. Trip invitations include names, plans, expenses and votes; recipients can read and forward them. Copies you share cannot be recalled.</p>
      <h2>Your choices</h2>
      <p>In the iOS app, Profile → Data &amp; privacy provides export, restore and account deletion. Account deletion removes the server workspace, uploaded photos, profile and native trip details. Some data may already be removed if deletion is interrupted; retry to finish. Cancel App Store subscriptions separately with Apple. Export documents individually before deleting a trip or signing out, as those files only exist on the device.</p>
      <h2>Retention and support</h2>
      <p>Account data is kept while you use the account and removed when account deletion completes. A minimal marker containing the account ID and deletion date is retained to prevent older requests from recreating deleted data; it contains no trip or profile details. Provider backups may remain under their backup retention schedules. Send privacy questions through Help &amp; feedback in the app. Shared exports and invitations are controlled by their recipients.</p>
    </main>
  );
}
