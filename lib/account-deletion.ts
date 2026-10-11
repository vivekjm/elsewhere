/** Storage boundaries are injectable so deletion ordering and failure handling
 * can be tested without touching anyone's account. Delete identity last. */
export type AccountDeletionServices = {
  blockWritesAndClearWorkspace: (owner: string) => Promise<void>;
  listPhotos: (prefix: string, cursor?: string) => Promise<{
    keys: string[];
    cursor?: string;
  }>;
  deletePhotos: (keys: string[]) => Promise<void>;
  deleteIdentity: (id: string) => Promise<void>;
};

// A payload-free row prevents requests already authenticated on another device
// from recreating this workspace while R2 and Supabase are being cleaned up.
export const accountDeletionMarkerSQL =
  "INSERT INTO workspaces (id,data,revision,updated_at) VALUES (?, '{}', -1, ?) ON CONFLICT(id) DO UPDATE SET data='{}',revision=-1,updated_at=excluded.updated_at";

export async function deleteAccountData(
  verifiedUserID: string,
  services: AccountDeletionServices,
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(verifiedUserID)) {
    throw new Error("Invalid account identity");
  }
  const owner = `user:${verifiedUserID}`;
  await services.blockWritesAndClearWorkspace(owner);
  let cursor: string | undefined;
  do {
    const page = await services.listPhotos(`${owner}/`, cursor);
    // Defense in depth: even a faulty storage adapter cannot delete another
    // account's object. Pagination uses the storage cursor, never array offsets.
    if (page.keys.some((key) => !key.startsWith(`${owner}/`))) {
      throw new Error("Storage returned an object outside this account");
    }
    if (page.keys.length) await services.deletePhotos(page.keys);
    cursor = page.cursor;
  } while (cursor);
  await services.deleteIdentity(verifiedUserID);
}
