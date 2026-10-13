/**
 * Turns a one-line trip request into a first draft: dates, length, travellers, budget, interests,
 * and a day-by-day plan. Works offline from templates; an on-device model, when the phone has one,
 * writes the day titles and stops instead (see `services/intelligence`).
 */
import type { ACTIVITY_TYPES } from '../data/model';
import type { TripKind } from '../data/extras';
import { fromDate, toDate, todayISO } from './format';

type Category = (typeof ACTIVITY_TYPES)[number];
export type DraftStop = { time: string; title: string; category: Category };
export type DraftDay = { title: string; stops: DraftStop[] };
export type Draft = {
  title: string; destination: string; kind: TripKind; start: string; days: number; travellers: number;
  budget: number; currency: string | null; interests: string[]; plan: DraftDay[]; source: 'template' | 'on-device';
};

/* ------------------------------------------------------------------ facts */

const WORD_NUMBERS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14 };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function parseDays(text: string): number | null {
  const m = text.match(/(\d{1,2})\s*(?:[a-z-]+\s+)?(day|night)/);
  if (m) { const n = Number(m[1]); return Math.max(1, Math.min(m[2] === 'night' ? n + 1 : n, 30)); }
  for (const [word, n] of Object.entries(WORD_NUMBERS)) if (text.includes(`${word} day`) || text.includes(`${word}-day`)) return n;
  for (const [word, n] of Object.entries(WORD_NUMBERS)) if (text.includes(`${word} night`)) return n + 1;
  if (text.includes('fortnight') || text.includes('two weeks')) return 14;
  if (text.includes('long weekend')) return 4;
  if (text.includes('weekend')) return 3;
  if (/\b(a|one|1)\s+week\b|week-long|weeklong|\bweek in\b/.test(text)) return 7;
  return null;
}

const nextWeekday = (iso: string, weekday: number) => { const d = toDate(iso); while (d.getDay() !== weekday) d.setDate(d.getDate() + 1); return fromDate(d); };

export function parseStart(text: string, today = todayISO()): string | null {
  if (/\b(today|tonight)\b/.test(text)) return today;
  if (/\btomorrow\b/.test(text)) return fromDate(new Date(toDate(today).getTime() + 86400000));
  // "12 Dec", "Dec 12", "12 December 2027"
  const dm = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b(?:\s+(\d{4}))?/) ?? null;
  const md = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/) ?? null;
  const pick = dm ? { day: Number(dm[1]), mon: dm[2], year: dm[3] } : md ? { day: Number(md[2]), mon: md[1], year: md[3] } : null;
  if (pick) {
    const month = MONTHS.findIndex((n) => n.startsWith(pick.mon.slice(0, 3)));
    const t = toDate(today);
    let year = pick.year ? Number(pick.year) : t.getFullYear();
    let d = new Date(year, month, pick.day, 12);
    if (!pick.year && d < t) d = new Date(++year, month, pick.day, 12);
    if (d.getMonth() === month) return fromDate(d);
  }
  for (let i = 0; i < 12; i++) {
    const name = MONTHS[i];
    const said = name === 'may' ? /\b(in|during|early|late|mid|this|next|by)\s+may\b/.test(text) : new RegExp(`\\b(${name}|${name.slice(0, 3)})\\b`).test(text);
    if (!said) continue;
    const t = toDate(today);
    let first = new Date(t.getFullYear(), i, 1, 12);
    if (new Date(t.getFullYear(), i + 1, 0, 12) < t) first = new Date(t.getFullYear() + 1, i, 1, 12);
    const from = first < t ? fromDate(t) : fromDate(first);
    const sat = nextWeekday(from, 6);
    return toDate(sat).getMonth() === i ? sat : from;
  }
  if (text.includes('this weekend')) return nextWeekday(today, 6);
  if (text.includes('next weekend')) return nextWeekday(fromDate(new Date(toDate(today).getTime() + 7 * 86400000)), 6);
  if (text.includes('next week')) return nextWeekday(fromDate(new Date(toDate(today).getTime() + 86400000)), 1);
  if (text.includes('next month')) { const t = toDate(today); return nextWeekday(fromDate(new Date(t.getFullYear(), t.getMonth() + 1, 1, 12)), 6); }
  return null;
}

export function parseTravellers(text: string): number | null {
  let m = text.match(/(?:family|group) of (\d{1,2})/); if (m) return Math.min(Number(m[1]), 20);
  m = text.match(/(\d{1,2})\s*(?:people|persons|adults|travellers|travelers|of us|friends|pax)/); if (m) return Math.max(1, Math.min(Number(m[1]) + (text.includes(`${m[1]} friends`) ? 1 : 0), 20));
  m = text.match(/with (\d{1,2}) (?:friends?|colleagues?|others?|people|persons?)\b/); if (m) return Math.min(Number(m[1]) + 1, 20);
  m = text.match(/with (a|one|two|three|four|five|six) (?:friends?|colleagues?|others?)\b/); if (m) return (m[1] === 'a' ? 1 : WORD_NUMBERS[m[1]] ?? 1) + 1;
  if (/\bwith (?:a |my )?(?:friend|colleague|partner|wife|husband|girlfriend|boyfriend|mum|mom|dad|sister|brother)\b/.test(text)) return 2;
  m = text.match(/\b(two|three|four|five|six) (?:of us|friends|people)\b/); if (m) return WORD_NUMBERS[m[1]] + (text.includes(`${m[1]} friends`) ? 1 : 0);
  if (/\b(solo|alone|by myself)\b/.test(text)) return 1;
  if (/\b(couple|honeymoon|two of us|my partner|my wife|my husband|girlfriend|boyfriend)\b/.test(text)) return text.includes('kids') ? 4 : 2;
  if (/\b(kids|children|family)\b/.test(text)) return 4;
  if (text.includes('friends')) return 4;
  return null;
}

export function parseBudget(text: string): { amount: number; currency: string | null } | null {
  const re = /(budget(?:\s+of)?|under|within|max|up to|around|about|for)?\s*([$€£¥])?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(dollars|euros|pounds|yen|usd|eur|gbp|jpy|chf|aud|cad)?/g;
  for (const m of text.matchAll(re)) {
    const moneyish = !!(m[1] && /budget|under|within|max/.test(m[1])) || !!m[2] || !!m[5] || !!m[4];
    if (!moneyish) continue;
    let value = Number(m[3].replace(/,/g, ''));
    if (m[4]) value *= 1000;
    if (value < 50) continue;
    const symbol = m[2] ?? '';
    const word = m[5] ?? '';
    const currency = symbol === '€' || /euro|eur/.test(word) ? 'EUR' : symbol === '£' || /pound|gbp/.test(word) ? 'GBP' : symbol === '¥' || /yen|jpy/.test(word) ? 'JPY'
      : symbol === '$' || /dollar|usd/.test(word) ? 'USD' : /chf/.test(word) ? 'CHF' : /aud/.test(word) ? 'AUD' : /cad/.test(word) ? 'CAD' : null;
    return { amount: value, currency };
  }
  return null;
}

export function parseKind(text: string): TripKind {
  if (/\b(dive|diving|scuba|reef|snorkel)/.test(text)) return 'dive';
  if (/\b(trek|hike|hiking|summit|climb|hut to hut|hut-to-hut|refuge|base camp|kilimanjaro|camino)/.test(text)) return 'trek';
  if (/\b(road trip|drive|driving|by car|campervan|van life)/.test(text)) return 'road';
  if (/\b(beach|island|coast|surf|swim)/.test(text)) return 'beach';
  return 'city';
}

/** "a week in Portugal" → "Portugal"; "Kyoto in autumn" → "Kyoto". */
export function parseDestination(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  const patterns = [
    /\b(?:in|to|around|across|through|visit|visiting|explore|exploring)\s+(?:the\s+)?((?:[A-Z][\p{L}'’.-]+)(?:[ ,]+(?:[A-Z][\p{L}'’.-]+|de|del|da|di|do|la|le|el|of|the))*)/u,
    /^((?:[A-Z][\p{L}'’.-]+)(?:[ ,]+[A-Z][\p{L}'’.-]+)*)\s+(?:in|for|with|on|,)/u,
  ];
  const skip = /^(January|February|March|April|May|June|July|August|September|October|November|December|Spring|Summer|Autumn|Fall|Winter|A|An|The|We|I|My|Our)$/;
  for (const p of patterns) {
    const m = cleaned.match(p);
    if (!m) continue;
    const words = m[1].split(/\s+/).filter((w) => !skip.test(w.replace(/[,.]/g, '')));
    const place = words.join(' ').replace(/[,.]+$/, '').trim();
    if (place.length >= 2) return place;
  }
  return '';
}

/* ------------------------------------------------------------------ templates */

const S = (time: string, title: string, category: Category): DraftStop => ({ time, title, category });

const INTERESTS: { name: string; words: string[]; day: DraftDay }[] = [
  { name: 'food', words: ['food', 'eat', 'cuisine', 'foodie', 'café', 'cafe', 'restaurant', 'wine', 'market'], day: { title: 'Food trail', stops: [S('09:00', 'Local breakfast', 'Food & drink'), S('12:30', 'Market lunch', 'Food & drink'), S('19:30', 'Dinner at a local favourite', 'Food & drink')] } },
  { name: 'museums', words: ['museum', 'art', 'history', 'gallery', 'castle', 'palace', 'heritage'], day: { title: 'Art and history', stops: [S('10:00', 'Main museum', 'Explore'), S('13:30', 'Lunch near the old town', 'Food & drink'), S('16:00', 'Historic quarter walk', 'Explore')] } },
  { name: 'beach', words: ['beach', 'swim', 'sea', 'coast', 'cove'], day: { title: 'Beach day', stops: [S('10:00', 'Morning swim', 'Explore'), S('13:00', 'Seafood lunch', 'Food & drink'), S('19:00', 'Sunset by the water', 'Event')] } },
  { name: 'hiking', words: ['hike', 'hiking', 'walk', 'trail', 'nature', 'mountain', 'hills'], day: { title: 'Into the hills', stops: [S('08:30', 'Morning hike', 'Explore'), S('13:00', 'Picnic lunch', 'Food & drink'), S('18:30', 'Viewpoint at sunset', 'Explore')] } },
  { name: 'markets', words: ['shopping', 'souk', 'bazaar', 'boutique'], day: { title: 'Markets and makers', stops: [S('10:00', 'Morning market', 'Explore'), S('14:00', 'Craft and design shops', 'Explore'), S('19:00', 'Night market', 'Food & drink')] } },
  { name: 'nightlife', words: ['nightlife', 'party', 'bar', 'club', 'music', 'jazz'], day: { title: 'Out after dark', stops: [S('14:00', 'Late lunch', 'Food & drink'), S('18:30', 'Sunset drinks', 'Food & drink'), S('22:00', 'Live music', 'Event')] } },
  { name: 'wellness', words: ['spa', 'yoga', 'relax', 'slow', 'wellness', 'hot spring', 'onsen'], day: { title: 'Slow and restful', stops: [S('09:00', 'Slow breakfast', 'Food & drink'), S('11:00', 'Spa or hot springs', 'Explore'), S('19:30', 'Quiet dinner', 'Food & drink')] } },
  { name: 'temples', words: ['temple', 'shrine', 'cathedral', 'church', 'mosque', 'monastery'], day: { title: 'Temples and gardens', stops: [S('07:30', 'Early temple visit', 'Explore'), S('12:30', 'Lunch near the gardens', 'Food & drink'), S('15:00', 'Garden walk', 'Explore')] } },
  { name: 'wildlife', words: ['wildlife', 'safari', 'whale', 'bird', 'animal'], day: { title: 'Wildlife', stops: [S('06:30', 'Early wildlife outing', 'Explore'), S('12:30', 'Lunch at the lodge', 'Food & drink'), S('17:00', 'Evening nature walk', 'Explore')] } },
  { name: 'snow', words: ['ski', 'snow', 'skiing', 'snowboard'], day: { title: 'Snow day', stops: [S('09:00', 'Lifts open', 'Explore'), S('12:30', 'Mountain hut lunch', 'Food & drink'), S('16:30', 'Après', 'Food & drink')] } },
  { name: 'adventure', words: ['kayak', 'rafting', 'surf', 'paraglid', 'zipline', 'climbing', 'bike', 'cycle'], day: { title: 'Adventure day', stops: [S('09:00', 'Morning activity', 'Explore'), S('13:00', 'Lunch nearby', 'Food & drink'), S('19:00', 'Easy evening', 'Food & drink')] } },
  { name: 'daytrip', words: ['day trip', 'excursion', 'nearby'], day: { title: 'Day trip', stops: [S('08:30', 'Train out of town', 'Travel'), S('12:30', 'Lunch in a small town', 'Food & drink'), S('18:00', 'Back for dinner', 'Food & drink')] } },
];

const BY_KIND: Record<TripKind, DraftDay[]> = {
  city: [
    { title: 'Old town on foot', stops: [S('09:30', 'Walking tour of the old town', 'Explore'), S('13:00', 'Lunch in the centre', 'Food & drink'), S('16:00', 'Viewpoint and coffee', 'Explore')] },
    { title: 'Neighbourhoods', stops: [S('10:00', 'A neighbourhood of your choice', 'Explore'), S('13:00', 'Market lunch', 'Food & drink'), S('19:30', 'Dinner somewhere local', 'Food & drink')] },
  ],
  beach: [
    { title: 'Coves and swims', stops: [S('10:00', 'Find a quiet cove', 'Explore'), S('13:30', 'Lunch by the water', 'Food & drink'), S('19:00', 'Sunset walk', 'Explore')] },
    { title: 'Out on the water', stops: [S('09:30', 'Boat trip', 'Explore'), S('13:00', 'Lunch on board or ashore', 'Food & drink'), S('20:00', 'Seafood dinner', 'Food & drink')] },
  ],
  trek: [
    { title: 'Trail day', stops: [S('07:00', 'Start the stage early', 'Travel'), S('12:30', 'Trail lunch', 'Food & drink'), S('17:00', 'Arrive at the hut or camp', 'Stay')] },
    { title: 'Acclimatise and rest', stops: [S('08:00', 'Short acclimatisation walk', 'Explore'), S('13:00', 'Rest and eat well', 'Food & drink'), S('19:00', 'Briefing for tomorrow', 'Event')] },
  ],
  road: [
    { title: 'On the road', stops: [S('08:30', 'Hit the road', 'Travel'), S('12:30', 'Stop for lunch along the way', 'Food & drink'), S('17:30', 'Check in for the night', 'Stay')] },
    { title: 'Scenic detour', stops: [S('09:00', 'Scenic drive', 'Travel'), S('12:00', 'Short walk at a viewpoint', 'Explore'), S('19:00', 'Dinner in town', 'Food & drink')] },
  ],
  dive: [
    { title: 'Dive day', stops: [S('08:00', 'Morning dive', 'Explore'), S('12:30', 'Lunch and surface interval', 'Food & drink'), S('14:30', 'Afternoon dive', 'Explore')] },
    { title: 'Reef and rest', stops: [S('09:00', 'Snorkel the house reef', 'Explore'), S('13:00', 'Lunch by the sea', 'Food & drink'), S('18:30', 'Log the dives over dinner', 'Food & drink')] },
  ],
};

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** A complete draft from a prompt, without any model. */
export function templateDraft(prompt: string, hints: { destination?: string; kind?: TripKind; currency?: string } = {}, today = todayISO()): Draft {
  const text = prompt.toLowerCase();
  const kind = hints.kind ?? parseKind(text);
  const destination = hints.destination || parseDestination(prompt) || '';
  const days = parseDays(text) ?? (kind === 'trek' ? 6 : kind === 'road' ? 6 : 4);
  const start = parseStart(text, today) ?? nextWeekday(fromDate(new Date(toDate(today).getTime() + 14 * 86400000)), 6);
  const travellers = parseTravellers(text) ?? 1;
  const budget = parseBudget(text);
  const interests = INTERESTS.filter((i) => i.words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es|ing)?\\b`, 'i').test(text)));
  const place = destination.split(',')[0] || 'your destination';
  const plan: DraftDay[] = [];
  plan.push({ title: `Arrive in ${place}`, stops: [S('14:00', `Arrive and check in`, 'Stay'), S('17:00', 'Gentle first walk', 'Explore'), S('19:30', 'Welcome dinner nearby', 'Food & drink')] });
  const pool = [...interests.map((i) => i.day), ...BY_KIND[kind]];
  for (let d = 1; d < days - 1; d++) plan.push(JSON.parse(JSON.stringify(pool[(d - 1) % pool.length])) as DraftDay);
  if (days > 1) plan.push({ title: 'Last morning', stops: [S('09:00', 'Slow breakfast', 'Food & drink'), S('11:00', 'Last look around', 'Explore'), S('14:00', 'Head home', 'Travel')] });
  const name = destination ? `${titleCase(place)}${parseStart(text, today) ? ` in ${new Intl.DateTimeFormat('en', { month: 'long' }).format(toDate(start))}` : ''}` : 'New trip';
  return { title: name, destination: destination ? titleCase(destination) : '', kind, start, days, travellers, budget: budget?.amount ?? 0, currency: budget?.currency ?? hints.currency ?? null, interests: interests.map((i) => i.name), plan: plan.slice(0, days), source: 'template' };
}
