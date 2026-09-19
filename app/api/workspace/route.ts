import {
  bucket,
  database,
  guest,
  headers,
  sameOrigin,
  failure,
  workspaceOwner,
} from "@/lib/server";
import { emptyWorkspace, workspaceSchema } from "@/lib/model";

async function claimVisitorPhotos(data: string, from: string, to: string) {
  try {
    const workspace = JSON.parse(data) as { items?: Array<{ image?: unknown }> },
      ids = [
        ...new Set(
          (workspace.items || [])
            .map((item) =>
              typeof item.image === "string"
                ? item.image.match(/^\/api\/images\/([a-f0-9-]{36})$/i)?.[1]
                : undefined,
            )
            .filter((id): id is string => !!id),
        ),
      ];
    if (!ids.length) return;
    const storage = bucket();
    for (const id of ids) {
      const source = await storage.get(`${from}/${id}`);
      if (!source) continue;
      await storage.put(`${to}/${id}`, source.body, {
        httpMetadata: source.httpMetadata,
        customMetadata: source.customMetadata,
      });
    }
  } catch {
    // Workspace data can still be claimed if a legacy visitor photo is gone.
  }
}

export async function GET(r: Request) {
  try {
    const owner = await workspaceOwner(r);
    if (!owner)
      return Response.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401, headers: headers() },
      );
    const existing = guest(r),
      db = database();
    // Remove only untouched copies of the retired built-in sample. Rows that
    // have ever been edited are preserved, so this cannot erase user work.
    await db
      .prepare(
        `DELETE FROM workspaces
         WHERE revision = 0
           AND json_extract(data, '$.version') = 1
           AND json_array_length(json_extract(data, '$.trips')) = 1
           AND json_extract(data, '$.trips[0].sample') = 1`,
      )
      .run();
    let row = await db
      .prepare("SELECT data, revision FROM workspaces WHERE id = ?")
      .bind(owner.id)
      .first<{ data: string; revision: number }>();
    // The first signed-in load claims the visitor workspace from this browser.
    // The copy keeps the existing trip data intact while future saves use the
    // stable Supabase user ID across browsers and devices.
    if (!row && owner.authenticated && existing && existing !== owner.id) {
      const visitor = await db
        .prepare("SELECT data, revision FROM workspaces WHERE id = ?")
        .bind(existing)
        .first<{ data: string; revision: number }>();
      if (visitor) {
        await claimVisitorPhotos(visitor.data, existing, owner.id);
        await db
          .prepare(
            "INSERT OR IGNORE INTO workspaces (id,data,revision,updated_at) VALUES (?, ?, ?, ?)",
          )
          .bind(
            owner.id,
            visitor.data,
            visitor.revision,
            new Date().toISOString(),
          )
          .run();
        row = await db
          .prepare("SELECT data, revision FROM workspaces WHERE id = ?")
          .bind(owner.id)
          .first<{ data: string; revision: number }>();
      }
    }
    if (!row) {
      const data = emptyWorkspace();
      await db
        .prepare(
          "INSERT OR IGNORE INTO workspaces (id,data,revision,updated_at) VALUES (?, ?, 0, ?)",
        )
        .bind(owner.id, JSON.stringify(data), new Date().toISOString())
        .run();
      row = await db
        .prepare("SELECT data,revision FROM workspaces WHERE id = ?")
        .bind(owner.id)
        .first<{ data: string; revision: number }>();
    }
    return Response.json(
      { workspace: JSON.parse(row!.data), revision: row!.revision },
      {
        headers: headers(
          owner.authenticated || existing ? undefined : owner.id,
          r,
        ),
      },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(r: Request) {
  if (!sameOrigin(r))
    return Response.json({ error: "Request not allowed" }, { status: 403 });
  const owner = await workspaceOwner(r);
  if (!owner)
    return Response.json(
      { error: "Your session has expired. Please sign in again." },
      { status: 401 },
    );
  if (!owner.authenticated && !owner.visitorId)
    return Response.json(
      { error: "Please reload to open your workspace." },
      { status: 401 },
    );
  try {
    const raw = await r.text();
    if (raw.length > 1500000)
      return Response.json(
        {
          error: "Workspace is too large. Export a backup and reduce its size.",
        },
        { status: 413 },
      );
    const payload = JSON.parse(raw),
      parsed = workspaceSchema.safeParse(payload.workspace);
    if (
      !parsed.success ||
      !Number.isSafeInteger(payload.revision) ||
      payload.revision < 0
    )
      return Response.json(
        { error: "Please check your trip data." },
        { status: 400 },
      );
    const result = await database()
      .prepare(
        "UPDATE workspaces SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
      )
      .bind(
        JSON.stringify(parsed.data),
        new Date().toISOString(),
        owner.id,
        payload.revision,
      )
      .run();
    if (!result.meta.changes)
      return Response.json(
        {
          error:
            "This workspace changed in another tab. Export your edits, then reload to continue.",
        },
        { status: 409 },
      );
    return Response.json(
      { revision: payload.revision + 1 },
      { headers: headers() },
    );
  } catch (e) {
    if (e instanceof SyntaxError)
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    return failure(e);
  }
}
