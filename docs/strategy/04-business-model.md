# 4. Business model, market and growth

Unit economics in this document are **illustrative models**: every input is labelled. They show which lever matters most and set the targets the experiments in the roadmap need to hit. They are not forecasts.

---

## 4.1 Who to serve

| Rank | Segment | Why them | Why now | Fit with what exists |
| --- | --- | --- | --- | --- |
| **1. Primary** | **Indian urban friend groups aged about 22–35, and the "planner friend" who organises.** Domestic long weekends (Goa, Gokarna, Kasol, Rishikesh, Coorg) and short-haul international trips (Thailand, Vietnam, Bali, Dubai, Sri Lanka). | They plan in WhatsApp, pay in UPI, and money is the main friction. Indian Gen Z group trips on Airbnb grew about **55% year on year** (domestic), the fastest-growing trip type on that platform [Reported, Airbnb/YouGov 2026]. 9 in 10 Indian international trips in 2025 were by millennials or Gen Z [Reported, Niyo]. | The OTAs (MakeMyTrip, ixigo) are pouring money into AI *booking*, not group coordination. Paytm's July 2026 Split Bills launch shows demand for settling in UPI [Reported]. | Shared costs, votes, budget, the map and widgets already exist. |
| **2. Secondary** | **Couples, families and solo travellers who share plans with someone at home** (Family view, F14). | Solo travel is about **64%** of Indian outbound trips [Reported, Niyo]. Families want visibility [Assumption]. | Same infrastructure as the Trip Room. | Live Activity, check-ins. |
| **3. B2B, to validate** | **Small trek and adventure operators** running batches of 10–20 people. | They already run readiness, fitness, gear and payment collection by hand [Assumption]. India's adventure tourism market is put at about **$19.7B in 2025** [Reported, IMARC; a broad market estimate]. Indiahikes alone reports 35,000+ trekkers a year [Reported, self-reported]. | Trek tools (stages, readiness, altitude, safety) are unusually deep for a consumer app. | Trek mode plus Ready Check. |
| **Later** | English-speaking friend groups globally (stag and hen trips, ski weeks, festivals) and Indian diaspora groups. | The same problem exists everywhere; Wanderlog serves it partly. | After product-market fit in India. | Currency-agnostic already. |

**Not a focus:** business travellers (TripIt and Concur own them), package buyers (OTAs), luxury bespoke travel (agencies).

## 4.2 India vs global

| Dimension | India | Global (English-speaking) |
| --- | --- | --- |
| Coordination channel | WhatsApp, dominant | WhatsApp, iMessage, Instagram DMs |
| Payments | **UPI**: instant, free, intent-based hand-off | Cards, Venmo/PayPal/Revolut. Settling is harder; tracking only. |
| Device | Android at about 90% of volume (Apple about 10% [Reported, IDC]) | iOS-heavy in the US and UK |
| Willingness to pay for subscriptions | Low [Assumption, consistent with travel being among the hardest subscription categories, per RevenueCat 2025/2026] | Moderate (Wanderlog, TripIt and Splitwise sell $40–50/yr plans) |
| Best revenue | **Affiliate** (stays, activities, insurance, eSIM, forex) plus a low per-trip fee | Subscription or Trip Pass plus affiliate |
| Competition for the group layer | Weak (Splitwise, Paytm; no group *planner*) | Moderate (Wanderlog, Troupe and small apps) |
| Content need | Domestic and short-haul ideas, Hinglish | Already English and European (current Discover) |

**Recommendation:** **India first for product-market fit, built to work globally.** Launch the group features with India-specific defaults (UPI, INR, holidays, Discover, Hinglish share text). Keep the app global in the stores. Country detection picks the payment hand-off (UPI in India; payment links or "mark as paid" elsewhere).

## 4.3 Positioning

> **For friend groups who plan in WhatsApp, Tripsloom is the shared trip room where everyone decides, plans and pays. Unlike AI planners that plan for one person, or Splitwise that only tracks debts, Tripsloom gets the whole group from "we should go" to "everyone's settled up", and spares the organiser all the chasing.**

Short forms:

- In English: *"Plan it together. Pay it fairly."*
- In Hinglish, for share text: *"Plan sab milke, hisaab ekdum fair."* ("We plan it together; the accounts stay fair.")

What Tripsloom should **not** claim: "the best AI travel planner" (lost to Google, Expedia and the OTAs) or "everything for your trip" (too broad to remember).

## 4.4 Monetisation options

| Option | How | Fit | Revenue potential | Risk | Verdict |
| --- | --- | --- | --- | --- | --- |
| **A. Affiliate and commission** | Booking.com, Agoda or local equivalents for stays; Klook, GetYourGuide, Viator for activities; insurance; eSIM; forex; airport transfers. Offered in context (Ready Check, shortlist, F15). | High: the group has intent and dates | **Highest per trip** (model below) | Feeling like ads; programme terms change | **Primary in India** |
| **B. Trip Pass** (one-time, per trip, bought by the organiser) | Unlocks organiser tools for one trip: Ready Check nudges, the kitty, more than 8 members, the custom cover, the recap book, unlimited documents. | **Matches episodic use** and avoids annual-plan friction (Wanderlog complaints [Reported]) | Moderate | Pricing sensitivity | **Test first** |
| **C. Pro subscription** (today) | Annual or monthly, for frequent organisers | Fine for globally frequent travellers | Low–moderate in India | Low retention in the travel category [Reported] | **Keep, but bundle Trip Pass benefits.** Stop selling "AI drafts". |
| **D. B2B Operator plan** | Monthly SaaS for trek and tour operators: batches, Ready Check, payment-collection ledger, safety check-ins | Strong tool fit, unproven demand | Moderate per account, few accounts | Sales effort; support | **Validate with 10 operator interviews** |
| **E. Print** (travel book, group recap book) | A print partner, fulfilled per order | Polarsteps' main revenue [Reported] | Moderate later | Logistics | **Later** (the PDF exists) |
| **F. Destination marketing** (tourism boards; Mindtrip does this [Reported]) | Sponsored Discover collections | Needs audience scale | Later | Hurts trust if mixed with organic content | **Not before 1M monthly users** |
| **G. Ads or data sales** | n/a | n/a | n/a | Destroys trust | **Never** |

### Pricing hypotheses to test [Speculative]

- **Trip Pass:** ₹199–₹299 in India; $4.99–$6.99 elsewhere. Bought by the organiser and covers the group.
- **Pro:** ₹999/year in India; $29.99/year elsewhere. Includes unlimited Trip Passes. Lower prices kept users longer in RevenueCat's 2026 data (36% median retention vs 23% for high-priced apps) [Reported, 9to5Mac summary].
- **Operator plan:** ₹2,999–₹7,999 a month by batch volume [Speculative; set after the interviews].

## 4.5 Illustrative unit economics per trip (India)

Every input below is an **[Assumption]**, to be replaced by measured values from T1 and the experiments.

| Input | Value | Basis |
| --- | --- | --- |
| Group size | 5 | Typical friend weekend |
| Spend per person | ₹16,000 | Domestic 4–5 day trip |
| Total trip spend | ₹80,000 | 5 × ₹16,000 |
| Share that is stays | 40% (₹32,000) | Assumption |
| Share that is activities | 10% (₹8,000) | Assumption |
| Effective stay affiliate rate | about 3% of booking value | Booking.com pays 25–40% of its commission, which is roughly 10–15% of booking value, so about 3–6% [Reported, Track360/SafariFind; confirm with official terms] |
| Activity affiliate rate | about 5% | Klook 2–5%, Viator and GetYourGuide about 8% [Reported] |
| Share of trips that book a stay through Tripsloom | 10% | Assumption (conservative: friends often book Airbnb or direct) |
| Share of trips that book an activity through Tripsloom | 15% | Assumption |
| Trip Pass conversion (organisers) | 5% at ₹249 | Assumption |

Expected revenue per trip:

| Source | Calculation | Expected revenue |
| --- | --- | --- |
| Stays | 10% × ₹32,000 × 3% | ₹96 |
| Activities | 15% × ₹8,000 × 5% | ₹60 |
| Trip Pass | 5% × ₹249 × about 0.7 net of store fees | ₹9 |
| **Total** | | **About ₹165 per trip**, or about ₹33 per participant |

International trips (Thailand, Bali, Dubai) add insurance, eSIM and forex, at higher spend per person. Expected revenue per trip there is plausibly **3–5× higher** [Assumption].

**Cost to serve:** close to zero today (free data services, on-device processing) [Verified for data sources]. With shared trips, add Supabase Realtime, database and web hosting. That's modest at early scale [Assumption: confirm with Supabase pricing at 10k and 100k monthly users]. Server-side AI is used only for S4 extraction, capped per trip.

**What the model tells us:**

1. Revenue scales with **trips, members and booking attach**, not subscriptions. Each new member arrives free through the invite.
2. The lever that matters most is **affiliate attach at the right moment**, more than Trip Pass price.
3. Acquisition per trip is effectively paid for by the loop if **the viral coefficient is at least about 0.5**. Paid acquisition should only buy **organisers**, never members.

## 4.6 Acquisition and growth

| Channel | Mechanism | Why it fits | First test |
| --- | --- | --- | --- |
| **Invite loop** (core) | Trip Room links in WhatsApp; friends join on the web; some install | Every trip reaches 4–6 people at high intent | Invite→join and join→install rates (T1) |
| **Recap loop** | Group Recap cards on Instagram stories and WhatsApp status, linking to the Room or a template | Post-trip pride, visual | Recap share rate; installs from recaps |
| **Template loop** | "Do it again": finished trips become forkable templates ("Gokarna in 3 days, ₹9k each") | User-generated Discover; organisers become creators | Template forks per month |
| **Creators** | Travel creators publish group-trip templates in Tripsloom and earn affiliate share | Creators already sell itineraries; Mindtrip reportedly courts creators [Reported, single source] | 10 Indian micro-creators, tracked links |
| **Communities** | College travel clubs, trekking groups, running clubs, office "offsite" organisers | Organisers with repeat groups | 5 community pilots |
| **Paid** (organisers only) | Meta and Instagram ads aimed at "planning a trip with friends" around long weekends | Timed with intent (holiday calendar) | Cost per activated organiser (a trip with 2 or more joined) |
| **App store optimisation** | "Group trip planner", "split trip expenses", "trip with friends" | Keywords the AI apps don't target | Keyword ranks and conversion |

**Referral incentive** [Speculative]: the organiser gets a free Trip Pass when 3 friends join their room. No cash rewards, because they invite fraud.

## 4.7 Retention model

Travel is episodic, so the metrics follow trips, not days:

- **Activation:** a trip with 2 or more members joined within 7 days of creation.
- **Trip completion:** an activated trip reaches its end date with 3 or more expenses logged.
- **Settle-up completion:** 60% or more of balances settled within 14 days of trip end.
- **Annual return:** the share of organisers and members who start or join another trip within 12 months. *This is the north star for retention.*
- **Between trips:** long-weekend alerts (F4), recap anniversaries ("a year ago in Gokarna"), templates from friends.

## 4.8 Business risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| A platform (WhatsApp, Google, MakeMyTrip) ships group planning | Medium | Move fast on India-specific depth (UPI, Ready Check, operator mode). Platforms optimise for booking, not for the organiser's workload. |
| Groups use the web Room but never install, which lowers app revenue | High | Fine: monetise on the web too (affiliate links work there). Make the app worth it for offline use, documents and widgets. |
| Affiliate revenue is too small per trip | Medium | Test attach early (experiment E4); add international services (insurance, eSIM) where margins are better. |
| Shared-trip sync bugs damage trust | Medium | Feature flag, friendly-group beta, activity log, undo. |
| Privacy incidents with link-joinable trips | Low–medium | Unguessable codes, revocation, private-by-default documents, no exact addresses to viewers unless the organiser allows it. |
| Too little focus: the team keeps adding niche features | High (history) | Use the "won't build" list in the roadmap document as a guardrail. |

## 4.9 Sources

- Airbnb Gen Z India report (YouGov, n=2,012, April 2026): https://www.esquireindia.co.in/amp/story/lifestyle/travel/airbnb-new-report-on-genz-travel-trend
- Niyo report: 9 in 10 international trips by millennials and Gen Z; solo 63.8%: https://www.theweek.in/wire-updates/national/2025/12/19/lst1-survey-travel.html
- FINN Partners, The Future of Travel 2025: https://www.finnpartners.com/wp-content/uploads/2025/04/The-Future-Of-Travel-2025_final-design_30.04-smaller-edited-1.pdf
- MMGY study of Indian travellers: https://www.hotel-online.com/news/indian-travellers-go-global-safety-social-media-and-sustainability-stand-out-in-new-mmgy-study
- IDC via EE Times India, India smartphone market in 2025 (Apple about 10% volume): https://www.eetindia.co.in/idc-india-smartphone-market-flat-in-2025/
- IMARC, India adventure tourism market: https://www.imarcgroup.com/report/en/india-adventure-tourism-market
- Indiahikes About page: https://indiahikes.com/about
- Paytm Split Bills: https://paytm.com/blog/bill-payments/paytm-split-bills/
- MakeMyTrip Q4 FY26 earnings (Myra, Hinglish voice): https://finance.yahoo.com/markets/stocks/articles/makemytrip-q4-earnings-call-highlights-130826386.html
- RevenueCat, State of Subscription Apps (travel among the hardest categories), via i-programmer: https://www.i-programmer.info/news/83-mobilephone/17938-making-money-from-subscription-apps.html
- RevenueCat 2026 summary (retention by price), via 9to5Mac: https://9to5mac.com/?p=1042212
- Travel app retention (AppsFlyer data via Braze): https://www.braze.com/resources/articles/mobile-app-retention
- Business of Apps travel benchmarks: https://www.businessofapps.com/?p=97743
- Booking.com affiliate programme teardown: https://track360.io/blog/booking-com-affiliate-partner-program-operator-teardown-2026
- Travel affiliate commission rates 2026: https://safarifind.com/blog/travel-affiliate-commission-rates-2026-earn-more-per-booking
- Tours and activities affiliate programmes: https://tourscanner.com/tours-travel-activities-affiliate-programs
- Polarsteps business model (travel books, affiliate): https://vizologi.com/business-strategy-canvas/polarsteps-business-model-canvas/
- Mindtrip tourism-board (DMO) product and creators: https://tooldirectory.ai/tools/mindtrip
- WhatsApp users in India (secondary estimates): https://learn.rasayel.io/en/blog/whatsapp-user-statistics/
