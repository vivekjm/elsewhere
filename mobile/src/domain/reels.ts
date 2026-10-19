/**
 * Reading a shared reel's words: the caption, hashtags, mentions, title and cover text a post makes public, plus
 * anything the person pastes (a comment, the creator's DM). Turned into where the trip is, the places named (each
 * with the line it came from), and cues (sunset, veg, free, couple…). Nothing here watches the video: what a reel
 * says in text is usually enough, and what it hides ("comment for the location") is asked, not guessed.
 * Pure parsing; fetching and map checks are in `services/reels`.
 */

export type ReelPlatform = 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'x' | 'web';

/** A post someone shared, with the text it makes public. */
export type Reel = {
  /** `platform:postId`, so the same reel shared twice is one reel. */
  id: string;
  url: string;
  platform: ReelPlatform;
  author: string;
  handle: string;
  /** YYYY-MM-DD, or '' when unknown. */
  postedAt: string;
  likes: number | null;
  comments: number | null;
  title: string;
  caption: string;
  hashtags: string[];
  mentions: string[];
  keywords: string[];
  thumbnail: string;
  /** Text on the cover image, read on the phone. */
  coverText: string;
  /** What the person pasted: a comment, the creator's reply, a DM. Trusted more than the caption. */
  notes: string;
  status: 'ok' | 'empty' | 'unreachable';
  savedAt: string;
};

/** Where a place was found. Shown on every place so nobody has to trust a black box. */
export type Source = 'pin' | 'label' | 'list' | 'caption' | 'hashtag' | 'mention' | 'cover' | 'comment' | 'you' | 'ai';

export const SOURCE_LABEL: Record<Source, string> = {
  pin: 'Pinned in the caption', label: 'Named in the caption', list: 'Listed in the caption', caption: 'Mentioned in the caption',
  hashtag: 'From a hashtag', mention: 'Tagged account', cover: 'On the cover', comment: 'From a comment you added', you: 'Added by you', ai: 'Suggested by AI',
};

export type Slot = 'sunrise' | 'morning' | 'afternoon' | 'sunset' | 'night';

/** A place a reel seems to name, before it's checked on the map. */
export type Candidate = {
  /** Normalised name, used to merge the same place across reels. */
  key: string;
  title: string;
  source: Source;
  /** The line it came from, shown as evidence. */
  quote: string;
  /** 0–1: how sure the text is that this is a place (a 📍 line is surer than a lone hashtag). */
  confidence: number;
  reelId: string;
  slot?: Slot;
  /** A hint worth keeping ("Free entry", "Closed Mondays"). */
  note?: string;
};

/* ------------------------------------------------------------------ links */

const clean = (s: string) => s.replace(/[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{200B}-\u{200D}\u{2060}]/gu, ' ').replace(/\s+/g, ' ').trim();
const stripEdges = (s: string) => s.replace(/^[\s,.:;|–—\-•*>→'"“”‘’()[\]]+|[\s,.:;|–—\-•*>→'"“”‘’()[\]!?]+$/g, '').trim();

/** The platform and post id of a link, and the canonical URL to read it from. Null for anything that isn't a link. */
export function reelLink(input: string): { id: string; url: string; platform: ReelPlatform } | null {
  const m = input.match(/https?:\/\/[^\s<>"'）)]+/i);
  if (!m) return null;
  let url: URL;
  try { url = new URL(m[0]); } catch { return null; }
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  const path = url.pathname;
  if (host === 'instagram.com' || host === 'instagr.am') {
    const code = path.match(/\/(?:reels?|p|tv)\/([A-Za-z0-9_-]{5,})/)?.[1];
    if (code) return { id: `instagram:${code}`, url: `https://www.instagram.com/reel/${code}/`, platform: 'instagram' };
  }
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'music.youtube.com') {
    const vid = host === 'youtu.be' ? path.slice(1).split('/')[0] : path.match(/\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{6,})/)?.[1] ?? url.searchParams.get('v');
    if (vid && /^[A-Za-z0-9_-]{6,}$/.test(vid)) return { id: `youtube:${vid}`, url: `https://www.youtube.com/shorts/${vid}`, platform: 'youtube' };
  }
  if (host.endsWith('tiktok.com')) {
    const vid = path.match(/\/video\/(\d{6,})/)?.[1];
    if (vid) return { id: `tiktok:${vid}`, url: `https://www.tiktok.com${path.replace(/\/+$/, '')}`, platform: 'tiktok' };
    return { id: `tiktok:${host}${path}`, url: `https://${host}${path}`, platform: 'tiktok' };
  }
  if (host === 'facebook.com' || host === 'fb.watch') {
    const vid = path.match(/\/(?:reel|videos?)\/(\d{6,})/)?.[1] ?? (host === 'fb.watch' ? path.slice(1).split('/')[0] : null);
    if (vid) return { id: `facebook:${vid}`, url: host === 'fb.watch' ? `https://fb.watch/${vid}/` : `https://www.facebook.com/reel/${vid}`, platform: 'facebook' };
  }
  if (host === 'x.com' || host === 'twitter.com') {
    const vid = path.match(/\/status\/(\d{6,})/)?.[1];
    if (vid) return { id: `x:${vid}`, url: `https://x.com${path}`, platform: 'x' };
  }
  const canonical = `${url.protocol}//${url.host}${path}${url.search}`;
  return { id: `web:${canonical}`.slice(0, 300), url: canonical, platform: 'web' };
}

export const PLATFORM_LABEL: Record<ReelPlatform, string> = { instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', facebook: 'Facebook', x: 'X', web: 'Web' };

/* ------------------------------------------------------------------ preview text */

/** "1,234" → 1234, "1.2K" → 1200, "3M" → 3000000. */
export function count(s: string): number | null {
  const m = s.trim().match(/^([\d.,]+)\s*([KkMm])?$/);
  if (!m) return null;
  const n = m[2] ? Number(m[1].replace(/,/g, '')) : Number(m[1].replace(/[.,]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * (m[2]?.toLowerCase() === 'k' ? 1000 : m[2]?.toLowerCase() === 'm' ? 1000000 : 1));
}

const MONTH_INDEX: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/**
 * Instagram's link preview: `27 likes, 3 comments - handle on October 13, 2026: "caption…".` (the caption part is
 * missing when there's none).
 */
export function instagramPreview(description: string): { likes: number | null; comments: number | null; handle: string; postedAt: string; caption: string } | null {
  const m = description.match(/^\s*([\d.,]+[KkMm]?)\s+likes?,\s+([\d.,]+[KkMm]?)\s+comments?\s+-\s+([A-Za-z0-9._]+)\s+on\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})(?::\s*"([\s\S]*)"\s*\.?\s*)?$/);
  if (!m) return null;
  const month = MONTH_INDEX[m[4].slice(0, 3).toLowerCase()];
  return {
    likes: count(m[1]), comments: count(m[2]), handle: m[3],
    postedAt: month ? `${m[6]}-${String(month).padStart(2, '0')}-${m[5].padStart(2, '0')}` : '',
    caption: (m[7] ?? '').trim(),
  };
}

/* ------------------------------------------------------------------ hashtags */

/** Tags with nothing to say about where (they're about the post, not the place). */
const GENERIC = new Set([
  'travel', 'travelgram', 'traveller', 'traveler', 'travelling', 'traveling', 'travelphotography', 'travelblogger', 'travelvlog', 'travelreels', 'travelindia',
  'indiatravel', 'incredibleindia', 'india', 'trip', 'tour', 'tourism', 'tourist', 'reels', 'reel', 'reelsinstagram', 'instareels', 'reelitfeelit', 'reelsindia',
  'viral', 'viralreels', 'viralvideo', 'viralpost', 'explore', 'explorepage', 'explorer', 'exploremore', 'exploreindia', 'exploresindia', 'fyp', 'foryou', 'foryoupage', 'fy',
  'instagood', 'instagram', 'insta', 'instadaily', 'trending', 'trend', 'wanderlust', 'photography', 'photooftheday', 'nature', 'naturelover', 'love', 'vlog', 'vlogger',
  'shorts', 'youtubeshorts', 'ytshorts', 'travelshorts', 'shortsfeed', 'couplegoals', 'couple', 'friends', 'family', 'weekend', 'holiday', 'holidays', 'vacation',
  'vacay', 'memories', 'summer', 'winter', 'monsoon', 'mood', 'vibes', 'goodvibes', 'happy', 'life', 'lifestyle', 'aesthetic', 'hiddengem', 'hiddengems', 'budgettravel',
  'travelhacks', 'traveltips', 'travelguide', 'itinerary', 'peaceandlove', 'tuesdaythoughts', 'mondaymotivation', 'motivation', 'attitude', 'savage', 'bossmode',
  'millionairemindset', 'luxurylifestyle', 'luxury', 'privatejet', 'successmindset', 'entrepreneur', 'reelsviral', 'desiboy', 'desi', 'foodie', 'food', 'foodblogger',
  'cafe', 'cafes', 'cafehopping', 'beach', 'beaches', 'beachlover', 'sea', 'sunset', 'sunsets', 'sunrise', 'mountains', 'hills', 'touristseason', 'newyear', 'top10places',
  'waves', 'wave', 'dronepilot', 'drone', 'droneshot', 'dronephotography', 'travelingram', 'travelling', 'yolo', 'selflove', 'healing', 'waterbaby', 'goodtimes',
  'happiness', 'peace', 'sunsetlover', 'naturephotography', 'mobilephotography', 'instatravel', 'traveldiaries', 'traveltheworld', 'travelgoals', 'heritage', 'héritage',
  'save', 'saveforlater', 'mustvisit', 'thingstodo', 'placestovisit', 'bucketlist', 'solotravel', 'girlsthatravel', 'travelcouple', 'roadtrip', 'backpacking', 'cinematic',
]);

/** Endings that make a tag about a place's posts, not a place ("goadiaries" → Goa). */
const POST_SUFFIX = /(villas?|stays?|holidays?|hotels?|homestays?|resorts?|weddings?|eats|cafes|photography|diaries|diary|vibes|vibe|gram|tourism|travels?|trips?|tours?|tourist|foodie|food|nightlife|life|lovers?|tales|stories|story|days|reels?|blogger|vlogs?|itinerary|guide|series|shorts|hacks|tips|beaches|cafes|calling|dairies|explore|explorer|unexplored|thingstodo|placestovisit|bucketlist|nights?)$/;

/** Words that make a name a place: "bagabeach" → "baga beach". */
const PLACE_WORDS = ['beach', 'fort', 'falls', 'waterfall', 'waterfalls', 'cafe', 'café', 'island', 'islands', 'lake', 'market', 'temple', 'church', 'hills', 'hill', 'valley', 'point',
  'viewpoint', 'dam', 'palace', 'bay', 'river', 'park', 'museum', 'mall', 'caves', 'cave', 'village', 'road', 'street', 'ghat', 'ghats', 'peak', 'sanctuary', 'garden', 'gardens',
  'square', 'bridge', 'lighthouse', 'mosque', 'basilica', 'cathedral', 'monastery', 'gompa', 'shack', 'club', 'pass', 'glacier', 'forest', 'reserve', 'tank', 'stepwell',
  'springs', 'resort', 'bazaar', 'souk', 'wat', 'shrine', 'tower', 'gate', 'mahal', 'bagh', 'kund', 'tal', 'nagar', 'ganj', 'chowk'];
const PLACE_WORD = new RegExp(`\\b(${PLACE_WORDS.join('|')})\\b`, 'i');
const PREFIXES = ['north', 'south', 'east', 'west', 'old', 'new', 'upper', 'lower', 'little', 'big'];

const titleCase = (s: string) => s.replace(/(^|[\s-])(\p{L})/gu, (_, a: string, c: string) => a + c.toUpperCase());

/** "ChaporaFort" → "Chapora Fort"; "bagabeach" → "baga beach"; "southgoa" → "south goa". */
export function splitTag(tag: string): string {
  const t = tag.replace(/^#/, '');
  if (/[a-z][A-Z]/.test(t)) return t.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/_/g, ' ').trim();
  let s = t.toLowerCase().replace(/_/g, ' ');
  for (const p of PREFIXES) if (s.startsWith(p) && s.length > p.length + 2 && !s.includes(' ')) { s = `${p} ${s.slice(p.length)}`; break; }
  for (const w of [...PLACE_WORDS].sort((a, b) => b.length - a.length)) {
    if (s.endsWith(w) && s.length > w.length + 2 && !s.endsWith(` ${w}`)) { s = `${s.slice(0, -w.length)} ${w}`; break; }
  }
  return s;
}

/** Every tag in a text: `#tags`, `[ Bracket Lists ]` creators use to dodge the hashtag limit, and bare words on a tag line. */
export function tagsIn(text: string): string[] {
  const out = new Map<string, string>();
  const add = (t: string) => { const k = t.toLowerCase(); if (k.length >= 2 && k.length <= 40 && /\p{L}/u.test(k) && !out.has(k)) out.set(k, t); };
  for (const m of text.matchAll(/#([\p{L}\p{N}_]+)/gu)) add(m[1]);
  for (const m of text.matchAll(/\[\s*([^\]\n]{3,500})\]/g)) {
    const words = clean(m[1]).split(/\s+/).filter(Boolean);
    if (words.length >= 3 && words.every((w) => /^[\p{L}\p{N}_]+$/u.test(w))) words.forEach(add);
  }
  for (const line of text.split(/\n/)) {
    const tokens = clean(line).split(/\s+/).filter(Boolean);
    const tagged = tokens.filter((w) => w.startsWith('#')).length;
    if (tagged >= 2 && tagged >= tokens.length / 2) tokens.filter((w) => /^[\p{L}][\p{L}\p{N}_]{3,}$/u.test(w) && w === w.toLowerCase()).forEach(add);
  }
  return [...out.values()];
}

/** Whether a tag says nothing about the place. */
export const isGenericTag = (tag: string) => GENERIC.has(tag.toLowerCase().replace(/^#/, ''));

/** The place a tag is about once the "posts about" ending is removed: "goadiaries" → "goa", "bangkoktravelguide" → "bangkok". */
export function tagBase(tag: string): string {
  let s = tag.toLowerCase().replace(/^#/, '');
  for (let i = 0; i < 3; i++) { const next = s.replace(POST_SUFFIX, ''); if (next === s || next.length < 3) break; s = next; }
  return s;
}

/* ------------------------------------------------------------------ cues */

export type Interest = 'beaches' | 'cafes' | 'food' | 'nightlife' | 'heritage' | 'nature' | 'adventure' | 'shopping' | 'wellness' | 'views';
export const INTEREST_LABEL: Record<Interest, string> = {
  beaches: 'Beaches', cafes: 'Cafés', food: 'Local food', nightlife: 'Nightlife', heritage: 'Forts & heritage', nature: 'Nature & waterfalls',
  adventure: 'Adventure', shopping: 'Markets & shopping', wellness: 'Slow & wellness', views: 'Views & sunsets',
};
const INTEREST_WORDS: Record<Interest, RegExp> = {
  beaches: /\b(beach(es)?|shack|cove|island|coast|seaside)\b/i,
  cafes: /\b(caf[eé]s?|coffee|brunch|bakery|bakeries)\b/i,
  food: /\b(food|eat|street food|thali|seafood|restaurant|dhaba|biryani|dinner|lunch|feni)\b/i,
  nightlife: /\b(nightlife|party|parties|club|clubs|bar|bars|pub|pubs|night market|night life|dj)\b/i,
  heritage: /\b(fort|church|basilica|cathedral|temple|heritage|museum|palace|ruins|old town|monastery|mosque|history)\b/i,
  nature: /\b(waterfalls?|falls|trek|trekking|hike|hiking|forest|lake|wildlife|sanctuary|mangroves?|nature|hills?)\b/i,
  adventure: /\b(kayak(ing)?|rafting|scuba|snorkel(ing)?|parasailing|water ?sports|jet ?ski|zipline|paragliding|surf(ing)?|dolphin|bungee)\b/i,
  shopping: /\b(market|flea|bazaar|shopping|mall|souvenir)\b/i,
  wellness: /\b(spa|yoga|ayurveda|retreat|slow|relax(ing)?|wellness)\b/i,
  views: /\b(sunset|sunrise|view ?point|viewpoint|golden hour|skyline|rooftop|view)\b/i,
};

export type Cues = {
  interests: Interest[];
  party?: 'solo' | 'couple' | 'friends' | 'family';
  budget?: 'backpacker' | 'treat';
  veg: boolean;
  free: boolean;
  /** Months the reels mention (1–12): "Goa in October". */
  months: number[];
};

/** What a set of texts says about the kind of trip, not the places. */
export function cuesIn(texts: string[]): Cues {
  const all = texts.join('\n');
  const words = `${all}\n${tagsIn(all).map(splitTag).join(' ')}`;
  const interests = (Object.keys(INTEREST_WORDS) as Interest[]).filter((k) => INTEREST_WORDS[k].test(words));
  const party = /\b(couple(goals)?|honeymoon|my (wife|husband|partner|girlfriend|boyfriend)|with bae)\b/i.test(words) ? 'couple'
    : /\b(kids?|family|children|toddler|parents)\b/i.test(words) ? 'family'
    : /\b(solo|alone|by myself)\b/i.test(words) ? 'solo'
    : /\b(friends|squad|gang|bachelor(ette)?|boys trip|girls trip)\b/i.test(words) ? 'friends' : undefined;
  const budget = /\b(budget|cheap|affordable|under ₹|hack|free|backpack(ing|er)?|hostel)\b/i.test(words) ? 'backpacker'
    : /\b(luxury|5[- ]star|five[- ]star|villa|premium)\b/i.test(words) ? 'treat' : undefined;
  const months = Object.entries(MONTH_INDEX).filter(([m]) => new RegExp(`\\b(in|this|during|visit(ed)?|for)\\s+${m}[a-z]*\\b`, 'i').test(all)).map(([, n]) => n);
  return {
    interests, party, budget, months,
    veg: /\b(veg(etarian)?|pure veg|jain|vegan)\b/i.test(words) && !/\bnon[- ]?veg\b/i.test(words),
    free: /\b(free( entry| entrance| of cost)?|₹ ?0\b|no entry fee)\b/i.test(words),
  };
}

/** The time of day a line points to ("watch the sunset from…", "night market"). */
export function slotIn(line: string): Slot | undefined {
  if (/\b(sunset|golden hour|dusk|evening)\b/i.test(line)) return 'sunset';
  if (/\b(sunrise|dawn)\b/i.test(line)) return 'sunrise';
  if (/\b(night|nightlife|party|club|after dark|late night|night market)\b/i.test(line)) return 'night';
  if (/\b(breakfast|brunch|early morning|morning)\b/i.test(line)) return 'morning';
  return undefined;
}

/* ------------------------------------------------------------------ hidden spots */

export type Bait = { kind: 'comment' | 'dm' | 'bio' | 'pinned'; keyword: string; quote: string };

/** "Comment DIL CHAHTA HAI and I'll DM you the location": the creator hides the spot behind engagement. */
export function baitIn(text: string): Bait | null {
  const line = (re: RegExp) => text.split(/\n/).find((l) => re.test(l))?.trim() ?? '';
  const comment = text.match(/comment\s+["“'‘]?([\p{L}\p{N} !&'’-]{2,40}?)["”'’]?\s+(?:below|and|&|for|to|in the comments)\b[\s\S]{0,80}?\b(location|link|details|address|dm|send|guide|itinerary|spot|spots|name|list|map|places)/iu);
  if (comment) return { kind: 'comment', keyword: comment[1].trim(), quote: clean(line(/comment/i)).slice(0, 200) };
  if (/\b(dm|message)\s+(me|us)\b[\s\S]{0,40}\b(location|details|address|spot|name)\b/i.test(text)) return { kind: 'dm', keyword: '', quote: clean(line(/\b(dm|message)\b/i)).slice(0, 200) };
  if (/\b(location|details|address|spot|name)\b[\s\S]{0,30}\b(in|on)\s+(the\s+)?(pinned\s+)?comments?\b/i.test(text)) return { kind: 'pinned', keyword: '', quote: clean(line(/comment/i)).slice(0, 200) };
  if (/\blink\s+in\s+(my\s+|the\s+)?bio\b/i.test(text)) return { kind: 'bio', keyword: '', quote: clean(line(/bio/i)).slice(0, 200) };
  return null;
}

/* ------------------------------------------------------------------ places */

/** Phrases that look like names but aren't places. */
const NOT_PLACE = /^(the |a |an |this |that |my |our |your |best |top |must |hidden |secret |amazing |beautiful |most |every |some |all )?(place|places|spot|spots|gem|gems|view|views|vibe|vibes|beach|beaches|cafe|cafes|café|cafés|food|trip|day|night|time|reel|video|post|link|bio|comment|comments|location|dm|guide|itinerary|budget|price|entry|tips?|hack|hacks|thing|things|everything|nothing|something)$/i;
/** Words that mean a line is a sentence, not a name. */
const SENTENCE = /\b(i|i'm|im|we|you|your|you're|my|our|is|are|was|were|be|been|have|has|had|do|does|did|can|could|will|would|should|this|that|it|it's|its|if|when|who|which|because|so|just|really|literally|honestly|here|there|don't|didn't|isn't|aren't|let's|lets|me|us|them|they|he|she|where|what|how|why)\b/i;
/** Words creators put in front of a destination's name in tags (#HiddenGoa, #CinematicGoa): not places. */
const TAG_ADJECTIVE = /^(hidden|secret|cinematic|magical|beautiful|incredible|amazing|offbeat|unexplored|explore|exploring|beyond|best|my|our|the|real|true|wild|quiet|aesthetic|monsoon|winter|summer|budget|luxury|unseen|underrated|classic|vintage|retro|love|lovely|visit|discover|insta|viral|sunny|rainy|green|blue|golden|old|new|little|big|great)$/i;

/** Single words that start sentences in comments and captions, not places ("Sunset dinner at…"). */
const COMMON = /^(sunset|sunrise|dinner|lunch|breakfast|brunch|coffee|drinks|party|night|morning|evening|afternoon|weekend|holiday|trip|travel|beach|food|cafe|café|view|views|vibes|must|best|top|also|then|next|first|last|after|before|great|amazing|beautiful|love|loved|wow|omg|bro|guys|thanks|thank you|yes|no|ok|okay|pro tip|tip|note|ps|p\.s\.)$/i;
const MONTH_OR_DAY = /^(January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Today|Tonight|Tomorrow|Weekends?)$/i;

/** A place name from a fragment, or '' when it doesn't look like one. */
export function placeName(raw: string): string {
  let s = clean(raw).replace(/#[\p{L}\p{N}_]+/gu, '').replace(/@[\w.]+/g, '');
  s = s.split(/\s+[-–—|:]\s+|\s*[|•]\s*|\s{2,}|\s*\((?![^)]*\))/)[0] ?? '';
  s = s.split(/\s*\(/)[0];
  s = stripEdges(s.replace(/^(near|at|in|visit|try|go to|head to|explore|check out|the famous|famous)\s+/i, '').replace(/\s+(free entry|entry|tickets?|price|timings?|open|closed)\b.*$/i, ''));
  if (s.length < 3 || s.length > 60 || s.split(/\s+/).length > 7) return '';
  if (!/\p{L}{2}/u.test(s) || NOT_PLACE.test(s) || SENTENCE.test(s) || MONTH_OR_DAY.test(s) || COMMON.test(s) || /^\d/.test(s) || /^https?:/i.test(s)) return '';
  // ALL-CAPS cover titles read better in title case.
  return s === s.toUpperCase() ? titleCase(s.toLowerCase()) : s;
}

export const placeKey = (title: string) => title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^the\s+/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** A list item's name: "1️⃣ Children’s Discovery Museum 💰 Free Entry" → "Children’s Discovery Museum". */
const LIST_START = /^\s*(?:\d{1,2}\s*[.)\]:-]|\d️?⃣|[•▪◾➡👉→✅✔🔸🔹⭐️*-])\s*/u;

/** Splits one-line lists ("1. Siam … 2. Iconsiam …", "1️⃣ X 2️⃣ Y") into one item per line. */
function unfold(text: string): string[] {
  return text.split(/\n/).flatMap((line) => {
    const marks = [...line.matchAll(/(?:^|\s)(\d{1,2}[.)]\s|\d️?⃣)/gu)];
    if (marks.length >= 2) {
      const out: string[] = [];
      let last = 0;
      for (const m of marks) { const at = m.index ?? 0; if (at > last) out.push(line.slice(last, at)); last = at; }
      out.push(line.slice(last));
      return out;
    }
    // A long line with emoji "bullets" ("🕉️ Visit … 🎉 Go out on … 🌆 Go to …") is a list too. 📍 stays with its name.
    if (line.length > 80) return line.split(/\s*(?:[\u{1F300}-\u{1F4CC}\u{1F4CE}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}]️?)+\s*/u).filter((s) => s.trim());
    return [line];
  });
}

/** Words that end a name in running text ("Above Eleven Where to eat…"). */
const STOP_WORD = /^(Where|What|How|Why|When|Who|Which|Then|And|Or|But|So|Also|Plus|Best|Top|Must|Don't|Do|Go|Get|Visit|Try|Check|Save|Follow|Share)$/;

/** Single capitalised words that are just the start of a sentence in a comment. */
const NOT_NAME = /^(Creator|Comment|Comments|Location|Thanks|Thank|Hi|Hello|Hey|Yes|No|Bro|Sir|Ma'am|Dm|It|It’s|It's|Its|The|This|That|Here|There|Ok|Okay|Wow|Omg|Please|Pls|Replied|Reply|Answer|Guys|Link|Bio|Free|Entry|Best|Top)$/;
const CONNECTOR = /^(de|da|do|del|la|le|of|the|e|y|di)$/;

/**
 * Runs of capitalised words: "Wat Arun, Wat Phra Kaew or Wat Pho" → three names. `every`: all runs in each part
 * (for short, trusted text like a pasted comment), not just the first.
 */
function capRuns(text: string, every = false): string[] {
  const out: string[] = [];
  for (const part of text.split(/\s*(?:,|\bor\b|\band\b|&|\/|;|:)\s*/)) {
    let run: string[] = [];
    const flush = () => {
      while (run.length && CONNECTOR.test(run[run.length - 1])) run.pop();
      if (run.length && !(run.length === 1 && NOT_NAME.test(run[0]))) out.push(run.join(' '));
      run = [];
    };
    for (const w of clean(part).split(/\s+/)) {
      const bare = w.replace(/[^\p{L}\p{N}'’&.-]/gu, '');
      const cap = !!bare && /^[\p{Lu}\p{N}]/u.test(bare) && !STOP_WORD.test(bare);
      // A name ends with its sentence: "…from 12 December. Amber Fort" is "Amber Fort", not "December. Amber Fort".
      // ("St." and "Mt." are part of a name.)
      const ends = /[.!?]["'”’)]*$/.test(w) && !/^(?:St|Mt|Ft|Dr|Jr|Sr|Rd|Ave|No)\.$/i.test(bare);
      if (cap || (run.length && CONNECTOR.test(bare))) { run.push(ends ? bare.replace(/\.+$/, '') : bare); if (ends) flush(); continue; }
      if (run.length) { flush(); if (!every) break; }
    }
    flush();
    if (!every && out.length) { /* first run of each part only */ }
  }
  return out;
}

const VERB = String.raw`(?:[Aa]t|[Vv]isit(?:ed)?|[Tt]ry|[Ee]xplore|[Hh]ead to|[Gg]o to|[Gg]o out on|[Ww]alk (?:along|down)|[Ss]troll (?:along|through)|[Ss]tay(?:ed)? at|[Cc]hill at|[Ee]at at|[Dd]inner at|[Ll]unch at|[Bb]reakfast at)`;
const AT = new RegExp(String.raw`\b${VERB}\s+((?:the\s+)?[\p{Lu}][\p{L}'’&.-]*(?:\s+(?:de|da|of|the|[\p{Lu}][\p{L}'’&.-]*)){0,5})`, 'gu');
/** A 📍 and the name after it, up to the next emoji or a wide gap. */
const PIN = /📍\s*([^📍\n]+?)(?=\s{2,}|[\u{1F300}-\u{1F4CC}\u{1F4CE}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}]|$)/gu;

/** Places a reel's text names, each with the line it came from. Hashtag and mention guesses are low-confidence until the map confirms them. */
export function candidatesIn(reel: Pick<Reel, 'id' | 'caption' | 'title' | 'hashtags' | 'mentions' | 'coverText' | 'notes'> & { handle?: string; author?: string }, destination = ''): Candidate[] {
  const out: Candidate[] = [];
  const dest = placeKey(destination);
  const push = (title: string, source: Source, quote: string, confidence: number, extra: Partial<Candidate> = {}) => {
    let name = placeName(title);
    if (!name) return;
    let key = placeKey(name);
    // "Goa Baga Beach" → "Baga Beach": the destination isn't part of the place's name.
    if (dest && key.startsWith(`${dest} `) && key.length > dest.length + 3) { name = name.slice(name.toLowerCase().indexOf(' ', dest.length - 1) + 1).trim(); key = placeKey(name); }
    if (!key || key === dest || dest.split(' ').includes(key)) return;
    // "South Goa" is an area of the trip, not a stop.
    if (dest && key.endsWith(` ${dest}`) && PREFIXES.includes(key.split(' ')[0])) return;
    const had = out.find((c) => c.key === key);
    if (had) { if (confidence > had.confidence) Object.assign(had, { source, quote, confidence, ...extra }); return; }
    out.push({ key, title: name, source, quote: clean(quote).slice(0, 220), confidence, reelId: reel.id, ...extra });
  };
  const read = (text: string, base: Source, trust: number) => {
    const as = (s: Source): Source => (base === 'caption' ? s : base);
    for (const raw of unfold(text)) {
      const line = raw.trim();
      if (!line) continue;
      const slot = slotIn(line);
      let named = false;
      for (const p of line.matchAll(PIN)) {
        named = true;
        const near = /^\s*near\b/i.test(p[1]);
        // "📍 Fontainhas, Panjim, Goa": the place, then where it is. ("📍@venue, Siam Paragon Mall": the first part that's a name.)
        const first = p[1].split(/\s*,\s*/).find((part) => placeName(part));
        if (first) push(first, as('pin'), line, (near ? 0.6 : 0.95) * trust, { slot });
      }
      const labelled = line.match(/^(?:location|place|where|address|spot|venue|name of (?:the )?place)\s*[:\-–]\s*(.+)/i)?.[1];
      if (labelled) { push(labelled, as('label'), line, 0.9 * trust, { slot }); continue; }
      if (LIST_START.test(line)) {
        // The item's own name comes before any 📍 (which names where it is) and before a lowercase description.
        const item = line.replace(LIST_START, '').split('📍')[0].replace(/,\s+(?=\p{Ll})[\s\S]*$/u, '');
        push(item, as('list'), line, 0.75 * trust, { slot, note: /\bfree\b/i.test(line) ? 'Free entry' : undefined });
        continue;
      }
      if (named) continue;
      // "temples such as Wat Arun, Wat Phra Kaew or Wat Pho"
      const such = line.match(/\b(?:[Ss]uch as|[Ll]ike|[Ii]ncluding|e\.g\.|eg)\s+(?=[\p{Lu}])(.+)/u)?.[1];
      if (such) for (const name of capRuns(such)) push(name, base, line, 0.65 * trust, { slot });
      for (const m of line.matchAll(AT)) {
        const name = capRuns(m[1])[0] ?? '';
        if (name && !MONTH_OR_DAY.test(name)) push(name, base, line, 0.6 * trust, { slot });
      }
      // What people paste is short and about the place: every capitalised name in it counts, except the area a
      // place is "in" ("Gunpowder in Assagao": Assagao is where, not a stop). A cover's lines are titles.
      if (base === 'comment') {
        const areas = new Set([...line.matchAll(/\b(?:in|at|near)\s+([\p{Lu}][\p{L}'’.-]*(?:\s+[\p{Lu}][\p{L}'’.-]*){0,2})/gu)].map((m) => placeKey(m[1])));
        // A time hint belongs to its own clause ("Sunset dinner at Thalassa, and go to Anjuna Flea Market": only Thalassa is at sunset).
        const clauses = line.replace(/^\s*[\p{L} ]{2,20}:\s*/u, '').split(/\s*(?:,|;|\band\b|\bthen\b|\balso\b)\s*/i);
        for (const clause of clauses) for (const name of capRuns(clause, true)) if (!areas.has(placeKey(name))) push(name, base, line, 0.8 * trust, { slot: slotIn(clause) });
      }
      if (base === 'cover') { const words = clean(line).split(/\s+/); if (words.length <= 5) push(line, base, line, 0.55 * trust, { slot }); }
    }
  };
  read(reel.notes, 'comment', 1);
  read(reel.caption, 'caption', 1);
  read(reel.title, 'caption', 0.9);
  // A post whose title (or first caption line) is just a name: "Cabo De Rama Beach 🏝️".
  for (const line of [reel.title, reel.caption.split(/\n/)[0] ?? '']) {
    const bare = clean(line.replace(/#[\p{L}\p{N}_]+/gu, '')).replace(/[!?.]+$/, '');
    const words = bare.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 6 && (PLACE_WORD.test(bare) || words.every((w) => /^[\p{Lu}\p{N}]/u.test(w) || CONNECTOR.test(w)))) push(bare, 'caption', line, 0.65, { slot: slotIn(line) });
  }
  read(reel.coverText, 'cover', 0.8);
  // Hashtags: "ChaporaFort" and "bagabeach" name places; "chapora" might (the map decides).
  const tagLine = (t: string) => reel.caption.split(/\n/).find((l) => l.toLowerCase().includes(t.toLowerCase())) ?? `#${t}`;
  const own = [reel.handle, reel.author].filter(Boolean).map((h) => h!.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const tag of reel.hashtags) {
    if (isGenericTag(tag) || own.includes(tag.toLowerCase().replace(/[^a-z0-9]/g, ''))) continue;
    const base = tagBase(tag);
    if (base !== tag.toLowerCase() && (base === dest || !PLACE_WORD.test(splitTag(tag)))) continue;
    let phrase = splitTag(tag);
    // "#thingstodoinbangkok", "#bangkokthailand": about the destination, not a place in it.
    if (dest && tag.toLowerCase().includes(dest.replace(/\s/g, '')) && !PLACE_WORD.test(phrase)) {
      // …but "PanjimGoa" still names Panjim.
      const rest = phrase.split(' ').filter((w) => w.length > 1 && !dest.split(' ').includes(w.toLowerCase()));
      const restWord = rest.join('').toLowerCase();
      if (!/[A-Z]/.test(tag.slice(1)) || !rest.length || rest.length === phrase.split(' ').length || isGenericTag(restWord) || PREFIXES.includes(restWord) || TAG_ADJECTIVE.test(restWord) || COMMON.test(restWord)) continue;
      phrase = rest.join(' ');
    }
    const multi = phrase.includes(' ');
    if (multi && dest && phrase.toLowerCase().split(' ').every((w) => dest.includes(w) || PREFIXES.includes(w))) continue; // "NorthGoa" is an area of the trip, not a stop.
    push(titleCase(phrase), 'hashtag', tagLine(tag), PLACE_WORD.test(phrase) ? 0.55 : multi ? 0.45 : 0.3);
  }
  // A tagged account is sometimes the venue ("📍@chocolateville").
  for (const handle of reel.mentions) {
    const words = handle.replace(/[._]+/g, ' ').replace(/\b(official|india|in|hq|the)\b/gi, ' ').trim();
    if (PLACE_WORD.test(splitTag(words.replace(/\s/g, ''))) || /\b(cafe|kitchen|bar|club|resort|hotel|shack|bistro|brewery|beach)\b/i.test(words)) push(titleCase(splitTag(words.replace(/\s+/g, ''))), 'mention', `@${handle}`, 0.35);
  }
  return out;
}

/** The same place across reels becomes one, keeping every line it came from. */
export type Merged = Candidate & { quotes: { reelId: string; quote: string; source: Source }[]; reels: number };
export function mergeCandidates(list: Candidate[]): Merged[] {
  const map = new Map<string, Merged>();
  for (const c of list) {
    // "Chapora" and "Chapora Fort" are one place when one name contains the other.
    const key = [...map.keys()].find((k) => k === c.key || (k.length >= 5 && c.key.length >= 5 && (k.startsWith(`${c.key} `) || c.key.startsWith(`${k} `)))) ?? c.key;
    const had = map.get(key);
    if (!had) { map.set(key, { ...c, quotes: [{ reelId: c.reelId, quote: c.quote, source: c.source }], reels: 1 }); continue; }
    if (!had.quotes.some((q) => q.reelId === c.reelId)) had.reels += 1;
    had.quotes.push({ reelId: c.reelId, quote: c.quote, source: c.source });
    // Keep the fuller name ("Chapora Fort" over "Chapora") and the strongest evidence.
    if (c.title.length > had.title.length) { had.title = c.title; had.key = c.key; }
    if (c.confidence > had.confidence) Object.assign(had, { source: c.source, quote: c.quote, confidence: c.confidence });
    had.slot = had.slot ?? c.slot;
    had.note = had.note ?? c.note;
    // Seen in more than one reel: surer.
    had.confidence = Math.min(1, had.confidence + 0.1);
  }
  return [...map.values()].sort((a, b) => b.confidence - a.confidence || b.reels - a.reels);
}

/* ------------------------------------------------------------------ where */

/**
 * Where the reels are about, best first: tags like #goa, #goadiaries, #northgoa and "in Goa" all count. Each name
 * still has to be found on the map before it's used.
 */
export function destinationHints(reels: (Pick<Reel, 'caption' | 'title' | 'hashtags' | 'keywords'> & { handle?: string; author?: string })[]): { name: string; score: number }[] {
  const score = new Map<string, number>();
  const add = (name: string, n: number) => {
    const k = name.toLowerCase().trim();
    if (k.length < 3 || k.length > 30 || GENERIC.has(k.replace(/\s/g, '')) || NOT_PLACE.test(k) || SENTENCE.test(k)) return;
    score.set(k, (score.get(k) ?? 0) + n);
  };
  for (const r of reels) {
    const own = [r.handle, r.author].filter(Boolean).map((h) => h!.toLowerCase().replace(/[^a-z0-9]/g, ''));
    for (const tag of r.hashtags) {
      if (isGenericTag(tag) || own.includes(tag.toLowerCase().replace(/[^a-z0-9]/g, ''))) continue;
      const base = tagBase(tag);
      const phrase = splitTag(tag);
      if (base !== tag.toLowerCase()) add(base, 1.5); // #goadiaries → goa
      else if (!PLACE_WORD.test(phrase)) {
        const words = phrase.toLowerCase().split(' ');
        // #northgoa counts for Goa (and as an area); #goa counts most.
        add(PREFIXES.includes(words[0]) && words.length === 2 ? words[1] : phrase, words.length === 1 ? 2 : 1);
      }
    }
    for (const text of [r.caption, r.title, ...r.keywords]) {
      for (const m of text.matchAll(/\b(?:in|to|around|across|visit(?:ing)?|explore|exploring)\s+((?:North|South|East|West|Old)\s+)?([A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+)?)/gu)) add(m[2], 1.5);
      for (const m of text.matchAll(/\b(?:places? to visit in|things to do in|in)\s+((?:north |south |old )?[a-z]+)\b/g)) add(m[1].replace(/^(north|south|old) /, ''), 0.5);
    }
  }
  // A name the captions keep repeating ("Goa travel, Goa memories, Goa vibes…") is what they're about.
  const prose = reels.map((r) => `${r.caption} ${r.title}`.replace(/#[\p{L}\p{N}_]+/gu, ' ')).join(' ').toLowerCase();
  for (const [name, n] of score) {
    const said = prose.match(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'))?.length ?? 0;
    score.set(name, n + Math.min(3, said * 0.5));
  }
  return [...score.entries()].map(([name, s]) => ({ name: titleCase(name), score: s })).sort((a, b) => b.score - a.score).slice(0, 6);
}

/** Areas within the destination the reels point to ("North Goa", "South Goa"). */
export function areaHints(reels: Pick<Reel, 'caption' | 'title' | 'hashtags'>[], destination: string): string[] {
  const d = destination.toLowerCase().split(',')[0].trim();
  if (!d) return [];
  const found = new Set<string>();
  for (const r of reels) {
    for (const tag of r.hashtags) { const p = splitTag(tag).toLowerCase(); const w = p.split(' '); if (w.length === 2 && PREFIXES.includes(w[0]) && w[1] === d) found.add(titleCase(p)); }
    for (const m of `${r.caption} ${r.title}`.matchAll(new RegExp(`\\b(north|south|east|west|old)\\s+${d}\\b`, 'gi'))) found.add(titleCase(`${m[1].toLowerCase()} ${d}`));
  }
  return [...found];
}
