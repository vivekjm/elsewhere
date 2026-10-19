/**
 * Planning together: everyone's input combined into one draft. The ideas (places anyone added: from a reel, a link,
 * typed in, or suggested by AI) carry the group's votes; each person's preferences (pace, food, budget) and the
 * shared plan settings decide how the days are paced. The rules are plain, so the board can say why:
 *
 * - An idea most of the group wants is a must; one at least someone wants is a maybe; one nobody wants is left out.
 *   On your own, anything you want is a must.
 * - A place someone pinned to a day stays on that day.
 * - Pace: whatever the group set for everyone, else the preference most people share (a tie is balanced).
 * - Food: if anyone eats Jain or veg, meal breaks say so.
 * - Plans added by hand stay where they are, and take room on their day.
 *
 * Pure: no network, no React Native (types only), so it's unit-tested.
 */
import type { GroupPrefs, Member, Person, PlanState, ShortlistItem } from '../data/extras';
import type { Activity, Trip } from '../data/model';
import { isoAdd, kindOf, type Answers, type Food, type Kind, type Pace, type PlanPlace, type Priority } from './planmode';

export type Voter = { id: string; name: string; prefs: GroupPrefs };

/** Who's planning: members who haven't said they can't come (a live trip), else you and the people on the trip. */
export function votersOf(extras: { members: Member[]; people: Person[] }, me: string, myName = 'You'): Voter[] {
  if (extras.members.length) return extras.members.filter((m) => m.rsvp !== 'out').map((m) => ({ id: m.id, name: m.id === me ? myName : m.name, prefs: m.prefs }));
  return [{ id: me, name: myName, prefs: {} }, ...extras.people.map((p) => ({ id: p.id, name: p.name, prefs: {} }))];
}

/** How much the group wants an idea, from its votes. */
export function priorityOf(item: Pick<ShortlistItem, 'votes' | 'pinned'>, voters: number): Priority {
  const n = item.votes.length;
  if (item.pinned) return 'must';
  if (!n) return 'skip';
  if (voters <= 1) return 'must';
  return n * 2 > voters || (voters === 2 && n === 2) ? 'must' : 'maybe';
}

const first = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`);
/** "Asha likes", "You like", "Asha and Rohan like". */
const verb = (names: string[], base: string) => (names.length === 1 && names[0] !== 'You' ? `${base}s` : base);
const mid = (names: string[]) => first(names).replace(/\bYou\b/g, 'you');
/** Names at the start of a sentence: "You and Asha", "Asha and you". */
const lead = (names: string[]) => { const t = mid(names); return t.charAt(0).toUpperCase() + t.slice(1); };

/** The group's pace and food, with the reason for each. */
export function groupStyle(voters: Voter[], plan: PlanState | null): { pace: Pace; food: Food; budget: Answers['budget']; why: { pace: string; food: string } } {
  let pace: Pace = 'balanced';
  let paceWhy = 'Nobody has said how they like to travel yet: a balanced pace.';
  const relaxed = voters.filter((v) => v.prefs.pace === 'relaxed').map((v) => v.name);
  const packed = voters.filter((v) => v.prefs.pace === 'packed').map((v) => v.name);
  if (plan?.pace) { pace = plan.pace; paceWhy = 'Set for the whole group.'; }
  else if (relaxed.length > packed.length) { pace = 'relaxed'; paceWhy = `${lead(relaxed)} ${verb(relaxed, 'like')} to take it easy.`; }
  else if (packed.length > relaxed.length) { pace = 'packed'; paceWhy = `${lead(packed)} ${verb(packed, 'want')} to see it all.`; }
  else if (relaxed.length) { paceWhy = `Split between taking it easy (${mid(relaxed)}) and seeing it all (${mid(packed)}): balanced.`; }
  const jain = voters.filter((v) => v.prefs.food === 'jain').map((v) => v.name);
  const veg = voters.filter((v) => v.prefs.food === 'veg').map((v) => v.name);
  let food: Food = 'any';
  let foodWhy = 'No food preferences shared.';
  if (plan?.food) { food = plan.food; foodWhy = 'Set for the whole group.'; }
  else if (jain.length) { food = 'jain'; foodWhy = `${lead(jain)} ${verb(jain, 'eat')} Jain${veg.length ? `, ${mid(veg)} veg` : ''}: meal breaks say so.`; }
  else if (veg.length) { food = 'veg'; foodWhy = `${lead(veg)} ${verb(veg, 'eat')} veg: meal breaks say so.`; }
  const budgets = voters.map((v) => v.prefs.budget).filter(Boolean);
  const budget: Answers['budget'] = budgets.includes('backpacker') ? 'backpacker' : budgets.length && budgets.every((b) => b === 'treat') ? 'treat' : 'comfortable';
  return { pace, food, budget, why: { pace: paceWhy, food: foodWhy } };
}

export type IdeaStatus = { item: ShortlistItem; priority: Priority; votes: number; of: number };

/** Every idea with where the group stands on it, most wanted first. */
export function ideaStatus(items: ShortlistItem[], voters: Voter[]): IdeaStatus[] {
  const ids = new Set(voters.map((v) => v.id));
  const of = Math.max(1, voters.length);
  return items.map((item) => {
    const votes = item.votes.filter((v) => ids.has(v)).length || item.votes.length;
    return { item, votes, of, priority: priorityOf({ votes: item.votes, pinned: item.pinned }, of) };
  }).sort((a, b) => ({ must: 0, maybe: 1, skip: 2 }[a.priority] - { must: 0, maybe: 1, skip: 2 }[b.priority]) || b.votes - a.votes || a.item.createdAt.localeCompare(b.item.createdAt));
}

const DAY_MS = 86400000;
export const tripLength = (t: Pick<Trip, 'start' | 'end'>) => Math.max(1, Math.round((Date.parse(`${t.end}T12:00:00Z`) - Date.parse(`${t.start}T12:00:00Z`)) / DAY_MS) + 1);

/** The draft's input: the ideas as places with priorities, the answers, and how many hand-made plans each day has. */
export function draftInput(trip: Pick<Trip, 'start' | 'end' | 'destination' | 'travellers' | 'activities'>, extras: { shortlist: ShortlistItem[]; members: Member[]; people: Person[]; plan: PlanState | null }, me: string): {
  places: PlanPlace[]; answers: Answers; busy: number[]; voters: Voter[]; why: { pace: string; food: string }; byHand: Map<string, string>;
} {
  const voters = votersOf(extras, me);
  const style = groupStyle(voters, extras.plan);
  const days = tripLength(trip);
  const dayOf = (iso: string) => { const i = Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${trip.start}T12:00:00Z`)) / DAY_MS); return i >= 0 && i < days ? i : undefined; };
  const drafted = new Set(extras.plan?.drafted ?? []);
  // An idea someone already put in the itinerary by hand is planned: it isn't drafted again. Idea id → its date.
  const kept = trip.activities.filter((a) => !drafted.has(a.id));
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const byHand = new Map(extras.shortlist.flatMap((x) => { const a = kept.find((k) => same(k.title, x.title)); return a ? [[x.id, a.date] as const] : []; }));
  const places: PlanPlace[] = extras.shortlist.filter((x) => !byHand.has(x.id)).map((x) => ({
    id: x.id, title: x.title, lat: x.lat, lng: x.lng, area: x.place && x.place !== x.title ? x.place : '',
    kind: (x.kind as Kind | undefined) ?? kindOf(x.title), pick: priorityOf(x, voters.length), slot: x.slot,
    evidence: x.quote ? [{ reelId: '', quote: x.quote, source: x.via === 'ai' ? 'ai' : x.via === 'reel' ? 'caption' : 'you' }] : [],
    ...(x.pinned && dayOf(x.pinned) !== undefined ? { day: dayOf(x.pinned) } : {}),
  }));
  const busy = Array.from({ length: days }, (_, d) => kept.filter((a) => a.date === isoAdd(trip.start, d)).length);
  const answers: Answers = {
    destination: trip.destination, start: trip.start, days, party: voters.length <= 1 ? 'solo' : 'friends', people: Math.max(voters.length, trip.travellers || 1),
    pace: style.pace, food: style.food, budget: style.budget, arrive: extras.plan?.arrive ?? 'afternoon', leave: extras.plan?.leave ?? 'afternoon', maybes: 'fit',
  };
  return { places, answers, busy, voters, why: style.why, byHand };
}

/**
 * Applying a draft: the previous draft's stops are replaced, plans people added by hand stay. Arrival and departure
 * stops are only added on days with no travel or stay plan already (a flight you imported says it better).
 */
export function applyDraft<A extends Pick<Activity, 'id' | 'date' | 'category'>>(activities: A[], drafted: string[], next: (A & { kind?: string })[]): { activities: A[]; drafted: string[] } {
  const old = new Set(drafted);
  const kept = activities.filter((a) => !old.has(a.id));
  const hasTravel = (date: string) => kept.some((a) => a.date === date && (a.category === 'Travel' || a.category === 'Stay'));
  const added = next.filter((a) => !((a.kind === 'arrive' || a.kind === 'leave') && hasTravel(a.date))).map(({ kind: _kind, ...a }) => a as unknown as A);
  return { activities: [...kept, ...added], drafted: added.map((a) => a.id) };
}
