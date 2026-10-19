/**
 * Reading shared reels on this phone, from what each post makes public in its link preview (the caption, hashtags,
 * creator and cover image), the same text a chat app shows when you paste the link. Requests say who they are
 * (TripsloomBot), go straight from the phone (no server sees the link), and never sign in or scrape comments.
 * Places the text names are then checked on the map, inside the destination, before anything is suggested.
 */
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { candidatesIn, instagramPreview, mergeCandidates, reelLink, tagsIn, type Merged, type Reel } from '../domain/reels';
import { kindOf, type Kind } from '../domain/planmode';
import { readImageText } from './intelligence';
import { cached, getJSON } from './net';

const UA = 'Mozilla/5.0 (compatible; TripsloomBot/1.0; +https://tripsloom.com/bot)';
const TIMEOUT = 10000;

async function page(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en' }, signal: controller.signal });
    if (!r.ok) return null;
    return (await r.text()).slice(0, 1_500_000);
  } catch { return null; } finally { clearTimeout(timer); }
}

const decode = (s: string) => s.replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

function meta(html: string, name: string): string {
  const esc = name.replace(/[.*+?^${}()|[\]\\:]/g, '\\$&');
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]*content=["']([^"']*)["']`, 'i'))
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${esc}["']`, 'i'));
  return m ? decode(m[1]) : '';
}

const mentionsIn = (text: string) => [...new Set([...text.matchAll(/(?:^|[\s(📍])@([A-Za-z0-9._]{3,30})/gu)].map((m) => m[1].replace(/\.$/, '')))];

function blank(link: { id: string; url: string; platform: Reel['platform'] }): Reel {
  return { ...link, author: '', handle: '', postedAt: '', likes: null, comments: null, title: '', caption: '', hashtags: [], mentions: [], keywords: [], thumbnail: '', coverText: '', notes: '', status: 'unreachable', savedAt: new Date().toISOString() };
}

/** Everything public about a post: one request (two for YouTube). Unreachable posts come back with status 'unreachable'. */
export async function fetchReel(input: string): Promise<Reel | null> {
  const link = reelLink(input);
  if (!link) return null;
  const reel = blank(link);
  // What the person shared along with the link ("Look at this café 😍") is worth reading too.
  const shared = input.replace(/https?:\/\/\S+/g, ' ').trim();
  if (link.platform === 'youtube') {
    const vid = link.id.split(':')[1];
    const [oembed, html] = await Promise.all([
      getJSON<{ title?: string; author_name?: string; author_url?: string; thumbnail_url?: string }>(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${vid}`)}&format=json`, TIMEOUT),
      page(`https://www.youtube.com/watch?v=${vid}`),
    ]);
    const description = html?.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1];
    let caption = '';
    try { caption = description ? JSON.parse(`"${description}"`) as string : ''; } catch { caption = ''; }
    const keywords = html?.match(/"keywords":\[([^\]]*)\]/)?.[1];
    // oEmbed is refused for videos with embedding turned off: the watch page has the same facts.
    const page1 = html ?? '';
    Object.assign(reel, {
      title: oembed?.title ?? (meta(page1, 'title') || meta(page1, 'og:title')),
      author: oembed?.author_name ?? decode(page1.match(/"ownerChannelName":"([^"]+)"/)?.[1] ?? ''),
      handle: oembed?.author_url?.split('/').pop()?.replace(/^@/, '') ?? page1.match(/"canonicalBaseUrl":"\\?\/@([^"]+)"/)?.[1] ?? '',
      caption, thumbnail: oembed?.thumbnail_url ?? meta(html ?? '', 'og:image'),
      keywords: keywords ? [...keywords.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).slice(0, 30) : [],
      postedAt: page1.match(/"(?:uploadDate|publishDate)":"(\d{4}-\d{2}-\d{2})/)?.[1] ?? html?.match(/itemprop="(?:uploadDate|datePublished)" content="(\d{4}-\d{2}-\d{2})/)?.[1] ?? '',
    });
  } else if (link.platform === 'tiktok') {
    // TikTok's public oEmbed carries the caption in `title`. (TikTok isn't reachable from India; that's reported as unreachable.)
    const o = await getJSON<{ title?: string; author_name?: string; author_unique_id?: string; thumbnail_url?: string }>(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link.url)}`, TIMEOUT);
    if (o) Object.assign(reel, { caption: o.title ?? '', author: o.author_name ?? '', handle: o.author_unique_id ?? '', thumbnail: o.thumbnail_url ?? '' });
  } else {
    const html = await page(link.url);
    if (html) {
      const description = meta(html, 'og:description') || meta(html, 'description');
      const ig = link.platform === 'instagram' ? instagramPreview(description) : null;
      const title = meta(html, 'og:title');
      Object.assign(reel, {
        caption: ig ? ig.caption : description, likes: ig?.likes ?? null, comments: ig?.comments ?? null, handle: ig?.handle ?? '', postedAt: ig?.postedAt ?? '',
        author: (meta(html, 'twitter:title') || title).replace(/\s*\(@[\w.]+\).*$/, '').replace(/\s+on Instagram$/i, '').replace(/\s*[•|].*$/, '').trim(),
        title: link.platform === 'instagram' ? '' : title, thumbnail: meta(html, 'og:image'),
      });
      if (ig && !reel.handle) reel.handle = ig.handle;
    }
  }
  if (shared && shared.length > 3) reel.notes = shared.slice(0, 1000);
  const text = `${reel.caption}\n${reel.title}`;
  reel.hashtags = tagsIn(text);
  reel.mentions = mentionsIn(text);
  reel.status = reel.caption || reel.title ? 'ok' : reel.thumbnail || reel.author ? 'empty' : 'unreachable';
  return reel;
}

/** Text on the cover image ("5 HIDDEN CAFÉS IN ASSAGAO"), read on this phone. '' where text recognition isn't available. */
export async function coverTextOf(reel: Reel): Promise<string> {
  if (!reel.thumbnail || Platform.OS !== 'ios') return '';
  try {
    const file = await File.downloadFileAsync(reel.thumbnail, new File(Paths.cache, `reel-${reel.id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60)}.jpg`), { idempotent: true });
    const text = await readImageText(file.uri);
    // Cover text is short; long blocks are usually a screenshot of the caption itself.
    return text.split(/\n/).map((l) => l.trim()).filter((l) => l.length >= 3 && l.length <= 40).slice(0, 8).join('\n');
  } catch { return ''; }
}

/* ------------------------------------------------------------------ the map */

/** A destination with the box it covers, so places can be looked for inside it. */
export type Region = { name: string; label: string; lat: number; lng: number; bbox: [number, number, number, number] | null; countryCode: string; tzMinutes: number | null };

type PhotonFeature = { geometry?: { coordinates?: [number, number] }; properties?: { name?: string; country?: string; countrycode?: string; state?: string; county?: string; city?: string; district?: string; locality?: string; type?: string; osm_key?: string; osm_value?: string; extent?: [number, number, number, number] } };

/** The destination ("Goa" → the state of Goa, India), its extent and time zone. Cached for 90 days. */
export async function regionFor(name: string): Promise<Region | null> {
  const q = name.trim();
  if (q.length < 2) return null;
  return cached(`reel.region.v3.${q.toLowerCase()}`, 90 * 86400000, async () => {
    const data = await getJSON<{ features?: PhotonFeature[] }>(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en&layer=state&layer=city&layer=country&layer=county&layer=district`);
    // The answer has to be the place asked for, word for word ("Trek" is not "Treko"): never just the first result.
    const want = norm(q.split(',')[0]);
    const words = (x: string) => norm(x).split(' ').filter(Boolean);
    const same = (name: string) => norm(name) === want || (words(want).length > 0 && words(want).every((w) => words(name).includes(w)) && words(name).length <= words(want).length + 2);
    const f = (data?.features ?? []).find((x) => x.properties?.name && norm(x.properties.name) === want) ?? (data?.features ?? []).find((x) => x.properties?.name && same(x.properties.name));
    const p = f?.properties, c = f?.geometry?.coordinates;
    if (!p?.name || !c) return null;
    // "Puducherry, India", not "Puducherry, Puducherry, India".
    const label = [p.name, p.type !== 'state' && p.type !== 'country' && p.state !== p.name ? p.state : '', p.type === 'country' ? '' : p.country].filter(Boolean).join(', ');
    // Photon's extent is [minLon, maxLat, maxLon, minLat].
    const e = p.extent;
    const zone = await getJSON<{ utc_offset_seconds?: number }>(`https://api.open-meteo.com/v1/forecast?latitude=${c[1]}&longitude=${c[0]}&timezone=auto&forecast_days=1&daily=sunrise`).catch(() => null);
    return {
      name: p.name, label, lat: c[1], lng: c[0], countryCode: (p.countrycode ?? '').toUpperCase(),
      bbox: e ? [Math.min(e[0], e[2]), Math.min(e[1], e[3]), Math.max(e[0], e[2]), Math.max(e[1], e[3])] : null,
      tzMinutes: typeof zone?.utc_offset_seconds === 'number' ? Math.round(zone.utc_offset_seconds / 60) : null,
    };
  });
}

export type Located = { title: string; lat: number; lng: number; area: string; kind: Kind; osm: string };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/** The map's answer has to be the place asked for, not a namesake: most of the words must match. */
function sameName(asked: string, found: string): boolean {
  const a = norm(asked).split(' ').filter((w) => w.length > 2 && !['the', 'and', 'of'].includes(w));
  const b = norm(found);
  if (!a.length) return false;
  const hit = a.filter((w) => b.includes(w)).length;
  return hit / a.length >= 0.6 || b.split(' ').every((w) => a.includes(w));
}

const LATIN = /[a-z]/i;
/** Map features that share a place's name without being the place: the road to the beach, its bus stop, a hotel named after it. */
const NOT_THE_PLACE = /^(highway|railway|public_transport|junction|building|office|information|power|landuse|craft|healthcare|emergency)=|^tourism=(hotel|guest_house|hostel|apartment|motel|chalet|camp_site)|^shop=|^amenity=(bus_station|parking|atm|bank|fuel|taxi|toilets|school|college|hospital|clinic|pharmacy)/;
const ASKED_FOR_SERVICE = /\b(road|street|station|stop|hotel|resort|hostel|homestay|villa|shop|store|mall)\b/i;

/** Words people add to a market's name that the map often leaves out ("Jodd Fairs Night Market" is "Jodd Fairs"). */
/**
 * Words people (and AI) add to a name that the map often leaves out: "Jodd Fairs Night Market" is "Jodd Fairs",
 * "May Kaidee's Vegetarian Restaurant" is "May Kaidee's", "Dona Paula View Point" is "Dona Paula".
 */
const GENERIC_TAIL = /\s+(night market|weekend market|floating market|walking street|night bazaar|market|bazaar|(?:pure )?veg(?:etarian)? restaurant|restaurant(?: (?:&|and) bar)?|caf[eé]|view ?point|museum)$/i;

/** The names to try, most specific first: as given, without a generic ending, then without a possessive ("Govinda's" → "Govinda"). */
export function nameVariants(name: string): string[] {
  const full = name.trim();
  const short = full.replace(GENERIC_TAIL, '');
  const bare = short.replace(/['’]s\b/gi, '');
  return [...new Set([full, short, bare])].filter((n, i) => i === 0 || n.length >= 4);
}

/** Finds a place by name inside the destination (its box when known, else near its centre). Null when the map doesn't know it there. */
export async function placeIn(name: string, region: Region | null): Promise<Located | null> {
  const [full, ...rest] = nameVariants(name);
  const found = await lookup(full, region);
  if (found) return found;
  for (const variant of rest) {
    const hit = await lookup(variant, region);
    // Its kind comes from the full name: a night market is still a night market, a restaurant still a restaurant.
    if (hit) return { ...hit, kind: kindOf(`${name} ${hit.title}`, hit.osm) };
  }
  return region ? appleMaps(name, region) : null;
}

type NativeMaps = { searchPlaces?(query: string, lat: number, lng: number, radiusKm: number): Promise<string> };
const NativeMaps = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeMaps>('LoomIntelligence') : null;
/** Apple Maps' categories, as the app's kinds of place. */
const APPLE_KIND: Record<string, Kind> = {
  MKPOICategoryBeach: 'beach', MKPOICategoryRestaurant: 'restaurant', MKPOICategoryCafe: 'cafe', MKPOICategoryBakery: 'cafe', MKPOICategoryNightlife: 'bar',
  MKPOICategoryBrewery: 'bar', MKPOICategoryWinery: 'bar', MKPOICategoryMuseum: 'museum', MKPOICategoryNationalPark: 'nature', MKPOICategoryPark: 'nature',
  MKPOICategoryCastle: 'fort', MKPOICategoryFortress: 'fort', MKPOICategoryLandmark: 'heritage', MKPOICategoryNationalMonument: 'heritage', MKPOICategoryMarina: 'activity',
  MKPOICategoryAmusementPark: 'activity', MKPOICategoryAquarium: 'museum', MKPOICategoryZoo: 'activity', MKPOICategoryStore: 'shopping', MKPOICategoryHike: 'nature',
};

/**
 * Apple Maps (iOS, on the device, no key): it knows places OpenStreetMap misses ("Promenade Beach", Puducherry).
 * Kept only when the name matches and it's inside the destination, so a namesake elsewhere is never taken.
 */
async function appleMaps(name: string, region: Region): Promise<Located | null> {
  if (!NativeMaps?.searchPlaces) return null;
  return cached(`reel.apple.v2.${region.lat.toFixed(2)},${region.lng.toFixed(2)}.${name.toLowerCase()}`, 60 * 86400000, async () => {
    try {
      const radius = region.bbox ? Math.max(10, Math.hypot((region.bbox[3] - region.bbox[1]) * 111, (region.bbox[2] - region.bbox[0]) * 111) / 2) : 60;
      const list = JSON.parse(await NativeMaps.searchPlaces!(name, region.lat, region.lng, radius)) as { name: string; lat: number; lng: number; locality: string; category: string }[];
      const inside = (h: { lat: number; lng: number }) => (region.bbox
        ? h.lng >= region.bbox[0] - 0.05 && h.lat >= region.bbox[1] - 0.05 && h.lng <= region.bbox[2] + 0.05 && h.lat <= region.bbox[3] + 0.05
        : Math.hypot((h.lat - region.lat) * 111, (h.lng - region.lng) * 111 * Math.cos((region.lat * Math.PI) / 180)) < 80);
      const hit = list.find((h) => h.name && sameName(name, h.name) && inside(h));
      if (!hit) return null;
      const kind = APPLE_KIND[hit.category] ?? kindOf(`${name} ${hit.name}`);
      return { title: hit.name.length <= name.length + 12 ? hit.name : name, lat: hit.lat, lng: hit.lng, area: hit.locality || region.name, kind, osm: '' };
    } catch { return null; }
  });
}

/** "Jaipur Municipal Corporation" is Jaipur to a traveller. */
const tidyArea = (area: string) => area.replace(/\s+(?:Municipal Corporation|Municipal Council|Municipality|Metropolitan (?:Region|Area)|City Corporation|Corporation)$/i, '');

async function lookup(name: string, region: Region | null): Promise<Located | null> {
  // Answers cached before areas were tidied are tidied on the way out.
  const hit = await lookupCached(name, region);
  return hit ? { ...hit, area: tidyArea(hit.area) } : null;
}

async function lookupCached(name: string, region: Region | null): Promise<Located | null> {
  const q = name.trim();
  if (q.length < 3) return null;
  const where = region ? `${region.lat.toFixed(2)},${region.lng.toFixed(2)}` : 'any';
  return cached(`reel.place.${where}.${q.toLowerCase()}`, 60 * 86400000, async () => {
    const params = new URLSearchParams({ q, limit: '10', lang: 'en' });
    if (region) { params.set('lat', String(region.lat)); params.set('lon', String(region.lng)); }
    if (region?.bbox) params.set('bbox', region.bbox.join(','));
    const data = await getJSON<{ features?: PhotonFeature[] }>(`https://photon.komoot.io/api/?${params}`);
    const want = kindOf(q);
    let best: { score: number; located: Located } | null = null;
    for (const f of data?.features ?? []) {
      const p = f.properties, c = f.geometry?.coordinates;
      if (!p?.name || !c) continue;
      const osm = p.osm_key && p.osm_value ? `${p.osm_key}=${p.osm_value}` : '';
      if (NOT_THE_PLACE.test(osm) && !ASKED_FOR_SERVICE.test(q)) continue;
      // Some names only exist in the local script ("ಕಾಬೊ ಡೆ ರಾಮ ಕೋಟೆ"); then the area it's in has to match instead.
      const latin = LATIN.test(p.name);
      if (!(latin ? sameName(q, p.name) : sameName(q, [p.district, p.locality, p.city].filter(Boolean).join(' ')))) continue;
      // Without a box, stay within ~150 km of the destination.
      if (region && !region.bbox && Math.hypot((c[1] - region.lat) * 111, (c[0] - region.lng) * 111 * Math.cos((region.lat * Math.PI) / 180)) > 150) continue;
      const kind = kindOf(`${q} ${latin ? p.name : ''}`, osm);
      const score = (norm(p.name) === norm(q) ? 3 : 0) + (want !== 'other' && kind === want ? 2 : 0) + (/^(natural|tourism|historic|leisure|amenity)=/.test(osm) ? 1 : 0) + (/^place=/.test(osm) ? 0.5 : 0);
      if (best && best.score >= score) continue;
      const area = tidyArea(p.city || p.district || p.county || p.locality || '');
      best = { score, located: { title: latin ? p.name : q, lat: c[1], lng: c[0], area: norm(area) === norm(p.name) ? (p.county || '') : area, kind, osm } };
    }
    return best?.located ?? null;
  });
}

/* ------------------------------------------------------------------ reading a set of reels */

export type Found = Merged & { located: Located | null };

/** All the places a set of reels names, checked on the map inside the destination, strongest first. */
export async function findPlaces(reels: Reel[], destination: string, region: Region | null, extra: string[] = [], onProgress?: (done: number, total: number) => void): Promise<Found[]> {
  const candidates = mergeCandidates([
    ...reels.flatMap((r) => candidatesIn(r, destination)),
    ...extra.map((title) => ({ key: title.toLowerCase(), title, source: 'you' as const, quote: title, confidence: 1, reelId: '' })),
  ]).slice(0, 30);
  // The free map service asks for gentle use: four lookups at a time, strongest first.
  const located: (Located | null)[] = new Array(candidates.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < candidates.length) {
      const i = next++;
      // One try each, with a generous timeout: an unknown name returns quickly, a slow server shouldn't stall the rest.
      located[i] = await Promise.race([placeIn(candidates[i].title, region).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 9000))]);
      done += 1;
      onProgress?.(done, candidates.length);
    }
  };
  let done = 0;
  onProgress?.(0, candidates.length);
  await Promise.all([worker(), worker(), worker(), worker()]);
  return candidates.map((c, i) => ({ ...c, located: located[i] }))
    // A guess from a hashtag or tagged account only stays if the map knows it in the destination; a town or city
    // the reels mention is where things are, not a stop (unless the person typed it).
    .filter((c) => (c.located || c.confidence >= 0.5) && !(c.located && /^place=(city|town|municipality|county|state|district|region|province)$/.test(c.located.osm) && c.source !== 'you'))
    // A guess from a hashtag or tagged account needs a close match: the map's name must start with it ("Hidden" isn't "Polem Hidden Beach").
    .filter((c) => !c.located || !(c.source === 'hashtag' || c.source === 'mention') || norm(c.located.title).startsWith(norm(c.title)) || norm(c.title).startsWith(norm(c.located.title)));
}
