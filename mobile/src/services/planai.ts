/**
 * The AI half of planning, and only the reading and suggesting half: a model reads the reels' words (caption,
 * hashtags, cover text, what the person typed or pasted) for places a rule can't see ("the Dil Chahta Hai fort" →
 * Chapora Fort), and suggests places that fit the trip and the group. It never schedules (the engine does) and never
 * adds anything on its own: every place it names is checked on the map, labelled, and kept only if someone keeps it.
 *
 * Where it runs: a cloud model through Trips Loom's own server (when the server has one set up; the phone never holds
 * a key), and Apple's on-device model (iOS 26 with Apple Intelligence) when the cloud isn't set up, has run out for
 * today, or fails. Otherwise nowhere, and the app says so; everything else works without it.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { apiFetch } from '../data/backend';
import type { Reel, Slot } from '../domain/reels';
import { briefOf, type Brief } from '../domain/brief';

export type AiSource = 'cloud' | 'on-device';
/** What's available: where it runs, the model, and a name to show ("DeepSeek", "Apple Intelligence"). */
export type AiInfo = { source: AiSource; model: string; label: string };
export type AiPlace = { title: string; quote: string; reelId: string; slot?: Slot; why?: string };
export type AiRead = AiInfo & { destination: string; places: AiPlace[] };
export type AiIdea = { title: string; why: string };
/** Why there's no answer, in words to show. */
export type AiFailure = { failed: true; message: string };
export const aiFailed = (x: unknown): x is AiFailure => !!x && typeof x === 'object' && (x as AiFailure).failed === true;

type NativeAi = { isAvailable(): Promise<boolean>; readReels?(text: string, destination: string): Promise<string>; suggestPlaces?(destination: string, have: string, wants: string): Promise<string> };
const Native = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeAi>('LoomIntelligence') : null;
const ON_DEVICE: AiInfo = { source: 'on-device', model: 'Apple Intelligence', label: 'Apple Intelligence' };

/** A model can take a while on a long caption; longer than the app's usual 20 s. */
const AI_TIMEOUT_MS = 30000;

let cloud: { available: boolean; model: string; label: string; at: number } | null = null;

async function cloudInfo(token: string | null): Promise<AiInfo | null> {
  // Checked again every 10 minutes (2 when it wasn't there), so a server change shows up without a restart.
  if (!cloud || Date.now() - cloud.at > (cloud.available ? 600000 : 120000)) {
    try {
      const r = await apiFetch('/api/ai/reels', token);
      const body = r.ok ? await r.json() as { available?: boolean; model?: string; provider?: string } : null;
      cloud = { available: !!body?.available, model: body?.model ?? '', label: body?.provider || 'AI', at: Date.now() };
    } catch { cloud = { available: false, model: '', label: '', at: Date.now() }; }
  }
  return cloud.available ? { source: 'cloud', model: cloud.model, label: cloud.label } : null;
}

async function onDevice(fn: 'readReels' | 'suggestPlaces'): Promise<boolean> {
  try { return !!Native?.[fn] && await Native.isAvailable(); } catch { return false; }
}

/** Which AI planning can use right now. `cloud`: whether the person allows (or hasn't been asked about) the cloud. */
export async function aiAvailable(token: string | null, cloud = true): Promise<AiInfo | null> {
  return (cloud ? await cloudInfo(token) : null) ?? ((await onDevice('readReels')) ? ON_DEVICE : null);
}

/** Calls the server's AI. The answer, or why there isn't one ('allowance': today's is used up). */
async function askCloud<T>(body: unknown, token: string | null): Promise<{ ok: true; body: T } | { ok: false; reason: 'allowance' | 'failed'; message: string }> {
  try {
    const r = await apiFetch('/api/ai/reels', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, AI_TIMEOUT_MS);
    const data = await r.json().catch(() => ({})) as T & { error?: string; reason?: string };
    if (r.ok) return { ok: true, body: data };
    return { ok: false, reason: r.status === 429 ? 'allowance' : 'failed', message: typeof data.error === 'string' ? data.error : 'The AI didn’t answer.' };
  } catch {
    return { ok: false, reason: 'failed', message: 'The AI didn’t answer in time.' };
  }
}

/** The text a model reads: no video, no comments it can't see. */
const brief = (reels: Reel[]) => reels.map((r) => ({
  id: r.id, platform: r.platform, creator: r.handle || r.author, title: r.title.slice(0, 300), caption: r.caption.slice(0, 2200),
  hashtags: r.hashtags.slice(0, 40), coverText: r.coverText.slice(0, 300), notes: r.notes.slice(0, 1500),
}));

const SLOTS: Slot[] = ['sunrise', 'morning', 'afternoon', 'sunset', 'night'];
function cleanPlaces(list: unknown, reels: Reel[]): AiPlace[] {
  if (!Array.isArray(list)) return [];
  const ids = new Set(reels.map((r) => r.id));
  return list.flatMap((p) => {
    const o = p as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, 80) : '';
    if (title.length < 3) return [];
    const reelId = typeof o.reelId === 'string' && ids.has(o.reelId) ? o.reelId : reels[0]?.id ?? '';
    return [{ title, quote: typeof o.quote === 'string' ? o.quote.slice(0, 220) : '', reelId, slot: SLOTS.includes(o.slot as Slot) ? o.slot as Slot : undefined, why: typeof o.why === 'string' ? o.why.slice(0, 160) : undefined }];
  }).slice(0, 20);
}

/**
 * Places (and the destination) a model finds in the reels' words. Null when no AI is available or it failed: the
 * rules' places stand. `cloud`: whether the person allowed the cloud provider (else only the phone's own model).
 */
export async function aiRead(reels: Reel[], destination: string, token: string | null, cloud: boolean): Promise<AiRead | null> {
  if (!reels.length) return null;
  const info = cloud ? await cloudInfo(token) : null;
  if (info) {
    const r = await askCloud<{ destination?: string; places?: unknown; model?: string; provider?: string }>({ task: 'read', destination, reels: brief(reels) }, token);
    if (r.ok) return { ...info, model: r.body.model ?? info.model, label: r.body.provider || info.label, destination: typeof r.body.destination === 'string' ? r.body.destination.slice(0, 80) : '', places: cleanPlaces(r.body.places, reels) };
  }
  if (!(await onDevice('readReels'))) return null;
  try {
    const text = brief(reels).map((r) => `[${r.id}] by ${r.creator}\n${r.title}\n${r.caption}\nTags: ${r.hashtags.join(' ')}\nCover: ${r.coverText}\nNotes: ${r.notes}`).join('\n\n').slice(0, 3500);
    const body = JSON.parse(await Native!.readReels!(text, destination)) as { destination?: string; places?: unknown };
    return { ...ON_DEVICE, destination: typeof body.destination === 'string' ? body.destination : '', places: cleanPlaces(body.places, reels) };
  } catch (e) {
    if (__DEV__) console.warn('On-device AI read failed', e);
    return null;
  }
}

export type IdeasInput = { destination: string; have: string[]; interests: string[]; party: string; food: string; budget: string; ask?: string; near?: string[] };

const parseIdeas = (list: unknown): AiIdea[] => (Array.isArray(list) ? list : []).flatMap((x) => {
  const o = x as Record<string, unknown>;
  return typeof o.title === 'string' && o.title.trim().length >= 3 ? [{ title: o.title.trim().slice(0, 80), why: typeof o.why === 'string' ? o.why.slice(0, 160) : '' }] : [];
}).slice(0, 8);

/** A few places that fit the trip, the group and what they asked, with a reason each; or why there are none. */
export async function aiIdeas(input: IdeasInput, token: string | null, cloud: boolean): Promise<AiIdea[] | AiFailure> {
  let failure: AiFailure = { failed: true, message: 'AI isn’t available here yet. Adding places yourself still works.' };
  if (cloud && await cloudInfo(token)) {
    const r = await askCloud<{ ideas?: unknown }>({ task: 'ideas', ...input }, token);
    if (r.ok) return parseIdeas(r.body.ideas);
    failure = { failed: true, message: r.message };
  }
  // The cloud isn't set up, today's allowance is used, or it failed: the phone's own model, when it has one.
  if (!(await onDevice('suggestPlaces'))) return failure;
  try {
    const wants = [input.ask ? `They ask: ${input.ask}` : '', input.near?.length ? `near ${input.near.join(', ')}` : '', input.interests.join(', '), input.party, `food ${input.food}`, `budget ${input.budget}`].filter(Boolean).join('; ');
    return parseIdeas((JSON.parse(await Native!.suggestPlaces!(input.destination, input.have.join(', ').slice(0, 600), wants)) as { ideas?: unknown }).ideas);
  } catch (e) {
    if (__DEV__) console.warn('On-device AI ideas failed', e);
    return failure.message.startsWith('AI isn’t available') ? { failed: true, message: 'The AI on this phone couldn’t answer. Try again, or ask differently.' } : failure;
  }
}

export type EditInput = {
  trip: { destination: string; start: string; days: number; party: string; people: number; pace: string; food: string; budget: string; arrive: string; leave: string };
  places: { id: string; title: string; area: string; kind: string; pick: 'must' | 'maybe' | 'skip'; day: number }[];
  schedule: { title: string; stops: string[] }[];
  history: { role: 'you' | 'ai'; text: string }[];
  message: string;
};

/**
 * Planning together: what the traveller wants changed, answered with edits to the plan (checked on the server and
 * again on the phone before they're applied) and a short reply. Cloud only: the phone's own model doesn't plan.
 */
export async function aiEdit(input: EditInput, token: string | null, cloud: boolean): Promise<{ reply: string; actions: unknown[] } | AiFailure> {
  if (!cloud || !(await cloudInfo(token))) return { failed: true, message: 'Planning with AI needs cloud AI. Quick changes (pace, length, food, moving or removing a place) still work.' };
  const r = await askCloud<{ reply?: unknown; actions?: unknown }>({ task: 'edit', ...input }, token);
  if (!r.ok) return { failed: true, message: r.message };
  return { reply: typeof r.body.reply === 'string' ? r.body.reply.slice(0, 300) : '', actions: Array.isArray(r.body.actions) ? r.body.actions : [] };
}

/**
 * What the person meant by what they typed (where, what kind of trip, the facts, the places they named, a trek's
 * route), or for a trek, the route changed as they asked. Cloud only: the phone's own model isn't used for this.
 */
export async function aiBrief(input: { text: string; current_route?: unknown[]; history?: { role: 'you' | 'ai'; text: string }[]; message?: string }, token: string | null, cloud: boolean): Promise<Brief | AiFailure> {
  if (!cloud || !(await cloudInfo(token))) return { failed: true, message: 'AI isn’t available here, so the trip is read from your words alone.' };
  const r = await askCloud<unknown>({ task: 'brief', current_route: [], history: [], message: '', ...input }, token);
  if (!r.ok) return { failed: true, message: r.message };
  return briefOf(r.body) ?? { failed: true, message: 'The AI’s answer didn’t make sense. Try again.' };
}
