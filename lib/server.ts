import { env } from "cloudflare:workers";

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

export type WorkspaceOwner = {
  id: string;
  authenticated: boolean;
  user?: AuthenticatedUser;
  visitorId?: string;
};

function runtimeEnv() {
  return env as unknown as Record<string, unknown>;
}

export function supabaseConfig() {
  const values = runtimeEnv(),
    url =
      typeof values.SUPABASE_URL === "string"
        ? values.SUPABASE_URL.trim().replace(/\/$/, "")
        : "",
    key =
      typeof values.SUPABASE_PUBLISHABLE_KEY === "string"
        ? values.SUPABASE_PUBLISHABLE_KEY.trim()
        : typeof values.SUPABASE_ANON_KEY === "string"
          ? values.SUPABASE_ANON_KEY.trim()
          : "";
  return url && key ? { url, key } : null;
}

function bearer(r: Request) {
  const value = r.headers.get("authorization") || "";
  return value.match(/^Bearer\s+([^\s]+)$/i)?.[1] || null;
}

/** Verify a Supabase access token without ever trusting a client-supplied user ID. */
export async function authenticatedUser(
  r: Request,
): Promise<AuthenticatedUser | null> {
  const token = bearer(r), config = supabaseConfig();
  if (!token || !config) return null;
  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as {
      id?: unknown;
      email?: unknown;
    };
    return typeof user.id === "string" &&
      /^[0-9a-f-]{36}$/i.test(user.id)
      ? {
          id: user.id,
          email: typeof user.email === "string" ? user.email : undefined,
        }
      : null;
  } catch {
    return null;
  }
}

/** Resolve a request to a stable account owner, or to its existing visitor cookie. */
export async function workspaceOwner(r: Request): Promise<WorkspaceOwner | null> {
  const hasAuthorization = /^Bearer\s+/i.test(
    r.headers.get("authorization") || "",
  );
  if (hasAuthorization) {
    const user = await authenticatedUser(r);
    return user
      ? { id: `user:${user.id}`, authenticated: true, user }
      : null;
  }
  const visitorId = guest(r);
  return {
    id: visitorId || crypto.randomUUID(),
    authenticated: false,
    ...(visitorId ? { visitorId } : {}),
  };
}

export function database() {
  if (!env.DB) throw new Error("Storage unavailable");
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET) throw new Error("Uploads unavailable");
  return env.BUCKET;
}
export function guest(r: Request) {
  const cookie = r.headers.get("cookie") || "",
    s =
      cookie.match(/(?:^|; )tripsloom_guest=([a-f0-9-]{36})(?:;|$)/)?.[1] ||
      cookie.match(/(?:^|; )elsewhere_guest=([a-f0-9-]{36})(?:;|$)/)?.[1];
  return s || null;
}
export function headers(id?: string, r?: Request) {
  return {
    "Cache-Control": "no-store",
    ...(id
      ? {
          "Set-Cookie": `tripsloom_guest=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${r && new URL(r.url).protocol === "https:" ? "; Secure" : ""}`,
        }
      : {}),
  };
}
export function sameOrigin(r: Request) {
  return r.headers.get("origin") === new URL(r.url).origin;
}
export function failure(e: unknown) {
  console.error("Trips Loom storage error", e);
  return Response.json(
    { error: "We couldn’t reach your workspace. Please try again." },
    { status: 503, headers: headers() },
  );
}
