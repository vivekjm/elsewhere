/** Visitor workspace format. Version 1 remains compatible with existing D1 rows.
 * Optional additions are normalised on read; unknown keys are never persisted.
 * The validator runs on both sides of the API and has no browser dependencies.
 */
export const CATEGORIES = ['Tops', 'Bottoms', 'Layers', 'Shoes', 'Accessories', 'Gear'] as const;
export const ACTIVITY_TYPES = ['Explore', 'Food & drink', 'Travel', 'Stay', 'Event', 'Other'] as const;
export const EXTRA_CATEGORIES = ['Essentials', 'Documents', 'Toiletries', 'Electronics', 'Health & care', 'Other'] as const;
export const SHAPES = ['tee', 'shirt', 'sweater', 'pants', 'coat', 'puffer', 'dress', 'sneakers', 'boots', 'bag', 'camera', 'bottle', 'hat', 'scarf', 'glasses'] as const;
export type Item = { id: string; name: string; category: typeof CATEGORIES[number]; weight: number; image: string; color?: string; shape?: typeof SHAPES[number]; notes?: string };
export type Outfit = { id: string; name: string; items: string[]; occasion?: string; notes?: string };
export type Activity = { id: string; date: string; time: string; endTime?: string; title: string; place: string; category: typeof ACTIVITY_TYPES[number]; cost: number; link: string; notes: string; outfitId: string; gear: string[]; completed?: boolean };
export type Day = { outfitId: string; outfitIds?: string[]; title?: string; stay: string; notes: string; gear?: string[] };
export type Extra = { id: string; name: string; quantity: number; weight: number; packed: boolean; category?: typeof EXTRA_CATEGORIES[number] };
export const CURRENCIES = ['EUR', 'USD', 'INR', 'GBP', 'NPR', 'JPY', 'AED', 'CAD', 'AUD'] as const;
export type Trip = { id: string; name: string; destination: string; start: string; end: string; travellers: number; budget: number; currency: typeof CURRENCIES[number]; weightLimit: number; activities: Activity[]; days: Record<string, Day>; extras: Extra[]; packed: string[]; theme?: 'mountains' | 'coast' | 'city'; notes?: string; sample?: boolean };
export type Workspace = { version: 1; trips: Trip[]; items: Item[]; outfits: Outfit[] };
export type PackRow = { id: string; name: string; category: string; weight: number; quantity: number; packed: boolean; automatic: boolean; image: string; dates: string[]; color?: string; shape?: Item['shape'] };
export class ValidationError extends Error {
  issues: { message: string }[];
  constructor(message: string) { super(message); this.name = 'ValidationError'; this.issues = [{ message }]; }
}
function fail(message: string): never { throw new ValidationError(message); }
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 200, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`Check ${label.toLowerCase()} (maximum ${max} characters).`);
  return required ? value.trim() : value;
}
function number(value: unknown, label: string, max: number, min = 0, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(`${label} must be ${integer ? 'a whole number ' : ''}between ${min} and ${max}.`);
  return value;
}
function boolean(value: unknown, label: string): boolean { if (typeof value !== 'boolean') fail(`Check ${label}.`); return value; }
function choice<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) fail(`Choose a valid ${label}.`);
  return value as T;
}
function list<T>(value: unknown, label: string, max: number, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > max) fail(`Check ${label} (at most ${max} entries).`);
  return value.map(parse);
}
const id = (v: unknown) => text(v, 'ID', 100, true);
const ids = (v: unknown, label: string, max = 100) => [...new Set(list(v, label, max, id))];
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '2200-12-31' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function date(v: unknown): string { if (!validDate(v)) fail('Enter a real calendar date between 1900 and 2200.'); return v; }
function time(v: unknown, optional = false): string { if (optional && v === '') return ''; if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) fail('Enter a valid 24-hour time.'); return v; }
export function safeLink(v: string): boolean {
  if (!v) return true;
  try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol) && !!u.hostname && !u.username && !u.password; } catch { return false; }
}
export function imagePath(v: unknown): v is string { return typeof v === 'string' && (v === '' || /^\/api\/images\/[a-f0-9-]{36}$/.test(v)); }
function parseItem(value: unknown): Item {
  const v = object(value, 'Item');
  if (!imagePath(v.image)) fail('The photo must be uploaded to this workspace.');
  const color = text(v.color ?? '#8b8b73', 'Colour', 7);
  if (!/^#[a-f0-9]{6}$/i.test(color)) fail('Choose a valid colour.');
  return { id: id(v.id), name: text(v.name, 'Item name', 200, true), category: choice(v.category, CATEGORIES, 'clothing category'), weight: number(v.weight, 'Item weight', 50000), image: v.image, color, shape: choice(v.shape ?? defaultShape(String(v.category)), SHAPES, 'illustration'), notes: text(v.notes ?? '', 'Item notes', 5000) };
}
export function defaultShape(category: string): Item['shape'] { return ({ Tops: 'shirt', Bottoms: 'pants', Layers: 'coat', Shoes: 'sneakers', Accessories: 'hat', Gear: 'bag' } as Record<string, Item['shape']>)[category] || 'tee'; }
function parseOutfit(value: unknown): Outfit {
  const v = object(value, 'Outfit');
  return { id: id(v.id), name: text(v.name, 'Outfit name', 200, true), items: ids(v.items, 'outfit pieces'), occasion: text(v.occasion ?? 'Everyday', 'Occasion', 100), notes: text(v.notes ?? '', 'Outfit notes', 5000) };
}
function parseActivity(value: unknown): Activity {
  const v = object(value, 'Activity'), link = text(v.link, 'Reference link', 2000), start = time(v.time, true), end = time(v.endTime ?? '', true);
  if (!safeLink(link)) fail('Use a full https:// or http:// reference link without credentials.');
  if (end && (!start || end <= start)) fail('The end time must be after the start time on the same day.');
  return { id: id(v.id), date: date(v.date), time: start, endTime: end, title: text(v.title, 'Activity title', 200, true), place: text(v.place, 'Place'), category: choice(v.category, ACTIVITY_TYPES, 'activity type'), cost: number(v.cost, 'Activity cost', 10000000), link, notes: text(v.notes, 'Activity notes', 5000), outfitId: text(v.outfitId, 'Outfit ID'), gear: ids(v.gear, 'activity gear'), completed: boolean(v.completed ?? false, 'activity status') };
}
function parseDay(value: unknown): Day {
  const v = object(value, 'Day');
  return { outfitId: text(v.outfitId ?? '', 'Outfit ID'), outfitIds: ids(v.outfitIds ?? [], 'day outfits'), title: text(v.title ?? '', 'Day title'), stay: text(v.stay, 'Accommodation'), notes: text(v.notes, 'Day notes', 5000), gear: ids(v.gear ?? [], 'day essentials') };
}
function parseExtra(value: unknown): Extra {
  const v = object(value, 'Packing item');
  return { id: id(v.id), name: text(v.name, 'Packing item name', 200, true), quantity: number(v.quantity, 'Quantity', 999, 1, true), weight: number(v.weight, 'Item weight', 50000), packed: boolean(v.packed, 'packing status'), category: choice(v.category ?? 'Essentials', EXTRA_CATEGORIES, 'packing category') };
}
function unique(records: { id: string }[], label: string) { if (new Set(records.map(r => r.id)).size !== records.length) fail(`Duplicate IDs in ${label}.`); }
function parseTrip(value: unknown): Trip {
  const v = object(value, 'Trip'), start = date(v.start), end = date(v.end);
  if (end < start || daysBetween(start, end) > 365) fail('Choose a trip of 1 to 366 days.');
  const days = object(v.days, 'Trip days'), result: Record<string, Day> = {};
  if (Object.keys(days).length > 366) fail('Too many day plans.');
  for (const [key, val] of Object.entries(days)) {
    date(key); if (key < start || key > end) fail('All day plans must be within the trip dates.');
    result[key] = parseDay(val);
  }
  const activities = list(v.activities, 'activities', 2000, parseActivity), extras = list(v.extras, 'packing extras', 500, parseExtra);
  unique(activities, 'activities'); unique(extras, 'packing extras');
  if (activities.some(a => a.date < start || a.date > end)) fail('All activities must be within the trip dates.');
  return { id: id(v.id), name: text(v.name, 'Trip name', 200, true), destination: text(v.destination, 'Destination', 200, true), start, end, travellers: number(v.travellers, 'Travellers', 100, 1, true), budget: number(v.budget, 'Budget', 10000000), currency: choice(v.currency, CURRENCIES, 'currency'), weightLimit: number(v.weightLimit, 'Luggage target', 1000), activities, days: result, extras, packed: ids(v.packed, 'packed items', 2000), theme: choice(v.theme ?? 'mountains', ['mountains', 'coast', 'city'] as const, 'cover'), notes: text(v.notes ?? '', 'Trip notes', 5000), sample: boolean(v.sample ?? false, 'sample status') };
}
function parseWorkspace(value: unknown): Workspace {
  const v = object(value, 'Workspace'); if (v.version !== 1) fail('This workspace version is not supported.');
  const w: Workspace = { version: 1, trips: list(v.trips, 'trips', 100, parseTrip), items: list(v.items, 'wardrobe items', 2000, parseItem), outfits: list(v.outfits, 'outfits', 500, parseOutfit) };
  unique(w.trips, 'trips'); unique(w.items, 'wardrobe'); unique(w.outfits, 'outfits');
  const itemIds = new Set(w.items.map(i => i.id)), outfitIds = new Set(w.outfits.map(o => o.id));
  const knownItems = (values: string[]) => values.every(i => itemIds.has(i));
  const knownOutfits = (values: string[]) => values.every(i => outfitIds.has(i));
  if (w.outfits.some(o => !knownItems(o.items)) || w.trips.some(t =>
    !knownItems(t.packed) || t.extras.some(e => itemIds.has(e.id)) ||
    Object.values(t.days).some(d => !knownOutfits(dayOutfits(d)) || !knownItems(d.gear ?? [])) ||
    t.activities.some(a => !knownOutfits(a.outfitId ? [a.outfitId] : []) || !knownItems(a.gear))
  )) fail('A plan refers to a missing wardrobe item or outfit.');
  return w;
}
function schema<T>(parse: (value: unknown) => T) {
  return { parse, safeParse(value: unknown): { success: true; data: T } | { success: false; error: ValidationError } {
    try { return { success: true, data: parse(value) }; } catch (e) { return { success: false, error: e instanceof ValidationError ? e : new ValidationError('Please check your data.') }; }
  } };
}
export const workspaceSchema = schema(parseWorkspace), tripSchema = schema(parseTrip), itemSchema = schema(parseItem), outfitSchema = schema(parseOutfit), activitySchema = schema(parseActivity), extraSchema = schema(parseExtra);
export function uid(): string {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function daysBetween(a: string, b: string) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
export function addDays(day: string, amount: number): string { date(day); const result = new Date(Date.parse(day) + amount * 86400000).toISOString().slice(0, 10); return date(result); }
export function tripDates(t: Pick<Trip, 'start' | 'end'>) {
  date(t.start); date(t.end); const n = daysBetween(t.start, t.end) + 1;
  if (n < 1 || n > 366) fail('Choose a trip of 1 to 366 days.');
  return Array.from({ length: n }, (_, i) => addDays(t.start, i));
}
export const blankDay = (): Day => ({ outfitId: '', outfitIds: [], title: '', stay: '', notes: '', gear: [] });
export function dayOutfits(day?: Day): string[] { return day ? [...new Set([day.outfitId, ...(day.outfitIds ?? [])].filter(Boolean))] : []; }
export function packing(w: Workspace, t: Trip): PackRow[] {
  const needed = new Map<string, Set<string>>();
  const addItem = (id: string, day: string) => { if (!needed.has(id)) needed.set(id, new Set()); needed.get(id)!.add(day); };
  const addOutfit = (id: string, day: string) => w.outfits.find(o => o.id === id)?.items.forEach(i => addItem(i, day));
  Object.entries(t.days).forEach(([date, d]) => { dayOutfits(d).forEach(o => addOutfit(o, date)); d.gear?.forEach(i => addItem(i, date)); });
  t.activities.forEach(a => { addOutfit(a.outfitId, a.date); a.gear.forEach(i => addItem(i, a.date)); });
  return [...w.items.filter(i => needed.has(i.id)).map(i => ({ ...i, quantity: 1, packed: t.packed.includes(i.id), automatic: true, dates: [...needed.get(i.id)!].sort() })), ...t.extras.map(i => ({ ...i, category: i.category ?? 'Essentials', image: '', automatic: false, dates: [] }))];
}
export function removeItem(w: Workspace, id: string) {
  w.items = w.items.filter(i => i.id !== id);
  w.outfits.forEach(o => { o.items = o.items.filter(i => i !== id); });
  w.trips.forEach(t => { t.packed = t.packed.filter(i => i !== id); t.activities.forEach(a => { a.gear = a.gear.filter(i => i !== id); }); Object.values(t.days).forEach(d => { d.gear = d.gear?.filter(i => i !== id); }); }); return w;
}
export function removeOutfit(w: Workspace, id: string) {
  w.outfits = w.outfits.filter(o => o.id !== id);
  w.trips.forEach(t => { Object.values(t.days).forEach(d => { if (d.outfitId === id) d.outfitId = ''; d.outfitIds = d.outfitIds?.filter(i => i !== id); }); t.activities.forEach(a => { if (a.outfitId === id) a.outfitId = ''; }); }); return w;
}
/** Stable sample IDs retain backwards compatibility with existing regression tests. */
export function seed(): Workspace {
  return { version: 1,
    items: [
      { id: 'linen', name: 'Linen shirt', category: 'Tops', weight: 180, image: '', shape: 'shirt', color: '#c2ae88' },
      { id: 'trousers', name: 'Everyday trousers', category: 'Bottoms', weight: 380, image: '', shape: 'pants', color: '#3d443c' },
      { id: 'trainers', name: 'Walking trainers', category: 'Shoes', weight: 620, image: '', shape: 'sneakers', color: '#dedbd0' },
      { id: 'jacket', name: 'Light jacket', category: 'Layers', weight: 320, image: '', shape: 'coat', color: '#85907c' },
      { id: 'camera', name: 'Camera', category: 'Gear', weight: 450, image: '', shape: 'camera', color: '#40433e' },
      { id: 'dress', name: 'Evening dress', category: 'Tops', weight: 260, image: '', shape: 'dress', color: '#c3ad99' },
    ],
    outfits: [
      { id: 'city', name: 'The city wanderer', items: ['linen', 'trousers', 'trainers'], occasion: 'Everyday' },
      { id: 'coast', name: 'A breezy afternoon', items: ['linen', 'trousers', 'jacket', 'trainers'], occasion: 'Exploring' },
      { id: 'evening', name: 'Dinner at sunset', items: ['dress', 'jacket'], occasion: 'Evening' },
    ],
    trips: [{ id: 'lisbon', name: 'A week in Lisbon', destination: 'Lisbon, Portugal', start: '2026-09-21', end: '2026-09-27', travellers: 2, budget: 1500, currency: 'EUR', weightLimit: 8, theme: 'coast', sample: true,
      days: { '2026-09-21': { outfitId: 'city', title: 'A slow start in Alfama', stay: 'Casa do Pátio · Alfama', notes: 'Take it slow on our first day.' }, '2026-09-23': { outfitId: 'coast', stay: '', notes: '' } },
      activities: [
        { id: 'alfama', date: '2026-09-21', time: '10:00', title: 'Wander through Alfama', place: 'Alfama, Lisbon', category: 'Explore', cost: 0, link: '', notes: 'Narrow streets, tiled façades, a coffee or two.', outfitId: 'city', gear: ['camera'] },
        { id: 'dinner', date: '2026-09-21', time: '18:30', title: 'Dinner by the river', place: 'Cais do Sodré', category: 'Food & drink', cost: 45, link: '', notes: 'Find a table around golden hour.', outfitId: 'evening', gear: [] },
        { id: 'sintra', date: '2026-09-23', time: '09:00', title: 'Day trip to Sintra', place: 'Sintra', category: 'Explore', cost: 35, link: '', notes: 'Comfortable shoes for the hills.', outfitId: 'coast', gear: ['camera'] },
      ], extras: [ { id: 'passport', name: 'Passport & travel documents', quantity: 1, weight: 80, packed: false }, { id: 'charger', name: 'Phone charger', quantity: 1, weight: 120, packed: false }, { id: 'toiletries', name: 'Toiletries', quantity: 1, weight: 350, packed: false } ], packed: [] }]
  };
}
