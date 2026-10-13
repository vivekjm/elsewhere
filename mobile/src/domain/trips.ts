import type { IllustrationName } from '../loom/graphics';
import type { Tint } from '../loom/tokens';
import { ME, type Expense, type ExpenseCategory, type Person, type TripExtras, type TripKind } from '../data/extras';
import { packing, tripDates, TRIP_MOODS, type Activity, type Trip, type Workspace } from '../data/model';
import { daysFromToday, todayISO } from './format';

export type Mood = (typeof TRIP_MOODS)[number];

/** The scene for each cover mood the web workspace stores. */
export const MOOD_ART: Record<Mood, IllustrationName> = {
  mountains: 'peaks', coast: 'cove', city: 'tram', forest: 'forest', lake: 'lake', desert: 'dunes', island: 'island', aurora: 'aurora',
};
export const MOOD_LABEL: Record<Mood, string> = {
  mountains: 'Mountains', coast: 'Coast', city: 'City', forest: 'Forest', lake: 'Lake', desert: 'Desert', island: 'Island', aurora: 'Northern lights',
};
export const coverOf = (trip: Pick<Trip, 'theme'>): IllustrationName => MOOD_ART[(trip.theme ?? 'mountains') as Mood] ?? 'peaks';

export const KIND_LABEL: Record<TripKind, string> = { city: 'City', beach: 'Beach', trek: 'Trek', road: 'Road trip', dive: 'Dive' };
export const KIND_TINT: Record<TripKind, Tint> = { city: 'peach', beach: 'mint', trek: 'mint', road: 'rose', dive: 'lavender' };
/** A sensible cover for a new trip of each kind. */
export const KIND_MOOD: Record<TripKind, Mood> = { city: 'city', beach: 'coast', trek: 'mountains', road: 'desert', dive: 'island' };

export type TripStatus = { phase: 'upcoming' | 'active' | 'past'; daysUntil: number; dayNumber: number; totalDays: number };
export function statusOf(trip: Pick<Trip, 'start' | 'end'>, today = todayISO()): TripStatus {
  const totalDays = daysFromToday(trip.end, trip.start) + 1;
  const until = daysFromToday(trip.start, today);
  if (until > 0) return { phase: 'upcoming', daysUntil: until, dayNumber: 0, totalDays };
  if (today <= trip.end) return { phase: 'active', daysUntil: 0, dayNumber: 1 - until, totalDays };
  return { phase: 'past', daysUntil: until, dayNumber: totalDays, totalDays };
}

/** The trip to put on Home: one under way, else the next to start, else the most recent. */
export function featuredTrip(trips: Trip[], today = todayISO()): Trip | null {
  const active = trips.filter((t) => t.start <= today && t.end >= today).sort((a, b) => a.start.localeCompare(b.start));
  if (active.length) return active[0];
  const upcoming = trips.filter((t) => t.start > today).sort((a, b) => a.start.localeCompare(b.start));
  if (upcoming.length) return upcoming[0];
  return [...trips].sort((a, b) => b.end.localeCompare(a.end))[0] ?? null;
}
export const upcomingTrips = (trips: Trip[], today = todayISO()) => trips.filter((t) => t.end >= today).sort((a, b) => a.start.localeCompare(b.start));
export const pastTrips = (trips: Trip[], today = todayISO()) => trips.filter((t) => t.end < today).sort((a, b) => b.end.localeCompare(a.end));

export function countdownLabel(status: TripStatus): string {
  if (status.phase === 'active') return `Day ${status.dayNumber} of ${status.totalDays}`;
  if (status.phase === 'past') return 'Finished';
  return status.daysUntil === 1 ? 'Tomorrow' : `In ${status.daysUntil} days`;
}

/* ------------------------------------------------------------------ plans */

export const CATEGORY: Record<Activity['category'], { label: string; tint: Tint; art: IllustrationName | 'cover'; icon: 'pin' | 'fork' | 'walk' | 'bed' | 'ticket' | 'more' }> = {
  Explore: { label: 'Sight', tint: 'peach', art: 'cover', icon: 'pin' },
  'Food & drink': { label: 'Food', tint: 'rose', art: 'food', icon: 'fork' },
  Travel: { label: 'Move', tint: 'mint', art: 'train', icon: 'walk' },
  Stay: { label: 'Stay', tint: 'lavender', art: 'stay', icon: 'bed' },
  Event: { label: 'Event', tint: 'lavender', art: 'ticket', icon: 'ticket' },
  Other: { label: 'Plan', tint: 'grey', art: 'compass', icon: 'more' },
};
export const planArt = (trip: Trip, a: Activity): IllustrationName => {
  // Flights get the passport rather than the train; a drive gets the road.
  if (a.category === 'Travel' && /\b(flight|fly|airport)\b/i.test(`${a.title} ${a.notes}`)) return 'passport';
  if (a.category === 'Travel' && /\b(drive|road trip|car hire|rental car)\b/i.test(`${a.title} ${a.notes}`)) return 'road';
  const art = CATEGORY[a.category].art;
  return art === 'cover' ? coverOf(trip) : art;
};
export const sortPlans = (list: Activity[]) => [...list].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.title.localeCompare(b.title));
export const plansOn = (trip: Trip, date: string) => sortPlans(trip.activities.filter((a) => a.date === date));

/** Days with at least one plan, an outfit or a stay. */
export function plannedDays(trip: Trip): number {
  return tripDates(trip).filter((d) => trip.activities.some((a) => a.date === d) || !!trip.days[d]?.stay || !!trip.days[d]?.outfitId).length;
}

/** The next plan that hasn't started (today, or the trip's first day). */
export function nextPlan(trip: Trip, now = new Date()): Activity | null {
  const today = todayISO(now), time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const ordered = sortPlans(trip.activities).sort((a, b) => a.date.localeCompare(b.date));
  return ordered.find((a) => a.date > today || (a.date === today && (a.time || '23:59') >= time)) ?? null;
}

/* ------------------------------------------------------------------ to-dos */

/** What still needs doing before the trip, most important first. */
export function todos(w: Workspace, trip: Trip, extras: TripExtras): string[] {
  const list: string[] = [];
  const dates = tripDates(trip);
  const unplanned = dates.filter((d) => !trip.activities.some((a) => a.date === d)).length;
  const nights = dates.slice(0, -1).filter((d) => !trip.days[d]?.stay && !trip.activities.some((a) => a.date === d && a.category === 'Stay')).length;
  if (nights > 0 && dates.length > 1) list.push(nights === dates.length - 1 ? 'Add where you’re staying' : `Add stays for ${nights} ${nights === 1 ? 'night' : 'nights'}`);
  if (unplanned > 0) list.push(unplanned === dates.length ? 'Plan your first day' : `Plan ${unplanned} more ${unplanned === 1 ? 'day' : 'days'}`);
  const rows = packing(w, trip);
  const left = rows.filter((r) => !r.packed).length;
  if (rows.length === 0) list.push('Start your packing list');
  else if (left > 0) list.push(`Pack ${left} more ${left === 1 ? 'item' : 'items'}`);
  if (!extras.documents.length && (extras.kind !== 'city' || dates.length > 2)) list.push('Add tickets and bookings');
  return list;
}

/* ------------------------------------------------------------------ budget */

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = { stay: 'Stay', food: 'Food', move: 'Move', sight: 'Sight', shopping: 'Shopping', other: 'Other' };
export const EXPENSE_TINT: Record<ExpenseCategory, Tint> = { stay: 'lavender', food: 'rose', move: 'mint', sight: 'peach', shopping: 'peach', other: 'grey' };
export const EXPENSE_ICON: Record<ExpenseCategory, 'bed' | 'fork' | 'walk' | 'pin' | 'card' | 'more'> = { stay: 'bed', food: 'fork', move: 'walk', sight: 'pin', shopping: 'card', other: 'more' };

/** Converts an amount between currencies with rates relative to `base` (1 base = rate units). Unknown rates pass through. */
export function convert(amount: number, from: string, to: string, rates: Record<string, number> | null, base: string): number {
  if (from === to || !rates) return amount;
  const rate = (code: string) => code === base ? 1 : rates[code];
  const rf = rate(from), rt = rate(to);
  return rf && rt ? amount / rf * rt : amount;
}

export type BudgetSummary = {
  planned: number; spent: number; limit: number; remaining: number; perDayLeft: number;
  byDay: { date: string; amount: number }[]; missingRates: boolean;
};
/** Plans with a price count as planned; logged expenses count as spent. Both are in the trip's currency. */
export function budgetOf(trip: Trip, extras: TripExtras, rates: Record<string, number> | null, base: string, today = todayISO()): BudgetSummary {
  const dates = tripDates(trip);
  let missingRates = false;
  const inTrip = (e: Expense) => {
    if (e.currency !== trip.currency && (!rates || (e.currency !== base && !rates[e.currency]) || (trip.currency !== base && !rates[trip.currency]))) missingRates = true;
    return convert(e.amount, e.currency, trip.currency, rates, base);
  };
  const spent = extras.expenses.reduce((s, e) => s + inTrip(e), 0);
  const plannedCosts = trip.activities.reduce((s, a) => s + (a.cost || 0), 0);
  const planned = plannedCosts + spent;
  const byDay = dates.map((date) => ({
    date,
    amount: trip.activities.filter((a) => a.date === date).reduce((s, a) => s + (a.cost || 0), 0)
      + extras.expenses.filter((e) => e.date === date).reduce((s, e) => s + inTrip(e), 0),
  }));
  const limit = trip.budget || 0;
  const remaining = limit - planned;
  const daysLeft = Math.max(1, dates.filter((d) => d >= today).length || dates.length);
  return { planned, spent, limit, remaining, perDayLeft: limit ? remaining / daysLeft : 0, byDay, missingRates };
}

/* ------------------------------------------------------------------ shared costs */

export type Balance = { person: string; amount: number };
export type Transfer = { from: string; to: string; amount: number };

export function nameOf(people: Person[], id: string, myName = 'You'): string {
  return id === ME ? myName : people.find((p) => p.id === id)?.name ?? 'Someone';
}

/**
 * Net balance per person in the trip currency: positive means they are owed. Each expense is split evenly
 * between `splitWith` (or charged to the payer alone); recorded settlements move money between two people.
 */
export function balances(trip: Trip, extras: TripExtras, rates: Record<string, number> | null, base: string): Balance[] {
  const net = new Map<string, number>();
  const add = (id: string, v: number) => net.set(id, (net.get(id) ?? 0) + v);
  for (const e of extras.expenses) {
    const amount = convert(e.amount, e.currency, trip.currency, rates, base);
    const split = e.splitWith.length ? e.splitWith : [e.paidBy];
    add(e.paidBy, amount);
    for (const id of split) add(id, -amount / split.length);
  }
  for (const s of extras.settlements) {
    const amount = convert(s.amount, s.currency, trip.currency, rates, base);
    add(s.from, amount);
    add(s.to, -amount);
  }
  return [...net.entries()].map(([person, amount]) => ({ person, amount: Math.round(amount * 100) / 100 })).filter((b) => Math.abs(b.amount) >= 0.01);
}

/** The fewest transfers that settle everyone (greedy largest-first). */
export function transfers(list: Balance[]): Transfer[] {
  const owed = list.filter((b) => b.amount > 0).map((b) => ({ ...b })).sort((a, b) => b.amount - a.amount);
  const owes = list.filter((b) => b.amount < 0).map((b) => ({ ...b, amount: -b.amount })).sort((a, b) => b.amount - a.amount);
  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < owes.length && j < owed.length) {
    const amount = Math.min(owes[i].amount, owed[j].amount);
    if (amount >= 0.01) out.push({ from: owes[i].person, to: owed[j].person, amount: Math.round(amount * 100) / 100 });
    owes[i].amount -= amount; owed[j].amount -= amount;
    if (owes[i].amount < 0.01) i++;
    if (owed[j].amount < 0.01) j++;
  }
  return out;
}

/* ------------------------------------------------------------------ packing */

export type PackingSummary = { total: number; packed: number; grams: number; packedGrams: number; limitGrams: number };
export function packingOf(w: Workspace, trip: Trip): PackingSummary {
  const rows = packing(w, trip);
  const grams = rows.reduce((s, r) => s + r.weight * r.quantity, 0);
  const packedGrams = rows.filter((r) => r.packed).reduce((s, r) => s + r.weight * r.quantity, 0);
  return { total: rows.length, packed: rows.filter((r) => r.packed).length, grams, packedGrams, limitGrams: (trip.weightLimit || 0) * 1000 };
}

/* ------------------------------------------------------------------ travel stats */

export type TravelStats = { trips: number; countries: string[]; days: number; upcoming: number; longest: number };

/** Polarsteps-style totals: trips taken or under way, distinct countries, days away so far, and what's ahead. */
export function travelStats(trips: Trip[], today = todayISO(), countryOf: (destination: string) => string = (d) => d.split(',').pop()?.trim() ?? ''): TravelStats {
  const started = trips.filter((t) => t.start <= today);
  const countries = [...new Set(started.map((t) => countryOf(t.destination)).filter(Boolean))];
  const days = started.reduce((sum, t) => sum + daysFromToday(t.end < today ? t.end : today, t.start) + 1, 0);
  const longest = trips.reduce((max, t) => Math.max(max, daysFromToday(t.end, t.start) + 1), 0);
  return { trips: started.length, countries, days, upcoming: trips.filter((t) => t.start > today).length, longest };
}
