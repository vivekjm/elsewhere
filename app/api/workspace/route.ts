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

const LEGACY_TRIP_ID = "lisbon",
  LEGACY_OUTFIT_IDS = new Set(["city", "coast", "evening"]),
  LEGACY_ITEM_IDS = new Set([
    "linen",
    "trousers",
    "trainers",
    "jacket",
    "camera",
    "dress",
  ]);

async function retireLegacyDemo(db: ReturnType<typeof database>) {
  const result = await db
    .prepare(
      `SELECT id, data, revision FROM workspaces
       WHERE instr(data, '"id":"lisbon"') > 0
          OR instr(data, '"sample":') > 0`,
    )
    .all<{ id: string; data: string; revision: number }>();
  for (const row of result.results) {
    try {
      const raw = JSON.parse(row.data) as Record<string, unknown>,
        trips = Array.isArray(raw.trips)
          ? (raw.trips as Array<Record<string, unknown>>).filter(
              (trip) => trip.id !== LEGACY_TRIP_ID,
            )
          : [];
      trips.forEach((trip) => delete trip.sample);
      const usedOutfits = new Set<string>(),
        usedItems = new Set<string>();
      for (const trip of trips) {
        if (Array.isArray(trip.packed))
          trip.packed.forEach((id) => usedItems.add(String(id)));
        if (Array.isArray(trip.activities))
          trip.activities.forEach((entry) => {
            const activity = entry as Record<string, unknown>;
            if (activity.outfitId) usedOutfits.add(String(activity.outfitId));
            if (Array.isArray(activity.gear))
              activity.gear.forEach((id) => usedItems.add(String(id)));
          });
        if (trip.days && typeof trip.days === "object")
          Object.values(trip.days as Record<string, Record<string, unknown>>).forEach(
            (day) => {
              if (day.outfitId) usedOutfits.add(String(day.outfitId));
              if (Array.isArray(day.outfitIds))
                day.outfitIds.forEach((id) => usedOutfits.add(String(id)));
              if (Array.isArray(day.gear))
                day.gear.forEach((id) => usedItems.add(String(id)));
            },
          );
      }
      const outfits = Array.isArray(raw.outfits)
        ? (raw.outfits as Array<Record<string, unknown>>).filter(
            (outfit) =>
              !LEGACY_OUTFIT_IDS.has(String(outfit.id)) ||
              usedOutfits.has(String(outfit.id)),
          )
        : [];
      outfits.forEach((outfit) => {
        if (Array.isArray(outfit.items))
          outfit.items.forEach((id) => usedItems.add(String(id)));
      });
      const items = Array.isArray(raw.items)
        ? (raw.items as Array<Record<string, unknown>>).filter(
            (item) =>
              !LEGACY_ITEM_IDS.has(String(item.id)) ||
              usedItems.has(String(item.id)),
          )
        : [];
      const cleaned = workspaceSchema.parse({ ...raw, trips, outfits, items });
      await db
        .prepare(
          "UPDATE workspaces SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?",
        )
        .bind(
          JSON.stringify(cleaned),
          new Date().toISOString(),
          row.id,
          row.revision,
        )
        .run();
    } catch {
      // A malformed workspace is left untouched rather than risking user data.
    }
  }
}

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
    await retireLegacyDemo(db);
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
