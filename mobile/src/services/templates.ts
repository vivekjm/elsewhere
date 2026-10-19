/**
 * "Do it again": a finished trip shared as a template (the days and plans, counted from day 1, plus the cost per
 * person) that anyone with the link can copy into a trip of their own on new dates. See
 * supabase/migrations/20261018_group_features.sql (trip_templates).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ACTIVITY_TYPES, addDays, daysBetween, tripDates, type Trip, type TripExtras } from '../data';

export type TemplateDay = { title: string; stay: string; stops: { time: string; title: string; place: string; category: string }[] };
export type Template = {
  code: string; author: string; name: string; destination: string; kind: TripExtras['kind']; theme: string | null; days: number;
  people: number; perPerson: number; currency: string; plan: TemplateDay[]; forks: number;
};

export const templateLink = (code: string) => `https://tripsloom.com/r/${code}`;

/** A trip as a template: plans by day number, without costs, notes, links or anything personal. */
export function toTemplate(trip: Trip): TemplateDay[] {
  return tripDates(trip).map((d) => ({
    title: trip.days[d]?.title ?? '',
    stay: trip.days[d]?.stay ?? '',
    stops: trip.activities.filter((a) => a.date === d).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
      .map((a) => ({ time: a.time, title: a.title, place: a.place, category: a.category })),
  }));
}

export async function publishTemplate(client: SupabaseClient, trip: Trip, extras: TripExtras, author: string, perPerson: number): Promise<string> {
  const { data, error } = await client.rpc('publish_template', {
    p_author: author || 'A traveller', p_name: trip.name, p_destination: trip.destination, p_kind: extras.kind, p_theme: trip.theme ?? null,
    p_days: daysBetween(trip.start, trip.end) + 1, p_people: Math.max(1, extras.people.length + 1), p_per_person: Math.round(perPerson),
    p_currency: trip.currency, p_plan: toTemplate(trip),
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function getTemplate(client: SupabaseClient, code: string): Promise<Template | null> {
  const { data, error } = await client.rpc('get_template', { p_code: code });
  if (error) throw new Error(error.message);
  return data ? (data as Template) : null;
}

/** The template's plans on new dates, starting `start`. */
export function planFrom(t: Template, start: string): { activities: Trip['activities']; days: Trip['days'] } {
  const activities: Trip['activities'] = [];
  const days: Trip['days'] = {};
  t.plan.slice(0, t.days).forEach((day, i) => {
    const date = addDays(start, i);
    if (day.title || day.stay) days[date] = { outfitId: '', outfitIds: [], title: day.title.slice(0, 200), stay: day.stay.slice(0, 200), notes: '', gear: [] };
    for (const s of day.stops.slice(0, 20)) {
      activities.push({
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`, date, time: /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time) ? s.time : '', endTime: '',
        title: s.title.slice(0, 200), place: s.place.slice(0, 200), category: (ACTIVITY_TYPES as readonly string[]).includes(s.category) ? s.category as Trip['activities'][number]['category'] : 'Explore',
        cost: 0, link: '', notes: '', outfitId: '', gear: [], completed: false,
      });
    }
  });
  return { activities, days };
}
