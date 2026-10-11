import { test } from "node:test";
import assert from "node:assert/strict";
import { accountDeletionMarkerSQL, deleteAccountData, type AccountDeletionServices } from "../lib/account-deletion.ts";
import { DatabaseSync } from "node:sqlite";

const id = "12345678-1234-1234-1234-123456789abc";
function fixture() {
  const calls: string[] = [];
  const services: AccountDeletionServices = {
    blockWritesAndClearWorkspace: async () => { calls.push("workspace-blocked"); },
    listPhotos: async (prefix, cursor) => { calls.push(`list:${prefix}:${cursor || ""}`); return { keys: [`${prefix}${cursor || "first"}`], cursor: cursor ? undefined : "next" }; },
    deletePhotos: async () => { calls.push("photos"); },
    deleteIdentity: async () => { calls.push("identity"); },
  };
  return { calls, services };
}
test("account deletion cleans every page and removes identity last", async () => {
  const { calls, services } = fixture();
  await deleteAccountData(id, services);
  assert.equal(calls.filter((call) => call === "photos").length, 2);
  assert.equal(calls[0], "workspace-blocked");
  assert.equal(calls.at(-1), "identity");
  assert(calls[1].includes(`user:${id}/`));
});
test("cleanup failure keeps identity available for retry", async () => {
  const { calls, services } = fixture();
  services.deletePhotos = async () => { throw new Error("offline"); };
  await assert.rejects(deleteAccountData(id, services));
  assert(!calls.includes("identity"));
  assert.equal(calls[0], "workspace-blocked");
});
test("deletion refuses storage objects outside the verified account", async () => {
  const { calls, services } = fixture();
  services.listPhotos = async () => ({ keys: ["user:another-account/photo"] });
  await assert.rejects(deleteAccountData(id, services), /outside/);
  assert.deepEqual(calls, ["workspace-blocked"]);
});
test("invalid identities never reach storage", async () => {
  const { calls, services } = fixture();
  await assert.rejects(deleteAccountData("user-supplied-owner", services));
  assert.equal(calls.length, 0);
});

test("deletion marker prevents late workspace creation and revisioned writes", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE workspaces (id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)");
    const owner = `user:${id}`;
    db.prepare("INSERT INTO workspaces VALUES (?, ?, 4, ?)").run(owner, '{"private":"trip"}', "before");
    db.prepare("INSERT INTO workspaces VALUES (?, ?, 8, ?)").run("user:other", '{"keep":true}', "before");
    const mark = db.prepare(accountDeletionMarkerSQL);
    mark.run(owner, "now");
    // An older GET creating the account and a PUT with a previously read
    // revision both arrive after deletion started.
    db.prepare("INSERT OR IGNORE INTO workspaces VALUES (?, ?, 0, ?)").run(owner, '{"resurrect":true}', "later");
    const result = db.prepare("UPDATE workspaces SET data=?,revision=revision+1 WHERE id=? AND revision=?").run('{"resurrect":true}', owner, 4);
    assert.equal(result.changes, 0);
    assert.deepEqual({ ...db.prepare("SELECT data,revision FROM workspaces WHERE id=?").get(owner) }, { data: "{}", revision: -1 });
    assert.equal(db.prepare("SELECT revision FROM workspaces WHERE id=?").get("user:other")?.revision, 8);
    mark.run(owner, "retry");
    assert.equal(db.prepare("SELECT revision FROM workspaces WHERE id=?").get(owner)?.revision, -1);
  } finally { db.close(); }
});
