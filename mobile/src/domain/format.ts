/** Locale-aware formatting. Dates are ISO `YYYY-MM-DD` strings in the trip's own calendar (no time zone). */
import * as Localization from 'expo-localization';

const locale = () => Localization.getLocales()[0]?.languageTag ?? 'en-GB';

/** Today's date on this device as `YYYY-MM-DD`. */
export function todayISO(now = new Date()): string {
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses `YYYY-MM-DD` as a local calendar date at noon (immune to DST edges). */
export function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}

export function fromDate(date: Date): string { return todayISO(date); }

/** A timestamp (full ISO, UTC) as this device's calendar date, `YYYY-MM-DD`. */
export function localDay(stamp: string): string { return todayISO(new Date(stamp)); }
/** A timestamp as this device's clock time in the user's locale ("21:40" or "9:40 PM"). */
export function clockTime(stamp: string): string { return fmt({ hour: 'numeric', minute: '2-digit' }).format(new Date(stamp)); }

export function daysFromToday(iso: string, today = todayISO()): number {
  return Math.round((toDate(iso).getTime() - toDate(today).getTime()) / 86400000);
}

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(), options);

/** "Thu 12 Nov" */
export function shortDay(iso: string): string {
  if (!iso) return '';
  return fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(toDate(iso));
}
/** "Thursday 12 Nov" */
export function longDay(iso: string): string {
  if (!iso) return '';
  return fmt({ weekday: 'long', day: 'numeric', month: 'short' }).format(toDate(iso));
}
/** "Thu" */
export function weekday(iso: string): string { return fmt({ weekday: 'short' }).format(toDate(iso)); }
/** "12" */
export function dayOfMonth(iso: string): string { return String(toDate(iso).getDate()); }
/** "Nov" */
export function month(iso: string): string { return fmt({ month: 'short' }).format(toDate(iso)); }

/** "Thu 12 – Mon 16 Nov", or "Fri 28 Nov – Tue 2 Dec" across months, with the year when it isn't this year. */
export function dateRange(start: string, end: string): string {
  if (!start) return '';
  const a = toDate(start), b = toDate(end || start);
  const thisYear = new Date().getFullYear();
  const showYear = a.getFullYear() !== thisYear || b.getFullYear() !== thisYear;
  if (start === end) return fmt({ weekday: 'short', day: 'numeric', month: 'short', ...(showYear ? { year: 'numeric' } : {}) }).format(a);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const left = fmt({ weekday: 'short', day: 'numeric', ...(sameMonth ? {} : { month: 'short' }) }).format(a);
  const right = fmt({ weekday: 'short', day: 'numeric', month: 'short', ...(showYear ? { year: 'numeric' } : {}) }).format(b);
  return `${left} – ${right}`;
}

/** "4–6 Dec" for compact labels. */
export function compactRange(start: string, end: string): string {
  const a = toDate(start), b = toDate(end || start);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${month(end)}`;
  return `${a.getDate()} ${month(start)} – ${b.getDate()} ${month(end)}`;
}

export function money(amount: number, currency: string, compact = false): string {
  try {
    return new Intl.NumberFormat(locale(), {
      style: 'currency', currency, maximumFractionDigits: compact || Math.abs(amount) >= 1000 || Number.isInteger(amount) ? 0 : 2,
      ...(compact && Math.abs(amount) >= 10000 ? { notation: 'compact' } : {}),
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

export function plural(n: number, one: string, many = `${one}s`): string { return `${n} ${n === 1 ? one : many}`; }

export function kg(grams: number, unit: 'metric' | 'imperial' = 'metric'): string {
  if (unit === 'imperial') return `${(grams / 453.592).toFixed(1)} lb`;
  return `${(grams / 1000).toFixed(1)} kg`;
}
export function weight(grams: number, unit: 'metric' | 'imperial' = 'metric'): string {
  if (unit === 'imperial') return grams >= 454 ? `${(grams / 453.592).toFixed(1)} lb` : `${Math.round(grams / 28.35)} oz`;
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`;
}
export function distance(km: number, unit: 'metric' | 'imperial' = 'metric'): string {
  return unit === 'imperial' ? `${(km * 0.621371).toFixed(km < 10 ? 1 : 0)} mi` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}
export function altitude(metres: number, unit: 'metric' | 'imperial' = 'metric'): string {
  return unit === 'imperial' ? `${Math.round(metres * 3.28084).toLocaleString()} ft` : `${Math.round(metres).toLocaleString()} m`;
}
export function temperature(celsius: number, unit: 'metric' | 'imperial' = 'metric'): string {
  return unit === 'imperial' ? `${Math.round(celsius * 9 / 5 + 32)}°` : `${Math.round(celsius)}°`;
}

/** "09:30" stays as-is; a blank time reads "Any time". */
export function timeLabel(time: string): string { return time || 'Any time'; }

/** "You" (the person using the app) gets an empty string, which Avatar draws as a person icon. */
export function initials(name: string): string {
  if (/^you$/i.test(name.trim())) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? '')).toUpperCase() || '?';
}
