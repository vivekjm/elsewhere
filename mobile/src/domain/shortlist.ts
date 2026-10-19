/**
 * Turning what friends share (a reel or post link, a Google Maps link, a caption, a screenshot's text) into the
 * places it mentions, for the group's shortlist. Pure parsing here; fetching and map lookups are in
 * `services/shortlist`. Everything found is a suggestion the person confirms before it's added.
 */

export type Candidate = { title: string; lat?: number; lng?: number; url?: string };

const clean = (s: string) => s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').replace(/^[\s,.:;|–—-]+|[\s,.:;|–—-]+$/g, '').trim();
const decode = (s: string) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return s; } };

/** A Google Maps URL's place name and coordinates, when it has them. */
export function fromMapsUrl(url: string): Candidate | null {
  if (!/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url)) return null;
  const at = url.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ?? url.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  const place = url.match(/\/maps\/place\/([^/@?]+)/)?.[1];
  const q = url.match(/[?&](?:q|query|destination)=([^&]+)/)?.[1];
  const qCoords = q ? decode(q).match(/^(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)$/) : null;
  const title = clean(decode(place ?? (qCoords ? '' : q ?? '')));
  const lat = at ? Number(at[1]) : qCoords ? Number(qCoords[1]) : undefined;
  const lng = at ? Number(at[2]) : qCoords ? Number(qCoords[2]) : undefined;
  if (!title && lat === undefined) return null;
  return { title: title || 'Pinned place', ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}), url };
}

/** Lines in a caption that name a place: "📍 Name", "at Name", "Location: Name", or a line of its own. */
export function fromText(text: string): Candidate[] {
  const out: string[] = [];
  const add = (s: string) => {
    const t = clean(s).replace(/\s*#\S+/g, '').slice(0, 120);
    if (t.length >= 3 && t.length <= 80 && !/^https?:/i.test(t) && /\p{L}/u.test(t) && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  };
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const pin = line.match(/📍\s*(.+)/u)?.[1];
    if (pin) { add(pin.split(/[|•]/)[0]); continue; }
    const labelled = line.match(/^(?:location|place|where|address|spot)\s*[:\-–]\s*(.+)/i)?.[1];
    if (labelled) { add(labelled); continue; }
    const at = line.match(/\b(?:at|visit(?:ed)?|try)\s+([A-Z][\p{L}'’&.-]*(?:\s+[A-Z][\p{L}'’&.-]*){0,5})/u)?.[1];
    if (at) add(at);
  }
  // A short message with nothing marked: treat each short line as a place name ("Thalassa, Vagator").
  if (!out.length) for (const raw of text.split(/\n+/).slice(0, 6)) if (raw.trim().split(/\s+/).length <= 6) add(raw);
  return out.slice(0, 8).map((title) => ({ title }));
}

/** Every link in a message (the scheme lower-cased: a typed link can come back as "HTTPS://" from auto-capitalisation). */
export const linksIn = (text: string) => [...text.matchAll(/https:\/\/[^\s<>"')]+/gi)].map((m) => `https://${m[0].slice(8)}`);

/** A social post link (Instagram, TikTok, YouTube, X, Facebook): its caption is worth reading for places. */
export const isSocial = (url: string) => /^https:\/\/(www\.|m\.)?(instagram\.com|tiktok\.com|vm\.tiktok\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|facebook\.com|fb\.watch)\//i.test(url);

/** Days to put shortlisted places on: the ones with the fewest plans first, then in date order. */
export function freeDays(dates: string[], plansOn: (d: string) => number): string[] {
  return [...dates].sort((a, b) => plansOn(a) - plansOn(b) || a.localeCompare(b));
}

/**
 * Splits places into groups that are close together (greedy, nearest neighbour), so each day stays in one area.
 * Places without coordinates go wherever there's room.
 */
export function groupByArea<T extends { lat?: number; lng?: number }>(items: T[], groups: number): T[][] {
  const out: T[][] = Array.from({ length: Math.max(1, groups) }, () => []);
  const located = items.filter((x) => x.lat !== undefined && x.lng !== undefined);
  const rest = items.filter((x) => x.lat === undefined || x.lng === undefined);
  const per = Math.ceil(items.length / out.length);
  const km = (a: T, b: T) => Math.hypot((a.lat! - b.lat!) * 111, (a.lng! - b.lng!) * 111 * Math.cos((a.lat! * Math.PI) / 180));
  const left = [...located];
  for (const group of out) {
    if (!left.length) break;
    group.push(left.shift()!);
    while (group.length < per && left.length) {
      left.sort((a, b) => km(group[group.length - 1], a) - km(group[group.length - 1], b));
      group.push(left.shift()!);
    }
  }
  for (const x of rest) out.reduce((min, g) => (g.length < min.length ? g : min), out[0]).push(x);
  return out.filter((g) => g.length);
}
