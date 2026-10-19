# 2. Competitor analysis

Research done on 2026-10-15 from public sources. Prices vary by region and change often, so treat every price as **[Reported]** unless marked otherwise. Many comparison articles are written by competing apps (Stippl, Pilot, MonkeyTravel, Finny, Kittysplit); they are used only for facts that other sources back up, and are flagged where they are the only source.

## 2.1 The landscape in one picture

Players fall into four groups, and Tripsloom touches all four:

1. **Itinerary planners** (Wanderlog, Stippl, Tripsy, TripIt): organise a trip you have mostly decided on.
2. **AI agents attached to booking supply** (Mindtrip, Layla/Expedia, Google Gemini, MakeMyTrip Myra, ixigo TARA): plan in conversation and earn money when you book.
3. **Memory and social** (Polarsteps; save-a-reel apps such as Rhyme/Roamy, Travio and Wingman): capture and share the trip.
4. **Group money and coordination** (Splitwise, Paytm Split Bills, Troupe, Lambus): decide together and settle up.

The second group is where capital is going. **Expedia acquired Layla on 2026-07-31** [Verified, Expedia Group investor relations]. **Mindtrip launched agentic flight booking with Sabre and PayPal in May 2026** [Reported, TravelMole]. **Google's Gemini now connects directly to Maps, Flights and Hotels** to build itineraries [Verified, Google blog, 2026-08-06]. In India, **MakeMyTrip's Myra** (over 54,000 conversations a day, 45%+ from Tier-2 and smaller cities) [Reported, company figures] and **ixigo's TARA** (app relaunched as AI-native in May 2026) [Reported] bring free AI planning to hundreds of millions of users.

**What this means:** "an AI that plans your trip" is now a free feature of the platforms that own the supply. An independent app can't win there. The open space is the *coordination layer* that none of them owns: the group, its decisions and its money.

## 2.2 Competitor profiles

| # | Product | Core job | Price (free / paid) | How it makes money | Strength | Recurring complaints |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Wanderlog** | Map-first itinerary with live group editing | Free; Pro about **$39.99/yr** | Subscription, plus deals on flights and car hire | Clearest group itinerary editor; strong free tier with live collaboration and booking import | Billing and trial-charge disputes; slow with large trips; "recommendations that don't exist in the city" (Trustpilot) |
| 2 | **TripIt** (SAP Concur) | Itinerary built from forwarded confirmation emails | Free; Pro about **$49/yr**, annual only | Subscription; free Pro bundled through Concur for companies | Inbox import; flight alerts; fare-refund monitoring | Built for business travellers; little for leisure groups |
| 3 | **Mindtrip** | AI chat to itinerary to booking | Free | Booking through partners (Priceline, Tripadvisor, Viator); tourism-board (DMO) product, with European contracts in June 2026 | Real places with photos and maps; "Start Anywhere" builds a trip from a screenshot, post or PDF; group editing | Restaurant picks lean towards tourist spots |
| 4 | **Layla** (Expedia, from July 2026) | Conversational trip planning and booking | Free; paid tier about **$49/yr** (sources conflict) | Booking, now inside Expedia | Supply and scale through Expedia | Free tier reportedly an overview only; price reports conflict |
| 5 | **Google Gemini, Maps and Search** | AI itineraries grounded in Maps, Flights and Hotels | Free (some features need a paid plan) | Ads and hotel and flight referral | Best place data; already on every phone | NYT reviewer (May 2026) still found errors to fix by hand |
| 6 | **Polarsteps** | Automatic trip tracking, journal and travel book | Free; Plus **€29.99/yr or €8.99/mo** | Printed travel books (main income), affiliate since 2025, Plus subscription | About 20M travellers; memory loop with a physical product | Not for planning; little for groups |
| 7 | **Splitwise** | Shared expenses | Free with a daily limit; Pro about **$39.99–49.99/yr** | Subscription, ads | The default for splitting costs | A limit of 3–4 expenses a day on the free tier, ads and upsells; iOS rating 3.9 vs Android 4.5 |
| 8 | **Stippl** | All-in-one planner, budget, packing, journal | Free; Pro about **€24.99/yr** | Subscription; links to Booking and Airbnb | Cheap, broad | Early-stage; 3.8 rating on Android; sync issues and crashes (its own blog admits this) |
| 9 | **Tripsy** | Polished iOS organiser | Free; Pro **$39.99/yr**, lifetime option | Subscription | Smart Import from links, documents and posts; widgets; Siri | iOS only; free tier thin |
| 10 | **MakeMyTrip, Myra** | AI assistant inside India's largest OTA | Free | Booking commissions (FY26 gross bookings about $10.4B reported) | Hinglish voice, 8 languages, books flights, hotels, visas and forex | Planning exists to sell MMT inventory; no group or money layer |
| 11 | **ixigo, TARA** | AI-native travel app for India | Free | Booking commissions | Trip Mode: boarding passes, gates, wallet updates, sending passes over WhatsApp | Booking-led; not a planner for a group of friends |
| 12 | **Pickyourtrail and Thrillophilia** | Customised packages (international, multi-day) | Free to plan | Package margin | Planning bundled with booking and human support | Planning only exists to sell a package |

**Adjacent, for specific ideas:**

- **Rhyme (formerly Roamy), Travio and Wingman:** turn saved reels and TikToks into a mapped plan. All launched in 2025–2026, mostly iOS-only [Reported].
- **Paytm Split Bills:** group expenses with UPI settlement and a "trip" group type, launched July 2026 per an NSE filing [Reported].
- **Troupe (JetBlue, 2022):** group voting on dates, destinations and stays, plus RSVPs [Reported].
- **Lambus:** group itinerary, chat and expenses [Reported].
- **Atlys:** Indian visa platform with an on-time guarantee; $20M Series B in 2024 [Reported].

## 2.3 Feature-gap matrix

● strong · ◐ partial · ○ absent. Tripsloom is rated from the code (see the product assessment), the others from public sources.

| Capability | Tripsloom | Wanderlog | TripIt | Mindtrip | Gemini | Splitwise | Polarsteps | MMT / ixigo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AI itinerary with real places | ◐ (templates; on-device only for iOS 26) | ◐ | ○ | ● | ● | ○ | ○ | ● |
| One shared live trip for the group | ○ (copies) | ● | ◐ | ● | ○ | n/a | ◐ | ○ |
| Friends join from a link without installing | ○ | ◐ (web) | ○ | ● (web) | ○ | ○ | ● (web viewer) | ○ |
| Group decisions (votes, RSVP, dates) | ◐ (votes, but on copies) | ○ | ○ | ◐ | ○ | ○ | ○ | ○ |
| Shared expenses and settle-up | ● (local) | ◐ (budget) | ○ | ○ | ○ | ● | ○ | ○ |
| Pay a friend from the app (UPI) | ○ | ○ | ○ | ○ | ○ | ○ (outside US) | ○ | ○ |
| Booking import | ◐ (paste) | ● (Gmail, Pro) | ● (email) | ● (PDF, screenshot) | ● (Gmail) | ○ | ○ | ● (own bookings) |
| Offline trip and maps | ● | ◐ (Pro) | ◐ | ○ | ○ | ○ | ● | ◐ |
| Packing from plans, outfits and weather | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Documents and visas | ◐ (stored, Face ID) | ◐ | ◐ | ◐ | ○ | ○ | ○ | ● (visa sales) |
| Flight delays and gates | ○ (position only) | ○ | ● (Pro) | ○ | ◐ | ○ | ○ | ● |
| Trip memory, recap and book | ◐ (recap, PDF book) | ○ | ○ | ○ | ○ | ○ | ● | ○ |
| Content for Indian travellers | ○ | ◐ | ○ | ◐ | ● | n/a | ◐ | ● |
| Hindi or Hinglish | ○ | ○ | ○ | ○ | ● | ○ | ○ | ● |
| Widgets and Live Activity | ● | ○ | ◐ | ○ | ○ | ○ | ◐ | ◐ |
| Affiliate or booking revenue | ○ | ◐ | ○ | ● | ● | ○ | ● | ● |

**How to read it:** Tripsloom leads on packing, widgets and offline use. It is uniquely placed for **group money plus a plan**, but falls short at the two things that make that work: **shared live state** and **link-based joining**. No one in the matrix combines a group decision, a shared plan and settle-up with UPI. That empty row is the opportunity.

## 2.4 What users complain about, across the market

| Pain | Evidence | Who suffers it | Open for Tripsloom? |
| --- | --- | --- | --- |
| **Planning dies in the group chat.** Information gets lost, nobody replies, counting who's in is hard. | A small UX survey (35 people): about 90% plan in WhatsApp, 57% struggle to count who's interested, 77% use Google Forms for polls [Reported, small sample]. Trip-leader case studies describe lost information and money friction. WePlanify and yay.travel market directly against "WhatsApp chaos". | Organisers of friend and family trips | **Yes.** Only small apps target it, and none combine it with money. |
| **Free tiers of the money tools got worse.** | Splitwise's free daily limit (3–4 expenses), cooldowns, ads and Pro-only conversion; lower iOS rating (3.9) [Reported, Trustpilot and competitor blogs]. | Anyone splitting trip costs | **Yes.** Tripsloom already has free multi-currency splits. |
| **AI itineraries can be wrong.** | 27% say AI gave inaccurate information that needed fact-checking. A writer missed a conference over wrong visa advice from ChatGPT (Kaspersky). Gemini's itineraries still needed manual fixes (NYT, May 2026) [Reported]. | Anyone using AI planners | **Partly.** Trust and verification beat more generation. |
| **Billing surprises and annual-only plans.** | Wanderlog trial-charge complaints and requests for a monthly plan; TripIt is annual only [Reported]. | Occasional travellers | **Yes.** Per-trip pricing fits occasional use. |
| **Apps slow and crash with big trips.** | Wanderlog "slow and buggy" (May 2026); Stippl crashes on older Android [Reported]. | Heavy planners | **Yes.** Performance is a Tripsloom strength. |
| **Inspiration lives in reels, plans live elsewhere.** | Three new reel-to-trip apps in 2025–26. FINN Partners: Indian Gen Z are "heavily influenced by authentic digital content" and decide impulsively [Reported]. | Gen Z and millennials | **Yes**, if tied to group decisions rather than solo saving. |

## 2.5 What competitors do better, and what to borrow carefully

1. **Wanderlog: live shared editing and web access.** Must-have. A group plan has to be one object.
2. **Mindtrip "Start Anywhere": build a trip from a screenshot, post or PDF.** Borrow the idea for bookings and reels, but keep it grounded and editable.
3. **TripIt: email-forward import.** Valuable but costly to run (inbound mail, parsing). Later.
4. **Polarsteps: a physical product from memories.** Their main income [Reported]. Recap first, print later.
5. **ixigo Trip Mode: WhatsApp boarding passes and wallet updates.** Fits WhatsApp-heavy markets; copy the WhatsApp-native distribution, not the booking.
6. **Troupe: vote on dates and destinations before booking.** The decision phase is where groups stall. Tripsloom has votes but not date polls or RSVPs.

## 2.6 What competitors overlook

- **The organiser.** Every app treats group members as equals. In real friend trips, one person plans, books, chases and pays upfront, then chases the money. No one builds for that person's workload or protects them from being out of pocket.
- **"How much will this trip cost me?" before committing.** Friends drop out over money. No planner gives each member a credible per-person estimate at invite time.
- **Paying, not just tracking.** Splitwise tracks debts, while UPI apps pay but don't plan. Paytm's July 2026 launch shows the demand, but it lives inside a payments app with no trip plan.
- **Readiness across the group.** Who has their visa, ticket, leave approval, payment, packing? Organisers chase this one by one in DMs.
- **India-native content and voice** for friend groups: Goa, Gokarna, Spiti, Kasol, Hampi, Coorg, Vietnam, Bali, Thailand, Dubai, Sri Lanka, with Hinglish copy. The OTAs have it, but only to sell packages.

## 2.7 Sources

Competitors

- Expedia Group acquires Layla (2026-07-31): https://ir.expediagroup.com/news-and-events/news/news-details/2026/Expedia-Group-acquires-Layla-accelerating-its-AI-powered-trip-planning-and-booking-strategy/default.aspx
- Skift on the Layla acquisition: https://skift.com/2026/07/31/expedia-acquired-ai-trip-planner-layla-exclusive/
- Mindtrip flight booking (Sabre, PayPal): https://travelmole.com/news/mindtrip-ai-flight-booking-experience
- Mindtrip flights coverage: https://www.traveldailynews.com/technology/mindtrip-launches-ai-powered-flight-booking-platform/
- Google: how Gemini plans trips (2026-08-06): https://blog.google/products-and-platforms/products/gemini/how-gemini-plans-trips/
- NYT columnist tests Google's AI trip planner (via The Star, 2026-05-07): https://www.thestar.com.my/tech/tech-news/2026/05/07/opinion-a-tech-writer-puts-googles-ai-to-the-test-as-a-trip-planner
- TechCrunch on Google vacation-planning features (2025): https://techcrunch.com/2025/03/27/google-rolls-out-new-vacation-planning-features-to-search-maps-and-gemini
- Wanderlog review: https://www.endlesstravelplans.com/guides/planning-tools/wanderlog-review
- Wanderlog Trustpilot reviews: https://trustpilot.com/review/wanderlog.com
- Wanderlog App Store pricing tracker: https://apppricinglab.com/app/apple/1476732439
- Stippl vs Wanderlog (Stippl's own blog): https://www.stippl.io/blog/stippl-vs-wanderlog
- Pilot comparison of Stippl: https://www.pilotplans.com/compare/stippl-alternative-feature-comparison
- TripIt Pro pricing (G2 snapshot): https://www.g2.com/products/tripit-pro/pricing
- TripIt review: https://www.pilotplans.com/blog/review-of-tripit
- Polarsteps Plus: https://www.polarsteps.com/news/polarsteps-launches-polarsteps-plus-a-new-subscription-for-its-most-dedicated-travelers and https://www.polarsteps.com/plus
- Polarsteps 20 million travellers: https://news.polarsteps.com/news/20-million-travelers-and-counting-tech-success-story-polarsteps-celebrates-its-fast-growing-community
- Splitwise pricing 2026 (Finny, competitor blog): https://getfinny.app/blog/splitwise-pricing-2026
- Splitwise Trustpilot reviews: https://ie.trustpilot.com/review/splitwise.com?page=2
- Tripsy on the App Store: https://apps.apple.com/app/id1429967544
- Tripsy in-app purchase prices: https://apppricinglab.com/iap/apple/1429967544
- Layla pricing (directory): https://tooldirectory.ai/tools/layla
- MakeMyTrip Myra launch: https://www.outlookbusiness.com/corporate/makemytrip-launches-genai-enabled-trip-planning-assistant
- MakeMyTrip and Google Cloud: https://www.googlecloudpresscorner.com/2025-10-08-MakeMyTrip-and-Google-Cloud-Partner-to-Deliver-Faster,-Simpler-Planning-and-Booking-for-Millions-of-Travellers
- MakeMyTrip Q4 FY26 earnings highlights: https://finance.yahoo.com/markets/stocks/articles/makemytrip-q4-earnings-call-highlights-130826386.html
- ixigo AI-native app and TARA: https://www.phocuswire.com/news/technology/ixigo-launches-travel-app-conversational-booking-agentic-ai and https://www.altexsoft.com/travel-industry-news/ixigo-turns-travel-app-into-an-ai-trip-assistant/
- Pickyourtrail growth and profitability: https://pickyourtrail.com/press/how-this-indian-travel-startup-balanced-rapid-growth-with-profitability
- Thrillophilia (PTI/PNN press release): https://www.theweek.in/wire-updates/business/2025/08/22/dcm4-thrillophilia.html
- Roamy/Rhyme on the App Store: https://apps.apple.com/us/app/6748781672
- Wingman City Guide on Product Hunt: https://www.producthunt.com/p/wingman-city-guide/wingman-city-guide-2
- Paytm Split Bills: https://paytm.com/blog/bill-payments/paytm-split-bills/
- Paytm NSE filing (2026-07-29): https://nsearchives.nseindia.com/corporate/PAYTM_29072026101856_SEPressRelease29072026sd.pdf
- Troupe launch (JetBlue): https://www.businesswire.com/news/home/20220921005148/en
- Lambus on TechCrunch: https://techcrunch.com/2019/05/28/indie-travel-app-lambus-makes-group-trip-planning-easier/
- Atlys Series B: https://inc42.com/buzz/visa-processing-platform-atlys-raises-20-mn-to-boost-product-stack-expand-market-footprint/

Market and behaviour

- Kaspersky survey on AI trip planning: https://www.kaspersky.com/about/press-releases/is-ai-underrated-as-a-travel-agent-kaspersky-survey-shows-only-28-of-travelers-use-ai-to-plan-their-trips-but-more-than-90-were-happy-with-the-results
- Yahoo: generative AI tools not yet saving time: https://www.yahoo.com/news/articles/generative-ai-tools-not-yet-101449611.html
- Group trip UX case study (WhatsApp survey, n=35): https://uxplanet.org/whatsapp-poll-a-case-study-of-a-conceptual-feature-13021bb619a
- Group trip leaders case study: https://bootcamp.uxdesign.cc/simplifying-the-trip-planning-experience-for-group-trip-leaders-a-product-design-case-study-ffc3e10eb547
- WePlanify on Product Hunt: https://www.producthunt.com/products/weplanify
