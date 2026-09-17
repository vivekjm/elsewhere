import { env } from "cloudflare:workers";
export function database() {
  if (!env.DB) throw new Error("Storage unavailable");
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET) throw new Error("Uploads unavailable");
  return env.BUCKET;
}
export function guest(r: Request) {
  const s = r.headers
    .get("cookie")
    ?.match(/(?:^|; )elsewhere_guest=([a-f0-9-]{36})(?:;|$)/)?.[1];
  return s || null;
}
export function headers(id?: string, r?: Request) {
  return {
    "Cache-Control": "no-store",
    ...(id
      ? {
          "Set-Cookie": `elsewhere_guest=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${r && new URL(r.url).protocol === "https:" ? "; Secure" : ""}`,
        }
      : {}),
  };
}
export function sameOrigin(r: Request) {
  return r.headers.get("origin") === new URL(r.url).origin;
}
export function failure(e: unknown) {
  console.error("Elsewhere storage error", e);
  return Response.json(
    { error: "We couldn’t reach your workspace. Please try again." },
    { status: 503, headers: headers() },
  );
}
