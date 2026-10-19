# 6. How trip-planning apps actually analyse a reel

October 2026. Research only: no application code was changed. Evidence labels as in the [README](README.md):
**[Verified]** primary source (vendor docs, platform docs, a paper) or this repo; **[Reported]** press, reviews or vendor
marketing; **[Assumption]** our reasoning.

## Summary

- **Every app runs the same five-stage pipeline:** get the post → collect the cheap signals → extract place names → put them on
  the map → have the person confirm. The differences are in *how they get the post* and *how far down the signal list they go*.
- **Getting the reel is the hard part, not the AI.** Instagram gives third parties almost nothing officially. The two
  legitimate routes are: (1) the person **DMs the reel to the app's Instagram account** (Meta's Messaging API delivers an
  `ig_reel` attachment with title, URL and video id), which is what Expedia, Plotline and Map Your Voyage do; and (2) the
  person **shares the file or a screen recording** into the app. Everyone else scrapes. [Verified, Reported]
- **Most apps read text before they watch video.** The cheapest signals (location tag, caption, comments) find most places.
  On-screen text and speech come next; "looking at the frames" is the last resort. Mindtrip's launch version only worked on
  TikToks *with text overlays*; YouTube used transcripts. [Reported]
- **Accuracy is poor and nobody publishes it.** The only hands-on comparison found one tool (Airial) that got "nearly every"
  place. Mindtrip returned an analysis and partly invented places. Expedia gave different places for the same reel on repeat
  runs. Rhyme (formerly Roamy) was "inconsistent". No app publishes an error rate. [Reported]
- **For Tripsloom:** keep the confirm-before-adding flow (it's the right defence). Add a share extension, use TikTok's free
  oEmbed for captions, offer "DM the reel to @tripsloom" as the Instagram route, and send video to a multimodal model only when
  text finds nothing. Measure it on a fixed set of real shares.

---

## 1. The common pipeline

```
 1. Ingest            2. Signals (cheap → costly)          3. Extract            4. Resolve            5. Confirm
 ───────────          ─────────────────────────────        ──────────            ──────────            ──────────
 share-sheet URL  →   location tag                    →    names + type     →    geocode near the  →   person ticks
 DM to app account    caption / description                (restaurant,          destination;          what to keep
 pasted link          top comments ("where is this?")      beach, hotel)         dedupe; category
 uploaded file        on-screen text (OCR)                 (LLM, structured      (Places / Maps /
                      speech (transcript)                   output, or NER +      Photon / Mapbox)
                      frames (landmarks, signs, menus)      LLM filter)
```

The order of stage 2 is the main design choice. A practitioner write-up of Rhyme/Roamy describes the fallback explicitly:
**location tag first, then the caption, and only as a last resort the video itself via an LLM**. [Reported:
[DevGenius on Roamy](https://blog.devgenius.io/extracting-locations-from-reels-or-tiktok-video-using-n8n-1e4bb41047b7)]

The most detailed public pipeline is academic, not commercial. An ACM paper on 1,033 TikToks ran keyframe detection for
landmarks and on-screen text, transcribed audio with Whisper (aligned to each keyframe's time window), pulled locations with
spaCy NER, then used GPT-4o to drop ambiguous mentions ("the Square", "the Heights"). It verified 823 location mentions.
[Verified: [ACM, *From Clips to Communities*](https://dl.acm.org/doi/10.1145/3715070.3749277)]

## 2. What each app does

| App | How the reel gets in | Signals used (as far as known) | Notes |
| --- | --- | --- | --- |
| **Mindtrip** ("Start Anywhere") | Paste a TikTok, YouTube, Instagram, Reddit or blog link, or upload a screenshot or PDF | TikTok: **text overlays only** (at launch). YouTube: **transcript**. Instagram: not described | Combines a 6.5M-place database with OpenAI models. In a 2026 test it returned an "analysis" and partly fabricated places [Reported: [TechCrunch](https://techcrunch.com/2024/07/31/travel-startup-mindtrips-new-feature-lets-you-build-an-itinerary-from-a-screenshot-youtube-or-tiktok-video), [Stardrift test](https://stardrift.ai/resources/how-to-save-travel-ideas-from-tiktok-and-instagram)] |
| **Expedia Trip Matching** | **DM the reel to @Expedia** on Instagram, built **with Meta** | Not disclosed | Replies in the DM with an itinerary and bookable hotels. Results differed for the same reel across runs [Reported: [GeekWire](https://www.geekwire.com/2025/new-expedia-feature-uses-ai-to-help-travelers-plan-and-book-trips-based-off-shared-instagram-reels/), [Stardrift test](https://stardrift.ai/resources/how-to-save-travel-ideas-from-tiktok-and-instagram)] |
| **Plotline** | iOS share sheet, or **DM to @plotline.app** | "the content, the caption, the metadata" | One pin per place, with a category [Reported: [Plotline](https://getplotline.app/blog/how-to-plan-a-trip-from-tiktok-and-instagram)] |
| **Rhyme (formerly Roamy)** | Share sheet or link | Location tag → caption → video (LLM) | Subscription ($15/month) for full detection; extraction "inconsistent" in one comparison [Reported: [App Store](https://apps.apple.com/us/app/roamy-save-spot-plan-trips/id6748781672), [Map Your Voyage](https://mapyourvoyage.com/blog/best-apps-to-plan-trips-from-social-media)] |
| **Airial** | Paste a link (web only) | Not disclosed | Best raw extraction in the one hands-on test [Reported] |
| **Vacay, Map Your Voyage** | Share or DM from Instagram | Not disclosed | Map Your Voyage claims "99.8%", with no reviews [Reported] |
| **TripSpire, Triply, ReelTrip, Wandereel, Stardrift** | Link or share sheet | Not disclosed | TripSpire handles TikTok slideshows; Triply handles photo carousels [Reported] |
| **VlogMap** (Chrome) | Open the video in the browser | **Captions/descriptions only** | Needs the creator to have written the places [Reported] |
| **Layla** (Expedia since 2026) | Chat | No documented reel import | — |
| **Wanderlog** | — | **No reel import found**; people add places by hand | — |

No app explains its stage 2 in public. Where they say anything, it's "caption + metadata + content".

## 3. Getting the reel: the real constraint

### Instagram
- **oEmbed is closed to this use.** It needs Meta App Review and business verification. It's licensed only for "front-end
  views" (embedding), and since Nov 2025 it no longer returns `thumbnail_url` or `author_name`. Meta's suggested workaround is
  to read the post page's HTML metadata. [Verified: [Meta oEmbed update](https://developers.facebook.com/blog/post/2025/04/08/oembed-updates/),
  [Meta oEmbed Read](https://developers.facebook.com/docs/features-reference/oembed-read)]
- **The page itself** usually sits behind a login wall when fetched from a server, so the caption often isn't in `og:`
  tags. This is exactly why Tripsloom's current reader (it fetches `og:title`/`og:description`) finds little on Instagram.
  [Assumption, consistent with Meta's guidance above]
- **DM-to-account is the official route.** When someone sends a reel to a business account, the Messaging API webhook
  carries an attachment of type **`ig_reel`** whose payload includes the reel's **title, URL and video id** (since June
  2024). Post shares are moving from `share` to `ig_post`. [Verified: [Instagram Messaging webhooks](https://developers.facebook.com/docs/instagram-messaging/webhooks),
  [Messenger changelog](https://developers.facebook.com/docs/messenger-platform/changelog)] *Unconfirmed:* whether `url` is a
  downloadable video file or a link to the post. Check a live payload before building on it. This route needs an
  Instagram professional account, a Meta app, and App Review for messaging permissions.
- **Scrapers** (Apify and similar) return captions, location tags, comments and often video renditions for about
  $0.05–$2.30 per 1,000 posts. [Reported: [Apify Instagram Reel Scraper](https://apify.com/autoscraping/instagram-reel-scraper)]
  The legal position is grey. A US district court found Meta's terms didn't bar *logged-out* scraping of public data, and
  Meta dropped the case, but it's one non-binding ruling. [Reported: [TechCrunch](https://techcrunch.com/2024/01/24/court-rules-in-favor-of-a-web-scraper-bright-data-which-meta-had-used-and-then-sued)]
  It's fragile in practice (blocking, breakage) and a store-review and partner risk. [Assumption]

### TikTok
- **Public oEmbed works without a key:** `https://www.tiktok.com/oembed?url=…` returns the **caption in `title`**, plus
  `author_name` and the embed HTML. That's the cheapest legitimate caption source of any platform. [Verified:
  [TikTok embed docs](https://developers.tiktok.com/docs/en/embed-videos)]
- There's no official way to download another creator's video file. The tools that do it use scrapers or `yt-dlp`. [Assumption]

### YouTube (Shorts)
- Transcripts and descriptions are the usual signal (Mindtrip). Gemini's API also accepts a **YouTube URL directly** as
  video input. [Reported: [Vertex AI video understanding](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding)]

### Inside the app
- **Share sheet:** Instagram and TikTok hand the app only a **URL**, not the video, so this doesn't solve getting the content. [Assumption]
- **Screen recording or saved file:** the person shares the actual media. Always available and fully compliant, but it's one
  more step for them.

## 4. Signals, ranked by cost and value

| Signal | Cost | What it finds | Typical gap |
| --- | --- | --- | --- |
| Location tag | Free (if you have the post data) | One place, exact | Only one tag, often a city |
| Caption + description | Free | "📍 Name", lists, hashtags | Many reels say "link in bio" or nothing |
| Top comments | Free with a scraper | "Where is this?" answered by the creator | Needs post data |
| On-screen text (OCR) | Cheap; on-device on iOS (Vision) | Place names in overlays (the TikTok norm) | Stylised fonts, fast cuts |
| Speech (transcript) | ~$0.003–0.005 per minute | Voiceover lists ("first stop, Wat Pho…") | Music-only reels; mispronunciations |
| Frames (vision model) | Most expensive | Landmarks, signs, menus, shopfronts | Guesses; needs a "can't tell" option |

Gemini video costs: about **1 frame per second at 66–258 tokens per frame, plus 32 tokens per second of audio**, so a 30 s
reel is roughly 3,000–9,000 input tokens. On Gemini 3.5 Flash-Lite ($0.30 per million input tokens) that's about
**$0.001–0.003 per reel** before output. [Reported: secondary sources on
[Gemini video understanding](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding);
prices from [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) as of 15 Oct 2026] A September 2026 "agentic
video" mode reportedly cuts tokens by up to 88% by choosing which parts to watch. [Reported]

## 5. How places get onto the map

- **Bias to the destination.** "Thalassa" alone is ambiguous; "Thalassa, Goa" isn't. Every serious approach geocodes with the
  trip or caption context. Tripsloom already does this (`geocodePlace(title, city)`). [Verified in repo]
- **Use a place database, not raw geocoding, for businesses.** Cafés and bars are poorly covered by free geocoders (Photon or
  OpenStreetMap). Mindtrip leans on its own 6.5M-place database. Gemini can ground answers on Google Maps (5,000 free requests a
  month, then $14 per 1,000). [Reported, Verified pricing]
- **Deduplicate and categorise:** one pin per place, typed as restaurant, beach, hotel and so on (Plotline). [Reported]
- **Confirm before saving.** Apps that skip this (DM-reply flows) are the ones reported as inconsistent or inventing places.
  [Assumption from the test reports]

## 6. Known failure modes

1. **Hallucinated places.** The model "helpfully" fills gaps (Mindtrip in testing). Mitigation: require each place to be
   *quoted* from a signal (caption text, OCR line, transcript span) and to resolve on the map. Otherwise show it as
   "couldn't confirm".
2. **Non-deterministic output.** The same reel gives different places (Expedia). Mitigation: temperature 0, structured output,
   and cache results by post id.
3. **Text-overlay dependence.** Reels with only music and visuals yield nothing from text (Mindtrip's launch limit).
   Mitigation: fall back to frames, and say so honestly.
4. **City-level only.** The tag says "Bali". Mitigation: treat a city as context, not a pin.
5. **Carousels and slideshows** need per-image handling (Triply and TripSpire call this out).

## 7. What this means for Tripsloom

What we have today [Verified in repo, `mobile/src/services/shortlist.ts`]: Maps links are read directly; social links fetch
`og:` metadata (often empty for Instagram); screenshots are read **on the phone** (Vision OCR); text is parsed with rules
(`fromText`); each place is geocoded near the destination and **confirmed by the person**. That's stages 1–5 with only the
cheapest signals.

Recommended ladder, cheapest first [Assumption: to be validated by the test below]:

1. **Ingest:** add an iOS and Android **share extension** (URL in), keep paste, add **"Send the reel to @tripsloom on
   Instagram"** via the Messaging API (`ig_reel` webhook), and add **"Share a screen recording"** as the always-works route.
2. **Free text first:** TikTok oEmbed caption; Instagram caption from the DM payload title. Keep the rule parser and add an
   LLM pass with structured output that must quote its source line.
3. **On-device OCR** on screenshots and recordings (already built for images; add frame sampling for recordings).
4. **Video model only when 1–3 find nothing:** for example Gemini 3.5 Flash-Lite on the recording or video (frames and audio
   in one call), with Maps grounding or our geocoder to resolve.
5. **Confirm:** unchanged. Show which signal each place came from ("from the caption", "said in the video").

Guardrails:
- **No scraping of logged-in content.** Prefer DM and shared files over third-party scrapers. If a scraper is used, only
  public, logged-out data, behind a kill switch.
- **Privacy copy changes** once anything leaves the phone (Data & privacy currently says screenshots are read on the phone).
- **Cache by post id**, so 10 friends sharing the same viral reel cost one analysis.

**Validation (before building step 4):** collect 50 real shares from Indian friend groups (Instagram reels, TikToks, Shorts,
carousels, screenshots) and write down the true places. Score each rung: places found, wrong places, invented places, cost
and seconds. Ship a rung only if precision is at least 90% after confirmation. This is the same harness proposed for choosing
between models (Luna, Haiku, Gemini Flash-Lite).

## Sources

- [TechCrunch: Mindtrip Start Anywhere](https://techcrunch.com/2024/07/31/travel-startup-mindtrips-new-feature-lets-you-build-an-itinerary-from-a-screenshot-youtube-or-tiktok-video)
- [Stardrift: hands-on comparison of reel importers](https://stardrift.ai/resources/how-to-save-travel-ideas-from-tiktok-and-instagram)
- [Plotline: how to plan from TikTok and Instagram](https://getplotline.app/blog/how-to-plan-a-trip-from-tiktok-and-instagram)
- [Map Your Voyage: apps compared](https://mapyourvoyage.com/blog/best-apps-to-plan-trips-from-social-media)
- [Rhyme (formerly Roamy) on the App Store](https://apps.apple.com/us/app/roamy-save-spot-plan-trips/id6748781672)
- [DevGenius: extracting locations from reels (Roamy pipeline)](https://blog.devgenius.io/extracting-locations-from-reels-or-tiktok-video-using-n8n-1e4bb41047b7)
- [GeekWire: Expedia Trip Matching](https://www.geekwire.com/2025/new-expedia-feature-uses-ai-to-help-travelers-plan-and-book-trips-based-off-shared-instagram-reels/)
- [Expedia newsroom: Trip Matching](https://www.expedia.com/newsroom/?p=54243)
- [ACM: From Clips to Communities (TikTok location pipeline)](https://dl.acm.org/doi/10.1145/3715070.3749277)
- [COLING 2025: Do video LLMs have strong OCR abilities?](https://aclanthology.org/2025.coling-main.659.pdf)
- [Meta: oEmbed updates (2025)](https://developers.facebook.com/blog/post/2025/04/08/oembed-updates/)
- [Meta: oEmbed Read feature](https://developers.facebook.com/docs/features-reference/oembed-read)
- [Meta: Instagram Messaging webhooks](https://developers.facebook.com/docs/instagram-messaging/webhooks)
- [Meta: Messenger Platform changelog](https://developers.facebook.com/docs/messenger-platform/changelog)
- [TikTok: embed videos (oEmbed)](https://developers.tiktok.com/docs/en/embed-videos)
- [Apify: Instagram Reel Scraper](https://apify.com/autoscraping/instagram-reel-scraper)
- [TechCrunch: Meta v. Bright Data ruling](https://techcrunch.com/2024/01/24/court-rules-in-favor-of-a-web-scraper-bright-data-which-meta-had-used-and-then-sued)
- [Google Cloud: video understanding](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [OpenAI: GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [Claude pricing](https://docs.claude.com/en/docs/about-claude/pricing)
