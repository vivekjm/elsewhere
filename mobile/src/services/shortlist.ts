/**
 * Finds the places in what someone shares to the trip: Google Maps links are read directly (short links are
 * followed first); social posts are fetched once for their public preview text (title and description), which is
 * where captions name places; plain text and screenshot text are read line by line. Each candidate is then looked
 * up near the trip's destination so it lands on the map. Nothing is stored until the person confirms.
 */
import { fromMapsUrl, fromText, isSocial, linksIn, type Candidate } from '../domain/shortlist';
import { geocodePlace } from './geo';

const TIMEOUT = 8000;

async function fetchText(url: string): Promise<{ finalUrl: string; html: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/html' } });
    const html = (await r.text()).slice(0, 400000);
    return { finalUrl: r.url || url, html };
  } catch { return null; } finally { clearTimeout(timer); }
}

const meta = (html: string, name: string) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1]
  ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, 'i'))?.[1];
const unescape = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** The places in a shared message (links and text). */
export async function findPlaces(input: string): Promise<Candidate[]> {
  const found: Candidate[] = [];
  const push = (c: Candidate | null) => { if (c && !found.some((x) => x.title.toLowerCase() === c.title.toLowerCase())) found.push(c); };
  for (const link of linksIn(input).slice(0, 4)) {
    const direct = fromMapsUrl(link);
    if (direct) { push(direct); continue; }
    if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(link)) {
      const page = await fetchText(link);
      push(page ? fromMapsUrl(page.finalUrl) : null);
      continue;
    }
    if (isSocial(link)) {
      const page = await fetchText(link);
      if (!page) continue;
      const caption = [meta(page.html, 'og:title'), meta(page.html, 'og:description'), meta(page.html, 'description')].filter(Boolean).map((s) => unescape(s!)).join('\n');
      for (const c of fromText(caption)) push({ ...c, url: link });
    }
  }
  const text = input.replace(/https:\/\/\S+/gi, ' ');
  if (text.trim()) for (const c of fromText(text)) push(c);
  return found.slice(0, 8);
}

/** Puts a candidate on the map near the trip's destination (skipped when it already has coordinates). */
export async function locate(c: Candidate, destination: string): Promise<Candidate> {
  if (c.lat !== undefined) return c;
  const city = destination.split(',')[0] ?? '';
  // A place the map doesn't know shouldn't hold up the others: give each lookup a few seconds (the cache still fills).
  const hit = await Promise.race([geocodePlace(c.title, city).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
  return hit ? { ...c, lat: hit.lat, lng: hit.lng } : c;
}
