# 7. Planning: start from anything, plan together, with AI

October 2026. Built in the app: plan mode (`mobile/src/screens/planmode.tsx`) for a new trip, and the planning board
(`mobile/src/screens/board.tsx`) for any trip. The reel side follows the research in
[6. How apps analyse a reel](06-reel-analysis.md).

## The idea

Planning is one feature, not a reel feature. You plan with whoever is going (yourself alone, or friends) and with AI,
and everyone's input ends up in one draft of the days.

- **Start from anything:** a sentence ("3 days in Jaipur on my own from 12 December. Amber Fort, Hawa Mahal,
  Nahargarh Fort at sunset"), place names, a Google Maps link, or reels you've shared to the app. Each is read for
  places, checked on the map, and labelled with where it came from.
- **Plan together:** every trip has a planning board. Anyone on the trip adds ideas the same ways, and taps a heart on
  the ones they want. Their preferences (pace, food, budget) count too.
- **AI helps, never decides:** it suggests places that fit the group and answers specific asks ("Food we can all eat",
  "a sunset spot near the market"). Every suggestion is checked on the map, labelled, and only goes on the board if
  someone adds it.
- **The days draft themselves** from what the group wants, and anyone can re-draft as ideas and votes change. Plans
  added by hand stay as they are.

For reels specifically, nothing watches the video. The app reads what each post already says in words (caption,
hashtags, tagged accounts, the cover title), and asks for the one thing posts often hide: the comment or DM that names
the spot.

## The Plan tab: a dedicated planning section

Planning has its own tab (Trips · **Plan** · Discover · Shared · Profile), `mobile/src/screens/planhub.tsx`:

- **Plan a trip with AI.** Type where, when and who, and anything you already want to do. Tap a starter ("A long
  weekend in…") if the page is blank. Reels, posts and Maps links are optional context ("Add a reel or link", or
  "Saved for context").
- **Plans in progress.** Every plan is saved on the phone as you go (`services/planDrafts.ts`), so you can stop and
  pick up later at the same step, with the AI conversation.
- **Keep planning your trips.** Each upcoming trip's planning board, with friends.

Plan mode then runs with AI the whole way. **AI reads the sentence first** (`brief`), so short, lowercase, misspelt
or wrong sentences are understood:
- **Where:** the destination as maps name it, in the right country.
- **What kind of trip:** a trek, a city trip, a beach trip…
- **The facts given:** days, who's going, month, food, budget.
- **The places named:** spelling fixed.
- **A note** when something needs correcting. "Trek in nepal in goechala for 6 days" gives a Goecha La trek from
  Yuksom, Sikkim, with the note: "Goechala is in Sikkim, India, not Nepal… in 6 days you'd turn back at Dzongri".
- **A question** when it can't tell where ("somewhere warm").

Without AI, the rules read it instead: trip words like "trek" are never taken as the destination, and lowercase place
names count.

**Treks are planned as treks:**
- A day-by-day route from the trailhead, with distances, hours, altitudes, the high point and permits.
- Days that climb fast at altitude are flagged by the app's own check, not left to AI.
- The start date is in season ("best done in March to May and September to November").
- Route changes are asked in words ("add a rest day", "the full 8-day route"); AI re-plans safely, with what changed
  and Undo.
- The trek becomes a trek trip: dated stages in the adventure view, permits under Prepare, one plan a day.

Places the free map (OpenStreetMap) doesn't know, like Promenade Beach in Puducherry, are looked up on Apple Maps on
iOS, inside the destination only.

For other trips:
1. **Places.** What you named is found on the map. If you named only a destination or a place or two, **AI's picks**
   arrive straight away, matched to what you wrote ("palaces and lake views" in Udaipur gave City Palace, Lake
   Pichola, Jag Mandir…). Add one, or all.
2. **The trip.** Facts from your sentence are marked "From you"; the rest are suggestions with reasons.
3. **Your days, with "Plan with AI".** Say what to change in your own words:
   - Quick changes are made on the phone, instantly and free: pace, length, food, budget, removing, moving or
     keeping a place by name.
   - Anything richer goes to the AI as checked edits: add, leave out or move a place; change a setting
     (`domain/coplan.ts`, prompt `EDIT_SYSTEM`). The engine then lays the days out again, so times, meals, travel
     and sunsets stay right.
   - Every turn lists what changed, with Undo for the latest.
   - Suggestions come from the plan itself ("Fill day 3", "Lighten day 2", "A sunset spot").

## Two doors into the same planning

| Door | When | What it does |
| --- | --- | --- |
| **Plan a trip** (Home → "Start planning", or share a reel to the app) | No trip yet | The 4-step guided flow below. Accepts a typed sentence, places, Maps links and reels together. Facts in the sentence (dates, length, who's going) are filled in and marked **From you**; the rest is **Suggested** with a reason. If you already have a trip to that destination, it offers to add the places to that trip's board instead ("Already planning Bangkok trip?"); a place already on the board gets your heart rather than a duplicate. |
| **The planning board** (trip page → "Plan" / "Plan together", Home → "Plan <trip> together", shortlist) | Any trip, solo or shared | Ideas, Ask AI, How the days go, and Draft the days. Live for shared trips: friends' ideas and votes arrive within seconds (Realtime, with a 12-second poll as backup). |

## The planning board: how everyone's input combines

The rules are plain so the board can say why (`mobile/src/domain/together.ts`, unit-tested):

| Input | Rule |
| --- | --- |
| Votes (hearts) | Most of the group wants it → **In the plan**. At least one person → **If there's room**. Nobody → left out. On your own, anything you want is in. |
| Pinned to a day | Stays on that day ("On Sat, 14 Nov"). |
| Already in the itinerary by hand | **Planned for <day>**; not drafted again, and its day keeps its own title. |
| Pace | Set for the whole group if someone chose it; otherwise what most people prefer ("Asha and Rohan like to take it easy"); a tie is balanced. |
| Food | If anyone eats Jain or veg, meal breaks say so ("Kabir eats Jain, you and Asha veg"). |
| Plans added by hand | Stay where they are, take room on their day, and show in the draft as "Already planned". A first or last day planned by hand gets no "Arrive" or "Check out" stop. |
| Re-drafting | Replaces only the last draft's stops. Each stop's notes say where it came from and who added it ("From a reel: … / Added by Rohan"). |

Each idea row shows its kind, area, who added it and how ("Rohan · from a reel", "Kabir asked AI"), where the group
stands ("3 of 4 want it") and your heart. Ideas missing a map pin (older ones, or names the map missed at first) are
looked up again when the board opens, so the draft can group them by what's nearby.

## The flow

| Step | What the person sees | What happens |
| --- | --- | --- |
| **0. Share** | In Instagram, YouTube or TikTok: Share → Trips Loom. Or paste a link on Home. | The iOS share extension / Android share target hands the app the link. It's saved to the reel inbox on the phone and read in the background. Sharing a second reel while plan mode is open adds it to the same plan. |
| **1. Your reels** | A row per reel: creator, date, likes, caption, the tags that look like places, the cover's text. | Read from the post's public link preview (one request from the phone, as `TripsloomBot`). If the creator hides the spot ("Comment DIL CHAHTA HAI and I'll DM you"), a banner says so and asks for the reply. A private post asks for its caption. |
| **2. The places** | Every place found, as chips over a map of the destination: tap one for *where it came from* ("From a hashtag · @beingazhar_") and Must-do / Maybe / Leave it out; tap one of AI's picks to add it. | Rules read pins (📍), "Location:" lines, numbered and emoji lists, "such as A, B or C", place-like hashtags (#ChaporaFort, #bagabeach), tagged venues and short titles. Hashtags like #goadiaries and #NorthGoa give the destination and area, not stops. Each name is looked up on OpenStreetMap inside the destination's boundary; roads, bus stops and hotels that share a name are skipped. When AI is on, it adds places the text only hints at, labelled "Suggested by AI", and only if the map finds them. |
| **3. The trip** | When, how long, who, pace, food, budget, arrival and departure, and what to do with maybes. One sentence ("3 days in Jaipur, starting Fri 25 Dec, for you and 3 friends. A balanced pace…"): what AI suggested in ember, what you said in ink. Tap a word to change it, with AI's reason under the sentence. | Dates: a month the reels name, else the next Indian long weekend, else three weeks out. Length: what fits the must-dos at the pace. Party: from the reels (#couplegoals → couple) or the person's usual. Food: "veg" in the reels → veg. |
| **4. Your days** | A map of the day (numbered stops and the route), a strip of days showing how full each is, and the day as a timeline with times, real sunset times, travel between stops, lunch and dinner near where you are, and why each stop is there. Changes are asked in the ask bar at the bottom: a notice above it shows AI's reply, what changed and Undo; changed stops are labelled and their pins ringed, and the plan jumps to the day that changed. Tap a stop to move it, demote it to a maybe or remove it; the days rebuild around it. | The engine (`domain/planmode.ts`) groups places that are within about 15 km of each other, packs those groups into days (arrival and departure days stay light), puts forts and viewpoints 50 minutes before the real sunset for that place and date (one sunset a day), temples and museums in the morning, clubs at night, a beach in the morning if the day would otherwise start empty, lunch around one o'clock near the last stop, and dinner after a sunset. A place the person moved stays on that day; a dinner place moved to the day you leave becomes lunch. |
| **Create** | "Create the trip". | A trip with every stop, start and end time, area, the reel link and the quoted evidence in each stop's notes, and every place on the shared shortlist. For friends and family, the next screen invites everyone, or opens a date poll if they chose "Ask the group". Maybes go to the shortlist for the group to vote on. Used reels leave the inbox. |

## Why it's different (from the apps in the research)

1. **Evidence on every place.** No app we tested shows *why* it thinks a place is in a reel. Plan mode shows the quote
   and the source on every place and every stop. That's the defence against the made-up places reported for Mindtrip
   and Expedia.
2. **It asks instead of guessing.** It detects "comment X for the location", "DM me", "link in bio" and pinned-comment
   bait, says so, and asks for the reply. A pasted reply counts first.
3. **The days respect geography and the clock.** Nearby places share a day. Sunset spots get the real sunset time.
   Meals fall near where you are. Arrival and departure days stay light. The competitors drop pins on a map or produce
   a generic list.
4. **Co-planning, not a black box.** Every answer is pre-filled with a reason the person can change. Every stop can be
   moved, and the plan rebuilds around what the person decided.
5. **Built for groups and India.** Couple, friends and family defaults. Long-weekend dates. Veg and Jain-aware meal
   notes. Maybes go to the group vote. A date poll and an invite come straight after. It works on Instagram and YouTube
   (TikTok is blocked in India), on rules alone when no AI is set up.
6. **Honest about AI.** It works without AI (rules plus the map). With AI, suggestions are labelled, quote their
   source, and must resolve on the map. The model reads and suggests; it never schedules.

## AI: where it runs

- **Cloud** (`/api/ai/reels`): DeepSeek by default (`deepseek-flash` reads posts, `deepseek-v4-pro` suggests places;
  thinking off), with Gemini and OpenAI behind the same interface. It's off until a key is set, and only used with the person's permission (asked once, the first
  time; changed in Data & privacy). It's for signed-in accounts only, at 40 calls a day per account, and answers are
  cached for repeat inputs.
  - Providers: `lib/ai/providers.ts`.
  - Prompts: `lib/ai/prompts.ts`, versioned.
  - Task logic: `lib/reel-ai.ts` (validation, answer checks, retries and fallback).
  - Operations: [08-ai-operations.md](08-ai-operations.md).
- **On-device** (iOS 26 with Apple Intelligence). `LoomIntelligence.readReels` / `suggestPlaces` use Apple's
  Foundation Models when the cloud isn't set up, isn't allowed, has used today's allowance, or fails. Nothing leaves
  the phone.
- **Neither.** Rules and the map only; everything except the AI suggestions works.

## What it reads, and what it doesn't

- Instagram: the post's link preview, which carries the full caption, likes, comments count, creator and date. This was
  verified on real posts with an honest `TripsloomBot` user agent. It reads no comments, never signs in and never
  scrapes logged-in content.
- YouTube: oEmbed plus the watch page's description, keywords and creator. Videos with embedding off fall back to
  the page. Private videos are reported as unreadable.
- TikTok: its public oEmbed caption. It's unreachable from India (it redirects), and the app says so.
- The cover image's text is read on the phone (Vision OCR).

## Verified (simulator, 16 Oct 2026)

- Four real Goa reels (two Instagram, two YouTube Shorts) produced six places, each placed correctly: Chapora Fort
  (Anjuna), Baga Beach (Calangute), Fontainhas (Panaji), Gunpowder (Verla), Cabo de Rama Fort (Kuddi), Butterfly Beach
  (Canacona). Four of them came from a pasted creator DM.
- The suggestions were couple (#couplegoals), relaxed, Christmas long weekend and 4 days.
- The days came out as: arrival at Fontainhas; North Goa (Baga in the morning, Chapora at sunset, Gunpowder dinner);
  South Goa (Butterfly Beach, Cabo de Rama at sunset); a light departure day. Moving Gunpowder to the departure day
  turned it into lunch and the rest rebuilt.
- The trip was created with 4 of 4 days planned.
- The real iOS share sheet: from Safari on an Instagram reel, Share → **Trips Loom** opened plan mode with the reel already
  read (caption, 1,172 likes, cover text "Finding Portugal in Panjim"). It found Fontainhas (pinned in the caption).
  Choosing friends and "Ask the group" created the trip and opened the date poll with the Christmas long weekend.
- Tests: 28 parser and engine tests (`node --import tsx --test mobile/src/domain/__tests__/*.test.ts`), 5 AI-module
  tests (`tests/reel-ai.test.ts`), and the full web suite (114).

## Verified: planning together (simulator, 17 Oct 2026)

On the live Bangkok trip with three real test accounts (Asha, Rohan and Kabir writing through the API while the board
was open on the simulator):
- Asha added Jim Thompson House by name and Rohan added Yaowarat Road from a reel, each with votes. Kabir added Wat Pho
  ("asked AI") and hearted Lumphini Park while the board was open; both appeared within the 12-second poll. Hearting
  Yaowarat (3 of 4) moved it from "If there's room" to "In the plan".
- Adding places: "Lumphini Park" by name went straight on; "Golden Mount, Talat Noi and Wat Saket" offered all three to
  pick from.
- Draft: the group's pace (relaxed, from Asha and Rohan) and food (Jain, from Kabir) were applied. Yaowarat (a night
  street-food market) is dinner in itself at 19:00. Friday's hand-made plans (Wat Arun, Asiatique, Jodd Fairs) stayed,
  were shown as "Already planned", and those ideas were marked "Planned for Fri, 13 Nov". Applying and then re-drafting
  replaced only the draft's stops, with no duplicates.
- Solo: "3 days in Jaipur on my own from 12 December. Amber Fort, Hawa Mahal, Nahargarh Fort at sunset" gave Jaipur,
  all three places, 12 Dec, 3 days and "Just me", the first three marked "From you", and Nahargarh at sunset.
- Hand-off: a Bangkok sentence in plan mode offered "Add to Bangkok trip"; it added Chinatown and the Grand Palace,
  gave Wat Pho your heart instead of a duplicate, and opened the board.

Fixed during this pass:
- Autocorrect turned "Lumphini" into "Lymphoma" (place fields now have autocorrect off), and a name the map can't find
  is no longer added unseen.
- "Jodd Fairs Night Market" wasn't found; market names are retried without "Night Market" and similar endings.
- A name ran across a full stop ("…December. Amber Fort").
- "On my own" wasn't read as solo.
- New searches kept old answers.
- Dinner was listed after a night market, or at 22:00.
- "Jaipur Municipal Corporation" was shown as a neighbourhood.
- AI suggestions appeared far from where you asked.
- The draft opened scrolled down.
- An edit made while the app was pulling from the server could stay on the phone until the next edit; it's now sent
  on the next pull.

Not verified: AI suggestions on the board. Apple's on-device model returned an error in the simulator, and there's no
cloud key here; the board shows "AI couldn't answer" and everything else works.

## Before launch

- **AI:** follow the launch checklist in [08-ai-operations.md](08-ai-operations.md): the `DEEPSEEK_API_KEY` Worker
  secret, migration `20261019_ai_usage.sql` on the hosted Supabase, `npm run eval:ai` passing, and the privacy policy
  and App Store privacy answers updated for DeepSeek.
- **Share extension:** works from the system share sheet (verified from Safari). Still to test on a real device from
  the Instagram and YouTube apps, which share a link plus their own text.
  EAS needs credentials for the extra extension target (`TripsLoomShare`) alongside the widget.
- **Map lookups:** Photon is free but slow (5–8 s each) and rate-limited. Before scale, move lookups to our server
  with a cache, or use a paid geocoder (Google Places, Mapbox).
- **Instagram previews:** they can change without notice. If captions stop arriving, the "paste the caption" path
  still works. Consider the official Instagram Messaging route (DM the reel to @tripsloom) as a second door.
