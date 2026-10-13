/**
 * Live flight status from free, keyless sources:
 * - adsbdb.com: airline codes (IATA → ICAO) and the flight's usual route with airport details.
 * - adsb.lol: live aircraft positions from volunteer ADS-B receivers (ODbL; credit shown in the app).
 * There is no free source for delays, gates or schedules, so the status is built from where the plane is.
 */
import { cached, getJSON } from './net';
import type { Activity } from '../data';
import { distanceKm } from './geo';

export type Airport = { iata: string; name: string; city: string; lat: number; lng: number };
export type FlightRoute = { callsign: string; airline: string; origin: Airport; destination: Airport };
/** Speed and track are null when the receivers didn't send believable values (they sometimes report 0 kn at cruise). */
export type LivePosition = { lat: number; lng: number; altitudeM: number; speedKmh: number | null; track: number | null; onGround: boolean; aircraft: string; registration: string; seenSec: number };
export type FlightStatus = {
  number: string;
  route: FlightRoute | null;
  live: LivePosition | null;
  phase: 'scheduled' | 'airborne' | 'landed' | 'unknown';
  /** Kilometres left and an arrival estimate from the current ground speed, when airborne. */
  remainingKm: number | null;
  etaMinutes: number | null;
  progress: number | null;
};

/** "TP 1321 · LHR → LIS", "Flight BA117", "ba 117" → { airline: "TP", number: "1321" }. */
export function parseFlightNumber(text: string): { airline: string; number: string } | null {
  const m = text.toUpperCase().match(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})[A-Z]?\b/);
  if (!m || /^\d+$/.test(m[1])) return null;
  return { airline: m[1], number: String(Number(m[2])) };
}

async function airlineIcao(iata: string): Promise<{ icao: string; name: string } | null> {
  return cached(`airline.${iata}`, 60 * 86400000, async () => {
    const data = await getJSON<{ response?: { icao?: string; name?: string }[] | string }>(`https://api.adsbdb.com/v0/airline/${encodeURIComponent(iata)}`);
    const first = Array.isArray(data?.response) ? data.response.find((a) => a.icao) : undefined;
    return first?.icao ? { icao: first.icao, name: first.name ?? iata } : null;
  });
}

type AdsbdbAirport = { iata_code?: string; name?: string; municipality?: string; latitude?: number; longitude?: number };
const airport = (a: AdsbdbAirport | undefined): Airport | null =>
  a && typeof a.latitude === 'number' && typeof a.longitude === 'number'
    ? { iata: a.iata_code ?? '', name: a.name ?? '', city: a.municipality ?? '', lat: a.latitude, lng: a.longitude } : null;

async function route(callsign: string, airlineName: string): Promise<FlightRoute | null> {
  return cached(`route.${callsign}`, 86400000, async () => {
    const data = await getJSON<{ response?: { flightroute?: { origin?: AdsbdbAirport; destination?: AdsbdbAirport } } | string }>(`https://api.adsbdb.com/v0/callsign/${callsign}`);
    const fr = typeof data?.response === 'object' ? data.response.flightroute : undefined;
    const origin = airport(fr?.origin), destination = airport(fr?.destination);
    return origin && destination ? { callsign, airline: airlineName, origin, destination } : null;
  });
}

type AdsbAircraft = {
  lat?: number; lon?: number; lastPosition?: { lat?: number; lon?: number; seen_pos?: number };
  alt_baro?: number | 'ground'; gs?: number; track?: number; t?: string; r?: string; seen?: number; seen_pos?: number;
};

async function live(callsign: string): Promise<LivePosition | null> {
  // Not cached: positions are only useful fresh.
  const data = await getJSON<{ ac?: AdsbAircraft[] }>(`https://api.adsb.lol/v2/callsign/${callsign}`);
  // Prefer a current position; otherwise the last one seen in the past 15 minutes.
  const withPos = (data?.ac ?? []).map((a) => {
    if (typeof a.lat === 'number' && typeof a.lon === 'number') return { a, lat: a.lat, lng: a.lon, age: a.seen_pos ?? a.seen ?? 0 };
    const p = a.lastPosition;
    return p && typeof p.lat === 'number' && typeof p.lon === 'number' && (p.seen_pos ?? 0) < 900 ? { a, lat: p.lat, lng: p.lon, age: p.seen_pos ?? 0 } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((x, y) => x.age - y.age);
  const hit = withPos[0];
  if (!hit) return null;
  const { a } = hit;
  const onGround = a.alt_baro === 'ground';
  const altitudeM = onGround ? 0 : Math.round(((a.alt_baro as number) || 0) * 0.3048);
  const kmh = typeof a.gs === 'number' ? Math.round(a.gs * 1.852) : null;
  // Above 3 km a plane can't be doing under 250 km/h; treat that as a bad reading, along with its track.
  const believable = kmh != null && (onGround || altitudeM < 3000 || kmh >= 250) && kmh < 1300;
  return {
    lat: hit.lat, lng: hit.lng, altitudeM, speedKmh: believable ? kmh : null, track: believable && typeof a.track === 'number' ? a.track : null,
    onGround, aircraft: a.t ?? '', registration: a.r ?? '', seenSec: Math.round(hit.age),
  };
}

/** Initial compass bearing from a to b, in degrees. */
export function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat));
  const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Everything known about a flight right now. `departs` is the planned departure, if the plan has a date and time. */
export async function flightStatus(text: string, departs: Date | null, now = new Date()): Promise<FlightStatus | null> {
  const parsed = parseFlightNumber(text);
  if (!parsed) return null;
  const number = `${parsed.airline} ${parsed.number}`;
  const airline = await airlineIcao(parsed.airline);
  if (!airline) return { number, route: null, live: null, phase: 'unknown', remainingKm: null, etaMinutes: null, progress: null };
  const callsign = `${airline.icao}${parsed.number}`;
  const [r, position] = await Promise.all([route(callsign, airline.name), live(callsign)]);
  // A flight number is reused daily: only trust a live position near the planned day.
  const nearPlan = !departs || Math.abs(now.getTime() - departs.getTime()) < 20 * 3600000;
  const pos = nearPlan ? position : null;
  let phase: FlightStatus['phase'] = 'unknown', remainingKm: number | null = null, etaMinutes: number | null = null, progress: number | null = null;
  if (pos && !pos.onGround) {
    phase = 'airborne';
    if (r) {
      const total = distanceKm(r.origin, r.destination);
      remainingKm = Math.round(distanceKm(pos, r.destination));
      progress = total > 0 ? Math.max(0, Math.min(1, 1 - remainingKm / total)) : null;
      // Ten minutes for the descent and taxi; a typical cruise speed when the receivers gave no believable speed.
      etaMinutes = Math.round((remainingKm / (pos.speedKmh ?? 850)) * 60) + 10;
    }
  } else if (departs && now < departs) phase = 'scheduled';
  else if (departs && r) {
    // No position after departure: past the route's usual flying time (800 km/h plus taxi), it has landed.
    const minutes = (distanceKm(r.origin, r.destination) / 800) * 60 + 40;
    phase = now.getTime() - departs.getTime() > minutes * 60000 ? 'landed' : 'unknown';
  } else if (pos?.onGround && departs && now > departs) phase = 'unknown';
  return { number, route: r, live: pos, phase, remainingKm, etaMinutes, progress };
}

/** Whether a plan looks like a flight, so screens can offer "Flight status". */
export const isFlightPlan = (a: Pick<Activity, 'category' | 'title' | 'notes'>) => a.category === 'Travel' && !!parseFlightNumber(`${a.title} ${a.notes}`) && /flight|fly|airport|\b[A-Z]{3}\s*(→|->|to)\s*[A-Z]{3}\b|\b[A-Z0-9]{2}\s?\d{2,4}\b/i.test(`${a.title} ${a.notes}`);
