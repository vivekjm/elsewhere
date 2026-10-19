# 5. Roadmap, experiments and what not to build

## 5.1 The decision

**Build next: the shared Trip Room.** That means one live trip that friends join from a WhatsApp link without installing anything, with group decisions (dates, RSVP, votes), a per-person cost estimate and UPI settle-up. Everything else waits until the invite loop is measured.

Stop or freeze: selling template drafts as AI, the ADS-B flight tracker, more trek and dive depth, and new solo-planner features.

---

## 5.2 Roadmap

Time frames assume a team of 1–3 [Assumption]. Each phase has an exit gate. Don't start the next phase's big bets until the gate's metric is met, or a conscious decision is made to proceed anyway.

### Phase 0: Fix the foundations (weeks 0–3) · quick wins

| Item | Ref | Effort | Why now |
| --- | --- | --- | --- |
| Product analytics with about 25 events and funnels | T1 | S | Nothing else can be measured without it |
| Serve `/terms`, `/privacy`, `/help` (404 today); universal and app links for `https://tripsloom.com/t/…` | T2 | S | Release blocker; prerequisite for the invite loop |
| Honest AI: rename to "Quick start", remove the 3-a-month cap, change the paywall copy | T6 | S | Protects trust and reviews |
| India-first Discover (30 ideas with cost bands), INR and IST defaults from the home base, Indian holiday calendar data | T7 | S–M | The first-run experience matches the market |
| UPI "Pay" button on settle-up (`upi://pay` intent; only the payee enters their own UPI ID) | T5 (part) | S | Fast value, even before shared trips |

**Exit gate:** funnels are live, the store review passes, and baselines are recorded (trips created, invites sent, invite opens).

### Phase 1: The shared Trip Room (weeks 3–12) · big bet

| Item | Ref | Effort |
| --- | --- | --- |
| A live shared trip (membership, RLS, realtime, activity log), behind a flag; migrate copy-invites | T3 | L |
| The web Trip Room: plan view, "I'm in / maybe / out", votes, cost estimate, who's paid, WhatsApp preview card | S1, T4 | L |
| Date poll with availability and a long-weekend overlay; RSVP with a soft deadline | T8, F4 | M |
| Per-person cost estimate (range plus its basis) on the invite and in the Room | T9 | S–M |
| Organiser-fronted ledger, shared and settled with UPI | S2, T5 | M |
| Onboarding asks "Who's coming?"; the empty Home leads with "Start a trip with friends" | T10 (part) | S |

**Exit gate (friendly beta with 50–100 real groups):**

- Invite→join **≥ 40%** within 48 hours.
- **Median of 3 or more** members per active trip.
- Viral coefficient **≥ 0.5**.
- Settle-up completion **≥ 50%** within 14 days of trip end.

### Phase 2: The organiser's toolkit and first revenue (weeks 12–24) · high impact

| Item | Ref | Effort |
| --- | --- | --- |
| Ready Check dashboard and WhatsApp nudges | S3, F11 | M |
| Trip kitty | F10 | M |
| Morning day sheet image for WhatsApp | F13 | S–M |
| Group Recap card (Instagram, WhatsApp) | F16 | S–M |
| Contextual affiliate offers: stays from the shortlist, activities, insurance, eSIM for international trips | F15 | S per partner |
| Trip Pass test, priced by A/B test (see E2) | Business model, option B | S |
| Simplify the information architecture: trek and dive become modes, the wardrobe is opt-in, freeze the flight tracker | T10 | M |
| Import from PDFs and screenshots (on-device text recognition) | F7 | M |

**Exit gate:**

- Expected revenue per trip measured (target **≥ ₹100 per domestic trip** in the first version) [Assumption].
- Trip Pass conversion **≥ 3%** of organisers, or the plan is changed.
- Annual-return cohort tracking is in place.

### Phase 3: Defensibility and expansion (months 6–12) · longer-term

| Item | Ref | Gate to start |
| --- | --- | --- |
| Reel-to-Room shortlist (server extraction) | S4 | E5 (Wizard-of-Oz) shows ≥ 50% of shared reels resolve to real places, and shortlists convert to plans |
| "Do it again" templates and creator programme | F17 | 500 or more completed trips with recaps |
| Operator plan (trek and tour batches) | F18, business model option D | E6: at least 3 of 10 operators commit to a paid pilot |
| Family view | F14 | The Room is stable; solo-traveller demand confirmed in E1 segments |
| Hinglish share text, then a Hindi UI | F20 | India is 50% or more of active users |
| Print group books | Business model, option E | Recap share rate is healthy; a print partner is found |
| Global launch of group features (payment links instead of UPI) | Business model §4.2 | India product-market fit signals (Phase 1 and 2 gates met) |

---

## 5.3 Experiments to validate demand

Run E1–E3 during Phase 0, before the large engineering bets.

| # | Question | Method | Success threshold | Cost |
| --- | --- | --- | --- | --- |
| **E1. Positioning smoke test** | Does "plan with friends and settle fairly" pull more organisers than "AI trip planner"? | Two landing pages plus Meta and Instagram ads in Bengaluru, Mumbai, Delhi and Pune before a long weekend; same budget; waitlist sign-up | The group message gets **≥ 1.5×** the sign-up rate at a lower cost per lead | About ₹30–50k ad spend [Assumption] |
| **E2. Trip Pass pricing** | Will organisers pay per trip, and how much? | A fake door: "Unlock organiser tools for this trip" at ₹149, ₹249 or ₹399 (randomised), then "coming soon" plus a free unlock | **≥ 3%** of exposed organisers tap through at ₹249 | S |
| **E3. Concierge Trip Room** | Do friends join from a link, and does the organiser value it? | Before building T3, run 20 groups with a hand-built web page per trip and manual updates | **≥ 60%** of invited friends open it; **≥ 8 of 10** organisers want it for the next trip | Founder time |
| **E4. Affiliate attach** | Will groups book through contextual offers? | In 50 beta trips, show one stay or activity offer from the shortlist with tracked links | **≥ 10%** of trips click through; record bookings once the partner reports them | S |
| **E5. Reel-to-Room (Wizard-of-Oz)** | Do shared reels become plans? | A share target posts reels to a queue; a person resolves places within 1 hour | **≥ 50%** of reels resolve; **≥ 30%** of shortlisted places reach the itinerary | Ops time |
| **E6. Operator demand** | Will trek and tour operators pay for batch tools? | 10 interviews plus a clickable prototype of Ready Check for a batch of 15 | **≥ 3 of 10** agree to a paid pilot | Founder time |
| **E7. Cost estimate effect** | Does showing "₹14–18k each" raise commitment? | A/B test on invites in the beta | Invite→"I'm in" **+10%** with the estimate | S |

---

## 5.4 What not to build, and why

| Don't build | Why |
| --- | --- |
| **A general AI itinerary agent or chatbot** | Google (Gemini with Maps, Flights and Hotels), Expedia (Layla), Mindtrip, MakeMyTrip (Myra) and ixigo (TARA) give it away, backed by supply and data Tripsloom can't match [Verified/Reported]. Use AI only where it removes typing: extraction and summarising votes. |
| **Your own booking engine or inventory** | OTA economics need scale and support operations. Affiliate deep links capture most of the value at a fraction of the cost. |
| **In-app group chat** | WhatsApp already won. Integrate with it (share cards, nudges, the Room link) rather than competing with it. |
| **Holding money, wallets or real pooled funds** | Payments regulation, KYC and fraud risk. UPI intents and a ledger cover the need. |
| **More flight-tracking depth** (ADS-B) | What travellers need is delays and gates, which require paid data. TripIt and ixigo already own this. |
| **More trek and dive tabs for consumers** | A deep niche with a small audience. Revisit only through the operator plan (E6). |
| **Automatic background GPS tracking** (Polarsteps-style) | Battery and privacy costs; Polarsteps owns the category. Manual check-ins are enough. |
| **Email-forward import, for now** | Needs inbound mail infrastructure. PDF and screenshot import (F7) covers most of the value first. |
| **Ads or selling data** | It would break the trust positioning. |
| **Feature parity with every competitor** | The product already has about 55 screens. New work has to serve the group decide → plan → pay loop. |

---

## 5.5 Metrics dashboard (set up in Phase 0)

| Layer | Metric | Target in the Phase 1 beta [Assumption] |
| --- | --- | --- |
| Acquisition | Organisers activated per week; cost per activated organiser | Baseline first |
| Virality | Invites per trip; invite→web-open; open→join; join→install; viral coefficient | Open ≥ 60%, join ≥ 40%, viral coefficient ≥ 0.5 |
| Activation | Share of new trips with 2 or more members joined within 7 days | ≥ 35% |
| Engagement | Votes cast, expenses logged and day sheets shared, per trip | Expenses ≥ 3 on 50% of trips |
| Money | Settle-up completion within 14 days | ≥ 50% |
| Revenue | Affiliate click and booking per trip; Trip Pass conversion; expected revenue per trip | Measured; ≥ ₹100 per domestic trip by Phase 2 |
| Retention | Return within 12 months (organisers and members) | Baseline at 6 months, then a target |
| Quality | Crash-free sessions; App Store rating; support tickets about divergent data | ≥ 99.5%; ≥ 4.6; zero |
