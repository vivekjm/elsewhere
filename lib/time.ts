/** Date and time parsing for the custom pickers.
 * No browser APIs: the same helpers run in the API/validation path and in tests.
 */
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const pad = (n: number) => String(n).padStart(2, "0");
/** True for a real YYYY-MM-DD calendar date. Not a type guard: callers
 * already hold strings, and narrowing would hide later string methods. */
export function isDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= days;
}
export const iso = (year: number, month: number, day: number) =>
  `${year}-${pad(month)}-${pad(day)}`;
export function parts(value: string) {
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    day: Number(value.slice(8, 10)),
  };
}
const monthIndex = (token: string) => {
  const needle = token.slice(0, 3).toLowerCase();
  const index = MONTHS.indexOf(needle);
  if (index >= 0) return index + 1;
  const numeric = Number(token);
  return numeric >= 1 && numeric <= 12 ? numeric : 0;
};
/** Accepts 2026-11-01, 1 Nov 2026, Nov 1 2026, 01/11/2026 and 11/01/2026 (day first). */
export function parseDate(input: string): string | null {
  const raw = input.trim();
  if (raw.length === 0) return null;
  const text = raw.replace(/[,]/g, " ").replace(/\s+/g, " ");
  if (isDate(text)) return text;
  const isoMatch = text.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (isoMatch) {
    const candidate = iso(+isoMatch[1], +isoMatch[2], +isoMatch[3]);
    return isDate(candidate) ? candidate : null;
  }
  const tokens: string[] = text.split(/[\s/.]+/);
  if (tokens.length !== 3) return null;
  const [a, b, c] = tokens;
  // A leading month name means "Nov 1 2026"; otherwise the day comes first,
  // so "1 Nov 2026" and "01/11/2026" both read as day, month, year.
  const order = /[a-z]/i.test(a)
    ? { day: b, month: a, year: c }
    : { day: a, month: b, year: c };
  const day = Number(order.day);
  const year = Number(order.year);
  const month = monthIndex(order.month);
  if (!day || !month || order.year.length !== 4) return null;
  const candidate = iso(year, month, day);
  return isDate(candidate) ? candidate : null;
}
export function formatDate(value: string) {
  if (!isDate(value)) return "";
  const { year, month, day } = parts(value);
  return `${day} ${MONTHS[month - 1][0].toUpperCase()}${MONTHS[month - 1].slice(1)} ${year}`;
}
export function shiftMonth(month: string, amount: number): string {
  const { year, month: m } = parts(`${month}-01`);
  const total = year * 12 + (m - 1) + amount;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}
/** Six Monday-first weeks covering the month, including neighbouring days. */
export function monthGrid(month: string): string[] {
  const { year, month: m } = parts(`${month}-01`);
  const first = new Date(Date.UTC(year, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) =>
    new Date(Date.UTC(year, m - 1, 1 - lead + i)).toISOString().slice(0, 10),
  );
}
export function isTime(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{1,2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}
/** Accepts 14:30, 2:30 pm, 1430 and 2.30pm. Returns 24-hour HH:MM. */
export function parseTime(input: string): string | null {
  const text = input.trim().toLowerCase().replace(/\./g, ":").replace(/\s+/g, "");
  if (!text) return null;
  const match = text.match(/^(\d{1,2}):?(\d{2})?(am|pm|a|p)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const suffix = match[3];
  if (minute > 59) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix.startsWith("p") && hour !== 12) hour += 12;
    if (suffix.startsWith("a") && hour === 12) hour = 0;
  } else if (hour > 23) return null;
  return `${pad(hour)}:${pad(minute)}`;
}
export function formatTime(value: string, hour12 = false) {
  if (!isTime(value)) return "";
  const [h, m] = value.split(":").map(Number);
  if (!hour12) return `${pad(h)}:${pad(m)}`;
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad(m)}${suffix}`;
}
export const minuteMark = (value: string) => Number(value.slice(3, 5));
export function shiftTime(value: string, minutes: number): string {
  const safe = isTime(value) ? value : "09:00";
  const [h, m] = safe.split(":").map(Number);
  const total = (h * 60 + m + minutes + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
