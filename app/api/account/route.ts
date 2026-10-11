import { env } from "cloudflare:workers";
import { authenticatedUser, bucket, database, headers, sameOrigin, supabaseConfig } from "@/lib/server";
import { accountDeletionMarkerSQL, deleteAccountData } from "@/lib/account-deletion";

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request not allowed" }, { status: 403 });
  const user = await authenticatedUser(request);
  if (!user) return Response.json({ error: "Please sign in again before deleting your account." }, { status: 401, headers: headers() });
  const config = supabaseConfig();
  const values = env as unknown as Record<string, unknown>;
  const secret = values.SUPABASE_SECRET_KEY || values.SUPABASE_SERVICE_ROLE_KEY;
  // Verify configuration before removing any data. This server-only secret
  // must never be returned by /api/auth/config or included in an app build.
  if (!config || typeof secret !== "string" || !secret) {
    return Response.json({ error: "Account deletion is temporarily unavailable. Please try again later." }, { status: 503, headers: headers() });
  }
  try {
    const storage = bucket();
    await deleteAccountData(user.id, {
      blockWritesAndClearWorkspace: async (owner) => {
        await database().prepare(accountDeletionMarkerSQL).bind(owner, new Date().toISOString()).run();
      },
      listPhotos: async (prefix, cursor) => {
        const result = await storage.list({ prefix, cursor, limit: 500 });
        return { keys: result.objects.map((object) => object.key), cursor: result.truncated ? result.cursor : undefined };
      },
      deletePhotos: async (keys) => { await storage.delete(keys); },
      deleteIdentity: async (id) => {
        const response = await fetch(`${config.url}/auth/v1/admin/users/${id}`, {
          method: "DELETE",
          headers: { apikey: secret, Authorization: `Bearer ${secret}` },
        });
        if (!response.ok) throw new Error("Account provider did not confirm deletion");
      },
    });
    return Response.json({ deleted: true }, { headers: headers() });
  } catch {
    // Identity is retained on a cleanup failure, allowing the user to retry.
    // Never log tokens or the provider response, which may contain personal data.
    return Response.json({ error: "Deletion could not be completed. Some data may already be removed. Please retry to finish deleting your account." }, { status: 503, headers: headers() });
  }
}
