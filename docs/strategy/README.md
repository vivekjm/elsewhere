# Tripsloom product and business strategy

October 2026. A one-pass strategy review covering the product as built, about 14 competitors and adjacent products, the Indian and global markets, and business models. This is research only: no application code was changed.

## Contents

| Document | What's in it |
| --- | --- |
| [1. Current product assessment](01-product-assessment.md) | What actually works (checked in the code), strengths, weaknesses, and what to simplify or cut |
| [2. Competitor analysis](02-competitors.md) | Profiles of 12 competitors plus adjacent products, the comparison and feature-gap matrix, user complaints, what competitors overlook, sources |
| [3. Product opportunities](03-opportunities.md) | 4 signature features, the top 10 improvements (each with problem, evidence, effort, risk and metric), 20 feature ideas, and UX and retention changes |
| [4. Business model, market and growth](04-business-model.md) | Segments, India vs global, positioning, monetisation options, illustrative unit economics, acquisition and retention, risks |
| [5. Roadmap, experiments, what not to build](05-roadmap-and-experiments.md) | The decision, a phased roadmap with exit gates, 7 validation experiments, the "won't build" list, the metrics dashboard |
| [6. How apps analyse a reel](06-reel-analysis.md) | The common reel → places pipeline, what each app does, how the reel is obtained (Instagram, TikTok, YouTube), signal costs, failure modes, and a recommended ladder for Tripsloom |
| [7. Plan mode](07-plan-mode.md) | The guided reels-to-trip flow as built: steps, what makes it different, where the AI runs, what it reads, what was verified, and what's left before launch |

Evidence labels used throughout: **[Verified]** means confirmed in this repo or a primary source; **[Reported]** means a secondary source; **[Assumption]** means our reasoning; **[Speculative]** means an idea to test.

---

## Executive summary

### What Tripsloom is today

A well-crafted app that tries to do everything: a planner, an "AI" drafter, shared costs, packing and wardrobe, documents, trek and dive tools, flight tracking, widgets. That's about 55 screens across two clients. The code shows four problems that matter more than any missing feature:

1. **The "AI" planner is mostly templates.** The stops are placeholders like "Main museum". A real model runs only on iOS 26 or later with Apple Intelligence, which excludes about 90% of Indian phones (Android). Yet the paywall sells it as "Unlimited AI planning".
2. **Collaboration is a copy.** Invites send a snapshot, so friends' expenses and votes never sync.
3. **The growth loop breaks at the link.** Invites are `tripsloom://` links that do nothing for anyone without the app.
4. **Nothing is measured, and some basics are missing.** There's no product analytics, and the app's Terms, Help and Privacy links return **404** in production, which blocks store review.

### What the market says

- **AI trip planning is now free and owned by the platforms that hold the supply.** Expedia bought Layla (July 2026), Mindtrip books flights in its chat, Gemini plans from Google Maps, Flights and Hotels, and MakeMyTrip's Myra and ixigo's TARA serve India in Hinglish. An independent app can't win that race.
- **Nobody owns the group layer**: deciding together, planning together, paying fairly. Groups plan in WhatsApp, track debts in Splitwise (whose free tier now caps daily expenses and shows ads) and pay in UPI. No product combines a shared plan, group decisions and settling up in UPI.
- **India fits this especially well.** Indian Gen Z group trips on Airbnb grew about 55% year on year. Millennials and Gen Z make 9 in 10 international trips. WhatsApp and UPI are universal, and Android is about 90% of phones.

### What Tripsloom should become

> **The trip room for friend groups: where a group decides, plans and pays, and the organiser stops chasing everyone.**

Signature features:

1. **Trip Room:** one live trip that friends join from a WhatsApp link, with no install.
2. **Fair Share:** "What will this cost me?" before anyone commits, an organiser-fronted ledger, and one-tap UPI settle-up.
3. **Ready Check:** the organiser's dashboard of who has paid, booked, uploaded their ID and packed, with friendly nudges.
4. **Reel-to-Room:** reels shared to the trip become a shortlist the group votes on. Validate this one before building it.

### How it becomes a business

- **Growth:** the invite loop is the engine. Every trip reaches 4–6 new people at the moment they're deciding. Paid acquisition buys organisers only.
- **Revenue:** contextual **affiliate** offers (stays, activities, insurance, eSIM, forex) are the main source in India. A **per-trip Trip Pass** for organisers fits occasional travel better than annual plans. Keep **Pro** for frequent organisers, and validate a **B2B operator plan** for trek and tour batches.
- **Illustrative economics:** about ₹165 expected revenue per domestic trip of 5 friends, rising 3–5× for international trips. Every input is an assumption to replace with measured data.
- **Defensibility:** each group's shared money and plan are hard to move elsewhere. India-specific depth (UPI, holidays, Hinglish, trek operators) is the moat, and craft quality stands out in a category known for slow, crashy apps.

### The decision

**Build next:** Phase 0 (3 weeks):

- analytics;
- legal pages and universal links;
- honest AI labels;
- India-first Discover;
- a UPI pay button.

**Then** Phase 1, the **shared Trip Room**, tested with 50–100 real groups against clear thresholds: invite→join ≥ 40%, viral coefficient ≥ 0.5, settle-up ≥ 50%.

**Don't build:**

- a general AI agent;
- a booking engine;
- in-app chat;
- a wallet;
- more flight-tracking or trek and dive tabs for consumers;
- anything that doesn't serve the group's decide → plan → pay loop.

**Validate first** (before large engineering spend):

- positioning ("plan with friends" vs "AI planner"): E1;
- Trip Pass price: E2;
- a hand-built concierge Trip Room with 20 groups: E3;
- operator demand: E6.

### Answers to the founding questions

| Question | Answer |
| --- | --- |
| What should Tripsloom become? | The shared trip room for friend groups, India first: decide, plan and pay together. |
| What are we missing? | A live shared trip, joining from a link, group decisions (dates and RSVP), a payment hand-off, analytics, working legal pages, and content for our actual market. |
| What can we do significantly better than competitors? | Combine the plan with the money, serve the organiser (Ready Check, fronted ledger), work without an install in WhatsApp, and stay faster and more polished than slow, crashy rivals. |
| What unique value can we create? | "Know what it costs me, see who's ready, settle in one tap": a group's whole trip in one link. |
| How does that become a sustainable business? | A free invite loop for acquisition; affiliate offers at moments of intent plus a per-trip organiser pass for revenue; a B2B operator plan as a second line; close-to-zero cost to serve. |
