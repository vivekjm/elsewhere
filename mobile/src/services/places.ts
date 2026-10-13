import * as Localization from 'expo-localization';
import { cached, getJSON } from './net';

export type Place = { name: string; label: string; latitude: number; longitude: number; country: string; countryCode: string; timeZone: string };

type Result = { name: string; latitude: number; longitude: number; country?: string; country_code?: string; admin1?: string; population?: number; timezone?: string; feature_code?: string };

const toPlace = (r: Result): Place => ({
  name: r.name, latitude: r.latitude, longitude: r.longitude, country: r.country ?? '', countryCode: r.country_code ?? '',
  timeZone: r.timezone ?? '', label: [r.name, r.admin1 && r.admin1 !== r.name ? r.admin1 : '', r.country].filter(Boolean).join(', '),
});

async function search(name: string, count: number): Promise<Result[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=${count}&language=en&format=json`;
  return (await getJSON<{ results?: Result[] }>(url))?.results ?? [];
}

/** Suggestions while typing a destination: populated places, most populous first. */
export async function suggest(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const results = await search(q.split(',')[0], 20);
  // Travel destinations only: cities, towns, regions, islands and parks; no airports, heliports or hills.
  // GeoNames feature codes: PPL* populated places, ADM* regions, ISL* islands, PRK parks, AREA, RGN regions, MT/MTS mountains.
  const destination = (r: Result) => !r.feature_code || /^(PPL|ADM|PCL|ISL|PRK|AREA|RGN|MT|MTS|PK|LK|BCH|CAPE|PEN|VAL)/.test(r.feature_code);
  // A hamlet of 30 people shouldn't outrank Tokyo: drop small places once a big one matches.
  const kept = results.filter(destination);
  const biggest = Math.max(0, ...kept.map((r) => r.population ?? 0));
  const seen = new Set<string>();
  return kept
    // Once a real city matches, show only towns and regions (not every hill, park or hamlet that shares the name).
    .filter((r) => biggest < 100000 || (/^(PPL|ADM|PCL|ISL)/.test(r.feature_code ?? '') && ((r.population ?? 0) >= 1000 || !/^PPL/.test(r.feature_code ?? ''))))
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .filter((r) => { const k = `${r.name}|${r.admin1}|${r.country}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 8)
    .map(toPlace);
}

/**
 * Best match for a free-text destination ("Kyoto, Japan"). Prefers a match whose region or country
 * appears in the text, then the phone's country, then population. Cached for 30 days.
 */
export async function lookup(text: string): Promise<Place | null> {
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  return cached(`place.${text.toLowerCase()}`, 30 * 86400000, async () => {
    const results = await search(parts[0], 10);
    if (!results.length) return null;
    const hint = parts.slice(1).join(' ').toLowerCase();
    const home = Localization.getLocales()[0]?.regionCode ?? '';
    const score = (r: Result) => Math.log10(Math.max(r.population ?? 1, 1))
      + (hint && r.admin1 && (hint.includes(r.admin1.toLowerCase()) || r.admin1.toLowerCase().includes(hint)) ? 10 : 0)
      + (hint && r.country && hint.includes(r.country.toLowerCase()) ? 10 : 0)
      + (r.country_code === home ? 3 : 0);
    return toPlace(results.reduce((best, r) => score(r) > score(best) ? r : best));
  });
}
