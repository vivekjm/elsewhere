# 3. Product opportunities

Feature ideas, signature concepts and the top 10 improvements. Each major recommendation covers the same points: **problem → solution → why it beats the alternatives → evidence → business impact → effort → dependencies → risks → success metric**.

Effort scale (for a 1–3 person team, **[Assumption]**): **S** is under 1 week, **M** is 2–4 weeks, **L** is 1–3 months.

---

## 3.1 The idea in one line

> **Tripsloom is the place a group of friends decides, plans and pays for a trip, and the organiser stops chasing everyone.**

The other documents explain why this beats "AI trip planner" or "all-in-one travel app": the AI planners are free and backed by supply, and the all-in-ones are crowded. The group layer is unowned, and it grows on its own because every trip invites 2 to 8 people.

---

## 3.2 Signature features (4)

These are the features people would describe Tripsloom by ("the app where…").

### S1. Trip Room: one link, everyone's in, no install

| | |
| --- | --- |
| **Problem** | Plans scatter across a WhatsApp group: links, polls, screenshots, "who's in?". Today a Tripsloom invite is a `tripsloom://` link that does nothing for a friend without the app, and it gives them a copy, not the trip. |
| **Solution** | Every trip gets an `https://tripsloom.com/t/<code>` link with a rich WhatsApp preview (cover, dates, "6 going"). It opens a fast web page: the plan, open votes, an "I'm in / maybe / out" button, the per-person cost estimate, and who has paid. Joining asks for a name only, nothing else. The app is offered for the things that need it: adding expenses offline, documents, widgets. Everyone sees one live trip. |
| **Why it beats alternatives** | Wanderlog and Mindtrip have web access but are built for planning, not for the "are you coming and can you afford it" moment. Splitwise has money but no plan. WhatsApp polls disappear in the scroll. Removing the install step for the 5 friends who aren't the organiser removes the biggest drop-off in group apps [Assumption, to measure]. |
| **Evidence** | About 90% of the group planners in one small survey plan in WhatsApp [Reported, n=35]. Polarsteps and Mindtrip both grew on web viewers [Reported]. WhatsApp has an estimated 535M+ monthly users in India [Reported, secondary estimates; Meta doesn't publish country figures]. |
| **Business impact** | This is the acquisition loop. Each trip shows Tripsloom to about 4–6 non-users at a moment of high intent. It also creates the audience the affiliate offers depend on (S2, idea F15). |
| **Effort** | **L.** Shared-trip backend (see improvement T3), a web page on the existing Cloudflare/Vinext app, universal and app links, a WhatsApp Open Graph card. |
| **Dependencies** | T3 (live shared trips), T2 (universal links, legal pages). |
| **Risks** | Privacy of a link-joinable trip: use unguessable codes, organiser-revocable links, and keep documents and personal packing private. There's also a risk that web-only members never install; that's acceptable, because they are reach, not cost. |
| **Success metric** | **Invite→join rate ≥ 40%** within 48 hours; **viral coefficient** (new sign-ups per organiser) ≥ 0.5 by the end of the beta. |

### S2. Fair Share: know the cost before you commit, settle in one tap

| | |
| --- | --- |
| **Problem** | Friends drop out over money late in planning. The organiser fronts bookings and then spends weeks chasing repayment. Splitwise's free tier now caps daily expenses and adds ads [Reported]. UPI pays but doesn't know the trip. |
| **Solution** | (a) A **per-person estimate** on the invite ("about ₹14–18k each: stay, travel, food at your style"), built from the trip's stays, plans and budget plus simple destination priors. (b) An **organiser-fronted ledger**: "Vivek paid ₹42,000 for the villa, split 6 ways". (c) **Settle with UPI**: a `upi://pay` intent pre-filled with payee, amount and note, opened in any UPI app, then marked paid by the receiver. (d) Multi-currency for international trips (already built). |
| **Why it beats alternatives** | No daily cap, no ads, and it's tied to the plan, so expenses arrive pre-categorised by day and place. Paytm Split Bills (July 2026) settles in UPI but lives inside a payments app with no trip context [Reported]. A UPI intent avoids becoming a payments company: no licence and no money handled. |
| **Evidence** | Splitwise free-tier complaints and lower iOS rating [Reported]. Paytm's launch shows demand for UPI settle [Reported]. Trip-leader case studies name money as a top source of friction [Reported]. |
| **Business impact** | Retention during and after the trip (ledgers are reopened until everyone settles). Hard to switch away from once a group's money is here. It's also the moment a "Trip Pass" sells naturally (see the business model document). |
| **Effort** | **M** (the ledger and UPI intent build on existing expense code), plus **S** for the estimate's first version. |
| **Dependencies** | T3 for the shared ledger. A UPI ID field per member (optional, stored privately). |
| **Risks** | Fraud and spoofed UPI IDs: only the payee can enter their own UPI ID, and the payer confirms in their bank app. Estimates being wrong: show a range and its basis, never a single number. |
| **Success metric** | **Share of trips with 3 or more expenses ≥ 50%**; **settle-up completion ≥ 60%** of balances within 14 days of trip end. |

### S3. Ready Check: the organiser's dashboard

| | |
| --- | --- |
| **Problem** | Before departure, the organiser chases each person: did you book your train? Got your visa or ID? Paid your share? Packed the tent? This happens in one-to-one messages, repeatedly. |
| **Solution** | One screen per trip: each member × each requirement (paid share, ticket or booking added, ID or visa uploaded *privately*, packing done, emergency contact). Each item is a tick, a deadline or a "nudge" button that composes a friendly WhatsApp message with the room link. Members see only their own row plus the counts. |
| **Why it beats alternatives** | No competitor models the organiser's workload [Reported, section 2.6 of the competitor document]. It reuses Tripsloom's existing pieces (trek readiness score, packing progress, documents) and points them at the group. |
| **Evidence** | Group-leader case studies say it's a constant struggle to get timely responses from members [Reported]. Trek operators already run manual versions of this (fitness and medical forms, gear checks) [Assumption, to validate with operators]. |
| **Business impact** | It's the organiser's reason to pay (Trip Pass) and the natural first feature for B2B operators. |
| **Effort** | **M.** |
| **Dependencies** | T3, S1. |
| **Risks** | It could feel like policing friends, so the tone matters ("2 of 6 ready" rather than naming people publicly). |
| **Success metric** | **Organiser-reported time saved** (in-app survey) and the **share of trips where every member is ready 3 days before departure**. |

### S4. Reel-to-Room: inspiration goes straight into the group's vote *(validate before building)*

| | |
| --- | --- |
| **Problem** | Friends share Instagram reels into the group chat ("we HAVE to go here"). The places get lost in the scroll and never become a plan. |
| **Solution** | Share a reel, TikTok, Google Maps link or screenshot to Tripsloom (the iOS and Android share sheet), or paste it in the Trip Room. Tripsloom pulls out the place, pins it on the trip map and adds it to a "Shortlist" the group votes on. Top-voted places drop into days. |
| **Why it beats alternatives** | Rhyme, Travio and Wingman do this for one person, mostly on iOS [Reported]. Tying it to the group's vote and the Android share sheet fits Indian friend groups. |
| **Evidence** | Three reel-to-trip launches in 2025–26 [Reported]. Indian Gen Z are "heavily influenced by authentic digital content" (FINN Partners) [Reported]. |
| **Business impact** | Engagement before the trip, and the shortlist feeds bookings for activities and stays. |
| **Effort** | **M–L.** Captions and link metadata can be parsed cheaply. Recognising places from video frames needs a server model, which brings per-request cost and privacy questions. |
| **Dependencies** | S1; a place database with good Indian coverage (Photon/OpenStreetMap is thin, so consider Google Places or Foursquare, at a cost). |
| **Risks** | Instagram limits scraping, so rely on the user-shared URL, the caption text and OCR of screenshots, not on fetching the video. Misidentified places: always show a confirm step. |
| **Validate first** | A Wizard-of-Oz test: a manual team resolves shared reels into pins for 30 test groups. Measure the share of reels resolved, how many get voted on, and how many end in a plan. |
| **Success metric** | **Shortlisted items per trip ≥ 5**; **shortlist→itinerary conversion ≥ 30%**. |

*Runner-up for a fifth signature:* **Group Recap card** (feature F13). It's a strong share loop but easy to copy, so it's better treated as a growth feature than as identity.

---

## 3.3 Top 10 product improvements (prioritised)

ICE is Impact × Confidence × Ease, each scored 1–10 **[Assumption]**. Higher is better.

| # | Improvement | Type | I | C | E | ICE |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | Product analytics and an event taxonomy | Quick win | 8 | 10 | 9 | 720 |
| T2 | Universal links, plus fix the 404 legal and help pages | Quick win | 8 | 10 | 8 | 640 |
| T3 | One live shared trip (replace copy-invites) | Big bet | 10 | 8 | 3 | 240 |
| T4 | Trip Room web page (S1) | Big bet | 10 | 7 | 3 | 210 |
| T5 | UPI settle and organiser-fronted ledger (S2) | High impact | 8 | 7 | 6 | 336 |
| T6 | Honest AI: rename templates, remove the draft cap | Quick win | 6 | 9 | 9 | 486 |
| T7 | India-first Discover and defaults | Quick win | 7 | 7 | 8 | 392 |
| T8 | Date poll and RSVP ("who's in") | High impact | 8 | 7 | 6 | 336 |
| T9 | Per-person cost estimate on invites (S2a) | High impact | 7 | 6 | 6 | 252 |
| T10 | Simplify the information architecture (modes, optional wardrobe, one onboarding question) | Medium | 6 | 7 | 6 | 252 |

### T1. Product analytics

- **Problem:** No event tracking exists, so no decision in these documents can be validated [Verified].
- **Solution:** Add a privacy-respecting product analytics tool (for example, self-hostable PostHog), with about 25 named events, including:
  - `trip_created`, `invite_sent`, `invite_opened_web`, `member_joined`, `expense_added`, `settle_marked`;
  - `vote_cast`, `paywall_viewed`, `purchase`, `trip_started`, `trip_ended`, `recap_shared`.
  Add funnels for activation and invites.
- **Why:** Without it, the team is building on guesses.
- **Evidence:** Repository search [Verified].
- **Impact:** All later bets depend on it.
- **Effort:** S.
- **Dependencies:** Update the privacy manifest and the App Store privacy answers.
- **Risks:** Privacy perception. Use anonymous IDs and no third-party ad SDKs.
- **Metric:** Funnels visible within 1 week of release.

### T2. Universal links and legal pages

- **Problem:** Invites use `tripsloom://`, which is dead for anyone without the app. The Terms, Help and Privacy pages return 404 in production, which fails App Store review [Verified 2026-10-15].
- **Solution:**
  - Serve `/terms`, `/privacy` and `/help`.
  - Add `apple-app-site-association` and Android `assetlinks.json`, so `https://tripsloom.com/t/...` opens the app when installed and the web page otherwise.
  - Keep the deflate invite as an offline fallback.
- **Why:** This is required for S1, and the legal pages are required for release.
- **Effort:** S.
- **Dependencies:** The web deploy.
- **Risks:** None material.
- **Metric:** Invite link open rate measured (T1); the store review passes.

### T3. One live shared trip

- **Problem:** Copy-based invites mean each member's expenses, votes and plan edits diverge [Verified].
- **Solution:**
  - Move a shared trip into a `trips_shared` model: trip and members with roles (organiser, member, viewer), RLS by membership, Supabase Realtime for changes.
  - Keep private parts (wardrobe, packing ticks, documents, check-ins) per user, as today.
  - Resolve conflicts per field, last writer wins, with an activity log ("Asha added Dinner at Thalassa").
- **Why:** The whole recommended direction depends on this. It matches Wanderlog and Mindtrip at their strongest point.
- **Evidence:** Competitor matrix.
- **Impact:** It unlocks S1–S3 and every group metric.
- **Effort:** L.
- **Dependencies:** A schema change on the shared backend (the earlier competitor research held this back pending owner approval). Migrate existing invited copies.
- **Risks:** Sync bugs. Ship it behind a flag to friendly groups first.
- **Metric:** **Median members per trip ≥ 3**; zero diverged-state support tickets in the beta.

### T4. Trip Room web page

See S1. Use the web app for this single job instead of keeping a second full planner in step with the phone.

### T5. UPI settle and fronted ledger

See S2(b–c).

- **Effort:** M.
- **Risk:** The UPI intent's behaviour differs across apps. Test with GPay, PhonePe, Paytm and BHIM.

### T6. Honest AI

- **Problem:** Templates are sold as "Unlimited AI planning", capped at 3 a month [Verified]. Users who compare Tripsloom with Gemini or Mindtrip will feel misled.
- **Solution:**
  - Rename it "Quick start: a day-by-day skeleton you fill in".
  - Remove the cap: templates cost nothing to generate.
  - Keep on-device generation where available, labelled as such.
  - Spend any future AI budget on *extraction* (S4, booking PDFs and screenshots) and *summarising group votes*, not on competing itinerary generation.
- **Why:** It protects trust and reviews, and takes the AI arms race off the table.
- **Evidence:** 27% of AI users report inaccurate information [Reported]. The big platforms give AI planning away [Verified].
- **Effort:** S.
- **Risk:** It weakens a marketing hook, but that hook can't be sustained anyway.
- **Metric:** App Store rating mentions of "AI" or "generic" fall; planner completion rate rises.

### T7. India-first Discover and defaults

- **Problem:** Discover offers 12 European ideas [Verified]. Indian friend groups go to Goa, Gokarna, Pondicherry, Kasol, Spiti, Rishikesh, Coorg, Hampi, Udaipur, Meghalaya, Vietnam, Thailand, Bali, Dubai and Sri Lanka.
- **Solution:**
  - Choose Discover by home country.
  - Add 30 India-relevant ideas with typical per-person cost bands and the best long weekends.
  - Default the currency to INR and time to IST from the home base.
  - Seed the date poll with Indian public holidays.
- **Effort:** S–M (content).
- **Risks:** Content upkeep, so keep it small and editorial.
- **Metric:** Discover→trip conversion for Indian users.

### T8. Date poll and RSVP

- **Problem:** Groups stall at "when?" and "who's actually in?". Tripsloom's votes exist, but on copies, and not for dates [Verified].
- **Solution:**
  - A date-range poll where each person marks their available weekends, with a long-weekend overlay (F4).
  - An RSVP state per member (in / maybe / out) with a soft deadline.
  - The organiser locks the dates, and that sets the trip dates.
- **Why:** Troupe built exactly this; there is no Indian equivalent with money attached [Reported].
- **Effort:** M.
- **Dependencies:** T3.
- **Metric:** Share of trips that move from "idea" to "dates locked" within 14 days.

### T9. Per-person cost estimate

See S2(a).

- **Effort:** S for a range from the trip's own budget, stays and plans; M for destination priors.
- **Risk:** Being wrong, so show a range and its basis.
- **Metric:** Invite→"I'm in" conversion when the estimate is shown versus hidden (A/B).

### T10. Simplify the information architecture

- **Problem:** About 55 routes, a parallel trek tab system, a Wardrobe tab on every trip, and 6 onboarding focus tiles that aren't used [Verified].
- **Solution:**
  - Onboarding asks one question: "Who's coming?". It sets the defaults.
  - Trek and dive become *modes*: sections of the trip page, not separate tab bars.
  - Wardrobe and the stylist are opt-in.
  - Freeze the ADS-B flight tracker.
- **Why:** Fewer concepts make for faster activation and less maintenance.
- **Effort:** M.
- **Risk:** Losing niche fans, so keep the features and move them, don't delete them.
- **Metric:** Time to first trip and first invite; crash-free sessions.

---

## 3.4 Feature ideas (20)

Grouped by journey stage. ★ marks the signature features, ◆ the top-10 items above.

**Decide**

- **F1. ★ Trip Room web link.** See S1.
- **F2. ◆ Date poll with availability and RSVP.** See T8.
- **F3. ★ Reel-to-Room shortlist and vote.** See S4.
- **F4. Long-weekend finder and leave optimiser (India first).** Combines Indian national and state holidays with the user's leave days: "Take 2 days off around Holi and get 5 days; 3 friends are free". This is an India-specific hook that blogs cover but apps don't [Assumption: no app found in this research]. Effort S–M. Metric: trips started from a suggested window.
- **F5. ◆ "What will this cost me?" estimate on every invite.** See S2(a).

**Plan**

- **F6. Shortlist → days.** Turn top-voted places into a day plan grouped by area, using the existing map and walking times. Effort M.
- **F7. Import from PDF and screenshot.** Extend the existing on-device text recognition (`services/intelligence.ts`) from receipts to booking PDFs and screenshots: IRCTC, airline e-tickets, OYO and Booking.com confirmations. Tripsy and Mindtrip charge for or lead with this [Reported]. Effort M.
- **F8. Vote summariser.** A narrow AI use: "4 want beach days, 2 want Dudhsagar; proposal: day 3 split, meet for dinner". It runs on the device or as a cheap server call on small text. Effort S–M. Risk: low.

**Pay**

- **F9. ★ Organiser-fronted ledger and UPI settle.** See S2.
- **F10. Trip kitty.** A virtual pot everyone tops up before the trip ("₹5k each for shared food and fuel"), with spending drawn from it. A ledger only, never holding money. Effort M. Metric: kitty adoption on trips with 4 or more members.

**Prepare**

- **F11. ★ Ready Check.** See S3.
- **F12. Visa and ID rules with a hand-off.** Show the entry rule for Indian passports by destination (e-visa, visa on arrival, none) with a dated source, plus a "check on Atlys / the official site" link. This is an affiliate candidate. Effort S (curated table for the top 20 destinations). Risk: wrong rules, so always show the "last checked" date and the official link.

**During the trip**

- **F13. Morning day sheet for WhatsApp.** At 8 a.m. on trip days, generate an image card of today's plan, meeting time and place, and who's paying for what, to forward to the group chat. Engagement without asking everyone to open the app. Builds on the widgets and Live Activity data. Effort S–M. Metric: day sheets shared per trip day.
- **F14. Family view.** A read-only live link for parents or a partner at home: today's plan, stay address, last check-in. Solo travel is about 64% of Indian outbound trips [Reported, Niyo], and families want reassurance [Assumption]. This reuses S1's infrastructure. Effort S once S1 exists.
- **F15. Contextual essentials offers.** eSIM, travel insurance, forex card and airport transfer, offered once, at the right moment: 7 days before an international trip, on the Ready Check. This is affiliate revenue (see the business model document). Effort S per partner. Risk: feeling like ads, so limit it to one card per trip and make it dismissible.

**After the trip**

- **F16. Group Recap card.** "6 friends · 5 days · 23 places · ₹16,400 each · 412 km" as an Instagram story or WhatsApp image, with a Trip Room link. The PDF travel book already exists, so print can follow (Polarsteps' main revenue [Reported]). Effort S–M. Metric: recap share rate and installs from recaps.
- **F17. "Do it again" templates.** Turn a finished trip into a reusable template ("Our Gokarna weekend") that friends can fork. This is user-generated Discover content, and lets organisers become creators over time. Effort M.

**Specialised (keep and focus)**

- **F18. Trek group mode for operators.** The existing trek tools (stages, readiness, altitude check-ins, safety) plus Ready Check, sold to small Himalayan trek operators to run batches of 10–20 people. Indiahikes alone reports 35,000+ trekkers a year [Reported, self-reported]. See B2B in the business model document. Effort M on top of S3.
- **F19. Packing from outfits, for those who opt in.** Keep the unique wardrobe→packing link as an opt-in "Style & pack" mode. Measure whether opted-in users retain better before investing more.
- **F20. Hinglish copy, then Hindi.** MakeMyTrip reports about 70% of its voice queries are in Hinglish [Reported]. Start with Hinglish nudges and share text (F13, Ready Check), then the full UI later. Effort S for share text.

## 3.5 UX, engagement and retention improvements

1. **Activation = "a trip with 2 or more people joined within 7 days"**, not "a trip created". Design onboarding to reach it: "Who's coming?" leads to creating the room, which leads to sharing on WhatsApp.
2. **An empty Home should be a group action**, not a solo planner: "Start a trip with friends" ahead of "Draft with AI".
3. **Lifecycle notifications that serve the group, not the app.** Vote closing, someone joined, someone paid, 3 days to go (Ready Check), settle reminders after the trip. No generic re-engagement messages.
4. **Retention through the year.** Travel is episodic (Day-30 retention about 3% in the category [Reported]). Measure *trips per user per year* and *share of users who start a second trip within 12 months*, not daily use. The between-trip hooks are F4 (long weekends), F16 (recaps) and F17 (templates).
5. **Keep the craft.** Fast, polished motion is a real advantage over reviews that call competitors slow [Reported]. Keep the performance budget as the group features grow.
6. **Trust signals.** Show sources and "last checked" dates on anything factual (visa rules, estimates, essentials). This is the opposite of the AI planners' confident errors.
7. **Personalisation that is useful, not creepy.** On joining a Room, each member answers three taps: budget style (backpacker / comfortable / treat), food (veg / non-veg / Jain / no preference) and pace (packed / relaxed). These feed the per-person estimate (S2), the vote summary (F8) and the shortlist's restaurant filter. They are set once, editable, and seen only by the group. Indian groups regularly mix dietary needs [Assumption]; no competitor in the matrix collects group-level preferences.
8. **Offline where trips actually go.** Spiti, Ladakh, the North-East and trek routes have weak signal. Keep the existing offline maps and offline-first data, and make the shared trip readable offline: the latest Room state is cached on every member's phone, the morning day sheet (F13) is an image that works without a connection, and expenses logged offline sync when a connection returns.
