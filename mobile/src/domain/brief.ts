/**
 * What AI understood from the sentence someone typed to start a plan: where (spelling and wrong facts fixed), what
 * kind of trip, the facts they gave, the places they named, and for a trek a safe day-by-day route. Checked again on
 * the phone (`briefOf`), turned into a trek trip's stages (`trekStages`), and compared when the route changes
 * (`routeChanges`). Pure, so it's unit-tested.
 */
import type { TripKind } from '../data/extras';

export type BriefStage = { day: number; from: string; to: string; distance_km: number; hours: number; start_altitude: number; end_altitude: number; note: string };
export type Trek = { summit: string; summit_altitude: number; typical_days: number; permits: string[]; stages: BriefStage[] };
export type Brief = {
  understood: boolean; destination: string; region: string; country_code: string; title: string; kind: TripKind;
  days: number; people: number; party: '' | 'solo' | 'couple' | 'friends' | 'family'; month: number; start: string;
  food: '' | 'veg' | 'jain' | 'nonveg' | 'any'; budget: '' | 'backpacker' | 'comfortable' | 'treat';
  places: { title: string; quote: string }[]; note: string; question: string; trek: Trek | null;
  /** What AI says about a change it made (route changes); and the months the trip is usually done in. */
  reply: string; best_months: number[];
};

const KINDS: TripKind[] = ['city', 'beach', 'trek', 'road', 'dive'];
const s = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const n = (v: unknown, min: number, max: number) => { const x = typeof v === 'number' ? v : Number(v); return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : 0; };
const one = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? v as T : fallback);

function stages(list: unknown): BriefStage[] {
  return (Array.isArray(list) ? list : []).slice(0, 30).flatMap((x, i) => {
    const t = (x ?? {}) as Record<string, unknown>;
    const from = s(t.from, 80), to = s(t.to, 80);
    return from && to ? [{
      day: i + 1, from, to, distance_km: n(t.distance_km, 0, 60), hours: n(t.hours, 0, 16),
      start_altitude: Math.round(n(t.start_altitude, 0, 8900)), end_altitude: Math.round(n(t.end_altitude, 0, 8900)), note: s(t.note, 120),
    }] : [];
  });
}

/** The server's answer, checked again: anything malformed becomes "not understood" or is left out. */
export function briefOf(v: unknown): Brief | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const t = (o.trek ?? null) as Record<string, unknown> | null;
  const route = t ? stages(t.stages) : [];
  const kind = one(o.kind, KINDS, 'city');
  const destination = s(o.destination, 80);
  return {
    understood: o.understood === true && destination.length >= 2, destination, region: s(o.region, 80), country_code: s(o.country_code, 2).toUpperCase(),
    title: s(o.title, 80) || destination, kind: kind === 'trek' && !route.length ? 'city' : kind,
    days: Math.round(n(o.days, 0, 30)), people: Math.round(n(o.people, 0, 20)), month: Math.round(n(o.month, 0, 12)),
    party: one(o.party, ['', 'solo', 'couple', 'friends', 'family'] as const, ''), start: /^\d{4}-\d{2}-\d{2}$/.test(s(o.start, 10)) ? s(o.start, 10) : '',
    food: one(o.food, ['', 'veg', 'jain', 'nonveg', 'any'] as const, ''), budget: one(o.budget, ['', 'backpacker', 'comfortable', 'treat'] as const, ''),
    places: (Array.isArray(o.places) ? o.places : []).slice(0, 15).flatMap((x) => { const p = (x ?? {}) as Record<string, unknown>; const title = s(p.title, 80); return title.length >= 3 ? [{ title, quote: s(p.quote, 160) }] : []; }),
    note: s(o.note, 300), question: s(o.question, 200), reply: s(o.reply, 300),
    best_months: [...new Set((Array.isArray(o.best_months) ? o.best_months : []).map((m) => Math.round(Number(m))).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b),
    trek: route.length && t ? { summit: s(t.summit, 80), summit_altitude: Math.round(n(t.summit_altitude, 0, 8900)), typical_days: Math.round(n(t.typical_days, 0, 40)),
      permits: (Array.isArray(t.permits) ? t.permits : []).map((p) => s(p, 100)).filter(Boolean).slice(0, 6), stages: route } : null,
  };
}

/** A stage as people say it: "Yuksom → Sachen", or "Rest day at Dzongri" when it stays put. */
export const stageTitle = (st: Pick<BriefStage, 'from' | 'to'>) => (st.from.toLowerCase() === st.to.toLowerCase() ? `Rest day at ${st.to}` : `${st.from} → ${st.to}`);

/** "8 km · 5 h · 1,780 → 2,200 m". */
export function stageFacts(st: BriefStage, unit: 'metric' | 'imperial' = 'metric'): string {
  const alt = (m: number) => (unit === 'imperial' ? `${Math.round(m * 3.281).toLocaleString('en-US')} ft` : `${m.toLocaleString('en-US')} m`);
  const km = unit === 'imperial' ? `${Math.round(st.distance_km * 0.621 * 10) / 10} mi` : `${st.distance_km} km`;
  const climb = st.start_altitude && st.end_altitude && st.start_altitude !== st.end_altitude
    ? `${alt(st.start_altitude).replace(/ (m|ft)$/, '')} → ${alt(st.end_altitude)}` : st.end_altitude ? alt(st.end_altitude) : '';
  return [st.distance_km ? km : '', st.hours ? `${st.hours} h` : '', climb].filter(Boolean).join(' · ');
}

/** The highest point the route reaches: its summit when given, else the highest camp. */
export const highPoint = (t: Trek) => Math.max(t.summit_altitude, ...t.stages.map((x) => x.end_altitude));

/** What changed between two versions of a route, in words. */
export function routeChanges(before: Trek, after: Trek): string[] {
  const out: string[] = [];
  if (before.stages.length !== after.stages.length) out.push(`${after.stages.length} days (was ${before.stages.length})`);
  if (after.summit && (after.summit !== before.summit || after.summit_altitude !== before.summit_altitude)) out.push(`Reaches ${after.summit}${after.summit_altitude ? ` (${after.summit_altitude.toLocaleString('en-US')} m)` : ''}`);
  const camps = (t: Trek) => new Set(t.stages.flatMap((x) => [x.from, x.to]).map((c) => c.toLowerCase()));
  const had = camps(before), now = camps(after);
  const added = [...new Set(after.stages.flatMap((x) => [x.from, x.to]))].filter((c) => !had.has(c.toLowerCase()));
  const dropped = [...new Set(before.stages.flatMap((x) => [x.from, x.to]))].filter((c) => !now.has(c.toLowerCase()));
  if (added.length) out.push(`Now via ${added.join(', ')}`);
  if (dropped.length) out.push(`No longer via ${dropped.join(', ')}`);
  const rest = (t: Trek) => t.stages.filter((x) => x.from.toLowerCase() === x.to.toLowerCase()).length;
  if (rest(after) !== rest(before)) out.push(`${rest(after)} rest ${rest(after) === 1 ? 'day' : 'days'} (was ${rest(before)})`);
  if (!out.length && JSON.stringify(before.stages) !== JSON.stringify(after.stages)) out.push('Adjusted the daily stages');
  return out;
}

/** What to offer next on a trek, from the route. */
export function trekSuggestions(t: Trek): { label: string; message: string }[] {
  const out: { label: string; message: string }[] = [];
  const rests = t.stages.filter((x) => x.from.toLowerCase() === x.to.toLowerCase()).length;
  if (highPoint(t) >= 3500 && !rests) out.push({ label: 'Add a rest day', message: 'Add an acclimatisation rest day where it is safest' });
  if (t.typical_days > t.stages.length) out.push({ label: `The full ${t.typical_days}-day route`, message: `Plan the full standard route in ${t.typical_days} days` });
  out.push({ label: 'A buffer day', message: 'Add a buffer day at the end for bad weather' });
  if (t.stages.length > 3) out.push({ label: 'One day shorter', message: 'Make it one day shorter, safely' });
  return out.slice(0, 4);
}

/**
 * Days that climb fast at altitude, worked out from the route itself (not left to AI): once already high (2,500 m or
 * more), sleeping over 500 m higher than the night before, above 3,000 m, raises the risk of altitude sickness.
 */
export function altitudeWarnings(t: Trek): string[] {
  const out: string[] = [];
  t.stages.forEach((st, i) => {
    const gain = st.end_altitude - st.start_altitude;
    // Climbing from a valley town to a first camp is normal; it's gaining fast once already high that's risky.
    if (st.end_altitude > 3000 && st.start_altitude >= 2500 && gain > 500) {
      out.push(`Day ${i + 1} climbs ${gain.toLocaleString('en-US')} m to sleep at ${st.end_altitude.toLocaleString('en-US')} m: go slowly, drink plenty, and descend if you get a bad headache or feel sick.`);
    }
  });
  return out.slice(0, 3);
}

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "April to May and September to November", from [4, 5, 9, 10, 11]. */
export function monthsInWords(months: number[]): string {
  const runs: number[][] = [];
  for (const m of [...months].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1];
    if (last && m === last[last.length - 1] + 1) last.push(m); else runs.push([m]);
  }
  const words = runs.map((r) => (r.length === 1 ? MONTH[r[0] - 1] : `${MONTH[r[0] - 1]} to ${MONTH[r[r.length - 1] - 1]}`));
  return words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/**
 * A start date in season: the first Saturday of the next good month that's at least three weeks away (or of the
 * month they named, when it's a good one). Null when the season isn't known.
 */
export function seasonStart(best: number[], today: string, named = 0): { date: string; why: string } | null {
  if (!best.length) return null;
  const earliest = new Date(Date.parse(`${today}T12:00:00Z`) + 21 * 86400000);
  for (let k = 0; k < 24; k++) {
    const first = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth() + k, 1, 12));
    const m = first.getUTCMonth() + 1;
    if (!best.includes(m) || (named && m !== named && best.includes(named))) continue;
    // The first Saturday of the month, or the first one after three weeks from now when that's later.
    const d = new Date(Math.max(first.getTime(), earliest.getTime()));
    while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCMonth() + 1 !== m) continue;
    return { date: d.toISOString().slice(0, 10), why: `It’s best done in ${monthsInWords(best)}.` };
  }
  return null;
}
