import { test } from "node:test";
import assert from "node:assert/strict";
import { readLimitedBody, RequestBodyTooLarge } from "../lib/request-body.ts";

test("request limits count UTF-8 bytes rather than characters", async () => {
  const exact = new Request("https://local.test", { method: "POST", body: "世界" });
  assert.equal(new TextDecoder().decode(await readLimitedBody(exact, 6)), "世界");
  await assert.rejects(readLimitedBody(new Request("https://local.test", { method: "POST", body: "世界" }), 5), RequestBodyTooLarge);
});
test("chunked oversized input is cancelled before the whole stream is read", async () => {
  let pulls = 0, cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { pulls++; controller.enqueue(new Uint8Array(8)); },
    cancel() { cancelled = true; },
  });
  const request = new Request("https://local.test", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(readLimitedBody(request, 10), RequestBodyTooLarge);
  assert(cancelled);
  assert(pulls <= 3, "Reader must stop rather than exhaust an unbounded stream");
});
test("declared oversized input is rejected without consuming it", async () => {
  const request = new Request("https://local.test", { method: "POST", body: "small", headers: { "Content-Length": "100" } });
  await assert.rejects(readLimitedBody(request, 10), RequestBodyTooLarge);
  assert.equal(request.bodyUsed, false);
  assert.equal((await readLimitedBody(new Request("https://local.test"), 10)).byteLength, 0);
});
