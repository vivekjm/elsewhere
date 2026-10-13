/**
 * Per-trip details the shared web workspace doesn't model, stored in Supabase `public.trip_extras`
 * (one row per user and trip, owner-only). Every read is normalised: unknown or malformed values
 * fall back to defaults instead of failing, so a row written by another client can never crash the app.
 */
import { uid } from './model';

export const TRIP_KINDS = ['city', 'beach', 'trek', 'road', 'dive'] as const;
export type TripKind = (typeof TRIP_KINDS)[number];

export const EXPENSE_CATEGORIES = ['stay', 'food', 'move', 'sight', 'shopping', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const DOCUMENT_KINDS = ['flight', 'stay', 'ticket', 'insurance', 'passport', 'visa', 'other'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const GEAR_GROUPS = ['sleep', 'layers', 'safety', 'kit', 'other'] as const;
export type GearGroup = (typeof GEAR_GROUPS)[number];

/** The account holder in people lists, expenses and votes. */
export const ME = 'me';

export type Person = { id: string; name: string };
export type Expense = {
  id: string; title: string; amount: number; currency: string; category: ExpenseCategory;
  date: string; paidBy: string; splitWith: string[]; createdAt: string;
};
export type Settlement = { id: string; from: string; to: string; amount: number; currency: string; date: string };
export type PollOption = { id: string; label: string };
export type Poll = { id: string; question: string; options: PollOption[]; votes: Record<string, string>; closesAt: string; createdAt: string };
export type TripDocument = {
  id: string; kind: DocumentKind; title: string; detail: string; date: string;
  /** A file kept on this device only (relative to the documents directory). */
  file?: { name: string; path: string; mime: string };
  createdAt: string;
};
export type Stage = {
  id: string; date: string; title: string; from: string; to: string;
  startAltitude: number; endAltitude: number; distanceKm: number; hours: number; done: boolean;
};
export type GearItem = { id: string; name: string; group: GearGroup; bag: 'porter' | 'day'; grams: number; packed: boolean; missing: boolean };
export type Permit = { id: string; name: string; reference: string; done: boolean };
export type TrainingSession = { id: string; title: string; date: string; done: boolean };
export type CheckIn = { id: string; at: string; altitude: number; spo2: number; heartRate: number; score: number; note: string };
export type Adventure = {
  summitName: string; summitAltitude: number; porterLimitKg: number;
  stages: Stage[]; gear: GearItem[]; permits: Permit[]; training: TrainingSession[]; checkIns: CheckIn[];
  guide: { name: string; phone: string }; emergency: { name: string; relation: string; phone: string }; rescuePhone: string;
  checkInReminders: boolean;
};
export type Dive = { id: string; date: string; site: string; depth: number; minutes: number; temperature: number };
/** Where a plan is on the map, found once from its "where" text. `query` is the text it was found from. */
export type PlanPlace = { lat: number; lng: number; query: string };
/** A travel-journal check-in (Polarsteps-style step): where you were, when, and a note. */
export type JournalStep = { id: string; at: string; lat: number; lng: number; place: string; note: string };
export type TripExtras = {
  v: 1; kind: TripKind; people: Person[]; expenses: Expense[]; settlements: Settlement[]; polls: Poll[];
  documents: TripDocument[]; adventure: Adventure; dives: Dive[]; rating: number; recapNote: string;
  places: Record<string, PlanPlace>; journal: JournalStep[];
  /** Set on a trip that came from someone else's invite: their display name. */
  invitedBy: string; updatedAt: string;
};

/* ------------------------------------------------------------------ normalisers */

const str = (v: unknown, max = 200, fallback = ''): string => typeof v === 'string' ? v.slice(0, max) : fallback;
const num = (v: unknown, min: number, max: number, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const bool = (v: unknown, fallback = false): boolean => typeof v === 'boolean' ? v : fallback;
const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T =>
  typeof v === 'string' && (values as readonly string[]).includes(v) ? v as T : fallback;
const arr = <T>(v: unknown, max: number, parse: (x: unknown) => T | null): T[] =>
  Array.isArray(v) ? v.slice(0, max).map(parse).filter((x): x is T => x !== null) : [];
const obj = (v: unknown): Record<string, unknown> | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const idOf = (v: unknown) => { const s = str(v, 100); return s || null; };
const isoDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
const currency = (v: unknown, fallback: string) => typeof v === 'string' && /^[A-Z]{3}$/.test(v) ? v : fallback;

function person(v: unknown): Person | null {
  const o = obj(v); const id = idOf(o?.id); const name = str(o?.name, 80).trim();
  return o && id && name ? { id, name } : null;
}
function expense(v: unknown): Expense | null {
  const o = obj(v); const id = idOf(o?.id); if (!o || !id) return null;
  const title = str(o.title, 200).trim(); if (!title) return null;
  return {
    id, title, amount: num(o.amount, 0, 1e9), currency: currency(o.currency, 'EUR'),
    category: oneOf(o.category, EXPENSE_CATEGORIES, 'other'), date: isoDate(o.date),
    paidBy: str(o.paidBy, 100, ME) || ME, splitWith: arr(o.splitWith, 50, idOf), createdAt: str(o.createdAt, 40),
  };
}
function settlement(v: unknown): Settlement | null {
  const o = obj(v); const id = idOf(o?.id); if (!o || !id) return null;
  return { id, from: str(o.from, 100), to: str(o.to, 100), amount: num(o.amount, 0, 1e9), currency: currency(o.currency, 'EUR'), date: isoDate(o.date) };
}
function poll(v: unknown): Poll | null {
  const o = obj(v); const id = idOf(o?.id); if (!o || !id) return null;
  const options = arr(o.options, 12, (x) => { const p = obj(x); const oid = idOf(p?.id); const label = str(p?.label, 120).trim(); return oid && label ? { id: oid, label } : null; });
  const votes: Record<string, string> = {};
  const raw = obj(o.votes) ?? {};
  for (const [k, val] of Object.entries(raw).slice(0, 50)) if (typeof val === 'string' && options.some((x) => x.id === val)) votes[k.slice(0, 100)] = val;
  const question = str(o.question, 200).trim();
  return question && options.length >= 2 ? { id, question, options, votes, closesAt: isoDate(o.closesAt), createdAt: str(o.createdAt, 40) } : null;
}
function doc(v: unknown): TripDocument | null {
  const o = obj(v); const id = idOf(o?.id); if (!o || !id) return null;
  const title = str(o.title, 200).trim(); if (!title) return null;
  const f = obj(o.file);
  const file = f && str(f.path, 300) ? { name: str(f.name, 200), path: str(f.path, 300), mime: str(f.mime, 100) } : undefined;
  return { id, kind: oneOf(o.kind, DOCUMENT_KINDS, 'other'), title, detail: str(o.detail, 500), date: isoDate(o.date), file, createdAt: str(o.createdAt, 40) };
}
function stage(v: unknown): Stage | null {
  const o = obj(v); const id = idOf(o?.id); if (!o || !id) return null;
  return {
    id, date: isoDate(o.date), title: str(o.title, 200), from: str(o.from, 120), to: str(o.to, 120),
    startAltitude: num(o.startAltitude, -500, 9000), endAltitude: num(o.endAltitude, -500, 9000),
    distanceKm: num(o.distanceKm, 0, 500), hours: num(o.hours, 0, 48), done: bool(o.done),
  };
}
function gear(v: unknown): GearItem | null {
  const o = obj(v); const id = idOf(o?.id); const name = str(o?.name, 200).trim(); if (!o || !id || !name) return null;
  return { id, name, group: oneOf(o.group, GEAR_GROUPS, 'kit'), bag: o.bag === 'day' ? 'day' : 'porter', grams: num(o.grams, 0, 50000), packed: bool(o.packed), missing: bool(o.missing) };
}
function permit(v: unknown): Permit | null {
  const o = obj(v); const id = idOf(o?.id); const name = str(o?.name, 200).trim(); if (!o || !id || !name) return null;
  return { id, name, reference: str(o.reference, 120), done: bool(o.done) };
}
function session(v: unknown): TrainingSession | null {
  const o = obj(v); const id = idOf(o?.id); const title = str(o?.title, 200).trim(); if (!o || !id || !title) return null;
  return { id, title, date: isoDate(o.date), done: bool(o.done) };
}
function checkIn(v: unknown): CheckIn | null {
  const o = obj(v); const id = idOf(o?.id); if (!o || !id) return null;
  return { id, at: str(o.at, 40), altitude: num(o.altitude, -500, 9000), spo2: num(o.spo2, 50, 100, 95), heartRate: num(o.heartRate, 30, 220, 70), score: Math.round(num(o.score, 0, 3)), note: str(o.note, 500) };
}
function dive(v: unknown): Dive | null {
  const o = obj(v); const id = idOf(o?.id); const site = str(o?.site, 200).trim(); if (!o || !id || !site) return null;
  return { id, date: isoDate(o.date), site, depth: num(o.depth, 0, 330), minutes: num(o.minutes, 0, 600), temperature: num(o.temperature, -2, 40, 0) };
}

export function emptyAdventure(): Adventure {
  return {
    summitName: '', summitAltitude: 0, porterLimitKg: 15, stages: [], gear: [], permits: [], training: [], checkIns: [],
    guide: { name: '', phone: '' }, emergency: { name: '', relation: '', phone: '' }, rescuePhone: '', checkInReminders: true,
  };
}

function adventure(v: unknown): Adventure {
  const o = obj(v); const base = emptyAdventure(); if (!o) return base;
  const g = obj(o.guide), e = obj(o.emergency);
  return {
    summitName: str(o.summitName, 120), summitAltitude: num(o.summitAltitude, 0, 9000), porterLimitKg: num(o.porterLimitKg, 0, 60, 15),
    stages: arr(o.stages, 60, stage), gear: arr(o.gear, 300, gear), permits: arr(o.permits, 30, permit),
    training: arr(o.training, 100, session), checkIns: arr(o.checkIns, 200, checkIn),
    guide: { name: str(g?.name, 120), phone: str(g?.phone, 40) },
    emergency: { name: str(e?.name, 120), relation: str(e?.relation, 60), phone: str(e?.phone, 40) },
    rescuePhone: str(o.rescuePhone, 40), checkInReminders: bool(o.checkInReminders, true),
  };
}

export function emptyExtras(kind: TripKind = 'city'): TripExtras {
  return {
    v: 1, kind, people: [], expenses: [], settlements: [], polls: [], documents: [], adventure: emptyAdventure(),
    dives: [], rating: 0, recapNote: '', places: {}, journal: [], invitedBy: '', updatedAt: new Date().toISOString(),
  };
}

/** Reads any stored value as `TripExtras`, keeping what is valid. Rows in another format start fresh. */
export function parseExtras(value: unknown): TripExtras {
  const o = obj(value);
  if (!o || o.v !== 1) return emptyExtras();
  return {
    v: 1, kind: oneOf(o.kind, TRIP_KINDS, 'city'), people: arr(o.people, 50, person), expenses: arr(o.expenses, 2000, expense),
    settlements: arr(o.settlements, 500, settlement), polls: arr(o.polls, 50, poll), documents: arr(o.documents, 200, doc),
    adventure: adventure(o.adventure), dives: arr(o.dives, 500, dive), rating: Math.round(num(o.rating, 0, 5)),
    recapNote: str(o.recapNote, 2000), places: places(o.places), journal: arr(o.journal, 500, journalStep),
    invitedBy: str(o.invitedBy, 80), updatedAt: str(o.updatedAt, 40),
  };
}

const coord = (v: unknown, limit: number) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= limit ? v : null;
function places(v: unknown): Record<string, PlanPlace> {
  const out: Record<string, PlanPlace> = {};
  for (const [id, raw] of Object.entries(obj(v) ?? {}).slice(0, 2000)) {
    const o = obj(raw); const lat = coord(o?.lat, 90), lng = coord(o?.lng, 180);
    if (lat !== null && lng !== null) out[id.slice(0, 100)] = { lat, lng, query: str(o?.query, 300) };
  }
  return out;
}
function journalStep(v: unknown): JournalStep | null {
  const o = obj(v); const id = idOf(o?.id); const lat = coord(o?.lat, 90), lng = coord(o?.lng, 180);
  if (!o || !id || lat === null || lng === null) return null;
  return { id, at: str(o.at, 40), lat, lng, place: str(o.place, 200), note: str(o.note, 1000) };
}

export const newId = uid;
