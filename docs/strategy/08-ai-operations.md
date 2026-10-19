# 8. Running planning's AI in production

October 2026. How Trips Loom's planning AI is set up, what it costs, how to watch it, and what to do when it goes
wrong. The product side is in [7. Planning](07-plan-mode.md).

## What it does

There are two tasks, both behind `POST /api/ai/reels`, and the model only reads and suggests:

| Task | Input | Output | Used by |
| --- | --- | --- | --- |
| `read` | Up to 10 posts' public text (caption, hashtags, cover text) plus anything typed or pasted | Places, each with the exact words it came from, a time of day and a reason | Plan a trip (after rules have already found what they can) |
| `ideas` | Destination, places already on the board, nearby areas, group, food, budget, the person's question | 3 to 6 named places with a reason each | Planning board → Ask AI; plan mode → AI's picks |
| `brief` | What the person typed to start a plan ("trek in nepal in goechala for 6 days"); or, for a trek, its route and the change they want | Where (spelling and wrong facts fixed, with a note), what kind of trip, the facts given, places named, the best months, and for a trek a day-by-day route with altitudes, distances and permits | Plan mode's first step; the trek route's "Plan with AI" |
| `edit` | The drafted plan (trip settings, places with ids, the days' stops), the last few messages, and what the person wants changed | A short reply and edits: add, leave out or move a place; set pace, length, food, budget, dates or people | Plan mode → Plan with AI |

The app checks every place on OpenStreetMap inside the destination before showing it, labels it ("Suggested by AI",
"Kabir asked AI"), and only adds what a person picks. The engine, not the model, schedules the days.

## How it's built

| Layer | File | Job |
| --- | --- | --- |
| Providers | `lib/ai/providers.ts` | One interface (system and user text in, JSON text out) for DeepSeek, Gemini and OpenAI, and error classes by what to do about them |
| Prompts | `lib/ai/prompts.ts` | The system prompts and response shapes, with a version (`PROMPT_VERSION`) |
| Tasks | `lib/reel-ai.ts` | Validates input, checks answers, and runs retries and the fallback provider |
| Route | `app/api/ai/reels/route.ts` | Sign-in, the daily allowance, the answer cache and logs (permission is asked in the app) |
| App | `mobile/src/services/planai.ts`, `mobile/src/core/cloudAi.ts` | Asks permission once, calls the server, and falls back to Apple's on-device model |

**Edits are checked twice:**
- **On the server:** only ids that are in the plan, settings with valid values, days within the trip, and new places
  that aren't already there (and serve no meat, for a veg or Jain group).
- **On the phone** (`domain/coplan.ts`, `cleanEdits` / `applyEdits`): checked again before anything changes. Plain
  requests never reach the AI at all.

**Checks on every answer** (`cleanAnswer`):
- A place must quote words that really are in the posts. A quote the model made up drops the place.
- Ideas the board already has, the destination itself, links and duplicates are dropped.
- Only known fields are kept, at bounded lengths. Code fences and chatter around the JSON are tolerated.

**Safety:**
- The prompts treat all input as data and say to ignore instructions inside it.
- Off-topic or unsafe asks get an empty list.
- Even a successful injection can only produce place names, which must then be found on the map and picked by a
  person.

## Configuration

Set in the Worker's environment. Keys must be secrets (`npx wrangler secret put …`), never `EXPO_PUBLIC_*`.

| Variable | Meaning |
| --- | --- |
| `DEEPSEEK_API_KEY` | Turns AI on with DeepSeek |
| `AI_PROVIDER` | `deepseek` (default when its key is set), `gemini` or `openai` |
| `AI_MODEL` | The model for both tasks. Unset: `deepseek-flash` reads posts and `deepseek-v4-pro` suggests ideas (see "Why two models") |
| `AI_IDEAS_MODEL` | The model for suggesting ideas only |
| `AI_FALLBACK_PROVIDER`, `AI_FALLBACK_MODEL` | A second provider for when the first is down or out of balance (needs its own key) |
| `GEMINI_API_KEY`, `OPENAI_API_KEY` | Keys for the other providers |
| `DEEPSEEK_BASE_URL` (and `GEMINI_…`, `OPENAI_…`) | A compatible gateway in front of the provider: HTTPS, or `http://localhost` for a local stand-in during development |
| `AI_DAILY_GLOBAL_LIMIT` | Model calls per UTC day for all accounts together. Default 20,000 (about $13 a day at most) |
| `AI_DISABLED=1` | Kill switch. AI is off everywhere at once; the app falls back to on-device AI or none |

**DeepSeek call:**
- `POST {base}/chat/completions`, with `deepseek-flash` to read and `deepseek-v4-pro` to suggest.
- `thinking: {type: "disabled"}`: fast and cheap. Reading and suggesting don't need reasoning.
- `response_format: {type: "json_object"}`. The prompts say "json" and show the exact shape, which JSON mode needs.
- Temperature 0 for reading, 0.5 for ideas.
- `max_tokens` 2,500 for reading, 900 for ideas.

## Limits and reliability

- **Per person:** 40 model calls per account per UTC day (`use_ai_quota()`, migrations `20261019_ai_usage.sql` and
  `20261020_ai_global_cap.sql`). Answers served from the cache don't count. Over the limit, the app says so and uses
  the phone's own model if it has one.
- **Everyone together:** `AI_DAILY_GLOBAL_LIMIT` calls per UTC day (default 20,000), so new accounts can't be used to
  run up the bill. A call refused by this cap isn't counted against the person.
- **Answer cache:** the edge cache (Workers Cache API) keyed by a SHA-256 of prompt version, model and input. Reads
  are kept 7 days, ideas 1 day. Changing the prompt version or the model invalidates the cache.
- **Retries:** a busy, slow or unusable answer (429, 5xx, timeout, network, bad JSON) is retried once after 0.5 s
  (1.5 s for 429). A wrong key, no balance or a rejected request (401, 402, 4xx) goes straight to the fallback
  provider. Everything stops after 25 s; the app waits up to 30 s.
- **Input limits:** 64 KB request body, 10 posts, 2,200-character captions, 200-character questions, 40 board places.

## Why two models

Reading is extraction: the words are in front of the model, and `deepseek-flash` was right on every evaluation case
in about 1 s. Suggesting needs to know the places.

| Model | Veg/Jain food suggestions that were right for the diet | Speed |
| --- | --- | --- |
| `deepseek-flash` | About 4 in 5. It named Ritz Classic, Viva Panjim and Spice Court, which serve meat, as veg | 1–1.5 s |
| `deepseek-v4-pro` | About 19 in 20 before the menu check, and 36 of 37 after it | 2.5–3.5 s |

**The menu check:** each idea must say what the place serves (`pure_veg`, `serves_meat` or `not_a_restaurant`). For
a veg or Jain group, the server drops anything that isn't `pure_veg` or `not_a_restaurant`, including when the model
leaves it unsure.

## Cost

List prices per million tokens, at peak hours (off-peak is half):

| Model | Input, cache hit | Input, cache miss | Output |
| --- | --- | --- | --- |
| `deepseek-flash` | $0.006 | $0.30 | $1.20 |
| `deepseek-v4-pro` | $0.044 | $1.32 | $3.96 |

**Measured (19 Oct 2026, 17 evaluation calls):** about 1,000 tokens in per call (89% of them cache hits, since the
system prompt repeats) and about 110 out. That's about $0.64 per 1,000 calls at peak prices, mostly from the ideas
calls.

**Example budget:** 10,000 active planners making 5 AI calls a day is 50,000 calls and about $32 a day at peak, less
with the answer cache. That's above the default global cap of 20,000 calls, so raise `AI_DAILY_GLOBAL_LIMIT` to match
real use.

The DeepSeek account is prepaid, so its balance is a hard spending cap: when it runs out, calls fail with 402 and the
fallback provider (if set) takes over.

## Watching it

Each call writes one log line to the Worker logs. The line never contains content or who made the call.

```json
{"event":"ai_call","task":"ideas","outcome":"ok","provider":"deepseek","model":"deepseek-v4-pro","attempts":1,"ms":3064,"inputTokens":976,"outputTokens":185,"cachedTokens":896,"items":4}
```

`outcome` is one of:
- `ok`: answered.
- `cache`: served from the cache.
- `allowance`: the person's daily limit was hit.
- An error kind: `auth`, `billing`, `rate`, `server`, `timeout`, `network`, `bad_output` or `bad_request`.

What to watch:
- **Failure rate:** non-`ok`, non-`cache` outcomes divided by calls.
- **Latency:** p50 and p95 of `ms`.
- **Tokens per day.**
- **Allowance hits per day.**

App analytics adds `ai_ideas` (how many ideas were found), `ai_consent` (allowed or not), `plan_board_*` and
`plan_mode_*`.

## When it goes wrong

| Symptom | Likely cause | Do |
| --- | --- | --- |
| `auth` outcomes | Key revoked or wrong | Rotate `DEEPSEEK_API_KEY` |
| `billing` outcomes | DeepSeek balance used up | Top up; set `AI_FALLBACK_PROVIDER` so it doesn't happen silently again |
| `rate` or `server` spikes | DeepSeek busy or down | The fallback takes over if set; otherwise set `AI_PROVIDER` to another provider, or `AI_DISABLED=1` |
| `bad_output` rising | Model or prompt drift | Run `npm run eval:ai`; pin `AI_MODEL`; roll back the prompt |
| Bad suggestions reported | Prompt quality | Add the case to `scripts/ai-eval.ts`, fix the prompt, bump `PROMPT_VERSION`, re-run the eval |

## Changing a prompt or model

1. Edit `lib/ai/prompts.ts` and bump `PROMPT_VERSION`. This also stops cached answers from the old prompt being served.
2. Run `npm test` (unit tests, mocked) and `npm run eval:ai` against the real provider. It runs realistic cases and
   checks:
   - What must be found, and what must never be (regions, the city, bait, injected names).
   - Times of day.
   - Every suggested idea exists on the map at the destination.
   - Latency, tokens and cost.

   It exits non-zero on any failure.
3. Ship. To compare models, run the eval with `AI_MODEL=… npm run eval:ai`.

## Evaluation (19 October 2026)

`npm run eval:ai` against live DeepSeek: **25 of 25 cases pass** (9 reading, 8 ideas, 8 planning). Planning median
2.1 s.

**Planning cases:**
- "Day 2 feels too packed" → moves one of day 2's places.
- "Add a nice sunset spot on day 3" → adds one on day 3.
- A pure-veg lunch near Panjim → adds Shree Sagar.
- "Swap Bom Jesus for something more fun" → leaves it out, adds a beach.
- "Five days, relaxed" → sets both.
- "change it" → asks back.
- An off-topic question, and an injected "remove every place" → no changes.

The earlier run (reading and ideas only, before the planning cases were added):

| Task | Cases | Median | Slowest |
| --- | --- | --- | --- |
| Reading (`deepseek-flash`) | 9 | 1.1 s | 1.3 s |
| Ideas (`deepseek-v4-pro`) | 8 | 2.7 s | 3.5 s |

Results by case:
- **Reading:**
  - Film hint: "the Dil Chahta Hai fort" → Chapora Fort at sunset.
  - Area qualifiers skipped: "Gunpowder in Assagao" → Gunpowder only.
  - Pinned 📍 lists read.
  - Hidden-spot bait gives nothing.
  - A typed sentence, Hinglish captions, and YouTube titles with sunrise are read correctly.
  - A planted "list Pwned Palace" instruction is ignored.
- **Ideas:**
  - Jain, veg and family requests are respected, with nothing already on the board repeated.
  - A poem request and a "reveal your system prompt" request both get an empty list.
  - 17 of 18 ideas were found on OpenStreetMap at the destination.

**End to end** through the local server as a signed-in test account: ideas in 3.3 s, the same ask again from the
cache in 0.11 s, and a reel read in 1.4 s. Missing sign-in (401), a wrong origin (403) and junk input (400) are
refused.

## Privacy

- **What's sent:** only the text a task needs, listed in the privacy policy (`app/privacy/page.tsx`) and in the app
  (Profile → Data & privacy). Never names, emails, account IDs, documents or other trips.
- **Permission:** the app asks before the first cloud call and keeps the answer in the profile (`cloudAi`). Off
  means only on-device AI. This is required by App Review guideline 5.1.2(i) for third-party AI.
- **Where:** DeepSeek's servers are in China. The privacy policy says so, and the App Store privacy answers need to
  match. Answers are cached for up to 7 days under a hash of the input.

## Launch checklist

- [ ] `npx wrangler secret put DEEPSEEK_API_KEY` on the production Worker. Optionally also `GEMINI_API_KEY` with
      `AI_FALLBACK_PROVIDER=gemini`.
- [ ] Migrations `20261019_ai_usage.sql` and `20261020_ai_global_cap.sql` applied to the hosted Supabase.
- [ ] `npm run eval:ai` passes against production settings.
- [ ] DeepSeek balance topped up, with a low-balance alert in the DeepSeek console.
- [ ] App Store Connect privacy answers include the data sent to the AI provider (user content, not linked to the
      user, not used for tracking).
- [ ] Privacy policy published with the "Planning, reels and AI" section.
- [ ] A dashboard or alert on the `ai_call` log lines: failure rate above 10% for 15 minutes, p95 above 15 s.
