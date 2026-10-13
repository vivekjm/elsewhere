/**
 * What the home-screen widgets and the trip-day Live Activity show. Pure functions of the workspace, the
 * trip extras and the time, so the same snapshot drives iOS (expo-widgets) and Android (react-native-android-widget).
 * Widget props must be plain JSON: dates travel as epoch milliseconds.
 */
import type { TripExtras } from '../data/extras';
import type { Activity, Workspace } from '../data/model';
import { altitude, compactRange, distance, fromDate, toDate } from '../domain/format';
import { featuredTrip, packingOf, sortPlans, statusOf } from '../domain/trips';

export type WidgetPlan = { time: string; title: string; symbol: string; at: number };

export type NextTripProps = {
  state: 'empty' | 'upcoming' | 'active' | 'past';
  name: string;
  place: string;
  /** "In 4 days", "Tomorrow", "Day 2 of 5", "Trip complete". */
  headline: string;
  dateLabel: string;
  /** Large number for the small widget: days to go, or the day of the trip. */
  big: string;
  bigLabel: string;
  /** 0–1: share of the trip done when active, of packing when upcoming. */
  progress: number;
  packed: number;
  packTotal: number;
  /** Remaining plans from this entry's time, at most five. */
  plans: WidgetPlan[];
  weather: string;
  weatherSymbol: string;
  url: string;
};

export type WeatherLookup = (tripId: string, date: string) => { symbol: string; label: string } | null;

const SYMBOL: Record<Activity['category'], string> = {
  Explore: 'mappin.and.ellipse', 'Food & drink': 'fork.knife', Travel: 'tram.fill', Stay: 'bed.double.fill', Event: 'ticket.fill', Other: 'circle.grid.2x2.fill',
};

const at = (date: string, time: string) => {
  const d = toDate(date);
  const [h, m] = (time || '00:00').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
};

const EMPTY: NextTripProps = {
  state: 'empty', name: 'No trip yet', place: '', headline: 'Plan your next trip', dateLabel: '', big: '+', bigLabel: 'new trip',
  progress: 0, packed: 0, packTotal: 0, plans: [], weather: '', weatherSymbol: '', url: 'tripsloom:///new-trip',
};

/** The widget's content at `now`. */
export function nextTripProps(w: Workspace, extras: (id: string) => TripExtras, now: Date, weather?: WeatherLookup): NextTripProps {
  const today = fromDate(now);
  const trip = featuredTrip(w.trips, today);
  if (!trip) return EMPTY;
  const st = statusOf(trip, today);
  if (st.phase === 'past' && trip.end < fromDate(new Date(now.getTime() - 3 * 86400000))) return EMPTY;
  const pack = packingOf(w, trip);
  const isTrek = extras(trip.id).kind === 'trek';
  const plans = sortPlans(trip.activities)
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((a) => a.time ? at(a.date, a.time) + 30 * 60000 > now.getTime() : a.date >= today)
    .slice(0, 5)
    .map((a) => ({ time: a.date === today ? a.time || 'Today' : `${toDate(a.date).toLocaleDateString(undefined, { weekday: 'short' })}${a.time ? ` ${a.time}` : ''}`, title: a.title, symbol: SYMBOL[a.category] ?? 'circle.fill', at: a.time ? at(a.date, a.time) : at(a.date, '00:00') }));
  const day = st.phase === 'upcoming' ? trip.start : today;
  const forecast = weather?.(trip.id, day) ?? null;
  const headline = st.phase === 'active' ? `Day ${st.dayNumber} of ${st.totalDays}` : st.phase === 'past' ? 'Trip complete' : st.daysUntil === 1 ? 'Tomorrow' : `In ${st.daysUntil} days`;
  return {
    state: st.phase,
    name: trip.name,
    place: trip.destination.split(',')[0].trim() === trip.name.trim() ? '' : trip.destination.split(',')[0].trim(),
    headline,
    dateLabel: compactRange(trip.start, trip.end),
    big: st.phase === 'active' ? String(st.dayNumber) : st.phase === 'upcoming' ? String(st.daysUntil) : '✓',
    bigLabel: st.phase === 'active' ? `of ${st.totalDays} days` : st.phase === 'upcoming' ? (st.daysUntil === 1 ? 'day to go' : 'days to go') : 'done',
    progress: st.phase === 'active' ? st.dayNumber / st.totalDays : st.phase === 'upcoming' ? (pack.total ? pack.packed / pack.total : 0) : 1,
    packed: pack.packed,
    packTotal: pack.total,
    plans,
    weather: forecast?.label ?? '',
    weatherSymbol: forecast?.symbol ?? '',
    url: `tripsloom:///${isTrek ? 'adventure' : 'trip'}?trip=${encodeURIComponent(trip.id)}`,
  };
}

/**
 * Timeline entries for the next few days: now, every midnight and half an hour after each timed plan,
 * so the widget moves on by itself without the app running.
 */
export function nextTripTimeline(w: Workspace, extras: (id: string) => TripExtras, now = new Date(), weather?: WeatherLookup): { date: Date; props: NextTripProps }[] {
  const times = new Set<number>([now.getTime()]);
  const horizon = now.getTime() + 7 * 86400000;
  for (let i = 1; i <= 7; i++) { const d = new Date(now); d.setHours(0, 0, 5, 0); d.setDate(d.getDate() + i); times.add(d.getTime()); }
  const trip = featuredTrip(w.trips, fromDate(now));
  if (trip) for (const a of trip.activities) {
    if (!a.time) continue;
    const t = at(a.date, a.time) + 30 * 60000 + 1000;
    if (t > now.getTime() && t < horizon) times.add(t);
  }
  return [...times].sort((a, b) => a - b).slice(0, 48).map((t) => ({ date: new Date(t), props: nextTripProps(w, extras, new Date(t), weather) }));
}

/* ------------------------------------------------------------------ Live Activity */

export type TripDayProps = {
  tripId: string;
  kind: 'day' | 'trail';
  title: string;
  /** "Day 2 of 5". */
  status: string;
  symbol: string;
  /** Next plan, or the stage's destination. */
  next: string;
  /** Epoch ms of the next plan's start, 0 when untimed. */
  nextAt: number;
  metrics: { label: string; value: string }[];
  progress: number;
  compact: string;
  url: string;
};

/** Today's Live Activity for a trip under way, or null when there's nothing to follow. */
export function tripDayProps(w: Workspace, extras: (id: string) => TripExtras, unit: 'metric' | 'imperial', now = new Date()): TripDayProps | null {
  const today = fromDate(now);
  const trip = w.trips.filter((t) => t.start <= today && t.end >= today).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (!trip) return null;
  const st = statusOf(trip, today);
  const x = extras(trip.id);
  const status = `Day ${st.dayNumber} of ${st.totalDays}`;
  if (x.kind === 'trek') {
    const stage = x.adventure.stages.find((s) => s.date === today);
    if (!stage) return null;
    const climb = stage.endAltitude - stage.startAltitude;
    const all = x.adventure.stages.length;
    return {
      tripId: trip.id, kind: 'trail', title: trip.name, status, symbol: 'mountain.2.fill',
      next: stage.title || [stage.from, stage.to].filter(Boolean).join(' → ') || 'Today’s stage', nextAt: 0,
      metrics: [
        { label: 'Distance', value: stage.distanceKm ? distance(stage.distanceKm, unit) : '–' },
        { label: climb >= 0 ? 'Climb' : 'Descent', value: climb ? altitude(Math.abs(climb), unit) : '–' },
        { label: 'Sleep', value: stage.endAltitude ? altitude(stage.endAltitude, unit) : '–' },
      ],
      progress: all ? x.adventure.stages.filter((s) => s.done).length / all : 0,
      compact: stage.to ? stage.to.slice(0, 14) : status,
      url: `tripsloom:///adventure?trip=${encodeURIComponent(trip.id)}`,
    };
  }
  const plans = sortPlans(trip.activities.filter((a) => a.date === today));
  if (!plans.length) return null;
  const upcoming = plans.find((a) => !a.completed && (!a.time || at(today, a.time) + 30 * 60000 > now.getTime()));
  const done = plans.filter((a) => a.completed || (a.time && at(today, a.time) + 30 * 60000 <= now.getTime())).length;
  const after = upcoming ? plans[plans.indexOf(upcoming) + 1] : undefined;
  return {
    tripId: trip.id, kind: 'day', title: trip.name, status, symbol: upcoming ? SYMBOL[upcoming.category] : 'checkmark.circle.fill',
    next: upcoming ? upcoming.title : 'Nothing else planned today',
    nextAt: upcoming?.time ? at(today, upcoming.time) : 0,
    metrics: [
      { label: 'Starts', value: upcoming?.time || (upcoming ? 'Any time' : '–') },
      { label: 'Then', value: after ? `${after.time ? `${after.time} ` : ''}${after.title}`.slice(0, 22) : 'Free evening' },
      { label: 'Left today', value: String(plans.length - done) },
    ],
    progress: done / plans.length,
    compact: upcoming?.time || `${plans.length - done} left`,
    url: `tripsloom:///trip/days?trip=${encodeURIComponent(trip.id)}`,
  };
}

/** When today's Live Activity stops being current: the end of today. */
export function endOfToday(now = new Date()): Date {
  const d = new Date(now); d.setHours(23, 59, 0, 0); return d;
}

