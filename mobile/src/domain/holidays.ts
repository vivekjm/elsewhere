/**
 * Long weekends from fixed-date public holidays, for the "When can everyone go?" poll. Only holidays on the same
 * date every year are listed (festivals that move with the lunar calendar are left out rather than guessed).
 */
import { addDays } from '../data/model';
import { fromDate, toDate } from './format';

const FIXED: Record<string, { md: string; name: string }[]> = {
  IN: [
    { md: '01-26', name: 'Republic Day' },
    { md: '08-15', name: 'Independence Day' },
    { md: '10-02', name: 'Gandhi Jayanti' },
    { md: '12-25', name: 'Christmas' },
  ],
};

export type LongWeekend = { start: string; end: string; holiday: string; leave: number };

/**
 * Holidays in the next `months` that make a long weekend: on a Friday or Monday (3 days, no leave), or on a
 * Thursday or Tuesday (4 days with one day of leave).
 */
export function longWeekends(country: string, from: string, months = 12): LongWeekend[] {
  const list = FIXED[country] ?? [];
  const until = fromDate(new Date(toDate(from).getFullYear(), toDate(from).getMonth() + months, toDate(from).getDate()));
  const out: LongWeekend[] = [];
  for (let y = toDate(from).getFullYear(); y <= toDate(until).getFullYear(); y++) {
    for (const h of list) {
      const day = `${y}-${h.md}`;
      if (day < from || day > until) continue;
      const dow = toDate(day).getDay();
      if (dow === 5) out.push({ start: day, end: addDays(day, 2), holiday: h.name, leave: 0 });
      else if (dow === 1) out.push({ start: addDays(day, -2), end: day, holiday: h.name, leave: 0 });
      else if (dow === 4) out.push({ start: day, end: addDays(day, 3), holiday: h.name, leave: 1 });
      else if (dow === 2) out.push({ start: addDays(day, -3), end: day, holiday: h.name, leave: 1 });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
