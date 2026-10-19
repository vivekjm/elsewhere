export const metadata = { title: "Help · Tripsloom" };

const Q = ({ q, children }: { q: string; children: React.ReactNode }) => <section><h2 style={{ fontSize: 20, marginBottom: 4 }}>{q}</h2><p style={{ marginTop: 0 }}>{children}</p></section>;

export default function HelpPage() {
  return (
    <main style={{ maxWidth: 760, margin: "48px auto", padding: 24, lineHeight: 1.7, color: "#172329", background: "#fff" }}>
      <h1>Trips Loom help</h1>
      <Q q="How do I plan a trip with friends?">Create the trip, then tap Share trip and send the link to your group chat. Everyone who opens it joins the same trip: they say if they’re in, vote on plans and dates, and add their own costs. Changes show for everyone.</Q>
      <Q q="My friend doesn’t have the app. Can they still see the trip?">Yes. The link opens a page with the plan, who’s coming and the cost per person. To vote, add costs or settle up, they install Trips Loom and open the link again.</Q>
      <Q q="How does settling up work?">Add expenses as you go and choose who shares each one. Settle up shows the fewest payments that square everyone. If the person you owe has added their UPI ID, Pay with UPI opens your UPI app with the amount filled in; save it as paid when it has gone through.</Q>
      <Q q="What’s the trip kitty?">Everyone puts the same amount in with one person, who pays shared costs from it. Costs paid from the kitty are shared by everyone automatically, and a top-up only counts against the holder as the pot is spent.</Q>
      <Q q="What stays private?">Your wardrobe, outfits, packing ticks, documents, health check-ins and emergency contacts stay on your phone. Ready check shares only the ticks.</Q>
      <Q q="How do I stop a link working?">Open the trip, tap Share trip, then Turn off this link. A new link is made; the old one stops working. People already on the trip stay on it.</Q>
      <Q q="What does Quick start do?">It turns a sentence like “4 days in Goa with 5 friends” into a day-by-day outline with dates, people and budget, built on your phone. Fill in the real places yourself or with your group.</Q>
      <Q q="Something isn’t working">Use Help &amp; feedback in the app (Profile › Help &amp; feedback). We read every message.</Q>
    </main>
  );
}
