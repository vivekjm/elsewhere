/**
 * Planning with AI: the traveller says what to change ("make day 2 lighter", "add a sunset spot", "we're veg") and
 * the plan changes through a small set of edits, which the engine then lays out as days again. The AI never writes
 * times or schedules; it only proposes these edits, and every one is checked here before it's applied.
 *
 * - `localEdits`: plain requests the phone understands itself (pace, length, food, remove / move / must / maybe a
 *   place by name). Instant and free; anything it isn't sure of goes to the AI.
 * - `applyEdits`: applies edits from either, returning the new plan inputs and the changes in words.
 * - `suggestionsFor`: what to offer next, from the plan itself (an empty day, a full one, places that didn't fit).
 *
 * Pure (types only from the engine), so it's unit-tested.
 */
import { kindOf, type Answers, type Budget, type DayPart, type Food, type Kind, type Pace, type Party, type Plan, type PlanPlace, type Priority } from './planmode';

export type SetField = 'pace' | 'food' | 'budget' | 'days' | 'people' | 'party' | 'arrive' | 'leave' | 'start';
export type EditAction =
  | { type: 'add_place'; title: string; why: string; day: number; pick: 'must' | 'maybe'; eat?: boolean }
  | { type: 'remove_place'; id: string }
  | { type: 'set_pick'; id: string; pick: Priority }
  | { type: 'move_place'; id: string; day: number }
  | { type: 'set'; field: SetField; value: string };

/** Where an added place is on the map, when it was found. */
export type Found = { lat: number; lng: number; area: string; kind: Kind | 'other'; osm?: string } | null;

const PACES: Pace[] = ['relaxed', 'balanced', 'packed'];
const FOODS: Food[] = ['veg', 'jain', 'nonveg', 'any'];
const BUDGETS: Budget[] = ['backpacker', 'comfortable', 'treat'];
const PARTIES: Party[] = ['solo', 'couple', 'friends', 'family'];
const PARTS: DayPart[] = ['morning', 'afternoon', 'evening'];
const PACE_WORD: Record<Pace, string> = { relaxed: 'relaxed', balanced: 'balanced', packed: 'see it all' };
const FOOD_WORD: Record<Food, string> = { veg: 'veg', jain: 'Jain', nonveg: 'non-veg', any: 'anything' };

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const DAY_MS = 86400000;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const niceDate = (iso: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

/** The place a few words mean ("the fort", "baga"), when exactly one place fits. */
export function placeNamed(words: string, places: PlanPlace[]): PlanPlace | null {
  const w = norm(words).replace(/^(the|a|an) /, '');
  if (w.length < 3) return null;
  const exact = places.filter((p) => norm(p.title) === w);
  if (exact.length === 1) return exact[0];
  const partial = places.filter((p) => norm(p.title).includes(w) || (w.includes(norm(p.title)) && norm(p.title).length >= 4));
  if (partial.length === 1) return partial[0];
  // "the fort", "the beach": the one place of that kind.
  const byKind = places.filter((p) => p.pick !== 'skip' && (p.kind === w || `${p.kind}s` === w || (w === 'market' && p.kind === 'nightmarket')));
  return byKind.length === 1 ? byKind[0] : null;
}

/* ------------------------------------------------------------------ requests the phone understands */

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const num = (s: string) => NUM[s] ?? Number(s);

/**
 * Edits for a plain request, or null when any part of it needs the AI. Every clause must be understood, so
 * "remove the fort and add a beach" goes to the AI whole rather than half-done here.
 */
export function localEdits(message: string, places: PlanPlace[], answers: Pick<Answers, 'days' | 'people'>): EditAction[] | null {
  const clauses = message.toLowerCase().replace(/[.!?]+$/g, '').split(/\s*(?:,|;|\band then\b|\bthen\b|\band\b|\balso\b)\s*/).map((c) => c.trim()).filter(Boolean);
  if (!clauses.length || clauses.length > 4) return null;
  const out: EditAction[] = [];
  let days = answers.days;
  for (const raw of clauses) {
    const c = raw.replace(/^(please|pls|can you|could you|let'?s|i want to|we want to|i'?d like to)\s+/, '').replace(/\s+please$/, '');
    let m: RegExpMatchArray | null;
    if (/^(make it |go |keep it )?(more )?(relaxed|slower|chill(er)?|easy|easier|lighter|less rushed|take it easy)( pace)?$/.test(c)) out.push({ type: 'set', field: 'pace', value: 'relaxed' });
    else if (/^(make it |go )?(more )?(packed|busier|faster|see it all|see everything)( pace)?$/.test(c)) out.push({ type: 'set', field: 'pace', value: 'packed' });
    else if (/^(make it |go )?balanced( pace)?$/.test(c)) out.push({ type: 'set', field: 'pace', value: 'balanced' });
    else if (/^(add|add a|add one|one more|another|add one more|add another|an extra|add an extra) day$/.test(c)) { days = Math.min(21, days + 1); out.push({ type: 'set', field: 'days', value: String(days) }); }
    else if (/^(one day less|remove a day|drop a day|cut a day|one less day|shorter)$/.test(c)) { days = Math.max(1, days - 1); out.push({ type: 'set', field: 'days', value: String(days) }); }
    else if ((m = c.match(/^(?:make it |for |change it to |it'?s )?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten) (?:days|day)$/))) { days = Math.max(1, Math.min(21, num(m[1]))); out.push({ type: 'set', field: 'days', value: String(days) }); }
    else if (/^(we'?re |we are |i'?m |i am |make it |make the food |food )?(pure )?(veg|vegetarian)( food| only)?$/.test(c)) out.push({ type: 'set', field: 'food', value: 'veg' });
    else if (/^(we'?re |we are |i'?m |i am |make it |food )?jain( food| only)?$/.test(c)) out.push({ type: 'set', field: 'food', value: 'jain' });
    else if (/^(we eat |we'?re |food )?(anything|non ?-?veg)( is fine)?$/.test(c)) out.push({ type: 'set', field: 'food', value: c.includes('non') ? 'nonveg' : 'any' });
    else if (/^(on a |make it )?(tight |low |small )?budget$|^(make it |go )?cheaper$|^backpack(er|ing)$/.test(c)) out.push({ type: 'set', field: 'budget', value: 'backpacker' });
    else if (/^(treat ourselves|splurge|make it fancy|go luxury|luxury)$/.test(c)) out.push({ type: 'set', field: 'budget', value: 'treat' });
    else if ((m = c.match(/^(?:remove|drop|skip|delete|cut|take out|no|leave out) (.+?)(?: from the (?:plan|trip))?$/))) {
      const p = placeNamed(m[1], places);
      if (!p) return null;
      out.push({ type: 'remove_place', id: p.id });
    } else if ((m = c.match(/^(?:move|put|shift) (.+?) (?:to|on) (?:day )?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|the (?:first|last) day)$/))) {
      const p = placeNamed(m[1], places);
      if (!p) return null;
      const d = m[2] === 'the first day' ? 1 : m[2] === 'the last day' ? days : num(m[2]);
      if (!(d >= 1 && d <= days)) return null;
      out.push({ type: 'move_place', id: p.id, day: d });
    } else if ((m = c.match(/^(?:make )?(.+?) (?:a |an )?(must|maybe|optional)$/))) {
      const p = placeNamed(m[1], places);
      if (!p) return null;
      out.push({ type: 'set_pick', id: p.id, pick: m[2] === 'must' ? 'must' : 'maybe' });
    } else if ((m = c.match(/^(?:keep|bring back|add back) (.+)$/))) {
      const p = placeNamed(m[1], places);
      if (!p || p.pick !== 'skip') return null;
      out.push({ type: 'set_pick', id: p.id, pick: 'must' });
    } else return null;
  }
  return out;
}

/* ------------------------------------------------------------------ applying edits */

/** Edits from the server, checked again on the phone: unknown places, values and days are dropped. */
export function cleanEdits(list: unknown, places: PlanPlace[], days: number): EditAction[] {
  if (!Array.isArray(list)) return [];
  const ids = new Set(places.map((p) => p.id));
  let maxDays = days;
  const out: EditAction[] = [];
  const str = (v: unknown, n = 160) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  for (const x of list.slice(0, 12)) {
    const a = (x ?? {}) as Record<string, unknown>;
    const day = typeof a.day === 'number' && Number.isInteger(a.day) ? a.day : Number(a.day) || 0;
    if (a.type === 'set') {
      const field = str(a.field, 10) as SetField;
      const value = str(a.value, 20);
      if (!validSet(field, value)) continue;
      if (field === 'days') maxDays = Number(value);
      out.push({ type: 'set', field, value });
    } else if (a.type === 'add_place') {
      const title = str(a.title, 80).replace(/^#/, '');
      if (title.length < 3 || /https?:|[<>{}]/.test(title)) continue;
      out.push({ type: 'add_place', title, why: str(a.why), day: day >= 0 && day <= 21 ? day : 0, pick: a.pick === 'maybe' ? 'maybe' : 'must', ...(a.eat === true ? { eat: true } : {}) });
    } else if ((a.type === 'remove_place' || a.type === 'set_pick' || a.type === 'move_place') && ids.has(str(a.id, 80))) {
      const id = str(a.id, 80);
      if (a.type === 'remove_place') out.push({ type: 'remove_place', id });
      else if (a.type === 'set_pick' && (a.pick === 'must' || a.pick === 'maybe' || a.pick === 'skip')) out.push({ type: 'set_pick', id, pick: a.pick });
      else if (a.type === 'move_place' && day >= 0 && day <= 21) out.push({ type: 'move_place', id, day });
    }
  }
  // A day beyond the trip's length (after any change to it) means "let the plan decide".
  return out.map((a) => ((a.type === 'move_place' || a.type === 'add_place') && a.day > maxDays ? { ...a, day: 0 } : a));
}

function validSet(field: SetField, value: string): boolean {
  switch (field) {
    case 'pace': return (PACES as string[]).includes(value);
    case 'food': return (FOODS as string[]).includes(value);
    case 'budget': return (BUDGETS as string[]).includes(value);
    case 'party': return (PARTIES as string[]).includes(value);
    case 'arrive': case 'leave': return (PARTS as string[]).includes(value);
    case 'days': return /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 21;
    case 'people': return /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 20;
    case 'start': return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
    default: return false;
  }
}

const slug = (s: string) => norm(s).replace(/ /g, '-').slice(0, 40);

/**
 * The plan's inputs after the edits, and each change in words ("Moved Baga Beach to day 3"). `found`: where each
 * added place is on the map (by title), looked up before applying. `today`: a start date before it is ignored.
 */
export function applyEdits(places: PlanPlace[], answers: Answers, edits: EditAction[], found: Record<string, Found> = {}, today = ''): { places: PlanPlace[]; answers: Answers; changes: string[] } {
  let ps = places.map((p) => ({ ...p }));
  const a: Answers = { ...answers };
  const changes: string[] = [];
  const byId = (id: string) => ps.find((p) => p.id === id);
  // Settings first, so days moved or added are checked against the new length.
  for (const e of edits) {
    if (e.type !== 'set') continue;
    const v = e.value;
    if (e.field === 'pace' && a.pace !== v) { a.pace = v as Pace; changes.push(`Pace: ${PACE_WORD[a.pace]}`); }
    else if (e.field === 'food' && a.food !== v) { a.food = v as Food; changes.push(`Food: ${FOOD_WORD[a.food]}`); }
    else if (e.field === 'budget' && a.budget !== v) { a.budget = v as Budget; changes.push(`Budget: ${v === 'treat' ? 'treat yourselves' : v}`); }
    else if (e.field === 'party' && a.party !== v) {
      a.party = v as Party;
      a.people = v === 'solo' ? 1 : v === 'couple' ? 2 : Math.max(a.people, 3);
      a.maybes = v === 'friends' || v === 'family' ? 'group' : 'fit';
      changes.push(`Who’s going: ${v === 'solo' ? 'just you' : v}`);
    } else if (e.field === 'people' && a.people !== Number(v)) { a.people = Number(v); changes.push(`${v} ${Number(v) === 1 ? 'person' : 'people'}`); }
    else if ((e.field === 'arrive' || e.field === 'leave') && a[e.field] !== v) { a[e.field] = v as DayPart; changes.push(`${e.field === 'arrive' ? 'Arriving' : 'Leaving'} in the ${v}`); }
    else if (e.field === 'start' && a.start !== v && (!today || v >= today)) { a.start = v; changes.push(`Starts ${niceDate(v)}`); }
    else if (e.field === 'days' && a.days !== Number(v)) { a.days = Number(v); changes.push(`${a.days} ${a.days === 1 ? 'day' : 'days'}, until ${niceDate(addDays(a.start, a.days - 1))}`); }
  }
  // A place fixed to a day that no longer exists goes back to the plan's choice.
  ps = ps.map((p) => (p.day !== undefined && p.day >= a.days ? { ...p, day: undefined } : p));
  for (const e of edits) {
    if (e.type === 'set') continue;
    if (e.type === 'add_place') {
      const had = placeNamed(e.title, ps);
      if (had && norm(had.title).length >= 4) {
        // Already considered: keep it rather than adding it twice.
        if (had.pick !== e.pick || (e.day && had.day !== e.day - 1)) {
          had.pick = e.pick; if (e.day && e.day <= a.days) had.day = e.day - 1;
          changes.push(`Kept ${had.title}${e.day ? ` on day ${e.day}` : ''}`);
        }
        continue;
      }
      const at = found[e.title] ?? null;
      // A place to eat (the AI says so) is a restaurant even when the map doesn't know it: it goes at a meal time.
      const guessed: Kind = at && at.kind !== 'other' ? at.kind : kindOf(e.title, at?.osm);
      const kind: Kind = e.eat && !['restaurant', 'cafe', 'bar', 'nightmarket'].includes(guessed) ? 'restaurant' : guessed;
      ps.push({
        id: `ai-${slug(e.title)}`, title: e.title, lat: at?.lat, lng: at?.lng, area: at?.area ?? '', kind, pick: e.pick,
        ...(e.day && e.day <= a.days ? { day: e.day - 1 } : {}), evidence: [{ reelId: '', quote: e.why, source: 'ai' }],
      });
      changes.push(`Added ${e.title}${e.day ? ` to day ${e.day}` : ''}${e.pick === 'maybe' ? ' as a maybe' : ''}${at ? '' : ' (not found on the map)'}`);
      continue;
    }
    const p = byId(e.id);
    if (!p) continue;
    if (e.type === 'remove_place' || (e.type === 'set_pick' && e.pick === 'skip')) {
      if (p.pick !== 'skip') { p.pick = 'skip'; p.day = undefined; changes.push(`Left out ${p.title}`); }
    } else if (e.type === 'set_pick' && p.pick !== e.pick) {
      p.pick = e.pick; changes.push(`${p.title} is ${e.pick === 'must' ? 'in the plan' : 'a maybe'}`);
    } else if (e.type === 'move_place') {
      if (e.day === 0) { if (p.day !== undefined) { p.day = undefined; changes.push(`The plan picks a day for ${p.title}`); } }
      else if (e.day <= a.days && p.day !== e.day - 1) {
        p.day = e.day - 1;
        if (p.pick === 'skip') p.pick = 'must';
        changes.push(`Moved ${p.title} to day ${e.day}`);
      }
    }
  }
  return { places: ps, answers: a, changes };
}

/* ------------------------------------------------------------------ what to suggest */

export type Suggestion = { label: string; message: string };

/** Things to ask for next, from the plan: an empty day, a full one, what didn't fit; then the usual. */
export function suggestionsFor(plan: Plan, answers: Answers): Suggestion[] {
  const out: Suggestion[] = [];
  const last = plan.days.length - 1;
  plan.days.forEach((d, i) => {
    if (i > 0 && i < last && !d.stops.some((s) => s.placeId)) out.push({ label: `Fill day ${i + 1}`, message: `Add one or two places for day ${i + 1}, near where we're going` });
  });
  for (const i of plan.overfull.slice(0, 1)) out.push({ label: `Lighten day ${i + 1}`, message: `Make day ${i + 1} lighter` });
  if (plan.unplaced.some((p) => p.pick === 'must')) out.push({ label: 'Add a day', message: 'Add a day' });
  if (!plan.days.some((d) => d.stops.some((s) => s.kind === 'viewpoint' || s.kind === 'fort' || s.kind === 'beach'))) out.push({ label: 'A sunset spot', message: 'Add a good sunset spot' });
  out.push({ label: 'More food spots', message: `Add a couple of well-known places to eat${answers.food === 'veg' || answers.food === 'jain' ? ' that suit our food' : ''}` });
  if (answers.pace !== 'relaxed') out.push({ label: 'More relaxed', message: 'More relaxed' });
  out.push({ label: 'Something offbeat', message: 'Add one offbeat place most visitors miss' });
  if (answers.party === 'family') out.push({ label: 'Kid-friendly', message: 'Swap anything that is hard with kids for something kid-friendly' });
  return out.slice(0, 6);
}
