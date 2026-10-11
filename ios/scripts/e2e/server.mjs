// Local replica of the Trips Loom backend for end-to-end tests of the iOS app.
// Worker routes mirror app/api/workspace, app/api/images and lib/server.ts;
// Supabase Auth + PostgREST (profiles, trip_extras) are emulated with RLS.
// Every workspace PUT is validated with the web's real workspaceSchema and the
// stripped result is stored, exactly as the Worker does.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { workspaceSchema } from "./.model.mjs";

const PORT = Number(process.env.TRIPSLOOM_E2E_PORT ?? 8787), ORIGIN = `http://127.0.0.1:${PORT}`, KEY = "sb_publishable_test";
const USER = { id: "0f6c3b1e-7a52-4c1d-9e8b-2d4a6f1c9b30", email: "e2e@tripsloom.test" };

const state = {
  tokens: new Map(),        // access token -> { userId, expiresAt }
  refresh: new Map(),       // refresh token -> userId
  workspaces: new Map(),    // "user:<id>" -> { data: string, revision }
  profiles: new Map(),      // id -> row
  extras: new Map(),        // `${user}|${trip}` -> row
  images: new Map(),        // `${owner}/${id}` -> { type, bytes }
  feedback: [],
  metadata: {},
  log: [],
  failNext: null,           // { path, status } to inject one failure
  tokenTTL: 3600,
};

function mint(userId, ttl = state.tokenTTL) {
  const access = "at_" + randomUUID(), refresh = "rt_" + randomUUID();
  state.tokens.set(access, { userId, expiresAt: Date.now() + ttl * 1000 });
  state.refresh.set(refresh, userId);
  return { access_token: access, refresh_token: refresh, expires_in: ttl, token_type: "bearer",
    user: { id: userId, email: USER.email, user_metadata: state.metadata } };
}

function userFor(req) {
  const m = (req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const t = state.tokens.get(m[1]);
  if (!t || t.expiresAt < Date.now()) return null;
  return t.userId;
}

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const read = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); });

async function handle(req, res) {
  const url = new URL(req.url, ORIGIN), path = url.pathname, method = req.method;
  const body = await read(req);
  const entry = { t: new Date().toISOString().slice(11, 23), method, path: path + (url.search || "") };
  state.log.push(entry);
  const send = (status, b, h) => { entry.status = status; json(res, status, b, h); };

  // ---- test controls ----
  if (path.startsWith("/__admin/")) {
    const cmd = path.slice(9);
    if (cmd === "reset") {
      state.workspaces.clear(); state.profiles.clear(); state.extras.clear(); state.images.clear();
      state.feedback = [];
      state.offline = false; state.failNext = null; state.delayNext = null; state.editBeforePut = null; state.log = [];
      return send(200, {});
    }
    if (cmd === "delay-next") { state.delayNext = JSON.parse(body.toString()); return send(200, {}); }
    if (cmd === "mint") return send(200, mint(USER.id, Number(url.searchParams.get("ttl")) || state.tokenTTL));
    if (cmd === "state") {
      const ws = state.workspaces.get(`user:${USER.id}`);
      return send(200, { revision: ws?.revision ?? null, workspace: ws ? JSON.parse(ws.data) : null,
        profile: state.profiles.get(USER.id) ?? null, metadata: state.metadata,
        extras: [...state.extras.values()].map((r) => ({ trip_id: r.trip_id, keys: Object.keys(r.data), name: r.data.name })),
        images: [...state.images.keys()], feedback: state.feedback, tokens: state.tokens.size });
    }
    if (cmd === "log") { const l = state.log.filter((e) => !e.path.startsWith("/__admin")); if (url.searchParams.has("clear")) state.log = []; return send(200, l); }
    if (cmd === "seed" || cmd === "web-edit") {
      // Simulates the website saving: validate, strip, bump revision.
      const key = `user:${USER.id}`, ws = JSON.parse(body.toString());
      const parsed = workspaceSchema.safeParse(ws);
      if (!parsed.success) return send(400, { error: parsed.error.message });
      const prev = state.workspaces.get(key);
      state.workspaces.set(key, { data: JSON.stringify(parsed.data), revision: cmd === "seed" ? 0 : (prev?.revision ?? 0) + 1 });
      return send(200, { revision: state.workspaces.get(key).revision });
    }
    if (cmd === "offline") { state.offline = url.searchParams.get("on") === "1"; return send(200, { offline: state.offline }); }
    if (cmd === "edit-before-next-put") { state.editBeforePut = JSON.parse(body.toString()); return send(200, {}); }
    if (cmd === "fail-next") { state.failNext = JSON.parse(body.toString()); return send(200, {}); }
    if (cmd === "expire-all") { for (const t of state.tokens.values()) t.expiresAt = 0; return send(200, {}); }
    return send(404, {});
  }

  if (state.offline) { entry.status = "dropped"; req.socket.destroy(); return; }
  if (state.failNext && path.startsWith(state.failNext.path) && (!state.failNext.method || state.failNext.method === method)) {
    const { status } = state.failNext; state.failNext = null;
    return send(status, { error: "Injected failure" });
  }

  if (state.delayNext && path.startsWith(state.delayNext.path) && (!state.delayNext.method || state.delayNext.method === method)) {
    const delay = state.delayNext; state.delayNext = null;
    await new Promise(resolve => setTimeout(resolve, delay.ms));
  }

  // ---- Worker ----
  if (path === "/api/auth/config") return send(200, { configured: true, url: ORIGIN, publishableKey: KEY });

  if (path === "/api/workspace") {
    const hasAuth = /^Bearer\s+/i.test(req.headers.authorization || "");
    if (!hasAuth) return send(200, { workspace: { version: 1, trips: [], items: [], outfits: [] }, revision: 0 }); // guest
    const uid = userFor(req);
    if (method === "PUT" && req.headers.origin !== ORIGIN) return send(403, { error: "Request not allowed" });
    if (!uid) return send(401, { error: "Your session has expired. Please sign in again." });
    const key = `user:${uid}`;
    if (method === "GET") {
      if (!state.workspaces.has(key)) state.workspaces.set(key, { data: JSON.stringify({ version: 1, trips: [], items: [], outfits: [] }), revision: 0 });
      const row = state.workspaces.get(key);
      return send(200, { workspace: JSON.parse(row.data), revision: row.revision });
    }
    if (method === "PUT") {
      const raw = body.toString();
      if (raw.length > 1500000) return send(413, { error: "Workspace is too large. Export a backup and reduce its size." });
      let payload; try { payload = JSON.parse(raw); } catch { return send(400, { error: "Invalid JSON" }); }
      const parsed = workspaceSchema.safeParse(payload.workspace);
      if (!parsed.success || !Number.isSafeInteger(payload.revision) || payload.revision < 0) {
        entry.detail = parsed.success ? "bad revision" : parsed.error.message;
        return send(400, { error: "Please check your trip data." });
      }
      if (state.editBeforePut) {
        // The website saves in the gap between this client's fetch and PUT.
        const web = workspaceSchema.safeParse(state.editBeforePut); state.editBeforePut = null;
        const prev = state.workspaces.get(key);
        state.workspaces.set(key, { data: JSON.stringify(web.data), revision: prev.revision + 1 });
        entry.detail = "web saved first";
      }
      const row = state.workspaces.get(key);
      if (!row || row.revision !== payload.revision)
        return send(409, { error: "This workspace changed in another tab. Export your edits, then reload to continue." });
      state.workspaces.set(key, { data: JSON.stringify(parsed.data), revision: payload.revision + 1 });
      return send(200, { revision: payload.revision + 1 });
    }
  }

  if (path === "/api/images" && method === "POST") {
    if (req.headers.origin !== ORIGIN) return send(403);
    const uid = userFor(req);
    if (!uid) return send(401);
    const form = await new Request(ORIGIN + path, { method, headers: { "content-type": req.headers["content-type"] }, body }).formData();
    const file = form.get("image");
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024) return send(400, { error: "Use an image smaller than 5 MB." });
    const b = new Uint8Array(await file.arrayBuffer());
    const type = b[0] === 255 && b[1] === 216 ? "image/jpeg" : b[0] === 137 && b[1] === 80 ? "image/png" : null;
    if (!type) return send(400, { error: "Choose a JPEG, PNG or WebP image." });
    const id = randomUUID();
    state.images.set(`user:${uid}/${id}`, { type, bytes: Buffer.from(b) });
    return send(200, { url: `/api/images/${id}` });
  }
  const img = path.match(/^\/api\/images\/([a-f0-9-]{36})$/);
  if (img && method === "GET") {
    const uid = userFor(req);
    const found = uid && state.images.get(`user:${uid}/${img[1]}`);
    if (!found) { entry.status = 404; res.writeHead(404); return res.end(); }
    entry.status = 200; res.writeHead(200, { "Content-Type": found.type }); return res.end(found.bytes);
  }

  // ---- Supabase ----
  if (path.startsWith("/auth/") || path.startsWith("/rest/")) {
    if (req.headers.apikey !== KEY) return send(401, { message: "Invalid API key" });
  }
  if (path === "/auth/v1/settings") return send(200, { external: { email: true, apple: false }, mailer_autoconfirm: false });
  if (path === "/auth/v1/signup" && method === "POST") {
    const b = JSON.parse(body.toString() || "{}");
    if (!b.email?.endsWith("@tripsloom.test") || typeof b.password !== "string" || b.password.length < 8)
      return send(400, { msg: "Password should be at least 8 characters." });
    return send(200, { user: { id: USER.id, email: b.email } }); // confirmation-required fixture; sends no email
  }
  if (path === "/auth/v1/recover" && method === "POST") return send(200, {}); // no email leaves the harness
  if (path === "/auth/v1/token") {
    const b = JSON.parse(body.toString() || "{}"), grant = url.searchParams.get("grant_type");
    if (grant === "password" && b.email === USER.email && b.password === "QA-only-passphrase-2026!") return send(200, mint(USER.id));
    if (grant === "refresh_token") {
      const uid = state.refresh.get(b.refresh_token);
      if (!uid) return send(400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" });
      state.refresh.delete(b.refresh_token); // rotation, as Supabase does
      return send(200, mint(uid));
    }
    return send(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
  }
  if (path === "/auth/v1/user") {
    const uid = userFor(req);
    if (!uid) return send(401, { code: 401, msg: "invalid JWT" });
    if (method === "PUT") { const b = JSON.parse(body.toString() || "{}"); if (b.data) Object.assign(state.metadata, b.data); }
    return send(200, { id: uid, email: USER.email, user_metadata: state.metadata });
  }
  if (path === "/auth/v1/logout") {
    const m = (req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
    if (m) state.tokens.delete(m[1]);
    entry.status = 204; res.writeHead(204); return res.end();
  }

  if (path === "/rest/v1/feedback" && method === "POST") {
    const uid = userFor(req), b = JSON.parse(body.toString());
    if (!uid) return send(401, { message: "JWT expired" });
    if (b.user_id !== uid) return send(403, { message: "RLS denied" });
    if (!b.message || b.message.trim().length < 10 || b.message.length > 4000) return send(400, { message: "Invalid feedback" });
    if (state.feedback.filter(x => x.user_id === uid).length >= 5) return send(429, { message: "Please wait before sending more feedback." });
    state.feedback.push(b); entry.status = 201; res.writeHead(201); return res.end();
  }
  // PostgREST with RLS: rows are always scoped to auth.uid().
  if (path === "/rest/v1/profiles") {
    const uid = userFor(req);
    if (!uid) return send(401, { message: "JWT expired" });
    if (method === "GET") {
      const eq = url.searchParams.get("id");
      const row = state.profiles.get(uid);
      return send(200, row && (!eq || eq === `eq.${uid}`) ? [row] : []);
    }
    if (method === "POST") {
      const b = JSON.parse(body.toString());
      if (b.id !== uid) return send(403, { message: 'new row violates row-level security policy for table "profiles"' });
      if (b.unit && !["metric", "imperial"].includes(b.unit)) return send(400, { message: 'violates check constraint "profiles_unit_check"' });
      state.profiles.set(uid, { display_name: "", home_base: "", travel_style: "a little of everything", interests: [], packing_style: "light and considered", unit: "metric", onboarding_completed: false, native_preferences: {}, ...(state.profiles.get(uid) || {}), ...b });
      entry.status = 201; res.writeHead(201); return res.end();
    }
  }
  if (path === "/rest/v1/trip_extras") {
    const uid = userFor(req);
    if (!uid) return send(401, { message: "JWT expired" });
    if (method === "GET")
      return send(200, [...state.extras.values()].filter((r) => r.user_id === uid).map((r) => ({ trip_id: r.trip_id, data: r.data })));
    if (method === "POST") {
      const rows = JSON.parse(body.toString());
      for (const r of Array.isArray(rows) ? rows : [rows]) {
        if (r.user_id !== uid) return send(403, { message: 'new row violates row-level security policy for table "trip_extras"' });
        if (!r.trip_id || r.trip_id.length > 100) return send(400, { message: "violates check constraint" });
        state.extras.set(`${uid}|${r.trip_id}`, { user_id: uid, trip_id: r.trip_id, data: r.data });
      }
      entry.status = 201; res.writeHead(201); return res.end();
    }
    if (method === "DELETE") {
      const m = (url.searchParams.get("trip_id") || "").match(/^in\.\((.*)\)$/);
      for (const id of m ? m[1].split(",").map(id => id.replace(/^"|"$/g, "")) : []) state.extras.delete(`${uid}|${id}`);
      entry.status = 204; res.writeHead(204); return res.end();
    }
  }
  send(404, { error: "Not found" });
}

http.createServer((req, res) => handle(req, res).catch((e) => { console.error(e); json(res, 500, { error: String(e) }); }))
  .listen(PORT, "127.0.0.1", () => console.log(`e2e backend on ${ORIGIN}`));
