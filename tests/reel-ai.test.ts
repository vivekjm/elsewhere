import { test } from "node:test";
import assert from "node:assert/strict";
import { aiConfig, cacheKey, cleanAnswer, parseJson, parseRequest, quoted, runTask, type AiRequest } from "../lib/reel-ai.ts";
import { AiError, complete, geminiSchema, geminiText, openaiText, providerFrom } from "../lib/ai/providers.ts";
import { EDIT_SYSTEM, IDEAS_SYSTEM, PROMPT_VERSION, READ_SCHEMA, READ_SYSTEM } from "../lib/ai/prompts.ts";

const READ: AiRequest = {
  task: "read", destination: "Goa",
  reels: [{ id: "instagram:x", platform: "instagram", creator: "goagram", title: "", caption: "Sunset at the Dil Chahta Hai fort, then dinner at Gunpowder in Assagao 🌅", hashtags: ["bagabeach", "goadiaries"], coverText: "", notes: "" }],
};
const IDEAS: AiRequest = { task: "ideas", destination: "Jaipur", have: ["Hawa Mahal", "Amber Fort"], interests: [], party: "4 friends", food: "jain", budget: "comfortable", ask: "Food we can all eat", near: ["Pink City"] };

/** A fake provider: answers in order, recording each request. */
function fake(...answers: (Response | (() => Response))[]) {
  const calls: { url: string; init: RequestInit; body: Record<string, unknown> }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: JSON.parse(init.body as string) });
    const a = answers[Math.min(calls.length - 1, answers.length - 1)];
    return typeof a === "function" ? a() : a.clone();
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}
const deepseekReply = (content: unknown, finish = "stop") => new Response(`\n\n${JSON.stringify({ choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) }, finish_reason: finish }], usage: { prompt_tokens: 900, completion_tokens: 120, prompt_cache_hit_tokens: 800 } })}`);
const noWait = { wait: async () => {} };

/* ------------------------------------------------------------------ configuration */

test("config: no key or switched off means no AI; DeepSeek first; provider, model and fallback are settings", () => {
  assert.equal(aiConfig({}), null);
  assert.equal(aiConfig({ DEEPSEEK_API_KEY: "d", AI_DISABLED: "1" }), null);
  const d = aiConfig({ DEEPSEEK_API_KEY: " d " })!;
  assert.deepEqual([d.primary.provider, d.primary.model, d.primary.ideasModel, d.primary.key, d.primary.baseUrl], ["deepseek", "deepseek-flash", "deepseek-v4-pro", "d", "https://api.deepseek.com"]);
  // AI_MODEL sets both tasks; AI_IDEAS_MODEL just ideas.
  assert.deepEqual([aiConfig({ DEEPSEEK_API_KEY: "d", AI_MODEL: "deepseek-v4-pro" })!.primary.model, aiConfig({ DEEPSEEK_API_KEY: "d", AI_MODEL: "deepseek-v4-pro" })!.primary.ideasModel], ["deepseek-v4-pro", "deepseek-v4-pro"]);
  assert.deepEqual([aiConfig({ DEEPSEEK_API_KEY: "d", AI_IDEAS_MODEL: "deepseek-flash" })!.primary.model, aiConfig({ DEEPSEEK_API_KEY: "d", AI_IDEAS_MODEL: "deepseek-flash" })!.primary.ideasModel], ["deepseek-flash", "deepseek-flash"]);
  assert.equal(d.fallback, null);
  // With several keys and no choice, DeepSeek; AI_PROVIDER picks another.
  assert.equal(aiConfig({ GEMINI_API_KEY: "g", DEEPSEEK_API_KEY: "d" })!.primary.provider, "deepseek");
  const g = aiConfig({ GEMINI_API_KEY: "g", DEEPSEEK_API_KEY: "d", AI_PROVIDER: "gemini", AI_MODEL: "gemini-3.5-flash", AI_FALLBACK_PROVIDER: "deepseek" })!;
  assert.deepEqual([g.primary.provider, g.primary.model, g.fallback?.provider, g.fallback?.model], ["gemini", "gemini-3.5-flash", "deepseek", "deepseek-flash"]);
  // A named provider without a key falls back to one that has one; a bad model name is ignored.
  assert.equal(aiConfig({ AI_PROVIDER: "openai", DEEPSEEK_API_KEY: "d" })!.primary.provider, "deepseek");
  assert.equal(aiConfig({ DEEPSEEK_API_KEY: "d", AI_MODEL: "bad model/../x" })!.primary.model, "deepseek-flash");
  // A fallback the same as the main provider, or without a key, is no fallback.
  assert.equal(aiConfig({ DEEPSEEK_API_KEY: "d", AI_FALLBACK_PROVIDER: "deepseek" })!.fallback, null);
  assert.equal(aiConfig({ DEEPSEEK_API_KEY: "d", AI_FALLBACK_PROVIDER: "openai" })!.fallback, null);
  // A gateway base URL must be HTTPS.
  assert.equal(providerFrom({ DEEPSEEK_API_KEY: "d", DEEPSEEK_BASE_URL: "http://evil.example" }, "deepseek")!.baseUrl, "https://api.deepseek.com");
  assert.equal(providerFrom({ DEEPSEEK_API_KEY: "d", DEEPSEEK_BASE_URL: "https://gw.example.com/deepseek/" }, "deepseek")!.baseUrl, "https://gw.example.com/deepseek");
  assert.equal(providerFrom({ DEEPSEEK_API_KEY: "d", DEEPSEEK_BASE_URL: "http://127.0.0.1:8788" }, "deepseek")!.baseUrl, "http://127.0.0.1:8788");
  assert.equal(providerFrom({ DEEPSEEK_API_KEY: "d", DEEPSEEK_BASE_URL: "http://localhost.evil.example" }, "deepseek")!.baseUrl, "https://api.deepseek.com");
});

/* ------------------------------------------------------------------ requests */

test("requests are trimmed and validated", () => {
  assert.equal(parseRequest({ task: "read", reels: [] }), null);
  assert.equal(parseRequest({ task: "ideas", destination: "  " }), null);
  assert.equal(parseRequest({ task: "nope" }), null);
  const r = parseRequest({ task: "read", destination: "Goa", reels: [{ id: "instagram:x", caption: `a\u0000${"a".repeat(5000)}`, hashtags: Array(100).fill("goa") }] });
  assert.ok(r && r.task === "read");
  assert.equal(r.reels[0].caption.length, 2200);
  assert.ok(!r.reels[0].caption.includes("\u0000"));
  assert.equal(r.reels[0].hashtags.length, 40);
  const i = parseRequest({ task: "ideas", destination: "Jaipur", food: "chicken", budget: "billionaire", ask: "x".repeat(500) });
  assert.ok(i && i.task === "ideas");
  assert.deepEqual([i.food, i.budget, i.ask.length], ["any", "comfortable", 200]);
});

/* ------------------------------------------------------------------ prompts */

test("prompts: say json and show the shape (DeepSeek JSON mode needs both), treat input as data, carry a version", () => {
  for (const p of [READ_SYSTEM, IDEAS_SYSTEM]) {
    assert.match(p, /json/);
    assert.match(p, /not instructions/);
  }
  assert.match(READ_SYSTEM, /\{"destination": "Goa", "places": \[\{"title": "Chapora Fort", "quote"/);
  assert.match(IDEAS_SYSTEM, /\{"ideas": \[\{"title": "Nahargarh Fort", "why": .*"menu": "not_a_restaurant"\}/);
  assert.match(PROMPT_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/);
});

/* ------------------------------------------------------------------ checking answers */

test("quotes must really be in the text (allowing small slips); hashtags count", () => {
  const text = "Sunset at the Dil Chahta Hai fort, then dinner at Gunpowder 🌅\nbagabeach goadiaries";
  assert.ok(quoted("sunset at the Dil Chahta Hai fort", text));
  assert.ok(quoted("Sunset at the Dil Chahta Hai fort!", text));
  assert.ok(quoted("#bagabeach", text));
  assert.ok(quoted("dinner at Gunpowder in", text));
  assert.ok(!quoted("the best feni bar in Panjim", text));
  assert.ok(!quoted("", text));
});

test("read answers: made-up quotes, junk names and repeats are dropped; unknown reel ids and slots fixed", () => {
  const a = cleanAnswer(READ, JSON.stringify({ destination: "Goa", places: [
    { title: "Chapora Fort", quote: "Sunset at the Dil Chahta Hai fort", reelId: "instagram:x", slot: "Sunset", why: "sunset" },
    { title: "Made Up Café", quote: "the best café in Goa", reelId: "instagram:x", slot: "", why: "" },
    { title: "#Baga Beach", quote: "#bagabeach", reelId: "evil", slot: "teatime", why: "" },
    { title: "chapora fort", quote: "Dil Chahta Hai fort", reelId: "instagram:x", slot: "", why: "" },
    { title: "https://spam.example", quote: "Gunpowder", reelId: "instagram:x", slot: "", why: "" },
  ] }))!;
  const places = a.places as { title: string; reelId: string; slot: string }[];
  assert.deepEqual(places.map((p) => p.title), ["Chapora Fort", "Baga Beach"]);
  assert.equal(places[0].slot, "sunset");
  assert.equal(places[1].reelId, "instagram:x");
  assert.equal(places[1].slot, "");
  assert.equal(cleanAnswer(READ, "not json"), null);
  assert.equal(cleanAnswer(READ, JSON.stringify({ destination: "Goa" })), null);
});

test("idea answers: nothing the trip has, nothing twice, not the destination; fenced JSON is read", () => {
  const a = cleanAnswer(IDEAS, "```json\n" + JSON.stringify({ ideas: [
    { title: "Rawat Mishtan Bhandar", why: "Pure-veg kachoris", menu: "pure_veg" },
    { title: "Hawa Mahal", why: "again", menu: "not_a_restaurant" },
    { title: "Amber Fort and Palace", why: "same place", menu: "not_a_restaurant" },
    { title: "Jaipur", why: "the city", menu: "not_a_restaurant" },
    { title: "rawat mishtan bhandar", why: "twice", menu: "pure_veg" },
    { title: "Laxmi Misthan Bhandar", why: "Jain thali", menu: "pure_veg" },
    { title: "Jantar Mantar", why: "sight", menu: "not_a_restaurant" },
  ] }) + "\n```")!;
  assert.deepEqual((a.ideas as { title: string }[]).map((i) => i.title), ["Rawat Mishtan Bhandar", "Laxmi Misthan Bhandar", "Jantar Mantar"]);
  assert.deepEqual(parseJson('Sure! {"ideas": []}'), { ideas: [] });
});

test("a veg or Jain group never gets a place that serves meat, or one the model isn't sure about", () => {
  const answer = JSON.stringify({ ideas: [
    { title: "Spice Court", why: "Jain options", menu: "serves_meat" },
    { title: "Niro's", why: "classic", menu: "" },
    { title: "Shree Agarwal Caterers", why: "Jain thali", menu: "pure_veg" },
    { title: "Johari Bazaar", why: "shopping", menu: "not_a_restaurant" },
  ] });
  assert.deepEqual((cleanAnswer(IDEAS, answer)!.ideas as { title: string }[]).map((i) => i.title), ["Shree Agarwal Caterers", "Johari Bazaar"]);
  // Anyone else gets them all.
  assert.equal((cleanAnswer({ ...IDEAS, food: "any" } as AiRequest, answer)!.ideas as unknown[]).length, 4);
});

/* ------------------------------------------------------------------ providers */

test("DeepSeek: chat completions, key in a header, JSON mode, thinking off; blank keep-alive lines are fine", async () => {
  const { fetcher, calls } = fake(deepseekReply({ ideas: [{ title: "Rawat Mishtan Bhandar", why: "veg", menu: "pure_veg" }] }));
  const config = aiConfig({ DEEPSEEK_API_KEY: "secret" })!;
  const r = await runTask(config, IDEAS, { fetcher, ...noWait });
  assert.ok(r.ok);
  assert.deepEqual(r.ok && [r.provider, r.model, r.usage.inputTokens, r.usage.cachedTokens], ["deepseek", "deepseek-v4-pro", 900, 800]);
  const { url, init, body } = calls[0];
  assert.equal(url, "https://api.deepseek.com/chat/completions");
  assert.equal((init.headers as Record<string, string>).Authorization, "Bearer secret");
  assert.ok(!url.includes("secret") && !(init.body as string).includes("secret"));
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.deepEqual(body.thinking, { type: "disabled" });
  assert.equal(body.model, "deepseek-v4-pro");
  // Reading uses the fast model.
  const reading = fake(deepseekReply({ destination: "Goa", places: [] }));
  await runTask(config, READ, { fetcher: reading.fetcher, ...noWait });
  assert.equal(reading.calls[0].body.model, "deepseek-flash");
  assert.equal(reading.calls[0].body.temperature, 0);
  const messages = body.messages as { role: string; content: string }[];
  assert.deepEqual(messages.map((m) => m.role), ["system", "user"]);
  assert.equal(messages[0].content, IDEAS_SYSTEM);
  assert.deepEqual(JSON.parse(messages[1].content).request, "Food we can all eat");
});

test("DeepSeek: a cut-off or empty answer is unusable", async () => {
  const config = aiConfig({ DEEPSEEK_API_KEY: "k" })!.primary;
  const req = { system: "s json", user: "u", schema: READ_SCHEMA, schemaName: "x", maxTokens: 10, temperature: 0 };
  await assert.rejects(complete(config, req, fake(deepseekReply('{"ideas": [', "length")).fetcher), (e: AiError) => e.kind === "bad_output");
  await assert.rejects(complete(config, req, fake(deepseekReply("")).fetcher), (e: AiError) => e.kind === "bad_output");
  await assert.rejects(complete(config, req, fake(new Response("nope", { status: 402 })).fetcher), (e: AiError) => e.kind === "billing" && !e.retryable);
  await assert.rejects(complete(config, req, fake(new Response("busy", { status: 503 })).fetcher), (e: AiError) => e.kind === "server" && e.retryable);
});

test("OpenAI and Gemini response shapes and schema dialect", () => {
  assert.equal(geminiText({ candidates: [{ content: { parts: [{ text: '{"a":' }, { text: "1}" }] } }] }), '{"a":1}');
  assert.equal(openaiText({ output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: '{"ideas":[]}' }] }] }), '{"ideas":[]}');
  const g = geminiSchema(READ_SCHEMA) as { type: string; additionalProperties?: unknown };
  assert.equal(g.type, "OBJECT");
  assert.equal(g.additionalProperties, undefined);
});

/* ------------------------------------------------------------------ retries and fallback */

test("a busy provider is tried once more; an unusable answer too", async () => {
  const good = deepseekReply({ ideas: [{ title: "Rawat Mishtan Bhandar", why: "veg", menu: "pure_veg" }] });
  const busy = fake(new Response("", { status: 503 }), good);
  const r = await runTask(aiConfig({ DEEPSEEK_API_KEY: "k" })!, IDEAS, { fetcher: busy.fetcher, ...noWait });
  assert.ok(r.ok && r.attempts === 2);
  const junk = fake(deepseekReply("I can't help with that"), good);
  assert.ok((await runTask(aiConfig({ DEEPSEEK_API_KEY: "k" })!, IDEAS, { fetcher: junk.fetcher, ...noWait })).ok);
});

test("a wrong key or no balance goes straight to the fallback provider; all failing is reported, not thrown", async () => {
  const config = aiConfig({ DEEPSEEK_API_KEY: "k", GEMINI_API_KEY: "g", AI_FALLBACK_PROVIDER: "gemini" })!;
  const geminiOk = new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ideas: [{ title: "Rawat Mishtan Bhandar", why: "veg", menu: "pure_veg" }] }) }] } }] }));
  const f = fake(new Response("", { status: 401 }), geminiOk);
  const r = await runTask(config, IDEAS, { fetcher: f.fetcher, ...noWait });
  assert.ok(r.ok && r.provider === "gemini" && r.attempts === 2);
  assert.match(f.calls[1].url, /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.5-flash-lite:generateContent$/);
  const down = fake(new Response("", { status: 500 }));
  const failed = await runTask(config, IDEAS, { fetcher: down.fetcher, ...noWait });
  assert.ok(!failed.ok && failed.error.kind === "server" && failed.attempts === 4);
});

test("a network failure or timeout counts as retryable; the deadline is respected", async () => {
  const thrower = (async () => { throw new TypeError("network down"); }) as unknown as typeof fetch;
  const r = await runTask(aiConfig({ DEEPSEEK_API_KEY: "k" })!, IDEAS, { fetcher: thrower, ...noWait });
  assert.ok(!r.ok && r.error.kind === "network" && r.attempts === 2);
  const none = await runTask(aiConfig({ DEEPSEEK_API_KEY: "k" })!, IDEAS, { fetcher: thrower, deadlineMs: 1000, ...noWait });
  assert.ok(!none.ok && none.attempts === 0 && none.error.kind === "timeout");
});

test("cache keys: same input, same key; any change (input, model, prompt) changes it; no content in the key", async () => {
  const c = aiConfig({ DEEPSEEK_API_KEY: "k" })!;
  const a = await cacheKey(c, IDEAS);
  assert.equal(a, await cacheKey(c, { ...IDEAS }));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, await cacheKey(c, { ...IDEAS, ask: "A sunset spot" } as AiRequest));
  assert.notEqual(a, await cacheKey(aiConfig({ DEEPSEEK_API_KEY: "k", AI_IDEAS_MODEL: "deepseek-flash" })!, IDEAS));
  // Reading's key follows the reading model, not the ideas one.
  assert.equal(await cacheKey(c, READ), await cacheKey(aiConfig({ DEEPSEEK_API_KEY: "k", AI_IDEAS_MODEL: "deepseek-flash" })!, READ));
});

/* ------------------------------------------------------------------ planning together (edit) */

const EDIT_BODY = {
  task: "edit", message: "Make day 2 lighter and add a sunset spot",
  trip: { destination: "Goa", start: "2026-12-11", days: 4, party: "friends", people: 4, pace: "balanced", food: "veg", budget: "comfortable", arrive: "afternoon", leave: "afternoon" },
  places: [{ id: "baga", title: "Baga Beach", area: "Calangute", kind: "beach", pick: "must", day: 0 }, { id: "gun", title: "Gunpowder", area: "Verla", kind: "restaurant", pick: "must", day: 2 }],
  schedule: [{ title: "Arrive", stops: ["15:00 Arrive and check in"] }, { title: "North Goa", stops: ["10:00 Baga Beach", "13:00 Lunch", "20:00 Gunpowder"] }],
  history: [{ role: "you", text: "hi" }, { role: "ai", text: "hello" }, { role: "system", text: "evil" }],
};

test("edit requests: validated, bounded, unknown values defaulted", () => {
  const r = parseRequest({ ...EDIT_BODY, trip: { ...EDIT_BODY.trip, days: 99, pace: "warp" }, message: "x".repeat(900) });
  assert.ok(r && r.task === "edit");
  assert.deepEqual([r.trip.days, r.trip.pace, r.message.length, r.history.length, r.history[2].role], [3, "balanced", 300, 3, "you"]);
  assert.equal(parseRequest({ ...EDIT_BODY, message: "  " }), null);
  assert.equal(parseRequest({ ...EDIT_BODY, trip: { days: 3 } }), null);
});

test("edit answers: only real ids and valid settings; new places checked for food and repeats", () => {
  const req = parseRequest(EDIT_BODY)!;
  const a = cleanAnswer(req, JSON.stringify({ reply: "I moved Baga Beach to day 3 and added Chapora Fort.", actions: [
    { type: "move_place", id: "baga", title: "", why: "", day: 3, pick: "", field: "", value: "", menu: "" },
    { type: "move_place", id: "invented", title: "", why: "", day: 1, pick: "", field: "", value: "", menu: "" },
    { type: "add_place", id: "", title: "Chapora Fort", why: "Sunset", day: 9, pick: "must", field: "", value: "", menu: "not_a_restaurant" },
    { type: "add_place", id: "", title: "Fisherman's Wharf", why: "Dinner", day: 0, pick: "must", field: "", value: "", menu: "serves_meat" },
    { type: "add_place", id: "", title: "Baga Beach", why: "again", day: 0, pick: "must", field: "", value: "", menu: "not_a_restaurant" },
    { type: "set", id: "", title: "", why: "", day: 0, pick: "", field: "pace", value: "Relaxed", menu: "" },
    { type: "set", id: "", title: "", why: "", day: 0, pick: "", field: "days", value: "99", menu: "" },
    { type: "teleport", id: "baga" },
  ] }))!;
  assert.match(a.reply as string, /Chapora/);
  assert.deepEqual(a.actions, [
    { type: "move_place", id: "baga", day: 3 },
    { type: "add_place", title: "Chapora Fort", why: "Sunset", day: 0, pick: "must" },
    { type: "set", field: "pace", value: "relaxed" },
  ]);
  // A place to eat says so, so the app schedules it at a meal time.
  const eat = cleanAnswer(req, JSON.stringify({ reply: "ok", actions: [{ type: "add_place", id: "", title: "Ambrai", why: "Lake view", day: 2, pick: "must", field: "", value: "", menu: "pure_veg" }] }))!;
  assert.deepEqual(eat.actions, [{ type: "add_place", title: "Ambrai", why: "Lake view", day: 2, pick: "must", eat: true }]);
  // Switching food to "anything" in the same reply lets a restaurant that serves meat through.
  const b = cleanAnswer(req, JSON.stringify({ reply: "ok", actions: [
    { type: "set", id: "", title: "", why: "", day: 0, pick: "", field: "food", value: "any", menu: "" },
    { type: "add_place", id: "", title: "Fisherman's Wharf", why: "Dinner", day: 0, pick: "must", field: "", value: "", menu: "serves_meat" },
  ] }))!;
  assert.equal((b.actions as unknown[]).length, 2);
  // No actions, no reply: a polite fallback, not an empty bubble.
  assert.match(cleanAnswer(req, JSON.stringify({ reply: "", actions: [] }))!.reply as string, /another way/);
  assert.equal(cleanAnswer(req, JSON.stringify({ reply: "hi" })), null);
});

test("edits use the stronger model; the prompt says json and shows the shape", async () => {
  const f = fake(deepseekReply({ reply: "Done.", actions: [] }));
  await runTask(aiConfig({ DEEPSEEK_API_KEY: "k" })!, parseRequest(EDIT_BODY)!, { fetcher: f.fetcher, ...noWait });
  assert.equal(f.calls[0].body.model, "deepseek-v4-pro");
  assert.match(EDIT_SYSTEM, /json/);
  assert.match(EDIT_SYSTEM, /\{"reply": .*"actions": \[\{"type": "move_place"/);
});

/* ------------------------------------------------------------------ understanding a sentence (brief) */

test("brief requests: the server sets today's date; the route and history are bounded", () => {
  const r = parseRequest({ task: "brief", text: "Trek in nepal in goechala for 6 days", today: "1999-01-01", current_route: Array(50).fill({ from: "A", to: "B", distance_km: 900, end_altitude: 99999 }) });
  assert.ok(r && r.task === "brief");
  assert.equal(r.today, new Date().toISOString().slice(0, 10));
  assert.equal(r.current_route.length, 30);
  assert.deepEqual([r.current_route[0].distance_km, r.current_route[0].end_altitude], [60, 8900]);
  assert.equal(parseRequest({ task: "brief", text: " " }), null);
});

test("brief answers: places must be quoted from the text; a trek needs stages; past dates and bad values dropped", () => {
  const req = parseRequest({ task: "brief", text: "4 days in udaipur with my wife, city palace and lake pichola" })!;
  const a = cleanAnswer(req, JSON.stringify({ understood: true, destination: "Udaipur", region: "Rajasthan, India", country_code: "in", title: "Udaipur", kind: "city", days: 4, people: 2, party: "couple",
    month: 0, start: "2001-01-01", food: "", budget: "", note: "", question: "",
    places: [{ title: "City Palace", quote: "city palace" }, { title: "Lake Pichola", quote: "lake pichola" }, { title: "Jag Mandir", quote: "jag mandir" }],
    trek: { summit: "", summit_altitude: 0, typical_days: 0, permits: [], stages: [] } }))!;
  assert.deepEqual((a.places as { title: string }[]).map((p) => p.title), ["City Palace", "Lake Pichola"]);
  assert.deepEqual([a.country_code, a.start, a.kind, a.trek], ["IN", "", "city", null]);
  const t = cleanAnswer(parseRequest({ task: "brief", text: "hampta pass" })!, JSON.stringify({ understood: true, destination: "Manali", kind: "trek", trek: { summit: "Hampta Pass", summit_altitude: 4270, typical_days: 5, permits: [], stages: [] } }))!;
  assert.equal(t.kind, "city", "a trek with no route isn't planned as one");
  const q = cleanAnswer(parseRequest({ task: "brief", text: "somewhere warm" })!, JSON.stringify({ understood: false, destination: "", question: "" }))!;
  assert.deepEqual([q.understood, q.question], [false, "Where would you like to go?"]);
});

test("brief places: 'name' is read as 'title' (JSON mode doesn't enforce the shape)", () => {
  const req = parseRequest({ task: "brief", text: "weekend in pondy, want to see auroville and promenade beach" })!;
  const a = cleanAnswer(req, JSON.stringify({ understood: true, destination: "Puducherry", kind: "city", places: [{ name: "Auroville", quote: "auroville" }, { name: "Promenade Beach", quote: "promenade beach" }] }))!;
  assert.deepEqual((a.places as { title: string }[]).map((p) => p.title), ["Auroville", "Promenade Beach"]);
});
