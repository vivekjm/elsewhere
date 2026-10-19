/**
 * Trips Loom's AI tasks, server side: reading reels' words (caption, hashtags, cover text, what the person typed or
 * pasted) for the places they name, and suggesting a few more places that fit a trip. The model only reads and
 * suggests; the app checks every place on the map and the person keeps or drops it.
 *
 * - Providers are in `ai/providers.ts` (DeepSeek, Gemini, OpenAI), chosen by configuration, with an optional second
 *   provider for when the first is down.
 * - Prompts are in `ai/prompts.ts`.
 * - This file validates what the app sends, checks what the model answers (a place must quote words that really
 *   are in the text; an idea can't repeat what the trip already has), and runs the retry and fallback chain.
 */
import { AiError, complete, PROVIDERS, PROVIDER_LABEL, providerFrom, type CompletionResult, type ProviderConfig, type ProviderName } from "./ai/providers.ts";
import { BRIEF_SCHEMA, BRIEF_SYSTEM, EDIT_SCHEMA, EDIT_SYSTEM, IDEAS_SCHEMA, IDEAS_SYSTEM, PROMPT_VERSION, READ_SCHEMA, READ_SYSTEM } from "./ai/prompts.ts";

export { AiError, PROVIDER_LABEL, PROMPT_VERSION };
export type { ProviderName };

/* ------------------------------------------------------------------ configuration */

export type AiConfig = { primary: ProviderConfig; fallback: ProviderConfig | null };

/**
 * The providers from the Worker's environment; null when none has a key, or AI is switched off (AI_DISABLED).
 * AI_PROVIDER picks the main one (else the first with a key: DeepSeek, Gemini, OpenAI); AI_MODEL its model for both
 * tasks, or AI_IDEAS_MODEL for suggesting ideas alone (DeepSeek defaults: deepseek-flash reads, deepseek-v4-pro suggests).
 * AI_FALLBACK_PROVIDER (and AI_FALLBACK_MODEL) is tried when the main one fails.
 */
export function aiConfig(values: Record<string, unknown>): AiConfig | null {
  if (values.AI_DISABLED === "1" || values.AI_DISABLED === "true") return null;
  const named = PROVIDERS.find((p) => p === values.AI_PROVIDER);
  // AI_MODEL belongs to the provider it was set for: the named one, or (with none named) whichever is used.
  const primary = (named && providerFrom(values, named, values.AI_MODEL, values.AI_IDEAS_MODEL))
    || PROVIDERS.map((p) => (named ? providerFrom(values, p) : providerFrom(values, p, values.AI_MODEL, values.AI_IDEAS_MODEL))).find((p): p is ProviderConfig => !!p)
    || null;
  if (!primary) return null;
  const fallbackName = PROVIDERS.find((p) => p === values.AI_FALLBACK_PROVIDER && p !== primary.provider);
  return { primary, fallback: fallbackName ? providerFrom(values, fallbackName, values.AI_FALLBACK_MODEL) : null };
}

/* ------------------------------------------------------------------ requests */

export type ReelBrief = { id: string; platform: string; creator: string; title: string; caption: string; hashtags: string[]; coverText: string; notes: string };
export type ReadRequest = { task: "read"; destination: string; reels: ReelBrief[] };
export type IdeasRequest = { task: "ideas"; destination: string; have: string[]; interests: string[]; party: string; food: string; budget: string; ask: string; near: string[] };
export type EditPlace = { id: string; title: string; area: string; kind: string; pick: "must" | "maybe" | "skip"; day: number };
export type EditRequest = {
  task: "edit";
  trip: { destination: string; start: string; days: number; party: string; people: number; pace: string; food: string; budget: string; arrive: string; leave: string };
  places: EditPlace[];
  schedule: { day: number; title: string; stops: string[] }[];
  history: { role: "you" | "ai"; text: string }[];
  message: string;
};
export type BriefStage = { day: number; from: string; to: string; distance_km: number; hours: number; start_altitude: number; end_altitude: number; note: string };
export type BriefRequest = {
  task: "brief";
  text: string;
  /** Set by the server, not the app: today's date, for "next month" and "in December". */
  today: string;
  current_route: BriefStage[];
  history: { role: "you" | "ai"; text: string }[];
  message: string;
};
export type AiRequest = ReadRequest | IdeasRequest | EditRequest | BriefRequest;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max) : "");
const strs = (v: unknown, count: number, max: number) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, count) : []);
const oneOf = (v: unknown, allowed: string[], fallback: string) => (typeof v === "string" && allowed.includes(v) ? v : fallback);

/** Validates and trims what the app sent. Null when it isn't a request the app makes. */
export function parseRequest(body: unknown): AiRequest | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (o.task === "read") {
    const reels = (Array.isArray(o.reels) ? o.reels : []).slice(0, 10).map((r) => {
      const x = (r ?? {}) as Record<string, unknown>;
      return { id: str(x.id, 300), platform: str(x.platform, 20), creator: str(x.creator, 80), title: str(x.title, 300), caption: str(x.caption, 2200), hashtags: strs(x.hashtags, 40, 40), coverText: str(x.coverText, 300), notes: str(x.notes, 1500) };
    }).filter((r) => r.id && (r.caption || r.title || r.notes || r.hashtags.length || r.coverText));
    return reels.length ? { task: "read", destination: str(o.destination, 80), reels } : null;
  }
  if (o.task === "ideas") {
    const destination = str(o.destination, 80);
    return destination ? {
      task: "ideas", destination, have: strs(o.have, 40, 80), interests: strs(o.interests, 10, 40), party: str(o.party, 30),
      food: oneOf(o.food, ["veg", "jain", "nonveg", "any"], "any"), budget: oneOf(o.budget, ["backpacker", "comfortable", "treat"], "comfortable"),
      ask: str(o.ask, 200), near: strs(o.near, 6, 60),
    } : null;
  }
  if (o.task === "edit") return parseEdit(o);
  if (o.task === "brief") {
    const text = str(o.text, 800);
    if (text.length < 2) return null;
    const history = (Array.isArray(o.history) ? o.history : []).slice(-6).flatMap((x) => {
      const h = (x ?? {}) as Record<string, unknown>;
      const t = str(h.text, 300);
      return t ? [{ role: h.role === "ai" ? "ai" as const : "you" as const, text: t }] : [];
    });
    const route = Array.isArray(o.current_route) ? cleanStages(o.current_route) : [];
    return { task: "brief", text, today: new Date().toISOString().slice(0, 10), current_route: route, history, message: str(o.message, 300) };
  }
  return null;
}

const numIn = (v: unknown, min: number, max: number) => { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0; };

/** A trek's stages: one per day, real-looking numbers, at most 30. */
export function cleanStages(list: unknown[]): BriefStage[] {
  return list.slice(0, 30).flatMap((x, i) => {
    const t = (x ?? {}) as Record<string, unknown>;
    const from = str(t.from, 80), to = str(t.to, 80);
    if (!from || !to || /https?:|[<>{}]/.test(from + to)) return [];
    return [{
      day: i + 1, from, to, distance_km: Math.round(numIn(t.distance_km, 0, 60) * 10) / 10, hours: Math.round(numIn(t.hours, 0, 16) * 10) / 10,
      start_altitude: Math.round(numIn(t.start_altitude, 0, 8900)), end_altitude: Math.round(numIn(t.end_altitude, 0, 8900)), note: str(t.note, 120),
    }];
  });
}

const int = (v: unknown, min: number, max: number, fallback: number) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fallback);

function parseEdit(o: Record<string, unknown>): EditRequest | null {
  const t = (o.trip ?? {}) as Record<string, unknown>;
  const destination = str(t.destination, 80);
  const message = str(o.message, 300);
  if (!destination || !message) return null;
  const days = int(t.days, 1, 21, 3);
  const places = (Array.isArray(o.places) ? o.places : []).slice(0, 60).flatMap((x) => {
    const p = (x ?? {}) as Record<string, unknown>;
    const id = str(p.id, 80), title = str(p.title, 80);
    return id && title ? [{ id, title, area: str(p.area, 60), kind: str(p.kind, 20), pick: oneOf(p.pick, ["must", "maybe", "skip"], "must") as EditPlace["pick"], day: int(p.day, 0, days, 0) }] : [];
  });
  const schedule = (Array.isArray(o.schedule) ? o.schedule : []).slice(0, 21).map((x, i) => {
    const d = (x ?? {}) as Record<string, unknown>;
    return { day: i + 1, title: str(d.title, 80), stops: strs(d.stops, 12, 90) };
  });
  const history = (Array.isArray(o.history) ? o.history : []).slice(-6).flatMap((x) => {
    const h = (x ?? {}) as Record<string, unknown>;
    const text = str(h.text, 300);
    return text ? [{ role: h.role === "ai" ? "ai" as const : "you" as const, text }] : [];
  });
  return {
    task: "edit", message, places, schedule, history,
    trip: {
      destination, start: /^\d{4}-\d{2}-\d{2}$/.test(str(t.start, 10)) ? str(t.start, 10) : "", days, people: int(t.people, 1, 20, 2),
      party: oneOf(t.party, ["solo", "couple", "friends", "family"], "friends"), pace: oneOf(t.pace, ["relaxed", "balanced", "packed"], "balanced"),
      food: oneOf(t.food, ["veg", "jain", "nonveg", "any"], "any"), budget: oneOf(t.budget, ["backpacker", "comfortable", "treat"], "comfortable"),
      arrive: oneOf(t.arrive, ["morning", "afternoon", "evening"], "afternoon"), leave: oneOf(t.leave, ["morning", "afternoon", "evening"], "afternoon"),
    },
  };
}

/** The user message: the request as json (it's data; the system prompt says so). */
export function userText(req: AiRequest): string {
  if (req.task === "read") return JSON.stringify({ destination_hint: req.destination, reels: req.reels });
  if (req.task === "edit") return JSON.stringify({ trip: req.trip, places: req.places, schedule: req.schedule, history: req.history, message: req.message });
  if (req.task === "brief") return JSON.stringify({ text: req.text, today: req.today, current_route: req.current_route, history: req.history, message: req.message });
  return JSON.stringify({ destination: req.destination, already_planned: req.have, near_areas: req.near, group: req.party, food: req.food, budget: req.budget, interests: req.interests, request: req.ask });
}

function completionFor(req: AiRequest) {
  if (req.task === "read") return { system: READ_SYSTEM, user: userText(req), schema: READ_SCHEMA, schemaName: "reel_places", maxTokens: 2500, temperature: 0 };
  if (req.task === "edit") return { system: EDIT_SYSTEM, user: userText(req), schema: EDIT_SCHEMA, schemaName: "plan_edits", maxTokens: 1200, temperature: 0.2 };
  if (req.task === "brief") return { system: BRIEF_SYSTEM, user: userText(req), schema: BRIEF_SCHEMA, schemaName: "trip_brief", maxTokens: 2500, temperature: 0 };
  return { system: IDEAS_SYSTEM, user: userText(req), schema: IDEAS_SCHEMA, schemaName: "place_ideas", maxTokens: 900, temperature: 0.5 };
}

/* ------------------------------------------------------------------ checking answers */

/** Lower-case letters and digits in any script, single-spaced: for comparing words, not for showing. */
export const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Whether a quote really comes from the text: the words appear in it (allowing for small slips in copying). */
export function quoted(quote: string, source: string): boolean {
  const q = norm(quote);
  if (!q) return false;
  const s = norm(source);
  if (s.includes(q) || s.replace(/ /g, "").includes(q.replace(/ /g, ""))) return true;
  const have = new Set(s.split(" "));
  const words = q.split(" ").filter((w) => w.length > 1);
  return words.length > 0 && words.filter((w) => have.has(w)).length / words.length >= 0.7;
}

const reelText = (r: ReelBrief) => [r.title, r.caption, r.hashtags.join(" "), r.coverText, r.notes, r.creator].join("\n");

/** The model's JSON, even wrapped in a code fence or with a line before it. */
export function parseJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  for (const candidate of [trimmed, trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1)]) {
    try {
      const v = JSON.parse(candidate) as unknown;
      if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch { /* Try the next shape. */ }
  }
  return null;
}

const SLOTS = ["sunrise", "morning", "afternoon", "sunset", "night"];
const looksLikeName = (t: string) => t.length >= 3 && t.length <= 80 && /\p{L}/u.test(t) && !/https?:|www\.|[<>{}]/i.test(t);

/** Keeps only what the request supports: places with a real quote, ideas the trip doesn't already have. */
export function cleanAnswer(req: AiRequest, text: string): Record<string, unknown> | null {
  const data = parseJson(text);
  if (!data) return null;
  if (req.task === "edit") return cleanEdit(req, data);
  if (req.task === "brief") return cleanBrief(req, data);
  if (req.task === "ideas") {
    if (!Array.isArray(data.ideas)) return null;
    const taken = [...req.have, req.destination].map(norm).filter((t) => t.length >= 4);
    const vegOnly = req.food === "veg" || req.food === "jain";
    const seen = new Set<string>();
    const ideas = data.ideas.flatMap((x) => {
      const i = (x ?? {}) as Record<string, unknown>;
      const title = str(i.title, 80).replace(/^#/, "");
      const key = norm(title);
      if (!looksLikeName(title) || seen.has(key) || taken.some((t) => t === key || t.includes(key) || key.includes(t))) return [];
      // A veg or Jain group only gets places that serve no meat, or that aren't restaurants; unsure counts as no.
      const menu = str(i.menu, 20);
      if (vegOnly && menu !== "pure_veg" && menu !== "not_a_restaurant") return [];
      seen.add(key);
      return [{ title, why: str(i.why, 160) }];
    }).slice(0, 8);
    return { ideas };
  }
  if (!Array.isArray(data.places)) return null;
  const ids = req.reels.map((r) => r.id);
  const all = req.reels.map(reelText).join("\n");
  const seen = new Set<string>();
  const places = data.places.flatMap((x) => {
    const p = (x ?? {}) as Record<string, unknown>;
    const title = str(p.title, 80).replace(/^#/, "");
    const quote = str(p.quote, 220);
    const reel = req.reels.find((r) => r.id === str(p.reelId, 300));
    // A place must quote words that are really in the text: no quote, or a made-up one, and it's dropped.
    if (!looksLikeName(title) || !quote || !quoted(quote, reel ? reelText(reel) : all) || seen.has(norm(title))) return [];
    seen.add(norm(title));
    const slot = str(p.slot, 12).toLowerCase();
    return [{ title, quote, reelId: reel?.id ?? ids[0] ?? "", slot: SLOTS.includes(slot) ? slot : "", why: str(p.why, 160) }];
  }).slice(0, 20);
  return { destination: str(data.destination, 80), places };
}

const EDIT_FIELDS: Record<string, (v: string, days: number) => boolean> = {
  pace: (v) => ["relaxed", "balanced", "packed"].includes(v),
  food: (v) => ["veg", "jain", "nonveg", "any"].includes(v),
  budget: (v) => ["backpacker", "comfortable", "treat"].includes(v),
  party: (v) => ["solo", "couple", "friends", "family"].includes(v),
  arrive: (v) => ["morning", "afternoon", "evening"].includes(v),
  leave: (v) => ["morning", "afternoon", "evening"].includes(v),
  days: (v) => /^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 21,
  people: (v) => /^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 20,
  start: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`)),
};

/**
 * Planning edits, kept only when they make sense for this plan: known place ids, known settings with valid values,
 * days within the trip, new places that aren't already there (and, for a veg or Jain group, that serve no meat).
 */
function cleanEdit(req: EditRequest, data: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(data.actions)) return null;
  const ids = new Set(req.places.map((p) => p.id));
  const titles = [...req.places.map((p) => p.title), req.trip.destination].map(norm).filter((t) => t.length >= 4);
  // A change to the trip's length or food, wherever it is in the list, applies to the rest of it.
  const sets = data.actions.map((x) => (x ?? {}) as Record<string, unknown>).filter((a) => a.type === "set");
  const setDays = sets.find((a) => a.field === "days" && EDIT_FIELDS.days(str(a.value, 4), 0));
  const days = setDays ? Number(str(setDays.value, 4)) : req.trip.days;
  const setFood = sets.find((a) => a.field === "food" && EDIT_FIELDS.food(str(a.value, 10).toLowerCase(), 0));
  const food = setFood ? str(setFood.value, 10).toLowerCase() : req.trip.food;
  const vegOnly = food === "veg" || food === "jain";
  const dayOf = (v: unknown) => { const d = typeof v === "number" ? v : Number(v); return Number.isInteger(d) && d >= 1 && d <= days ? d : 0; };
  const seen = new Set<string>();
  const actions = data.actions.flatMap((x): Record<string, unknown>[] => {
    const a = (x ?? {}) as Record<string, unknown>;
    const type = str(a.type, 20);
    const id = str(a.id, 80);
    if (type === "set") {
      const field = str(a.field, 10), value = str(a.value, 20).toLowerCase();
      return EDIT_FIELDS[field]?.(value, days) ? [{ type, field, value }] : [];
    }
    if (type === "add_place") {
      const title = str(a.title, 80).replace(/^#/, "");
      const key = norm(title);
      if (!looksLikeName(title) || seen.has(key) || titles.some((t) => t === key || t.includes(key) || key.includes(t))) return [];
      if (vegOnly && !["pure_veg", "not_a_restaurant"].includes(str(a.menu, 20))) return [];
      seen.add(key);
      // What the model says it serves: a restaurant is scheduled at a meal time, a sight isn't.
      const menu = str(a.menu, 20);
      return [{ type, title, why: str(a.why, 160), day: dayOf(a.day), pick: a.pick === "maybe" ? "maybe" : "must", ...(menu === "pure_veg" || menu === "serves_meat" ? { eat: true } : {}) }];
    }
    if (!ids.has(id)) return [];
    if (type === "remove_place") return [{ type, id }];
    if (type === "set_pick") return ["must", "maybe", "skip"].includes(str(a.pick, 10)) ? [{ type, id, pick: str(a.pick, 10) }] : [];
    if (type === "move_place") return [{ type, id, day: dayOf(a.day) }];
    return [];
  }).slice(0, 12);
  const reply = str(data.reply, 300) || (actions.length ? "Done." : "I couldn’t work out what to change. Could you say it another way?");
  return { reply, actions };
}

const KINDS = ["city", "beach", "trek", "road", "dive"];

/** What the model understood, kept only where it's well-formed: valid values, places quoted from the text. */
function cleanBrief(req: BriefRequest, data: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof data.understood !== "boolean" && typeof data.destination !== "string") return null;
  const destination = str(data.destination, 80);
  const understood = data.understood !== false && destination.length >= 2 && looksLikeName(destination);
  const kind = KINDS.includes(str(data.kind, 10)) ? str(data.kind, 10) : "city";
  const start = str(data.start, 10);
  const places = (Array.isArray(data.places) ? data.places : []).flatMap((x) => {
    const p = (x ?? {}) as Record<string, unknown>;
    // JSON mode doesn't enforce the shape: "name" for "title" is the usual slip.
    const title = str(p.title ?? p.name, 80), quote = str(p.quote, 160);
    // A place they named: its words must be in what they wrote (the title may fix the spelling).
    return looksLikeName(title) && quote && quoted(quote, req.text) ? [{ title, quote }] : [];
  }).slice(0, 15);
  const t = (data.trek ?? {}) as Record<string, unknown>;
  const stages = kind === "trek" && Array.isArray(t.stages) ? cleanStages(t.stages) : [];
  return {
    understood, destination: understood ? destination : "", region: str(data.region, 80), country_code: /^[A-Z]{2}$/.test(str(data.country_code, 2).toUpperCase()) ? str(data.country_code, 2).toUpperCase() : "",
    title: str(data.title, 80), kind: kind === "trek" && !stages.length ? "city" : kind,
    days: Math.round(numIn(data.days, 0, 30)), people: Math.round(numIn(data.people, 0, 20)), month: Math.round(numIn(data.month, 0, 12)),
    party: oneOf(data.party, ["solo", "couple", "friends", "family"], ""), food: oneOf(data.food, ["veg", "jain", "nonveg", "any"], ""), budget: oneOf(data.budget, ["backpacker", "comfortable", "treat"], ""),
    start: /^\d{4}-\d{2}-\d{2}$/.test(start) && start >= req.today ? start : "",
    places: kind === "trek" ? [] : places, note: str(data.note, 300), question: understood ? "" : str(data.question, 200) || "Where would you like to go?",
    reply: str(data.reply, 300),
    best_months: [...new Set((Array.isArray(data.best_months) ? data.best_months : []).map((m) => Math.round(Number(m))).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b),
    trek: stages.length ? {
      summit: str(t.summit, 80), summit_altitude: Math.round(numIn(t.summit_altitude, 0, 8900)), typical_days: Math.round(numIn(t.typical_days, 0, 40)),
      permits: strs(t.permits, 6, 100), stages,
    } : null,
  };
}

/* ------------------------------------------------------------------ running a task */

/** The model a provider uses for a task: reading is extraction; suggesting and planning need to know places. */
export const modelFor = (p: ProviderConfig, req: AiRequest) => (req.task === "read" ? p.model : p.ideasModel);

export type Usage = { inputTokens: number; outputTokens: number; cachedTokens: number };
export type TaskResult =
  | { ok: true; answer: Record<string, unknown>; provider: ProviderName; model: string; usage: Usage; attempts: number }
  | { ok: false; error: AiError; attempts: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a task: the main provider, once more after a short wait if it failed in a way that can pass (busy, slow,
 * unusable answer), then the fallback provider the same way. Setup problems (wrong key, no balance) skip straight
 * to the fallback. Everything stops at `deadlineMs`, so the app never waits longer than that.
 */
export async function runTask(config: AiConfig, req: AiRequest, opts: { fetcher?: typeof fetch; deadlineMs?: number; wait?: (ms: number) => Promise<unknown> } = {}): Promise<TaskResult> {
  const started = Date.now();
  const deadline = opts.deadlineMs ?? 25000;
  const wait = opts.wait ?? sleep;
  const completion = completionFor(req);
  let last = new AiError("server");
  let attempts = 0;
  for (const provider of [config.primary, config.fallback]) {
    if (!provider) continue;
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - (Date.now() - started);
      if (left < 3000) return { ok: false, error: last.kind === "server" && attempts === 0 ? new AiError("timeout") : last, attempts };
      attempts++;
      try {
        const model = modelFor(provider, req);
        const result: CompletionResult = await complete({ ...provider, model }, completion, opts.fetcher ?? fetch, Math.min(left, 20000));
        const answer = cleanAnswer(req, result.text);
        if (!answer) throw new AiError("bad_output");
        return { ok: true, answer, provider: provider.provider, model, usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, cachedTokens: result.cachedTokens }, attempts };
      } catch (e) {
        last = e instanceof AiError ? e : new AiError("server");
        if (!last.retryable) break;
        if (attempt === 0) await wait(last.kind === "rate" ? 1500 : 500);
      }
    }
  }
  return { ok: false, error: last, attempts };
}

/** The answer cache's key: same prompt version, model and input, same answer. A hash, so no content is in the key. */
export async function cacheKey(config: AiConfig, req: AiRequest): Promise<string> {
  const data = new TextEncoder().encode(`${PROMPT_VERSION}|${config.primary.provider}|${modelFor(config.primary, req)}|${userText(req)}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
