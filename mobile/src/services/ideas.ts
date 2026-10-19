/**
 * Ideas for a trip's planning board, from whatever someone has: a reel or post link (its caption, hashtags and
 * cover), a Google Maps link, place names typed in, or AI suggestions. Every idea is checked on the map inside the
 * destination before it's offered, and keeps the words it came from. Nothing is added until the person picks it.
 */
import { ME, uid, type ShortlistItem } from '../data';
import { fromMapsUrl } from '../domain/shortlist';
import { reelLink, type Reel, type Slot } from '../domain/reels';
import { kindOf } from '../domain/planmode';
import { fetchReel, findPlaces, placeIn, type Found, type Region } from './reels';

export type IdeaCandidate = {
  title: string; lat?: number; lng?: number; area: string; kind: string; slot?: Slot; quote: string;
  via: NonNullable<ShortlistItem['via']>; url?: string; located: boolean;
};

const ofFound = (f: Found, via: IdeaCandidate['via'], url?: string): IdeaCandidate => ({
  title: f.located && f.located.title.length <= f.title.length + 12 ? f.located.title : f.title, lat: f.located?.lat, lng: f.located?.lng, area: f.located?.area ?? '',
  kind: f.located?.kind && f.located.kind !== 'other' ? f.located.kind : kindOf(f.title, f.located?.osm), slot: f.slot, quote: f.quote, via, url, located: !!f.located,
});

/** The places in a link or in typed text. `reel` is the post that was read, when it was one. */
export async function ideasFrom(input: string, destination: string, region: Region | null, onProgress?: (done: number, total: number) => void): Promise<{ ideas: IdeaCandidate[]; reel: Reel | null; status: 'ok' | 'none' | 'unreachable' }> {
  const text = input.trim();
  const link = reelLink(text);
  // A Google Maps link names (and pins) the place itself.
  const maps = link ? fromMapsUrl(link.url) ?? fromMapsUrl(text.match(/https?:\/\/\S+/i)?.[0] ?? '') : null;
  if (maps) {
    const at = maps.lat !== undefined ? null : await placeIn(maps.title, region).catch(() => null);
    return { ideas: [{ title: maps.title, lat: maps.lat ?? at?.lat, lng: maps.lng ?? at?.lng, area: at?.area ?? '', kind: at?.kind ?? kindOf(maps.title), quote: 'Google Maps link', via: 'link', url: maps.url, located: maps.lat !== undefined || !!at }], reel: null, status: 'ok' };
  }
  if (link && link.platform !== 'web') {
    const reel = await fetchReel(text);
    if (!reel || reel.status === 'unreachable') return { ideas: [], reel, status: 'unreachable' };
    const found = await findPlaces([reel], destination, region, [], onProgress);
    return { ideas: found.map((f) => ofFound(f, 'reel', reel.url)), reel, status: found.length ? 'ok' : 'none' };
  }
  // Typed: each name on its own, or a sentence that names places ("Fontainhas, Gunpowder in Assagao").
  const typed: Reel = {
    id: 'typed', url: '', platform: 'web', author: '', handle: '', postedAt: '', likes: null, comments: null, title: '', caption: '', hashtags: [], mentions: [],
    keywords: [], thumbnail: '', coverText: '', notes: text, status: 'ok', savedAt: '',
  };
  const found = await findPlaces([typed], destination, region, [], onProgress);
  // A single name the parser didn't take as a place ("thalassa") is still what they typed.
  if (!found.length && text.length >= 3 && text.split(/\s+/).length <= 6 && !/https?:/i.test(text)) {
    const at = await placeIn(text, region).catch(() => null);
    return { ideas: [{ title: at && at.title.length <= text.length + 12 ? at.title : text, lat: at?.lat, lng: at?.lng, area: at?.area ?? '', kind: at?.kind ?? kindOf(text), quote: '', via: 'typed', located: !!at }], reel: null, status: 'ok' };
  }
  return { ideas: found.map((f) => ({ ...ofFound(f, 'typed'), quote: '' })), reel: null, status: found.length ? 'ok' : 'none' };
}

/**
 * AI suggestions, each checked on the map inside the destination. Ones the map finds come first; ones it can't (the
 * free map misses many restaurants) are still offered, last, marked "Not found on the map", for the person to judge.
 */
export async function locateIdeas(list: { title: string; why: string }[], region: Region | null): Promise<IdeaCandidate[]> {
  const located = await Promise.all(list.map((i) => placeIn(i.title, region).catch(() => null)));
  const ideas = list.map((i, n): IdeaCandidate => {
    const at = located[n];
    return at
      ? { title: i.title, lat: at.lat, lng: at.lng, area: at.area, kind: at.kind !== 'other' ? at.kind : kindOf(i.title, at.osm), quote: i.why, via: 'ai', located: true }
      : { title: i.title, area: '', kind: kindOf(i.title), quote: i.why, via: 'ai', located: false };
  });
  return [...ideas.filter((i) => i.located), ...ideas.filter((i) => !i.located)];
}

/** An idea as a shortlist item: added by you, and you want it. */
export function toShortlistItem(c: IdeaCandidate): ShortlistItem {
  return {
    id: uid(), title: c.title.slice(0, 160), place: (c.area || '').slice(0, 200), ...(c.lat !== undefined && c.lng !== undefined ? { lat: c.lat, lng: c.lng } : {}),
    ...(c.url && /^https:\/\//.test(c.url) ? { url: c.url } : {}), note: '', addedBy: ME, votes: [ME], planned: '', createdAt: new Date().toISOString(),
    via: c.via, ...(c.quote ? { quote: c.quote.slice(0, 220) } : {}), ...(/^[a-z]{2,15}$/.test(c.kind) ? { kind: c.kind } : {}), ...(c.slot ? { slot: c.slot } : {}),
  };
}

/** Whether an idea is already on the board (same name, or the same spot on the map). */
export function alreadyIn(items: Pick<ShortlistItem, 'title' | 'lat' | 'lng'>[], c: Pick<IdeaCandidate, 'title' | 'lat' | 'lng'>): boolean {
  const t = c.title.toLowerCase();
  return items.some((x) => x.title.toLowerCase() === t || x.title.toLowerCase().includes(t) || t.includes(x.title.toLowerCase())
    || (c.lat !== undefined && x.lat !== undefined && Math.abs(x.lat - c.lat) < 0.0015 && Math.abs((x.lng ?? 0) - (c.lng ?? 0)) < 0.0015));
}
