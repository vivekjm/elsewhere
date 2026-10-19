import { env } from "cloudflare:workers";
import { authenticatedUser, headers, sameOrigin, supabaseConfig } from "@/lib/server";
import { readLimitedBody, RequestBodyTooLarge } from "@/lib/request-body";
import { aiConfig, cacheKey, parseRequest, PROVIDER_LABEL, runTask, type AiRequest } from "@/lib/reel-ai";

/**
 * Calls to the model per signed-in account per UTC day (answers served from the cache, and changes the phone makes
 * itself, don't count). A planning session with a dozen changes fits several times over.
 */
const DAILY_CALLS = 60;
/** Calls for all accounts together per UTC day, unless AI_DAILY_GLOBAL_LIMIT says otherwise: a ceiling on the bill. */
const DAILY_GLOBAL_CALLS = 20000;
const globalLimit = (values: Record<string, unknown>) => {
  const n = Number(values.AI_DAILY_GLOBAL_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : DAILY_GLOBAL_CALLS;
};
/** How long an answer is reused for the same input: reels' words don't change; suggestions can go stale. */
const CACHE_SECONDS: Record<AiRequest["task"], number> = { read: 7 * 86400, ideas: 86400, edit: 3600, brief: 3600 };

const settings = () => env as unknown as Record<string, unknown>;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: headers() });

/** One line per call for the Worker's logs: what ran and how it went. Never content, never who. */
function log(fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event: "ai_call", ...fields }));
}

/** The edge cache, where there is one (Workers on a zone); a no-op elsewhere. */
async function cache(): Promise<Cache | null> {
  try { return typeof caches !== "undefined" ? await caches.open("tripsloom-ai") : null; } catch { return null; }
}
const cacheUrl = (key: string, task: string) => `https://ai-cache.tripsloom.internal/${task}/${key}`;

/** Whether planning can use a cloud model, and which. No key is ever returned. */
export async function GET() {
  const config = aiConfig(settings());
  return json({ available: !!config, provider: config ? PROVIDER_LABEL[config.primary.provider] : "", model: config?.primary.model ?? "" });
}

/** Reads reels' words for places, or suggests a few more. Signed-in accounts only, within a daily allowance. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Request not allowed" }, 403);
  const config = aiConfig(settings());
  if (!config) return json({ error: "AI isn’t set up on this server." }, 503);
  const user = await authenticatedUser(request);
  const supabase = supabaseConfig();
  if (!user || !supabase) return json({ error: "Sign in to use AI planning." }, 401);
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(await readLimitedBody(request, 64 * 1024))); } catch (e) {
    const big = e instanceof RequestBodyTooLarge;
    return json({ error: big ? "Too much text at once." : "Couldn’t read the request." }, big ? 413 : 400);
  }
  const req = parseRequest(body);
  if (!req) return json({ error: "Nothing to read." }, 400);
  const started = Date.now();

  // The same input already answered (another person sharing the same reel, the same ask): no model call, no allowance used.
  const store = await cache();
  const key = await cacheKey(config, req);
  const hit = await store?.match(cacheUrl(key, req.task)).catch(() => undefined);
  if (hit) {
    log({ task: req.task, outcome: "cache", ms: Date.now() - started });
    return json(await hit.json());
  }

  // One call counted per request, as the person (their token), so the allowance can't be shared or spoofed.
  const quota = await fetch(`${supabase.url}/rest/v1/rpc/use_ai_quota`, {
    method: "POST",
    headers: { apikey: supabase.key, Authorization: request.headers.get("authorization") ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ p_limit: DAILY_CALLS, p_global: globalLimit(settings()) }),
  }).then((r) => (r.ok ? r.json() : false)).catch(() => false);
  if (quota !== true) {
    log({ task: req.task, outcome: "allowance", ms: Date.now() - started });
    return json({ error: "AI planning has reached today’s limit. Adding places yourself still works.", reason: "allowance" }, 429);
  }

  const result = await runTask(config, req);
  if (!result.ok) {
    log({ task: req.task, outcome: result.error.kind, status: result.error.status, attempts: result.attempts, provider: config.primary.provider, ms: Date.now() - started });
    return json({ error: "The AI didn’t answer. Adding places yourself still works.", reason: "failed" }, 502);
  }
  const answer = { ...result.answer, model: result.model, provider: PROVIDER_LABEL[result.provider] };
  log({ task: req.task, outcome: "ok", provider: result.provider, model: result.model, attempts: result.attempts, ms: Date.now() - started, ...result.usage, items: ["places", "ideas", "actions"].map((k) => result.answer[k]).find(Array.isArray)?.length ?? 0 });
  await store?.put(cacheUrl(key, req.task), new Response(JSON.stringify(answer), { headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${CACHE_SECONDS[req.task]}` } })).catch(() => {});
  return json(answer);
}
