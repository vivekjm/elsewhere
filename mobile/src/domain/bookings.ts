/**
 * Pulls flights, trains, stays and other bookings out of confirmation text pasted from an email.
 * Clipboard input is untrusted: it is size-capped and only ever read, never executed or fetched.
 */
import * as Localization from 'expo-localization';
import type { ACTIVITY_TYPES } from '../data/model';
import type { DocumentKind } from '../data/extras';
import { fromDate } from './format';

type Category = (typeof ACTIVITY_TYPES)[number];
export type ParsedBooking = { id: string; category: Category; kind: DocumentKind; title: string; detail: string; date: string; time: string };

const MONTH = /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?/;
const monthIndex = (m: string) => ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m.slice(0, 3).toLowerCase());

type Found = { index: number; date: string; time: string };

/** Dates (and a time printed right after them) in reading order. */
export function findDates(text: string, now = new Date()): Found[] {
  const out: Found[] = [];
  const dayFirst = !['US', 'CA', 'PH'].includes(Localization.getLocales()[0]?.regionCode ?? '');
  const year = (y: string | undefined, month: number, day: number) => {
    if (y) return Number(y.length === 2 ? `20${y}` : y);
    const guess = new Date(now.getFullYear(), month, day, 12);
    return guess < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30) ? now.getFullYear() + 1 : now.getFullYear();
  };
  const push = (index: number, y: number, m: number, d: number, after: string) => {
    const date = new Date(y, m, d, 12);
    if (date.getMonth() !== m || date.getDate() !== d || y < 2000 || y > 2100) return;
    const t = after.match(/^[^\n\d]{0,24}?(\d{1,2})[:.h](\d{2})\s*(am|pm)?/i);
    let time = '';
    if (t) {
      let h = Number(t[1]); const min = Number(t[2]);
      if (t[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
      if (t[3]?.toLowerCase() === 'am' && h === 12) h = 0;
      if (h < 24 && min < 60) time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
    out.push({ index, date: fromDate(date), time });
  };
  const rules: [RegExp, (m: RegExpExecArray) => [number, number, number] | null][] = [
    [/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m) => [Number(m[1]), Number(m[2]) - 1, Number(m[3])]],
    [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH.source}\\s*,?\\s*(\\d{4})?`, 'gi'), (m) => { const mi = monthIndex(m[2]); return mi < 0 ? null : [year(m[3], mi, Number(m[1])), mi, Number(m[1])]; }],
    [new RegExp(`\\b${MONTH.source}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(\\d{4})?`, 'gi'), (m) => { const mi = monthIndex(m[1]); return mi < 0 ? null : [year(m[3], mi, Number(m[2])), mi, Number(m[2])]; }],
    [/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/g, (m) => {
      const a = Number(m[1]), b = Number(m[2]);
      const [d, mo] = a > 12 ? [a, b] : b > 12 ? [b, a] : dayFirst ? [a, b] : [b, a];
      return [year(m[3], mo - 1, d), mo - 1, d];
    }],
  ];
  for (const [re, read] of rules) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (out.some((f) => Math.abs(f.index - m!.index) < 3)) continue;
      const v = read(m);
      if (v) push(m.index, v[0], v[1], v[2], text.slice(m.index + m[0].length, m.index + m[0].length + 40));
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

const firstLine = (text: string, words: string[]) => text.split('\n').map((l) => l.trim()).find((l) => l.length < 70 && words.some((w) => l.toLowerCase().includes(w)));

export function parseBookings(input: string): ParsedBooking[] {
  if (!input || input.length > 100000) return [];
  const text = input.replace(/\r/g, '\n');
  if (!text.trim()) return [];
  // Links and invite codes aren't bookings; without real words there's nothing to read.
  if (/^\s*(tripsloom:\/\/|https?:\/\/)\S*\s*$/i.test(text) || !/[a-z]{3,}\s+[a-z]{2,}/i.test(text)) return [];
  const lower = text.toLowerCase();
  const dates = findDates(text);
  const reference = text.match(/(?:pnr|booking ref(?:erence)?|booking id|confirmation(?: number| code| no\.?)?|reservation(?: number| code)?|record locator|ticket no\.?)[:\s#]*([A-Z0-9]{5,10})\b/i)?.[1];
  const results: ParsedBooking[] = [];
  let n = 0;
  const id = () => `b${++n}`;

  // Flights: flight numbers that aren't the booking reference, each once.
  if (/\b(flight|boarding|departure|depart|airline|terminal)\b/.test(lower)) {
    const seen = new Set<string>();
    const legs = [...text.matchAll(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b/g)].filter((m) => {
      const compact = `${m[1]}${m[2]}`;
      if (reference?.includes(compact) || seen.has(compact) || /^\d+$/.test(m[1])) return false;
      seen.add(compact); return true;
    }).slice(0, 4);
    const routeRe = /\b([A-Z]{3})\s*(?:→|->|–|-|to)\s*([A-Z]{3})\b/;
    legs.forEach((m, i) => {
      const end = i + 1 < legs.length ? legs[i + 1].index! : text.length;
      const leg = text.slice(m.index!, end);
      const route = leg.match(routeRe) ?? text.match(routeRe);
      const when = findDates(leg)[0] ?? dates[i] ?? dates[0];
      const seat = (leg.match(/seat[:\s]*(\d{1,2}[A-K])\b/i) ?? (i === 0 ? text.match(/seat[:\s]*(\d{1,2}[A-K])\b/i) : null))?.[1];
      const number = `${m[1]} ${m[2]}`;
      results.push({
        id: id(), category: 'Travel', kind: 'flight', title: route ? `${number} · ${route[1]} → ${route[2]}` : `Flight ${number}`,
        detail: [seat ? `Seat ${seat}` : '', reference ? `Ref ${reference}` : ''].filter(Boolean).join(' · '), date: when?.date ?? '', time: when?.time ?? '',
      });
    });
  }

  // Trains and buses.
  if (!results.length && /\b(train|rail|railway|coach|bus ticket|platform|carriage)\b/.test(lower)) {
    const isBus = /\b(bus|coach station)\b/.test(lower) && !/\btrain\b/.test(lower);
    const route = text.match(/\b([A-Z][\p{L}.' -]{2,30}?)\s+(?:→|->|–|to)\s+([A-Z][\p{L}.' -]{2,30})\b/u);
    const seat = text.match(/(?:coach|carriage)\s*([A-Z]?\d{1,2})[,\s]*seat\s*(\d{1,3}[A-Z]?)/i) ?? text.match(/seat[:\s]*(\d{1,3}[A-Z]?)/i);
    const when = dates[0];
    results.push({
      id: id(), category: 'Travel', kind: 'ticket', title: route ? `${isBus ? 'Bus' : 'Train'} ${route[1].trim()} → ${route[2].trim()}` : isBus ? 'Bus' : 'Train',
      detail: [seat ? (seat.length > 2 ? `Coach ${seat[1]}, seat ${seat[2]}` : `Seat ${seat[1]}`) : '', reference ? `Ref ${reference}` : ''].filter(Boolean).join(' · '),
      date: when?.date ?? '', time: when?.time ?? '',
    });
  }

  // Stays.
  if (/\b(check-in|check in|hotel|nights?|stay|accommodation|apartment|hostel|guesthouse|ryokan|airbnb)\b/.test(lower)) {
    let nights = text.match(/(\d{1,2})\s*nights?/i)?.[1];
    if (!nights && dates.length >= 2) {
      const diff = Math.round((Date.parse(dates[1].date) - Date.parse(dates[0].date)) / 86400000);
      if (diff > 0 && diff < 60) nights = String(diff);
    }
    const name = firstLine(text, ['hotel', 'hostel', 'apartment', 'resort', 'guesthouse', 'inn', 'villa', 'ryokan', 'lodge', 'suites'])
      ?.replace(/^(hotel name|property|accommodation)\s*[:-]\s*/i, '') ?? 'Stay';
    const checkIn = text.match(/check[- ]?in[^\n]*?(\d{1,2}[:.]\d{2})/i)?.[1]?.replace('.', ':');
    const stayDate = dates.find((d) => text.slice(Math.max(0, d.index - 30), d.index).toLowerCase().includes('check')) ?? dates[0];
    results.push({
      id: id(), category: 'Stay', kind: 'stay', title: name.slice(0, 120),
      detail: [nights ? `${nights} ${nights === '1' ? 'night' : 'nights'}` : '', reference ? `Ref ${reference}` : ''].filter(Boolean).join(' · '),
      date: stayDate?.date ?? '', time: checkIn ? checkIn.padStart(5, '0') : '15:00',
    });
  }

  if (!results.length) {
    const title = firstLine(text, ['tour', 'ticket', 'reservation', 'table', 'booking', 'tickets', 'admission', 'entry']) ?? text.split('\n').map((l) => l.trim()).find(Boolean) ?? 'Booking';
    results.push({ id: id(), category: /table|dinner|lunch|restaurant/i.test(title) ? 'Food & drink' : 'Event', kind: 'ticket', title: title.slice(0, 120),
      detail: reference ? `Ref ${reference}` : 'From your confirmation', date: dates[0]?.date ?? '', time: dates[0]?.time ?? '' });
  }
  return results;
}
