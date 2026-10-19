/**
 * Plan mode's engine: confirmed places plus the person's answers become days. The AI reads and suggests; this
 * schedules, so the plan always respects geography and the clock: places close together share a day, forts and
 * viewpoints land at the real sunset for that place and date, one sunset per day, temples in the morning, clubs at
 * night, a lunch break near where you are, lighter arrival and departure days, and the pace you chose. Every stop
 * says why it's there. Pure functions, no network.
 */
import type { Slot, Source } from './reels';

export type Kind =
  | 'beach' | 'fort' | 'heritage' | 'temple' | 'church' | 'museum' | 'viewpoint' | 'market' | 'nightmarket' | 'cafe' | 'restaurant'
  | 'bar' | 'club' | 'nature' | 'waterfall' | 'activity' | 'shopping' | 'area' | 'other';
export type Priority = 'must' | 'maybe' | 'skip';
export type Pace = 'relaxed' | 'balanced' | 'packed';
export type Party = 'solo' | 'couple' | 'friends' | 'family';
export type Food = 'veg' | 'jain' | 'nonveg' | 'any';
export type Budget = 'backpacker' | 'comfortable' | 'treat';
export type DayPart = 'morning' | 'afternoon' | 'evening';

export type Evidence = { reelId: string; quote: string; source: Source };

/** A place the person kept, checked on the map (when it could be found). */
export type PlanPlace = {
  id: string;
  title: string;
  lat?: number;
  lng?: number;
  /** The neighbourhood or town it's in ("Anjuna", "Bardez"), for day titles and meal breaks. */
  area: string;
  kind: Kind;
  pick: Priority;
  /** A time of day the reel points to ("sunset at the fort"). */
  slot?: Slot;
  evidence: Evidence[];
  note?: string;
  /** Pinned to a day by the person (0-based); the engine works around it. */
  day?: number;
};

export type Answers = {
  destination: string;
  start: string;
  days: number;
  party: Party;
  people: number;
  pace: Pace;
  food: Food;
  budget: Budget;
  arrive: DayPart;
  leave: DayPart;
  /** Maybes: fit them in where there's room, or leave them for the group to vote on. */
  maybes: 'fit' | 'group';
};

export type Category = 'Explore' | 'Food & drink' | 'Travel' | 'Stay' | 'Event' | 'Other';

export type Stop = {
  id: string;
  time: string;
  title: string;
  /** Where, when it adds something to the title. */
  place: string;
  placeId?: string;
  category: Category;
  kind: Kind | 'meal' | 'arrive' | 'leave';
  /** Why it's here, in plain words. */
  why: string;
  minutes: number;
  /** Minutes of travel from the stop before. */
  travel?: number;
  lat?: number;
  lng?: number;
};

export type PlanDay = { date: string; title: string; stops: Stop[] };
export type Plan = { days: PlanDay[]; unplaced: PlanPlace[]; overfull: number[] };

/* ------------------------------------------------------------------ dates and distance */

const pad = (n: number) => String(n).padStart(2, '0');
export const isoAdd = (iso: string, days: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const hhmm = (m: number) => `${pad(Math.floor(((m % 1440) + 1440) % 1440 / 60))}:${pad(Math.round(((m % 1440) + 1440) % 1440 % 60))}`;
const round5 = (m: number) => Math.round(m / 5) * 5;

export function km(a: { lat?: number; lng?: number }, b: { lat?: number; lng?: number }): number | null {
  if (a.lat === undefined || a.lng === undefined || b.lat === undefined || b.lng === undefined) return null;
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Rough door-to-door minutes by road in a town: straight-line distance × 1.4 at 25 km/h, at least 10. */
export function travelMinutes(a: { lat?: number; lng?: number }, b: { lat?: number; lng?: number }): number | null {
  const d = km(a, b);
  return d === null ? null : Math.max(10, round5((d * 1.4 / 25) * 60));
}

/**
 * Sunrise and sunset (local minutes after midnight) at a place on a date, NOAA's approximation (within a few
 * minutes). `tzMinutes`: the destination's offset from UTC.
 */
export function sunTimes(lat: number, lng: number, iso: string, tzMinutes: number): { sunrise: number; sunset: number } | null {
  const d = new Date(`${iso}T12:00:00Z`);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const n = Math.floor((d.getTime() - start) / 86400000);
  const g = (2 * Math.PI / 365) * (n - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const phi = (lat * Math.PI) / 180;
  const cosH = (Math.cos((90.833 * Math.PI) / 180) / (Math.cos(phi) * Math.cos(decl))) - Math.tan(phi) * Math.tan(decl);
  if (cosH < -1 || cosH > 1) return null; // Midnight sun or polar night.
  const ha = (Math.acos(cosH) * 180) / Math.PI;
  const noon = 720 - 4 * lng - eq + tzMinutes;
  return { sunrise: Math.round(noon - 4 * ha), sunset: Math.round(noon + 4 * ha) };
}

/* ------------------------------------------------------------------ what a place is */

/** A place's kind from its name and, when the map knows it, its OpenStreetMap tag ("historic=castle"). */
export function kindOf(title: string, osm = ''): Kind {
  const t = `${title} ${osm}`.toLowerCase();
  if (/\bnight ?market|saturday night/.test(t)) return 'nightmarket';
  if (/\b(club|nightclub)\b|amenity=nightclub/.test(t)) return 'club';
  if (/\b(bar|pub|brewery|lounge|tavern|rooftop)\b|amenity=(bar|pub|biergarten)/.test(t)) return 'bar';
  if (/\b(caf[eé]|coffee|bakery|patisserie|brunch)\b|amenity=cafe|shop=bakery/.test(t)) return 'cafe';
  if (/\b(restaurant|kitchen|dhaba|thali|bistro|diner|eatery|shack|food court|biryani)\b|amenity=(restaurant|fast_food|food_court)/.test(t)) return 'restaurant';
  if (/\b(fort|fortress|castle|citadel|qila|killa)\b|historic=(castle|fort)/.test(t)) return 'fort';
  if (/\b(beach|cove|sands?)\b|natural=beach/.test(t)) return 'beach';
  if (/\b(view ?point|viewpoint|lookout|sunset point|point)\b|tourism=viewpoint/.test(t)) return 'viewpoint';
  if (/\b(waterfall|falls)\b|waterway=waterfall/.test(t)) return 'waterfall';
  // "Jag Mandir" and "Sheesh Mahal" are palaces, not temples, whatever the name's words say.
  if (/\b(jag mandir|mahal|palace|haveli)\b/.test(t)) return 'heritage';
  if (/\b(temple|wat|mandir|shrine|gurudwara|stupa|pagoda|monastery|gompa|mosque|masjid|dargah)\b|amenity=place_of_worship/.test(t)) return /\b(church|chapel|cathedral|basilica)\b/.test(t) ? 'church' : 'temple';
  if (/\b(church|chapel|cathedral|basilica)\b/.test(t)) return 'church';
  if (/\b(museum|gallery|exhibition|aquarium)\b|tourism=(museum|gallery|aquarium)/.test(t)) return 'museum';
  if (/\b(market|bazaar|souk|mandi)\b|amenity=marketplace/.test(t)) return 'market';
  if (/\b(mall|shopping|outlet|plaza)\b|shop=mall/.test(t)) return 'shopping';
  if (/\b(lake|forest|park|garden|sanctuary|reserve|hill|hills|peak|valley|island|mangroves?|cave|caves|trail|trek)\b|natural=|leisure=(park|nature_reserve|garden)|boundary=national_park/.test(t)) return 'nature';
  if (/\b(cruise|ferry|boat|kayak|rafting|scuba|snorkel|dive|parasail|water ?sports|safari|zipline|paraglid|spa|cooking class|tour)\b/.test(t)) return 'activity';
  if (/\b(ruins|palace|heritage|monument|memorial|tomb|old town|haveli|stepwell|lighthouse|gate|tower)\b|historic=|tourism=(attraction|artwork)/.test(t)) return 'heritage';
  if (/place=(village|town|suburb|neighbourhood|quarter|hamlet|locality)/.test(t)) return 'area';
  return 'other';
}

export const KIND_LABEL: Record<Kind, string> = {
  beach: 'Beach', fort: 'Fort', heritage: 'Heritage', temple: 'Temple', church: 'Church', museum: 'Museum', viewpoint: 'Viewpoint', market: 'Market',
  nightmarket: 'Night market', cafe: 'Café', restaurant: 'Food', bar: 'Bar', club: 'Club', nature: 'Nature', waterfall: 'Waterfall', activity: 'Activity',
  shopping: 'Shopping', area: 'Neighbourhood', other: 'Place',
};

const MINUTES: Record<Kind, number> = {
  beach: 150, fort: 75, heritage: 90, temple: 60, church: 45, museum: 120, viewpoint: 45, market: 90, nightmarket: 120, cafe: 75,
  restaurant: 90, bar: 120, club: 180, nature: 150, waterfall: 210, activity: 150, shopping: 90, area: 120, other: 90,
};

/** When a kind of place is best, unless the reel says otherwise. */
function slotFor(p: PlanPlace): Slot {
  if (p.slot) return p.slot;
  switch (p.kind) {
    case 'temple': case 'church': case 'museum': case 'heritage': case 'market': case 'waterfall': case 'nature': case 'cafe': return 'morning';
    case 'bar': case 'club': case 'nightmarket': case 'restaurant': return 'night';
    case 'viewpoint': case 'fort': return 'sunset';
    default: return 'afternoon';
  }
}
const SLOT_ORDER: Record<Slot, number> = { sunrise: 0, morning: 1, afternoon: 2, sunset: 3, night: 4 };
/** Places to eat or drink: a "sunset" one is dinner or drinks as the sun goes down, after the viewpoint, not instead of it. */
const FOOD_KINDS: Kind[] = ['restaurant', 'cafe', 'bar'];
/** A place that has to be somewhere at sunset (a fort, a viewpoint, a beach), one per day. */
const sunsetSpot = (p: PlanPlace) => slotFor(p) === 'sunset' && !FOOD_KINDS.includes(p.kind);

const CATEGORY: Record<Kind, Category> = {
  beach: 'Explore', fort: 'Explore', heritage: 'Explore', temple: 'Explore', church: 'Explore', museum: 'Explore', viewpoint: 'Explore', market: 'Explore',
  nightmarket: 'Explore', cafe: 'Food & drink', restaurant: 'Food & drink', bar: 'Food & drink', club: 'Event', nature: 'Explore', waterfall: 'Explore',
  activity: 'Event', shopping: 'Explore', area: 'Explore', other: 'Explore',
};

/* ------------------------------------------------------------------ suggestions */

/** Main stops a full day holds at each pace (meals aren't counted). */
export const PER_DAY: Record<Pace, number> = { relaxed: 3, balanced: 4, packed: 6 };

/** How many stops a day can hold: arrival and departure days are partial. */
export function capacity(day: number, total: number, a: Pick<Answers, 'pace' | 'arrive' | 'leave'>): number {
  const full = PER_DAY[a.pace];
  if (total === 1) return Math.max(1, full - (a.arrive === 'morning' ? 1 : a.arrive === 'afternoon' ? 2 : 3));
  if (day === 0) return a.arrive === 'morning' ? full - 1 : a.arrive === 'afternoon' ? Math.max(1, full - 2) : 1;
  if (day === total - 1) return a.leave === 'evening' ? full - 1 : a.leave === 'afternoon' ? Math.max(1, Math.floor(full / 2)) : 0;
  return full;
}

/** A trip length that fits the places at the chosen pace: e.g. 9 places, relaxed → 4 days. */
export function suggestDays(places: number, pace: Pace, arrive: DayPart = 'afternoon', leave: DayPart = 'afternoon'): number {
  for (let days = 2; days <= 14; days++) {
    let room = 0;
    for (let d = 0; d < days; d++) room += capacity(d, days, { pace, arrive, leave });
    if (room >= places) return days;
  }
  return 14;
}

export function suggestPace(party: Party | undefined, people: number): Pace {
  if (party === 'family' || party === 'couple') return 'relaxed';
  if (party === 'friends' && people >= 5) return 'balanced';
  return 'balanced';
}

/** Whether a place should start as a must-do: clearly named, found on the map, or seen in more than one reel. */
export function defaultPick(confidence: number, located: boolean, reels: number): Priority {
  if (reels > 1 && located) return 'must';
  if (confidence >= 0.7 && located) return 'must';
  return 'maybe';
}

/* ------------------------------------------------------------------ grouping */

const centroid = (ps: PlanPlace[]): { lat?: number; lng?: number } => {
  const located = ps.filter((p) => p.lat !== undefined && p.lng !== undefined);
  if (!located.length) return {};
  return { lat: located.reduce((a, p) => a + p.lat!, 0) / located.length, lng: located.reduce((a, p) => a + p.lng!, 0) / located.length };
};

/** Places closer than this (straight line) can share a day without much driving. */
const NEAR_KM = 15;

/** Groups of places that are all within NEAR_KM of each other (complete linkage). Places the map couldn't find are each their own group. */
function nearbyGroups(places: PlanPlace[]): PlanPlace[][] {
  const located = places.filter((p) => p.lat !== undefined && p.lng !== undefined);
  let groups = located.map((p) => [p]);
  for (;;) {
    let best: [number, number, number] | null = null;
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      let worst = 0;
      for (const p of groups[i]) for (const q of groups[j]) worst = Math.max(worst, km(p, q) ?? Infinity);
      if (worst <= NEAR_KM && (!best || worst < best[2])) best = [i, j, worst];
    }
    if (!best) break;
    groups[best[0]] = [...groups[best[0]], ...groups[best[1]]];
    groups = groups.filter((_, k) => k !== best![1]);
  }
  return [...groups, ...places.filter((p) => p.lat === undefined || p.lng === undefined).map((p) => [p])];
}

/* ------------------------------------------------------------------ scheduling */

const MEAL_WHY = (food: Food) => (food === 'veg' ? 'A break near your plans. Look for pure-veg places.' : food === 'jain' ? 'A break near your plans. Jain food: ask for no onion or garlic.' : 'A break near your plans.');

/** Whether an area is just the destination city ("Bangkok", "Jaipur Municipal Corporation" on a Jaipur trip): not worth naming. */
export function isTheCity(area: string, destination: string): boolean {
  const a = area.trim().toLowerCase(), city = destination.split(',')[0].trim().toLowerCase();
  return !!a && !!city && (a === city || a.startsWith(`${city} `) || city.startsWith(`${a} `));
}

function dayTitle(places: PlanPlace[], index: number, total: number, destination: string): string {
  const where = destination.split(',')[0];
  if (!places.length) return index === 0 ? `Arrive in ${where}` : index === total - 1 ? 'Last morning' : 'A free day';
  // Most places in one area: name the day for it ("Old Goa heritage", "Beaches of Calangute").
  const counts = new Map<string, PlanPlace[]>();
  for (const p of places) if (p.area && !isTheCity(p.area, destination)) counts.set(p.area, [...(counts.get(p.area) ?? []), p]);
  const [area, main] = [...counts.entries()].sort((x, y) => y[1].length - x[1].length)[0] ?? ['', []];
  let label: string;
  if (main.length >= 2 && main.length * 2 >= places.length) {
    const kinds = main.map((p) => p.kind);
    label = kinds.filter((k) => k === 'beach').length >= 2 ? `Beaches of ${area}`
      : main.some((p) => slotFor(p) === 'sunset') && kinds.some((k) => k === 'fort' || k === 'viewpoint') ? `${area} at sunset`
      : kinds.filter((k) => ['heritage', 'church', 'temple', 'museum'].includes(k)).length >= 2 ? `${area} heritage`
      : kinds.some((k) => k === 'club' || k === 'bar' || k === 'nightmarket') ? `${area} after dark` : area;
    const others = places.length - main.length;
    if (others) label += others === 1 ? ` · ${places.find((p) => !main.includes(p))!.title}` : ` and ${others} more`;
  } else {
    // Otherwise the places themselves, in the order of the day: "Baga Beach, Chapora Fort & Gunpowder".
    const names = order(places).map((p) => p.title);
    label = names.length <= 3 ? names.join(', ').replace(/, ([^,]*)$/, ' & $1') : `${names.slice(0, 2).join(', ')} & ${names.length - 2} more`;
  }
  return `${index === 0 ? 'Arrive · ' : ''}${label}`.slice(0, 90);
}

/** Orders a day's places by time of day, nearest-first within each part of the day. */
function order(places: PlanPlace[]): PlanPlace[] {
  const out: PlanPlace[] = [];
  for (const slot of Object.keys(SLOT_ORDER) as Slot[]) {
    // At sunset, the viewpoint comes before the sunset dinner.
    const left = places.filter((p) => slotFor(p) === slot).sort((a, b) => Number(FOOD_KINDS.includes(a.kind)) - Number(FOOD_KINDS.includes(b.kind)));
    while (left.length) {
      const prev = out[out.length - 1];
      let bi = 0;
      if (prev && !(slot === 'sunset' && left.some((p) => !FOOD_KINDS.includes(p.kind)) && left.some((p) => FOOD_KINDS.includes(p.kind)))) { let bd = Infinity; left.forEach((p, i) => { const d = km(prev, p) ?? 50; if (d < bd) { bd = d; bi = i; } }); }
      out.push(left.splice(bi, 1)[0]);
    }
  }
  return out;
}

export type Sun = (lat: number, lng: number, iso: string) => { sunrise: number; sunset: number } | null;
const at = (p: { lat?: number; lng?: number }, fallback: { lat?: number; lng?: number }) => (p.lat !== undefined && p.lng !== undefined ? p : fallback);

/** When a place has to start: sunset spots before the sun goes down, nights out late, afternoons after lunch. */
function earliest(p: PlanPlace, date: string, sun: Sun, mid: { lat?: number; lng?: number }): number {
  const pos = at(p, mid);
  const s = pos.lat !== undefined && pos.lng !== undefined ? sun(pos.lat, pos.lng, date) : null;
  switch (slotFor(p)) {
    case 'sunset': return (s?.sunset ?? 18 * 60) - (p.kind === 'beach' ? 90 : FOOD_KINDS.includes(p.kind) ? 15 : 50);
    case 'sunrise': return (s?.sunrise ?? 6 * 60 + 15) - 20;
    case 'night': return p.kind === 'club' ? 22 * 60 : p.kind === 'restaurant' ? 20 * 60 : p.kind === 'nightmarket' || p.kind === 'market' ? 19 * 60 : 20 * 60 + 30;
    case 'afternoon': return 14 * 60 + 30;
    default: return 0;
  }
}

/** Evening stops that are dinner in themselves. */
const EVENING_FOOD: Kind[] = ['restaurant', 'nightmarket', 'market'];

/** Times for a sequence of places, with travel, a lunch break and dinner, from `from` minutes. `loose`: places whose best time of day is ignored (moved by hand to a day that can't have it). */
function simulate(seq: PlanPlace[], date: string, a: Answers, from: number, until: number, sun: Sun, mid: { lat?: number; lng?: number }, loose: Set<string> = new Set()): Stop[] {
  const stops: Stop[] = [];
  let t = from;
  let prev: PlanPlace | null = null;
  let lunched = from >= 15 * 60;
  // Dinner happens once: at an evening food stop (a night market, a street-food market, a restaurant), before a late
  // stop when there's room, or after the last stop, but never later than half past nine.
  let dined = false;
  const meal = (title: 'Lunch' | 'Dinner', when: number, near: PlanPlace | null) => {
    // "Lunch near Anjuna", but not "Lunch near Bangkok" on a Bangkok trip.
    const area = near?.area && !isTheCity(near.area, a.destination) && !a.destination.toLowerCase().includes(near.area.toLowerCase()) ? near.area : '';
    stops.push({ id: `meal-${date}-${title}`, time: hhmm(round5(when)), title: `${title}${area ? ` near ${area}` : ''}`, place: '', category: 'Food & drink', kind: 'meal', why: MEAL_WHY(a.food), minutes: title === 'Lunch' ? 60 : 90, lat: near?.lat, lng: near?.lng });
  };
  for (const p of seq) {
    const minutes = MINUTES[p.kind];
    const travel = prev ? travelMinutes(prev, p) ?? 20 : 0;
    // An "afternoon" place (a beach, a market) that would leave the morning empty starts the day instead.
    const opener = !prev && slotFor(p) === 'afternoon' && t < 12 * 60 && t + minutes <= 13 * 60 + 30;
    // A dinner place on a day that ends early becomes lunch; anything else just goes as early as it can.
    const looseStart = (p.kind === 'restaurant' || p.kind === 'bar') ? Math.max(t + travel, 12 * 60 + 30) : t + travel;
    const at0 = () => (loose.has(p.id) ? looseStart : opener ? t : Math.max(t + travel, earliest(p, date, sun, mid)));
    let start = at0();
    const food = p.kind === 'cafe' || p.kind === 'restaurant';
    // Lunch once, around one o'clock: before a stop that starts after it or runs across it.
    if (!lunched && !food && (start >= 13 * 60 || start + minutes > 14 * 60) && t <= 14 * 60 + 30) {
      const when = Math.max(t, 13 * 60);
      meal('Lunch', when, prev ?? p);
      lunched = true;
      t = round5(when) + 60;
      start = loose.has(p.id) ? Math.max(t + travel, looseStart) : opener ? t : Math.max(t + travel, earliest(p, date, sun, mid));
    }
    if (food && start >= 12 * 60 && start <= 15 * 60) lunched = true;
    if (!dined && start >= 18 * 60 && EVENING_FOOD.includes(p.kind)) dined = true;
    // A late stop that isn't food, with a free evening before it: dinner first, near where the day has been.
    if (!dined && start >= 19 * 60 + 30) {
      const when = Math.max(t + (prev ? 15 : 0), 18 * 60 + 30);
      if (round5(when) + 90 + travel <= start) { meal('Dinner', when, prev ?? p); dined = true; }
    }
    stops.push({ id: p.id, time: hhmm(round5(start)), title: p.title, place: p.area, placeId: p.id, category: CATEGORY[p.kind], kind: p.kind, why: '', minutes, travel: prev ? travel : undefined, lat: p.lat, lng: p.lng });
    t = round5(start) + minutes;
    prev = p;
  }
  const last = stops[stops.length - 1];
  const dinnerAt = Math.max(t + 20, 19 * 60 + 30);
  if (!dined && last && t >= 17 * 60 && t + 20 <= until && dinnerAt <= 21 * 60 + 30 && !['restaurant', 'bar', 'club', 'nightmarket', 'meal'].includes(last.kind)) meal('Dinner', dinnerAt, prev);
  return stops;
}

/**
 * One day's timetable. A sunset place is an anchor: a flexible stop that would make it late moves to after it
 * (or out, if the day really can't hold it). Places that would run past `until` (the time you leave) come back as
 * `spill`.
 */
function scheduleDay(places: PlanPlace[], date: string, a: Answers, from: number, until: number, sun: Sun, mid: { lat?: number; lng?: number }): { stops: Stop[]; spill: PlanPlace[] } {
  let seq = order(places);
  const spill: PlanPlace[] = [];
  const loose = new Set<string>();
  for (let guard = 0; guard < 10; guard++) {
    const stops = simulate(seq, date, a, from, until, sun, mid, loose);
    const anchor = seq.find(sunsetSpot);
    if (anchor) {
      const want = earliest(anchor, date, sun, mid);
      const got = toMin(stops.find((s) => s.placeId === anchor.id)!.time);
      if (got > want + 15) {
        const i = seq.indexOf(anchor);
        const flex = seq.slice(0, i).filter((p) => slotFor(p) === 'afternoon' || slotFor(p) === 'morning');
        const move = flex.pop();
        if (move) { seq = [...seq.filter((p) => p !== move)]; seq.splice(seq.indexOf(anchor) + 1, 0, move); continue; }
      }
    }
    const late = seq.find((p) => { const s = stops.find((x) => x.placeId === p.id)!; return toMin(s.time) + s.minutes > until && !(p.day !== undefined && loose.has(p.id)); });
    if (late) {
      // Moved here by the person: it stays, at a time the day allows. Anything else moves to a day with room.
      if (late.day !== undefined) { loose.add(late.id); seq = [...seq.filter((p) => p !== late)]; seq.splice(0, 0, late); seq = order(seq).sort((x, y) => Number(loose.has(y.id)) - Number(loose.has(x.id))); continue; }
      seq = seq.filter((p) => p !== late); spill.push(late); continue;
    }
    return { stops, spill };
  }
  return { stops: simulate(seq, date, a, from, until, sun, mid, loose), spill };
}

/**
 * Builds the days. Must-dos always go in (a day can end up over-full: it's flagged, not dropped); maybes fill the
 * room that's left when `maybes` is 'fit', and otherwise wait for the group's vote.
 */
export function buildPlan(all: PlanPlace[], a: Answers, opts: { sun?: Sun; busy?: number[] } = {}): Plan {
  const sun: Sun = opts.sun ?? (() => null);
  const total = Math.max(1, Math.min(a.days, 30));
  // Plans people added by hand take room on their day.
  const caps = Array.from({ length: total }, (_, d) => Math.max(0, capacity(d, total, a) - (opts.busy?.[d] ?? 0)));
  const room = caps.reduce((x, c) => x + c, 0);
  const musts = all.filter((p) => p.pick === 'must');
  const maybes = all.filter((p) => p.pick === 'maybe');
  const chosen = [...musts, ...(a.maybes === 'fit' ? maybes.slice(0, Math.max(0, room - musts.length)) : [])].map((p) => ({ ...p }));
  const unplaced: PlanPlace[] = all.filter((p) => p.pick !== 'skip' && !chosen.some((c) => c.id === p.id));

  // Places the person pinned to a day stay there. The rest are grouped by real distance (places a short ride apart
  // share a day), then the groups are packed into days: a group goes whole to a day that can hold it, empty days
  // and days nearby first; a group too big for one day is split into nearby halves.
  const byDay: PlanPlace[][] = caps.map(() => []);
  const pinned = chosen.filter((p) => p.day !== undefined && p.day >= 0 && p.day < total);
  for (const p of pinned) byDay[p.day!].push(p);
  const rest = chosen.filter((p) => !pinned.includes(p));
  const freeOf = (d: number) => caps[d] - byDay[d].length;
  const placeGroup = (g: PlanPlace[]) => {
    let left = [...g].sort((x, y) => (x.pick === y.pick ? 0 : x.pick === 'must' ? -1 : 1));
    while (left.length) {
      const c = centroid(left);
      const options = caps.map((_, i) => i).filter((i) => freeOf(i) > 0).map((i) => {
        const near = !byDay[i].length || (km(c, centroid(byDay[i])) ?? 0) <= NEAR_KM;
        return { i, fits: freeOf(i) >= left.length, near, free: freeOf(i) };
      }).sort((x, y) => Number(y.fits && y.near) - Number(x.fits && x.near) || Number(y.near) - Number(x.near) || Number(y.fits) - Number(x.fits) || y.free - x.free || x.i - y.i);
      const best = options[0];
      if (!best) {
        // No room anywhere: must-dos go to the nearest day (flagged as full), maybes wait for the vote.
        for (const p of left) {
          if (p.pick === 'maybe') { unplaced.push(all.find((x) => x.id === p.id)!); continue; }
          const near = caps.map((_, i) => ({ i, d: km(p, centroid(byDay[i])) ?? 999 })).filter((x) => caps[x.i] > 0).sort((x, y) => x.d - y.d)[0];
          byDay[near?.i ?? 0].push(p);
        }
        return;
      }
      // Take the places closest together that fit, starting from the one farthest from the rest.
      const take: PlanPlace[] = [];
      const pool = [...left];
      const far = pool.map((p, i) => ({ i, d: pool.reduce((t, q) => t + (km(p, q) ?? 0), 0) })).sort((x, y) => y.d - x.d)[0]?.i ?? 0;
      take.push(pool.splice(far, 1)[0]);
      while (take.length < best.free && pool.length) {
        const m = centroid(take);
        pool.sort((x, y) => (km(x, m) ?? 50) - (km(y, m) ?? 50));
        take.push(pool.shift()!);
      }
      byDay[best.i].push(...take);
      left = left.filter((p) => !take.includes(p));
    }
  };
  // Groups that fit in a day go first (so they stay whole), biggest first; groups too big for any day are split last.
  const roomiest = Math.max(0, ...caps.map((_, i) => freeOf(i)));
  for (const g of nearbyGroups(rest).sort((x, y) => Number(x.length > roomiest) - Number(y.length > roomiest) || y.length - x.length)) placeGroup(g);

  // Sunsets: one a day, and only on days you're there in the evening (not after you've left, not before you've landed).
  const isSunset = sunsetSpot;
  const evening = (d: number) => (d === 0 ? a.arrive !== 'evening' : true) && (d === total - 1 && total > 1 ? a.leave === 'evening' : true);
  for (let d = 0; d < total; d++) {
    const limit = evening(d) ? 1 : 0;
    while (byDay[d].filter(isSunset).length > limit) {
      const extra = byDay[d].filter(isSunset).sort((x, y) => (x.day === undefined ? 0 : 1) - (y.day === undefined ? 0 : 1)).reverse().pop()!;
      const other = extra.day !== undefined ? -1 : byDay.findIndex((ps, i) => i !== d && caps[i] > 0 && evening(i) && !ps.some(isSunset));
      if (other < 0) { extra.slot = 'afternoon'; extra.note = extra.note ?? 'Also lovely at sunset: swap days to catch it.'; continue; }
      byDay[d] = byDay[d].filter((p) => p !== extra);
      byDay[other].push(extra);
      // Keep both days the same size: something without a sunset comes back the other way.
      const swap = byDay[other].filter((p) => !isSunset(p) && p.day === undefined).sort((x, y) => (km(x, centroid(byDay[d])) ?? 99) - (km(y, centroid(byDay[d])) ?? 99))[0];
      if (swap && byDay[other].length > caps[other]) { byDay[other] = byDay[other].filter((p) => p !== swap); byDay[d].push(swap); }
    }
  }

  const mid = centroid(all);
  const days: PlanDay[] = [];
  const overfull: number[] = [];
  const spilled: PlanPlace[] = [];
  const window = (d: number) => ({
    from: d === 0 ? (a.arrive === 'morning' ? 11 * 60 : a.arrive === 'afternoon' ? 15 * 60 + 30 : 19 * 60) : a.pace === 'packed' ? 8 * 60 + 30 : a.pace === 'balanced' ? 9 * 60 + 30 : 10 * 60,
    until: d === total - 1 && total > 1 ? (a.leave === 'morning' ? 11 * 60 : a.leave === 'afternoon' ? 15 * 60 : 22 * 60) : 23 * 60 + 30,
  });
  const timed = byDay.map((places, d) => { const w = window(d); const r = scheduleDay(places, isoAdd(a.start, d), a, w.from, w.until, sun, mid); spilled.push(...r.spill); return r.stops; });
  // What didn't fit its day tries the day with the most room left, else waits.
  for (const p of spilled) {
    const free = caps.map((cap, i) => ({ i, free: cap - timed[i].filter((s) => s.placeId).length })).filter((x) => x.free > 0 && x.i !== total - 1).sort((x, y) => y.free - x.free)[0];
    if (!free) { unplaced.push(all.find((x) => x.id === p.id)!); continue; }
    byDay[free.i].push(p);
    byDay[byDay.findIndex((ps) => ps.includes(p) && ps !== byDay[free.i])] = byDay[byDay.findIndex((ps) => ps.includes(p) && ps !== byDay[free.i])]?.filter((x) => x !== p) ?? [];
    const w = window(free.i);
    timed[free.i] = scheduleDay(byDay[free.i], isoAdd(a.start, free.i), a, w.from, w.until, sun, mid).stops;
  }
  for (let d = 0; d < total; d++) {
    const date = isoAdd(a.start, d);
    const w = window(d);
    const stops = timed[d];
    const placed = byDay[d].filter((p) => stops.some((s) => s.placeId === p.id));
    if (placed.length > caps[d] && caps[d] > 0) overfull.push(d);
    // A first or last day someone already planned by hand keeps their plan as it is: no arrival or departure stop
    // that might contradict it.
    const handPlanned = (opts.busy?.[d] ?? 0) > 0;
    if (d === 0 && !handPlanned) stops.unshift({ id: `arrive-${date}`, time: hhmm(w.from - 60), title: 'Arrive and check in', place: '', category: 'Stay', kind: 'arrive', why: 'Settle in first: day one is lighter.', minutes: 60 });
    if (d === total - 1 && total > 1 && !handPlanned) {
      const end = Math.max(w.from, ...stops.map((s) => toMin(s.time) + s.minutes));
      stops.push({ id: `leave-${date}`, time: hhmm(round5(Math.max(end, Math.min(w.until, end + 30)))), title: 'Check out and head home', place: '', category: 'Travel', kind: 'leave', why: 'Time to leave, with room to spare.', minutes: 60 });
    }
    days.push({ date, title: dayTitle(placed, d, total, a.destination), stops });
  }
  return { days, unplaced, overfull };
}

export const toMin = (time: string) => { const m = time.match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
export const clock = hhmm;
