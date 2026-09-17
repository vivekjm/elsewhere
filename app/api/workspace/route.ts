import { database, guest, headers, sameOrigin, failure } from "@/lib/server";
import { seed, workspaceSchema } from "@/lib/model";
export async function GET(r: Request) {
  try {
    const existing = guest(r),
      id = existing || crypto.randomUUID(),
      db = database();
    let row = await db
      .prepare("SELECT data, revision FROM workspaces WHERE id = ?")
      .bind(id)
      .first<{ data: string; revision: number }>();
    if (!row) {
      const data = seed();
      await db
        .prepare(
          "INSERT OR IGNORE INTO workspaces (id,data,revision,updated_at) VALUES (?, ?, 0, ?)",
        )
        .bind(id, JSON.stringify(data), new Date().toISOString())
        .run();
      row = await db
        .prepare("SELECT data,revision FROM workspaces WHERE id = ?")
        .bind(id)
        .first<{ data: string; revision: number }>();
    }
    return Response.json(
      { workspace: JSON.parse(row!.data), revision: row!.revision },
      { headers: headers(existing ? undefined : id, r) },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(r: Request) {
  if (!sameOrigin(r))
    return Response.json({ error: "Request not allowed" }, { status: 403 });
  const id = guest(r);
  if (!id)
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
        id,
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
