import { addDays, daysBetween, dayOutfits, tripDates, uid, type Trip, type Day, type Workspace, type Activity } from './model.ts';
export const dateLabel = (date: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const money = (amount: number, currency = 'INR') => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
export function monthDays(month: string) {
  const first = `${month}-01`, weekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(Date.parse(first) + (i - weekday) * 86400000).toISOString().slice(0, 10));
}
export function shiftMonth(month: string, amount: number): string {
  const d = new Date(`${month}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + amount); return d.toISOString().slice(0, 7);
}
export function dayHasContent(day: Day) { return !!(day.title || day.stay || day.notes || dayOutfits(day).length || day.gear?.length); }
/** A date edit is atomic: it cannot quietly erase accommodation, notes, outfits or events. */
export function resizeTrip(trip: Trip, start: string, end: string, shiftPlans = false): Trip {
  tripDates({ start, end });
  const next = structuredClone(trip), delta = shiftPlans ? daysBetween(trip.start, start) : 0;
  next.activities.forEach(a => { a.date = addDays(a.date, delta); });
  next.days = Object.fromEntries(Object.entries(next.days).map(([date, data]) => [addDays(date, delta), data]));
  if (next.activities.some(a => a.date < start || a.date > end) || Object.entries(next.days).some(([date, day]) => (date < start || date > end) && dayHasContent(day))) {
    throw new Error('These dates would remove existing plans. Shift the itinerary with the trip, extend the return date, or move the affected plans first.');
  }
  next.days = Object.fromEntries(Object.entries(next.days).filter(([d]) => d >= start && d <= end));
  return { ...next, start, end };
}
export function duplicateTrip(trip: Trip): Trip {
  const copy = structuredClone(trip);
  copy.id = uid(); copy.name = `${copy.name.slice(0, 190)} (copy)`; copy.sample = false; copy.packed = [];
  copy.activities.forEach(a => { a.id = uid(); a.completed = false; });
  copy.extras.forEach(e => { e.id = uid(); e.packed = false; });
  return copy;
}
export function dayActivities(trip: Trip, day: string): Activity[] { return trip.activities.filter(a => a.date === day).sort((a, b) => a.time.localeCompare(b.time)); }
export function dayItems(w: Workspace, trip: Trip, date: string) {
  const events = dayActivities(trip, date), day = trip.days[date];
  const looks = [...new Set([...dayOutfits(day), ...events.map(a => a.outfitId).filter(Boolean)])];
  const gear = [...new Set([...(day?.gear ?? []), ...events.flatMap(a => a.gear)])];
  return { outfits: w.outfits.filter(o => looks.includes(o.id)), gear: w.items.filter(i => gear.includes(i.id)) };
}
export function overlaps(events: Activity[]): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < events.length; i++) for (let j = i + 1; j < events.length; j++) {
    const a = events[i], b = events[j];
    if (a.date === b.date && a.time && a.endTime && b.time && b.endTime && a.time < b.endTime && b.time < a.endTime) { result.add(a.id); result.add(b.id); }
  }
  return result;
}
export function emptyTrip(): Trip { const start = today(); return { id: uid(), name: '', destination: '', start, end: addDays(start, 6), travellers: 1, currency: 'INR', budget: 0, weightLimit: 15, theme: 'mountains', notes: '', sample: false, days: {}, activities: [], extras: [], packed: [] }; }
