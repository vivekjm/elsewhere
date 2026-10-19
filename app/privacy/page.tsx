export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: "48px auto", padding: 24, lineHeight: 1.7, color: "#172329", background: "#fff" }}>
      <h1>Trips Loom privacy</h1>
      <p>Updated 19 October 2026. Trips Loom stores the travel information you choose to add so you can plan, pack and use your trips across devices.</p>
      <h2>Information and storage</h2>
      <p>Accounts use Supabase for authentication and travel profiles. Signed-in trips, plans, packing lists and wardrobe information are stored using Cloudflare and Supabase. Uploaded wardrobe and cover photos are private to your account. The native iOS app keeps travel documents and new health check-ins on your device with iOS file protection. New app versions do not upload health logs or include them in invitations. Data already uploaded by older versions is removed when its trip is next saved, or when the account is deleted. Guest data is tied to your device or browser.</p>
      <h2>External services</h2>
      <p>The native app uses Apple Maps and Open-Meteo for destination lookup and weather, ExchangeRate-API for currency rates, and Unsplash for cover imagery. Requests may disclose your destination query and IP address to the relevant provider. Apple&apos;s on-device AI drafts trips when available. App Store purchases are processed by Apple.</p>
      <h2>Planning, reels and AI</h2>
      <p>When you share a reel or post to Trips Loom, your phone opens its public link preview (caption, hashtags and cover image) to read it. The video is not downloaded. Place names are looked up on OpenStreetMap through Photon (by komoot), which receives the place name and the area of your destination.</p>
      <p>When AI planning is available, Trips Loom&apos;s server sends only the text a task needs to its AI provider, currently DeepSeek, whose servers are in the People&apos;s Republic of China. To find places in posts, it sends the posts&apos; public text and anything you typed or pasted into the planner. To suggest ideas, it sends the destination, the places already on the trip&apos;s board, the group&apos;s size, food and budget preferences, and your question. Your name, email address, account ID, contacts, documents and the rest of your trips are never sent, and nothing is sent when you add places yourself. Don&apos;t paste personal information into the planner. The AI&apos;s answers may be kept on Trips Loom&apos;s server for up to 7 days, under a fingerprint of the request, so the same post isn&apos;t sent twice. Each account has a daily AI allowance; we count calls, not their content. On iPhones with Apple Intelligence, reading and suggestions can run on the device instead, and then nothing leaves it.</p>
      <p>On shared trips, the ideas you add, your votes and your travel preferences (pace, food and budget) are visible to everyone on the trip.</p>
      <h2>Product analytics</h2>
      <p>If you allow it in Data &amp; privacy, the app records named events (for example, that a trip was created or a plan was drafted) with a few small details, never trip content such as names, places, amounts or notes. They are stored in Trips Loom&apos;s own database, not sent to an analytics company, and you can turn them off at any time.</p>
      <h2>Permissions and sharing</h2>
      <p>Notifications are optional. Photos and document selection use system pickers. Face ID or your passcode can protect the document viewer. The app does not request contacts or current-location access. Trip invitations include names, plans, expenses and votes; recipients can read and forward them. Copies you share cannot be recalled.</p>
      <h2>Your choices</h2>
      <p>In the iOS app, Profile → Data &amp; privacy provides export, restore and account deletion. Account deletion removes the server workspace, uploaded photos, profile and native trip details. Some data may already be removed if deletion is interrupted; retry to finish. Cancel App Store subscriptions separately with Apple. Export documents individually before deleting a trip or signing out, as those files only exist on the device.</p>
      <h2>Retention and support</h2>
      <p>Account data is kept while you use the account and removed when account deletion completes. A minimal marker containing the account ID and deletion date is retained to prevent older requests from recreating deleted data; it contains no trip or profile details. Provider backups may remain under their backup retention schedules. Send privacy questions through Help &amp; feedback in the app. Shared exports and invitations are controlled by their recipients.</p>
    </main>
  );
}
