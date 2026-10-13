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

type PhotonFeature = { geometry?: { coordinates?: [number, number] }; properties?: { name?: string; country?: string; countrycode?: string; state?: string; type?: string } };

/**
 * Towns, states and countries by name from OpenStreetMap (Photon, free, no key), ranked by how well known they are.
 * The town gazetteer above ranks by population and leaves regions out, so "Goa" found towns elsewhere and "Manali"
 * found a Chennai suburb before the hill town; these lead the suggestions instead.
 */
async function regions(name: string): Promise<Place[]> {
  const data = await getJSON<{ features?: PhotonFeature[] }>(`https://photon.komoot.io/api/?q=${encodeURIComponent(name)}&limit=5&lang=en&layer=city&layer=state&layer=country`);
  const q = name.trim().toLowerCase();
  return (data?.features ?? []).flatMap((f) => {
    const p = f.properties, c = f.geometry?.coordinates;
    if (!p?.name || !c || !p.name.toLowerCase().startsWith(q)) return [];
    const country = p.type === 'country' ? p.name : p.country ?? '';
    const label = [p.name, p.type === 'city' && p.state && p.state !== p.name ? p.state : '', p.type === 'country' ? '' : country].filter(Boolean).join(', ');
    return [{ name: p.name, label, latitude: c[1], longitude: c[0], country, countryCode: (p.countrycode ?? '').toUpperCase(), timeZone: '' }];
  }).slice(0, 3);
}

/** The IANA time zone at a point (Open-Meteo, free, no key); empty when unknown. */
async function zoneAt(latitude: number, longitude: number): Promise<string> {
  const data = await getJSON<{ timezone?: string }>(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&timezone=auto&forecast_days=1&daily=sunrise`).catch(() => null);
  return data?.timezone && data.timezone !== 'GMT' ? data.timezone : '';
}

/** Suggestions while typing a destination: regions and countries that match by name, then towns, most populous first. */
export async function suggest(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const [results, areas] = await Promise.all([search(q.split(',')[0], 20), regions(q.split(',')[0]).catch(() => [] as Place[])]);
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
    .map(toPlace)
    .reduce((list, place) => (list.some((x) => x.label === place.label) ? list : [...list, place]), areas)
    .slice(0, 8);
}

/**
 * Best match for a free-text destination ("Kyoto, Japan"). Prefers a match whose region or country
 * appears in the text, then the phone's country, then population. Cached for 30 days.
 */
export async function lookup(text: string): Promise<Place | null> {
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  return cached(`place.${text.toLowerCase()}`, 30 * 86400000, async () => {
    const [results, areas] = await Promise.all([search(parts[0], 10), regions(parts[0]).catch(() => [] as Place[])]);
    const hint = parts.slice(1).join(' ').toLowerCase();
    // A state or region with exactly this name ("Goa, India") beats villages that share it, unless a real city matches.
    const area = areas.find((a) => a.name.toLowerCase() === parts[0].toLowerCase() && (!hint || hint.includes(a.country.toLowerCase()) || a.label.toLowerCase().includes(hint)));
    const bigCity = results.some((r) => (r.population ?? 0) >= 100000 && (!hint || (r.country ?? '').toLowerCase().includes(hint) || hint.includes((r.country ?? '').toLowerCase())));
    if (area && !bigCity) return { ...area, timeZone: await zoneAt(area.latitude, area.longitude) };
    if (!results.length) return null;
    const home = Localization.getLocales()[0]?.regionCode ?? '';
    const score = (r: Result) => Math.log10(Math.max(r.population ?? 1, 1))
      + (hint && r.admin1 && (hint.includes(r.admin1.toLowerCase()) || r.admin1.toLowerCase().includes(hint)) ? 10 : 0)
      + (hint && r.country && hint.includes(r.country.toLowerCase()) ? 10 : 0)
      + (r.country_code === home ? 3 : 0);
    return toPlace(results.reduce((best, r) => score(r) > score(best) ? r : best));
  });
}
