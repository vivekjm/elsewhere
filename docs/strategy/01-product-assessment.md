# 1. Current product assessment

What Tripsloom actually is today, checked against the code in this repository (October 2026), not against the marketing copy. Paths are relative to the repo root.

Labels used throughout these documents:

- **[Verified]**: confirmed in this repository or on a primary source.
- **[Reported]**: stated by a secondary source (press, review sites, competitor blogs).
- **[Assumption]**: our reasoning, not yet tested.
- **[Speculative]**: an idea worth testing.

---

## 1.1 What exists

Two clients share one account system.

| Surface | Stack | What it does |
| --- | --- | --- |
| **Web planner** (`app/`, `components/travel/`) | React 19, Vinext, Cloudflare Workers, D1, R2, Supabase Auth | A calendar-first planner whose roots are outfits and packing: wardrobe, outfits, a connected packing list, animated covers, backups and exports. Visitor workspaces work without an account. |
| **Mobile app** (`mobile/`) | Expo SDK 57, React Native, Supabase | A much wider product: trips, itinerary, map, budget, shared costs, votes, documents, wardrobe and stylist, packing, trek tools (stages, gear, altitude check-ins, summit forecast), dive tools (tides, dive log), live flight position, widgets, Live Activity, AI drafting, booking import, Pro subscription. |

About 55 routes live in `mobile/app/`: 4 main tabs, 9 trip tabs, 5 trek tabs, 20 sheets, 4 modals, 8 full pages, plus sign-in and onboarding.

## 1.2 What really works, and how well

| Capability | Reality in code | Verdict |
| --- | --- | --- |
| **AI trip drafting** | `mobile/src/domain/drafter.ts` is a template engine. A regex parser reads days, dates, people and budget from the prompt, then fills days from 12 fixed "interest" templates and 2 per trip kind. Stops are placeholders such as "A neighbourhood of your choice", "Main museum" and "Dinner somewhere local". Real model output comes only from Apple Foundation Models (`services/intelligence.ts`), which needs iOS 26 or later with Apple Intelligence. There is no server-side model. | **Weak, and labelled more strongly than it is** [Verified]. Most users, and every Android user, get templates with no real places. Yet the paywall sells "Unlimited AI planning" and limits these drafts to 3 a month. |
| **Collaboration** | `mobile/src/services/invite.ts` packs a snapshot of the trip into a `tripsloom://join?d=…` link. Each person gets their own copy, and opening a newer invite replaces it. Nothing syncs: an expense one friend logs never reaches the others unless the organiser re-sends the whole trip. | **Not real collaboration** [Verified]. Wanderlog, Mindtrip, Lambus and Splitwise all keep one shared state. |
| **Invite links** | The link uses the custom `tripsloom://` scheme. No universal link or associated domain is configured. Trips too long for 1,900 characters fall back to "copy this whole message, then paste it into the app". | **Breaks the viral loop** [Verified]. A friend without the app gets a link that does nothing, usually inside WhatsApp, where most Indian group planning happens. |
| **Shared costs** | Expenses, splits, settle-up, multi-currency (open.er-api), receipt OCR on iOS. | **Good locally** [Verified], but only on each person's own copy (see above). No payment hand-off (UPI or payment links). |
| **Places and maps** | Photon/OpenStreetMap search, a trip map, offline OpenStreetMap tiles, "Route in Maps". | **Works** [Verified]. Point-of-interest data is thin next to Google or Foursquare: no ratings, opening hours or photos. |
| **Discover** | `mobile/src/domain/ideas.ts` has 12 hand-written ideas: Amalfi, Iceland, Kyoto, Mont Blanc, Lisbon, Morocco, Dahab, Kilimanjaro, Lofoten, Bali, Black Forest, Paris. | **Static, and almost entirely European** [Verified]. It has nothing for an Indian user, even though INR, ₹ formatting and Indian test data are in the app. |
| **Booking import** | `domain/bookings.ts` parses pasted confirmation text for flights, trains, stays and tickets. | **Useful** [Verified]. Paste-only: no email forwarding and no PDF parsing. |
| **Packing and wardrobe** | A deduplicated packing list from outfits, a weather stylist, suggestions by trip kind and weather. | **The most original part of the product** [Verified]. Its value to the target market is unproven [Assumption]. |
| **Trek and dive tools** | Stages, readiness score, summit wind forecast, altitude check-ins, tides, dive log. | **Deep but niche** [Verified]. Five extra tabs serve a small slice of users. |
| **Flights** | Position, altitude and arrival estimate from volunteer ADS-B data. No delays, gate changes or schedules. | **A novelty** [Verified]. TripIt Pro, ixigo and Tripsy cover what travellers actually need here: delays, gates and check-in. |
| **Monetisation** | `core/pro.tsx`: StoreKit subscriptions `com.tripsloom.pro.yearly` and `.monthly`. Free users get 3 AI drafts a month and 3 documents per trip. Everything else is free. | **Paywall sits on low-value limits** [Verified]. The drafts are mostly templates, and TripIt already uses the same 3-document free limit. No affiliate or booking revenue exists. |
| **Product analytics** | No analytics SDK or event tracking anywhere in `mobile/src` or `app/` (searched for analytics, posthog, amplitude, mixpanel, firebase, sentry, telemetry). | **Blind** [Verified]. Activation, retention, invite conversion and paywall conversion can't be measured. |
| **Legal and help pages** | The app links to `https://tripsloom.com/terms`, `/help` and `/privacy`. On 2026-10-15 all three returned **HTTP 404** in production (the home page returned 200). | **A release blocker** [Verified]. App Store review requires a reachable privacy policy. |

## 1.3 Strengths worth building on

1. **Craft and polish.** Motion, the card-to-page transition, widgets and the Live Activity are well above most indie travel apps. Wanderlog and Stippl reviews often cite slowness and crashes [Reported, see the competitor document]. Quality can be a real reason to choose Tripsloom.
2. **Money plus plan in one place.** Most competitors do either the plan (Wanderlog, Mindtrip) or the money (Splitwise). Tripsloom already has both models in code, which is the base of the recommended direction.
3. **Privacy-respecting, low running cost.** Weather, places and rates come from free sources (Open-Meteo, Photon, open.er-api), and AI runs on the device. The cost to serve a free user is close to zero [Verified in code; cost is an assumption]. That allows a generous free tier where Splitwise and Wanderlog have tightened theirs.
4. **Things competitors don't have.** A packing list built from planned outfits, trek readiness and altitude safety, and documents behind Face ID. They're niche, but defensible in their niches.
5. **Cross-platform.** One React Native codebase ships iOS and Android, including an Android widget. Apple is about **10% of Indian smartphone volume** [Reported, IDC via EE Times India], so Android is the main battleground in India.

## 1.4 Weaknesses, ranked by business impact

1. **No wedge.** The product tries to be a planner, an AI agent, a Splitwise, a TripIt, a PackPoint, a Polarsteps, a trek app and a dive app at once. Each of those is done deeper by a funded specialist. A new user has no single, memorable reason to install it.
2. **Collaboration is a copy, not a shared trip.** Groups are the most natural growth engine in travel: every trip has 2 to 8 people. Copy-based invites cap the product at single-player value.
3. **The growth loop is broken at the link.** `tripsloom://` links don't open for anyone without the app, and many messengers don't make custom schemes tappable at all.
4. **"AI" over-promises.** Generic stops sold as unlimited AI planning invite one-star reviews ("it just says *Main museum*"). Meanwhile Google Gemini (connected to Maps, Flights and Hotels), Mindtrip, Expedia's Layla, MakeMyTrip's Myra and ixigo's TARA give AI planning away free or near free, built on real inventory. Tripsloom can't win a general AI-planner race.
5. **The content and market don't match.** The user base and test data are Indian (INR, Bengaluru home base, Goa trip), but Discover, the sample prompts and the voice are European.
6. **Nothing to measure with.** Without analytics, none of the recommendations here can be validated.
7. **Monetisation doesn't match how people travel.** People open travel apps a few times a year: Day-30 retention for the travel category is about 2.8–3.1% [Reported, AppsFlyer data via Braze and Business of Apps]. An annual subscription is a hard sell for episodic use, especially in India.
8. **Surface area outruns the team.** Around 55 screens, two clients (web and mobile) with different feature sets, plus custom native modules for widgets, the Live Activity, on-device AI and text recognition. That's a lot of maintenance for a small team.

## 1.5 Unnecessary complexity: simplify or cut

| Area | Today | Recommendation |
| --- | --- | --- |
| Trip kinds with separate tab systems (trek: 5 tabs; dive: tides) | A trek gets a different home, tab bar and tools | **Keep trek as a "mode", not a parallel app.** Fold Prepare, Climb and Safety into sections of the trip page. Hide the dive tools behind a toggle until usage proves demand. |
| Live flight position (ADS-B) | Shows where the plane is | **Freeze; don't invest.** Delays and gates are what matter, and those need a paid data feed. |
| Wardrobe-first stylist | A core tab inside every trip | **Make it optional.** Keep it for people who opt in during onboarding, and take the Wardrobe tab off the trip bar for everyone else. Test whether it drives retention before investing more. |
| AI draft limit as the paywall | 3 template drafts a month | **Remove the limit** on template drafts (they cost nothing), and **stop calling templates AI**. Put the paywall where value is real (see the business model document). |
| Two diverging clients | The web planner and the mobile app have different feature sets | **Use web for one job: the shared trip page.** It should be what a friend sees from a WhatsApp link, not a second full planner. |
| Onboarding "focus" tiles (6 interests) | Collected, then barely used | **Replace them with one question that sets the mode:** "Who's coming?" (just me, partner, family, friends). |

## 1.6 What this means

Tripsloom has good craft spread across too many jobs, with growth blocked at the share link and no measurement. The strongest assets already in the code are **shared costs, a day-by-day plan and an organiser's view of the group**. Those match the largest unsolved pain in the market, analysed next: friend groups who plan in WhatsApp and settle up in Splitwise or UPI.
