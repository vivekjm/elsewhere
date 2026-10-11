// Run against a LOCAL built Worker configured with the test Auth server below.
// No real account, key, bucket or Supabase project is used.
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";

const base = process.env.TRIPS_LOOM_TEST_URL || "http://127.0.0.1:8789";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "This destructive smoke test is local only");
const ownerID = randomUUID();
const otherID = randomUUID();
let deleteFails = true, deleted = false;
const auth = http.createServer((request, response) => {
  const token = request.headers.authorization;
  if (request.url === "/auth/v1/user") {
    const id = token === "Bearer qa-owner-a" && !deleted ? ownerID : token === "Bearer qa-owner-b" ? otherID : null;
    response.writeHead(id ? 200 : 401, { "Content-Type": "application/json" });
    return response.end(JSON.stringify(id ? { id } : { error: "invalid token" }));
  }
  if (request.url === `/auth/v1/admin/users/${ownerID}` && request.method === "DELETE" && token === "Bearer test-only-service-secret") {
    if (!deleteFails) deleted = true;
    response.writeHead(deleteFails ? 503 : 200, { "Content-Type": "application/json" });
    return response.end(JSON.stringify(deleteFails ? { error: "injected failure" } : { id: ownerID }));
  }
  response.writeHead(404); response.end();
});
await new Promise((resolve, reject) => { auth.once("error", reject); auth.listen(8790, "127.0.0.1", resolve); });

const request = (path, token, options = {}) => fetch(base + path, {
  // Each case has a fresh HTTP/1 connection: rejecting a body before the
  // client finishes sending it can close a local emulator's keep-alive socket.
  ...options, headers: { Origin: base, Authorization: `Bearer ${token}`, Connection: "close", ...options.headers },
});
async function upload(token) {
  const form = new FormData();
  form.set("image", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6eTQAAAAASUVORK5CYII=", "base64")], { type: "image/png" }), "fixture.png");
  return request("/api/images", token, { method: "POST", body: form });
}

try {
  const a = await request("/api/workspace", "qa-owner-a");
  const b = await request("/api/workspace", "qa-owner-b");
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  const original = await a.json(), other = await b.json();
  const aPhoto = await upload("qa-owner-a"), bPhoto = await upload("qa-owner-b");
  assert.equal(aPhoto.status, 200, aPhoto.status === 200 ? "" : await aPhoto.text());
  assert.equal(bPhoto.status, 200, bPhoto.status === 200 ? "" : await bPhoto.text());
  const aURL = (await aPhoto.json()).url, bURL = (await bPhoto.json()).url;
  assert.equal((await request(bURL, "qa-owner-a")).status, 404);
  assert.equal((await request("/api/account", "qa-owner-a", { method: "DELETE", headers: { Origin: "https://hostile.example" } })).status, 403);
  assert.equal((await request("/api/account", "invalid", { method: "DELETE" })).status, 401);

  assert.equal((await request("/api/workspace", "qa-owner-b", { method: "PUT", body: "a".repeat(1500001) })).status, 413);
  const hugePhoto = new FormData();
  hugePhoto.set("image", new Blob([new Uint8Array(6 * 1024 * 1024)], { type: "image/png" }), "too-big.png");
  assert.equal((await request("/api/images", "qa-owner-b", { method: "POST", body: hugePhoto })).status, 413);
  const malformed = await request("/api/images", "qa-owner-b", { method: "POST", body: "invalid multipart", headers: { "Content-Type": "multipart/form-data" } });
  assert.equal(malformed.status, 400, await malformed.text());

  // Identity deletion fails once AFTER local cleanup. The marker must block
  // old clients and allow the user to retry without exposing another account.
  const first = await request("/api/account", "qa-owner-a", { method: "DELETE" });
  assert.equal(first.status, 503);
  assert.equal((await request("/api/workspace", "qa-owner-a")).status, 410);
  assert.equal((await request("/api/workspace", "qa-owner-a", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(original) })).status, 410);
  assert.equal((await upload("qa-owner-a")).status, 410);
  assert.equal((await request(aURL, "qa-owner-a")).status, 404);
  assert.equal((await request(bURL, "qa-owner-b")).status, 200);
  assert.deepEqual(await (await request("/api/workspace", "qa-owner-b")).json(), other);

  deleteFails = false;
  const retry = await request("/api/account", "qa-owner-a", { method: "DELETE" });
  assert.equal(retry.status, 200); assert.deepEqual(await retry.json(), { deleted: true });
  assert(deleted);
  assert.equal((await request("/api/workspace", "qa-owner-a")).status, 401);
  console.log("Passed: local account deletion, cleanup failure and retry, stale writes blocked, auth/origin guards, bounded uploads and account isolation.");
} finally {
  auth.closeAllConnections();
  await new Promise(resolve => auth.close(resolve));
}
