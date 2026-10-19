/**
 * The model providers behind Trips Loom's AI, each behind one small interface: a system prompt and the user's text
 * in, JSON text out. Which one runs is configuration (AI_PROVIDER, AI_MODEL, one key per provider), so changing
 * provider or model is a settings change, and a second provider can stand in when the first is down
 * (AI_FALLBACK_PROVIDER). Keys travel only in request headers. Nothing here logs or keeps content.
 */

export type ProviderName = "deepseek" | "gemini" | "openai";
/** `model` reads posts; `ideasModel` suggests places (which needs more knowledge of the world than reading does). */
export type ProviderConfig = { provider: ProviderName; model: string; ideasModel: string; key: string; baseUrl: string };
export type JsonSchema = Record<string, unknown>;

export type Completion = {
  system: string;
  user: string;
  /** Used by providers that enforce a schema (OpenAI, Gemini). DeepSeek gets the shape from the prompt's example. */
  schema: JsonSchema;
  schemaName: string;
  maxTokens: number;
  temperature: number;
};
export type CompletionResult = { text: string; inputTokens: number; outputTokens: number; cachedTokens: number };

export const PROVIDERS: ProviderName[] = ["deepseek", "gemini", "openai"];
export const DEFAULT_MODEL: Record<ProviderName, string> = { deepseek: "deepseek-flash", gemini: "gemini-3.5-flash-lite", openai: "gpt-6-luna" };
/**
 * Suggesting places needs to know them: in our evaluation, deepseek-flash named restaurants that serve meat for a veg
 * group about one time in five; deepseek-v4-pro about one in twenty, at 2–3 s and about $1 per 1,000 calls.
 */
export const DEFAULT_IDEAS_MODEL: Record<ProviderName, string> = { deepseek: "deepseek-v4-pro", gemini: "gemini-3.5-flash-lite", openai: "gpt-6-luna" };
export const PROVIDER_LABEL: Record<ProviderName, string> = { deepseek: "DeepSeek", gemini: "Gemini", openai: "OpenAI" };
export const KEY_VAR: Record<ProviderName, string> = { deepseek: "DEEPSEEK_API_KEY", gemini: "GEMINI_API_KEY", openai: "OPENAI_API_KEY" };
const BASE_URL: Record<ProviderName, string> = {
  deepseek: "https://api.deepseek.com",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  openai: "https://api.openai.com/v1",
};

export type AiErrorKind = "auth" | "billing" | "bad_request" | "rate" | "server" | "timeout" | "network" | "bad_output";

/** A failed call, by what to do about it: fix the setup (auth, billing, bad_request), or try again (the rest). */
export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly status: number;
  constructor(kind: AiErrorKind, status = 0) {
    super(`AI ${kind}${status ? ` (${status})` : ""}`);
    this.kind = kind;
    this.status = status;
  }
  get retryable(): boolean {
    return this.kind === "rate" || this.kind === "server" || this.kind === "timeout" || this.kind === "network" || this.kind === "bad_output";
  }
}

export function errorForStatus(status: number): AiError {
  if (status === 401 || status === 403) return new AiError("auth", status);
  if (status === 402) return new AiError("billing", status);
  if (status === 429) return new AiError("rate", status);
  if (status >= 500) return new AiError("server", status);
  return new AiError("bad_request", status);
}

const MODEL_ID = /^[a-z0-9][a-z0-9.\-_]{1,59}$/i;

/** One provider's settings from the Worker's environment, or null when it has no key. */
/** `model` sets both tasks' model; `ideasModel` sets the ideas model alone. */
export function providerFrom(values: Record<string, unknown>, provider: ProviderName, model?: unknown, ideasModel?: unknown): ProviderConfig | null {
  const key = values[KEY_VAR[provider]];
  if (typeof key !== "string" || !key.trim()) return null;
  // A different base URL is for a compatible gateway (for example a proxy in front of DeepSeek): HTTPS, or a local
  // stand-in on this machine during development (a deployed Worker can't reach localhost).
  const override = values[`${provider.toUpperCase()}_BASE_URL`];
  const allowed = /^https:\/\/[^\s/]+(\/[^\s]*)?$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/[^\s]*)?$/;
  const baseUrl = typeof override === "string" && allowed.test(override.trim()) ? override.trim().replace(/\/+$/, "") : BASE_URL[provider];
  const valid = (m: unknown): m is string => typeof m === "string" && MODEL_ID.test(m);
  return {
    provider, model: valid(model) ? model : DEFAULT_MODEL[provider], ideasModel: valid(ideasModel) ? ideasModel : valid(model) ? model : DEFAULT_IDEAS_MODEL[provider],
    key: key.trim(), baseUrl,
  };
}

async function post(fetcher: typeof fetch, url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, { method: "POST", signal, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  } catch {
    throw new AiError(signal.aborted ? "timeout" : "network");
  }
  if (!response.ok) {
    // Drain the body so the connection can be reused; its text may echo the request, so it isn't kept.
    await response.text().catch(() => "");
    throw errorForStatus(response.status);
  }
  let raw: string;
  try { raw = await response.text(); } catch { throw new AiError(signal.aborted ? "timeout" : "network"); }
  // DeepSeek sends blank lines while a request waits; JSON.parse skips leading whitespace.
  try { return JSON.parse(raw); } catch { throw new AiError("bad_output", response.status); }
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** DeepSeek: OpenAI-style chat completions, JSON mode, thinking off (fast and cheap for reading and suggesting). */
async function deepseek(c: ProviderConfig, req: Completion, fetcher: typeof fetch, signal: AbortSignal): Promise<CompletionResult> {
  const body = await post(fetcher, `${c.baseUrl}/chat/completions`, { Authorization: `Bearer ${c.key}` }, {
    model: c.model,
    messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }],
    response_format: { type: "json_object" },
    thinking: { type: "disabled" },
    temperature: req.temperature,
    max_tokens: req.maxTokens,
    stream: false,
  }, signal) as { choices?: { message?: { content?: unknown }; finish_reason?: unknown }[]; usage?: Record<string, unknown> };
  const choice = body.choices?.[0];
  const text = typeof choice?.message?.content === "string" ? choice.message.content : "";
  // Cut off at the token limit, or the occasional empty answer: not usable JSON.
  if (!text.trim() || choice?.finish_reason === "length") throw new AiError("bad_output");
  return { text, inputTokens: n(body.usage?.prompt_tokens), outputTokens: n(body.usage?.completion_tokens), cachedTokens: n(body.usage?.prompt_cache_hit_tokens) };
}

/** OpenAI: the Responses API with a strict JSON schema. */
async function openai(c: ProviderConfig, req: Completion, fetcher: typeof fetch, signal: AbortSignal): Promise<CompletionResult> {
  const body = await post(fetcher, `${c.baseUrl}/responses`, { Authorization: `Bearer ${c.key}` }, {
    model: c.model, instructions: req.system, input: req.user, max_output_tokens: req.maxTokens, reasoning: { effort: "low" },
    text: { format: { type: "json_schema", name: req.schemaName, schema: req.schema, strict: true } },
  }, signal) as Record<string, unknown>;
  const usage = (body.usage ?? {}) as Record<string, unknown>;
  const text = openaiText(body);
  if (!text.trim()) throw new AiError("bad_output");
  return { text, inputTokens: n(usage.input_tokens), outputTokens: n(usage.output_tokens), cachedTokens: n((usage.input_tokens_details as Record<string, unknown> | undefined)?.cached_tokens) };
}

export function openaiText(body: unknown): string {
  const o = (body ?? {}) as Record<string, unknown>;
  if (typeof o.output_text === "string") return o.output_text;
  const out = (o.output as { type?: string; content?: { type?: string; text?: string }[] }[] | undefined) ?? [];
  return out.flatMap((m) => (m.type === "message" ? m.content ?? [] : [])).filter((x) => x.type === "output_text").map((x) => x.text ?? "").join("");
}

/** Gemini: generateContent with a response schema (its dialect: upper-case types, no additionalProperties). */
async function gemini(c: ProviderConfig, req: Completion, fetcher: typeof fetch, signal: AbortSignal): Promise<CompletionResult> {
  const body = await post(fetcher, `${c.baseUrl}/models/${encodeURIComponent(c.model)}:generateContent`, { "x-goog-api-key": c.key }, {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: "user", parts: [{ text: req.user }] }],
    generationConfig: { temperature: req.temperature, maxOutputTokens: req.maxTokens, responseMimeType: "application/json", responseSchema: geminiSchema(req.schema) },
  }, signal) as Record<string, unknown>;
  const usage = (body.usageMetadata ?? {}) as Record<string, unknown>;
  const text = geminiText(body);
  if (!text.trim()) throw new AiError("bad_output");
  return { text, inputTokens: n(usage.promptTokenCount), outputTokens: n(usage.candidatesTokenCount), cachedTokens: n(usage.cachedContentTokenCount) };
}

export function geminiText(body: unknown): string {
  const o = (body ?? {}) as Record<string, unknown>;
  const parts = ((o.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined)?.[0]?.content?.parts) ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

/** Gemini's schema dialect: upper-case types, no additionalProperties. */
export function geminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(geminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "additionalProperties") continue;
    out[k] = k === "type" && typeof v === "string" ? v.toUpperCase() : geminiSchema(v);
  }
  return out;
}

const CALL: Record<ProviderName, typeof deepseek> = { deepseek, openai, gemini };

/** One call to one provider, abandoned after `timeoutMs`. Throws AiError. */
export async function complete(c: ProviderConfig, req: Completion, fetcher: typeof fetch = fetch, timeoutMs = 20000): Promise<CompletionResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await CALL[c.provider](c, req, fetcher, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
