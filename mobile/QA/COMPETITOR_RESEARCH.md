# Competitor research and business improvements

October 2026. Sources: App Store listings, product help pages and 2026 comparison articles (listed at the end). Prices vary by region and source, so treat them as approximate.

## The market at a glance

| App | What it's best at | Business model |
| --- | --- | --- |
| Wanderlog | Map-based planning, route optimiser, collaboration, offline plans | Free, Pro about $40–50 a year (Gmail import, export to Google Maps, offline extras) |
| TripIt | Itinerary built from forwarded confirmation emails | Free, Pro about $49 a year (flight alerts, 24-hour check-in reminders, seat and fare trackers) |
| Polarsteps | Automatic travel tracking, journal, travel statistics | Free app, revenue from printed travel books (from about €20) |
| PackPoint | Packing list generated from weather, trip length and activities | Free with in-app purchases, Premium tier |
| Splitwise | Shared expenses | Pro about $40 a year (currency conversion, receipt scanning, charts) |
| Stippl | All-in-one: planner, budget, packing, journal | Free, AI planner in Pro |
| Tripsy | Polished iOS planner, widgets, flight alerts | About $4.99 a month |
| Lambus | Group planning, expenses, country info (time zones, currency) | Free, Pro in-app |

**What travellers value most:** reliable itinerary management and offline access come first; social features are secondary. Bugs, hidden costs and complicated UX are the top reasons people uninstall travel apps.

**What converts:** travel apps have among the highest trial-to-paid conversion, with annual plans preferred. Paywalls work best at moments of intent (when a user hits a premium action), not on every launch. Showing the annual saving and offering a free trial help.

## Where Trips Loom already matches or leads

- AI trip drafting (Stippl Pro, Wanderlog), on device where available.
- Booking import from pasted confirmations (TripIt's core idea, without needing email access).
- Shared costs with settle-up and multi-currency conversion for free (Splitwise charges for conversion).
- Votes, invites without accounts, outfits and a weather stylist (unique).
- Home and Lock Screen widgets plus a trip-day Live Activity (Tripsy has widgets; Live Activities are rare).
- Documents with Face ID, trek and dive tools (unique).

## Gaps worth closing, and what was built

| Gap | Seen in | Status |
| --- | --- | --- |
| Packing list suggested from weather, trip length, trip kind and plans | PackPoint, Stippl | Built: "Suggest items" in Packing |
| Country essentials: plugs, voltage, emergency number, driving side, tipping, local time and time difference | Lambus, TripIt | Built: "Essentials" on the trip page |
| Flight check-in reminder 24 hours before | TripIt Pro, Tripsy | Built: automatic reminder for flight plans |
| Directions for the day's plans in Maps | Wanderlog | Built: "Route in Maps" on each day, "Directions" on each plan |
| Travel statistics: trips, countries, days away | Polarsteps | Built: "Your travels" on Profile |
| Spending by category | Splitwise Pro | Built: category breakdown in Budget |
| Automatic expense categories | Splitwise | Built: "Taxi" picks Move, "Hotel" picks Stay as you type |
| Annual saving shown on the paywall | Paywall best practice | Built |
| Review prompt at a happy moment | Store best practice | Built: after a finished trip's recap |
| Tell a friend | Growth loop | Built: share from Profile |
| Trip map with every plan, the day's route and walking time | Wanderlog | Built: "Map" on the trip page and itinerary |
| Offline maps | Wanderlog Pro | Built: "Save map for offline" (free OpenStreetMap tiles) |
| Live flight status | TripIt Pro, Tripsy | Built: position, altitude, speed, distance left and arrival estimate from volunteer ADS-B data |
| Journal check-ins and "where you went" | Polarsteps | Built: "Check in here" on the map, listed in the recap |
| Receipt scanning | Splitwise Pro | Built: on-device text recognition fills amount, currency, merchant, date and kind |
| Travel book | Polarsteps (printed) | Built: a PDF travel book from the recap, free |

## Not built, and why

- **Gate changes, delays, seat and fare trackers (TripIt Pro).** No free source has schedules or delays. Live status covers where the plane is; delays need a paid provider.
- **Email forwarding import.** Needs an inbound mail server, a backend change for the owner to approve. Paste import covers the need today.
- **Automatic background GPS tracking (Polarsteps).** Battery and privacy cost; manual check-ins cover it without background location.
- **Printed books.** Need a print partner; the PDF travel book is the free version and a good later revenue stream.
- **Real-time co-editing with chat (Wanderlog, Lambus).** Needs a shared-trip backend change for the owner to approve; invites cover sharing today.
- **Route optimisation.** Needs a routing service; the day's route opens in Apple or Google Maps instead.

## Sources

- [Stippl: best travel planning apps 2026](https://www.stippl.io/blog/best-travel-planning-apps-2026)
- [TripProf: 20 trip planning apps ranked](https://tripprof.com/en/blog/best-trip-planning-apps-2026/)
- [Wanderlog vs Polarsteps](https://www.wandrly.app/comparisons/wanderlog-vs-polarsteps)
- [Wanderlog on the App Store](https://apps.apple.com/us/app/wanderlog/id1476732439)
- [TripIt help: TripIt or TripIt Pro](https://help.tripit.com/en/support/solutions/articles/103000063396-tripit-or-tripit-pro-)
- [PackPoint on the App Store](https://apps.apple.com/app/packpoint-packing-list/id896337401)
- [Polarsteps travel book announcement](https://news.polarsteps.com/news/polarsteps-tracks-your-trip-and-turns-it-into-an-instant-photo-album)
- [Android Central on Splitwise](https://androidcentral.com/apps-software/the-app-splitwise-is-the-best-hack-to-split-group-trip-expenses-in-2026)
- [Adapty: how travel apps convert](https://adapty.io/blog/paywall-newsletter-21/)
- [Subscription app growth playbook 2026](https://www.contentgrip.com/subscription-app-growth-playbook/)
- [Tripsy update on 9to5Mac](https://9to5mac.com/2023/09/22/tripsy-travel-planner-app-update/)
- [Lambus country info feature](https://www.lambus.com/blog/2024/02/22/new-lambus-feature-country-infos-l-lambus-blog)
- [Apadmi Travel Apps Report 2026](https://www.apadmi.com/download/travel-apps-report-2026/)

## Verified in the simulator (2026-10-13)

Watched live in the side panel on the Barcelona test trip, with live data:

- **Essentials:** Spain, local time 3 h 30 min behind home, jet lag tip, plug type C/F fits, 230 V, drive on the right, emergency 112, country code +34.
- **Suggested items:** 21 suggestions for a 5-day beach trip; "Passport" already on the list was not repeated. Adding them filled the list by category.
- **Directions:** "Directions" appears on a plan once it has a place and opens Apple Maps.
- **Your travels:** 1 trip, 1 country (Spain, looked up from "Barcelona"), days away, longest trip.
- **By category:** Food €90 (78%), Move €25 (22%).
- **Automatic categories:** typing "Hotel" switched the kind to Stay.

Later the same night, also watched live: trip map with pins and walking route, offline map save (22 MB), a check-in, live status for Air India 128 in flight over Oman, a receipt scanned from Photos (€42.90), and the travel book PDF. Details are in RELEASE_AUDIT.md.

Built and typechecked but not exercised on screen: flight check-in reminders (need a flight plan and a scheduled notification), the paywall saving badge (needs store products), the review prompt (fires after a finished trip's recap), and "Tell a friend".
