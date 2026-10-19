/**
 * Live shared trips: turning a person's trip into the shared document everyone on it edits, and back.
 *
 * Shared: the plan (days, stays, timed plans), the group's costs, settlements, votes, the date poll, the people who
 * haven't joined yet ("guests"), and a trek's route and summit details. Private, never sent: wardrobe outfits and
 * gear on plans, packing ticks and packing extras, documents, health check-ins, the journal, rating and notes.
 *
 * People: on the server every member is `u-<their user id>`; on the phone your own id is `ME`. Guests (added by
 * name, without the app) keep their `p-…` ids. These functions translate in both directions.
 *
 * Merging: `merge3(base, local, remote)` keeps both sides' changes when two people edit at once. Lists of records
 * merge by id; anything else takes the side that changed (the remote side if both did).
 */
import { groupPrefs, ME, planState, shortlistItemOf, type Adventure, type DatePoll, type Member, type Person, type TripExtras } from './extras';
import type { Trip } from './model';

export type SharedDoc = {
  trip: Omit<Trip, 'packed' | 'extras'>;
  shared: {
    kind: TripExtras['kind'];
    guests: Person[];
    expenses: TripExtras['expenses'];
    settlements: TripExtras['settlements'];
    polls: TripExtras['polls'];
    datePoll: DatePoll | null;
    kitty: TripExtras['kitty'];
    pass: boolean;
    shortlist: TripExtras['shortlist'];
    readyItems: TripExtras['readyItems'];
    /** The planning board: shared settings and the last draft. */
    plan?: TripExtras['plan'];
    route: Pick<Adventure, 'summitName' | 'summitAltitude' | 'porterLimitKg' | 'stages' | 'guide' | 'rescuePhone'>;
  };
};

export type MemberRow = { user_id: string; display_name: string; role: 'organiser' | 'member'; rsvp: Member['rsvp']; upi: string | null; ready: Record<string, boolean>; prefs?: Record<string, unknown> };

export const memberId = (userId: string) => `u-${userId}`;

/** Swaps person ids everywhere they appear in the group's records. */
function swapIds<T extends Pick<SharedDoc['shared'], 'expenses' | 'settlements' | 'polls' | 'datePoll' | 'kitty' | 'shortlist' | 'plan'>>(s: T, swap: (id: string) => string): T {
  return {
    ...s,
    plan: s.plan ? { ...s.plan, draftedBy: s.plan.draftedBy ? swap(s.plan.draftedBy) : '' } : null,
    shortlist: (s.shortlist ?? []).map((x) => ({ ...x, addedBy: swap(x.addedBy), votes: x.votes.map(swap) })),
    kitty: s.kitty ? { ...s.kitty, holder: swap(s.kitty.holder) } : null,
    expenses: s.expenses.map((e) => ({ ...e, paidBy: swap(e.paidBy), splitWith: e.splitWith.map(swap) })),
    settlements: s.settlements.map((x) => ({ ...x, from: swap(x.from), to: swap(x.to) })),
    polls: s.polls.map((p) => ({ ...p, votes: Object.fromEntries(Object.entries(p.votes).map(([k, v]) => [swap(k), v])) })),
    datePoll: s.datePoll ? { ...s.datePoll, votes: Object.fromEntries(Object.entries(s.datePoll.votes).map(([k, v]) => [swap(k), v])) } : null,
  };
}

/** Your trip and extras as the shared document (your id becomes your member id). */
export function toShared(trip: Trip, extras: TripExtras, myUserId: string): SharedDoc {
  const mine = memberId(myUserId);
  const { packed: _packed, extras: _extras, ...rest } = trip;
  const sharedTrip = {
    ...rest,
    activities: trip.activities.map((a) => ({ ...a, outfitId: '', gear: [] })),
    days: Object.fromEntries(Object.entries(trip.days).map(([d, day]) => [d, { ...day, outfitId: '', outfitIds: [], gear: [] }])),
  };
  const a = extras.adventure;
  return {
    trip: sharedTrip,
    shared: swapIds({
      kind: extras.kind,
      guests: extras.people.filter((p) => !p.id.startsWith('u-')),
      expenses: extras.expenses, settlements: extras.settlements, polls: extras.polls, datePoll: extras.datePoll,
      kitty: extras.kitty, pass: extras.pass, shortlist: extras.shortlist, readyItems: extras.readyItems, plan: extras.plan,
      route: { summitName: a.summitName, summitAltitude: a.summitAltitude, porterLimitKg: a.porterLimitKg, stages: a.stages, guide: a.guide, rescuePhone: a.rescuePhone },
    }, (id) => (id === ME ? mine : id)),
  };
}

/**
 * The shared document applied to your copy: shared fields from the document, private fields kept from your copy.
 * Returns the new trip and the extras changes.
 */
export function fromShared(doc: SharedDoc, rows: MemberRow[], myUserId: string, local: Trip | undefined, extras: TripExtras): { trip: Trip; extras: TripExtras } {
  const mine = memberId(myUserId);
  const swap = (id: string) => (id === mine ? ME : id);
  const keepActivity = new Map((local?.activities ?? []).map((a) => [a.id, a]));
  const trip: Trip = {
    ...doc.trip,
    activities: doc.trip.activities.map((a) => ({ ...a, outfitId: keepActivity.get(a.id)?.outfitId ?? '', gear: keepActivity.get(a.id)?.gear ?? [] })),
    days: Object.fromEntries(Object.entries(doc.trip.days).map(([d, day]) => {
      const own = local?.days[d];
      return [d, { ...day, outfitId: own?.outfitId ?? '', outfitIds: own?.outfitIds ?? [], gear: own?.gear ?? [] }];
    })),
    packed: local?.packed ?? [],
    extras: local?.extras ?? [],
  };
  const members: Member[] = rows.map((r) => ({
    id: r.user_id === myUserId ? ME : memberId(r.user_id), name: r.display_name, role: r.role, rsvp: r.rsvp,
    ...(r.upi ? { upi: r.upi } : {}), ready: r.ready ?? {}, prefs: groupPrefs(r.prefs),
  }));
  const s = swapIds(doc.shared, swap);
  // Everyone you share costs with: the members who joined, then the guests who haven't.
  const people: Person[] = [
    ...members.filter((m) => m.id !== ME).map((m) => ({ id: m.id, name: m.name, ...(m.upi ? { upi: m.upi } : {}) })),
    ...s.guests,
  ];
  return {
    trip,
    extras: {
      ...extras,
      kind: s.kind, people, expenses: s.expenses, settlements: s.settlements, polls: s.polls, datePoll: s.datePoll, members,
      kitty: s.kitty ?? null, pass: !!s.pass, readyItems: s.readyItems ?? [],
      // What friends send is checked like anything read from storage.
      shortlist: (s.shortlist ?? []).map(shortlistItemOf).filter((x): x is NonNullable<typeof x> => !!x), plan: planState(s.plan),
      adventure: { ...extras.adventure, ...s.route },
      invitedBy: rows.find((r) => r.role === 'organiser' && r.user_id !== myUserId)?.display_name ?? '',
    },
  };
}

/* ------------------------------------------------------------------ three-way merge */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isRecord = (v: unknown): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);
const isIdList = (v: unknown): v is { id: string }[] => Array.isArray(v) && v.length > 0 && v.every((x) => isRecord(x) && typeof x.id === 'string');

/**
 * Combines your changes (base → local) with someone else's (base → remote). Objects merge key by key; lists of
 * records with ids merge record by record (adds and deletes on either side are kept, the remote order first);
 * any other value takes whichever side changed it, and the remote side when both did.
 */
export function merge3<T>(base: T, local: T, remote: T): T {
  if (same(local, base)) return remote;
  if (same(remote, base) || same(local, remote)) return local;
  if (isRecord(base) && isRecord(local) && isRecord(remote)) {
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      const inLocal = k in local, inRemote = k in remote, inBase = k in base;
      if (!inLocal && inBase && same(remote[k], base[k])) continue; // you removed it
      if (!inRemote && inBase && same(local[k], base[k])) continue; // they removed it
      if (!inLocal && !inBase) { out[k] = remote[k]; continue; }
      if (!inRemote && !inBase) { out[k] = local[k]; continue; }
      out[k] = merge3(base[k], local[k], remote[k]);
    }
    return out as T;
  }
  const lists = [base, local, remote].filter(Array.isArray);
  if (lists.length === 3 && [base, local, remote].some(isIdList) && [base, local, remote].every((l) => (l as unknown[]).length === 0 || isIdList(l))) {
    const b = new Map((base as { id: string }[]).map((x) => [x.id, x]));
    const l = new Map((local as { id: string }[]).map((x) => [x.id, x]));
    const r = new Map((remote as { id: string }[]).map((x) => [x.id, x]));
    const out: unknown[] = [];
    for (const item of remote as { id: string }[]) {
      const was = b.get(item.id), mine = l.get(item.id);
      if (!mine && was && same(item, was)) continue; // you deleted it; they didn't touch it
      out.push(mine && was ? merge3(was, mine, item) : mine && !was ? merge3(item, mine, item) : item);
    }
    for (const item of local as { id: string }[]) {
      if (r.has(item.id)) continue;
      const was = b.get(item.id);
      if (was && same(item, was)) continue; // they deleted it; you didn't touch it
      out.push(item); // you added it (or changed something they deleted: keep your version)
    }
    return out as T;
  }
  return remote;
}
