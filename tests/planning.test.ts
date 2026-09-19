import { test } from "node:test";
import assert from "node:assert/strict";
import {
  packing,
  removeItem,
  removeOutfit,
  workspaceSchema,
  tripDates,
  validDate,
  activitySchema,
  dayOutfits,
  blankDay,
  safeLink,
  type Workspace,
} from "../lib/model.ts";
import { testWorkspace as seed } from "./fixtures.ts";
import {
  resizeTrip,
  duplicateTrip,
  monthDays,
  shiftMonth,
  dayItems,
  overlaps,
} from "../lib/planning.ts";
import { calendarICS, packingCSV, foldICS, filename } from "../lib/exports.ts";
import { parseBackup, prepareRestore, exportBackup } from "../lib/backup.ts";

test("test workspace retains packing count, deduplication and per-piece weights", () => {
  const w = seed(),
    rows = packing(w, w.trips[0]);
  assert.equal(rows.length, 9);
  assert.equal(rows.filter((i) => i.id === "linen").length, 1);
  assert.equal(rows.filter((i) => i.id === "camera").length, 1);
  assert.equal(
    rows.reduce((n, i) => n + i.weight * i.quantity, 0),
    2760,
  );
});
test("legacy hosted rows normalise without losing itinerary content", () => {
  const old = seed();
  old.items.forEach((i) => {
    delete i.color;
    delete i.shape;
    delete i.notes;
  });
  old.outfits.forEach((o) => {
    delete o.occasion;
    delete o.notes;
  });
  const actual = workspaceSchema.parse(old);
  assert.equal(
    actual.trips[0].activities[0].title,
    old.trips[0].activities[0].title,
  );
  assert.equal(actual.trips[0].days["2026-09-21"].outfitId, "city");
  assert.equal(actual.items[0].shape, "shirt");
});
test("day and activity looks and essentials deduplicate but preserve use dates", () => {
  const w = seed(),
    t = w.trips[0];
  t.days["2026-09-21"].outfitIds = ["city", "evening"];
  t.days["2026-09-21"].gear = ["camera"];
  const camera = packing(w, t).filter((i) => i.id === "camera");
  assert.equal(camera.length, 1);
  assert.deepEqual(camera[0].dates, ["2026-09-21", "2026-09-23"]);
  assert.equal(dayItems(w, t, "2026-09-21").outfits.length, 2);
});
test("multiple day looks survive validated round trip", () => {
  const w = seed();
  w.trips[0].days["2026-09-22"] = {
    ...blankDay(),
    outfitIds: ["city", "evening"],
    gear: ["camera"],
  };
  const d = workspaceSchema.parse(JSON.parse(JSON.stringify(w))).trips[0].days[
    "2026-09-22"
  ];
  assert.deepEqual(dayOutfits(d), ["city", "evening"]);
  assert.deepEqual(d.gear, ["camera"]);
});
test("removing outfits cleans both legacy and multiple daily assignments", () => {
  const w = seed();
  w.trips[0].days["2026-09-21"].outfitIds = ["city", "evening"];
  removeOutfit(w, "city");
  assert.deepEqual(dayOutfits(w.trips[0].days["2026-09-21"]), ["evening"]);
  assert(workspaceSchema.safeParse(w).success);
});
test("removing an item cleans day gear, activity gear, looks and packed state", () => {
  const w = seed();
  w.trips[0].days["2026-09-21"].gear = ["camera"];
  w.trips[0].packed = ["camera"];
  removeItem(w, "camera");
  removeItem(w, "linen");
  assert.deepEqual(w.trips[0].days["2026-09-21"].gear, []);
  assert.deepEqual(w.trips[0].packed, []);
  assert(w.outfits.every((o) => !o.items.includes("linen")));
  assert(workspaceSchema.safeParse(w).success);
});
test("unassigning an outfit removes unused automatic pieces", () => {
  const w = seed();
  removeOutfit(w, "evening");
  assert(!packing(w, w.trips[0]).some((i) => i.id === "dress"));
});
test("manual categories, quantities and status round trip", () => {
  const w = seed();
  w.trips[0].extras.push({
    id: "socks",
    name: "Wool socks",
    category: "Essentials",
    weight: 30,
    quantity: 3,
    packed: true,
  });
  const row = packing(workspaceSchema.parse(w), w.trips[0]).find(
    (i) => i.id === "socks",
  )!;
  assert.equal(row.weight * row.quantity, 90);
  assert.equal(row.packed, true);
});
for (const d of [
  "2026-02-30",
  "2025-02-29",
  "2026-13-01",
  "2026-00-01",
  "2026-04-31",
  "2026-1-01",
  "1899-12-31",
  "2201-01-01",
  "not-a-date",
])
  test(`reject date ${d}`, () => assert.equal(validDate(d), false));
for (const d of ["2024-02-29", "2000-02-29", "1900-01-01", "2200-12-31"])
  test(`accept date ${d}`, () => assert(validDate(d)));
test("date range is inclusive across a year boundary", () =>
  assert.deepEqual(tripDates({ start: "2026-12-31", end: "2027-01-02" }), [
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
  ]));
test("trip length limits do not allow reversed or excessive ranges", () => {
  assert.throws(() => tripDates({ start: "2026-01-02", end: "2026-01-01" }));
  assert.throws(() => tripDates({ start: "2026-01-01", end: "2027-01-02" }));
  assert.equal(
    tripDates({ start: "2026-01-01", end: "2027-01-01" }).length,
    366,
  );
});
test("calendar is Monday-first with contiguous dates including month boundaries", () => {
  const grid = monthDays("2026-09");
  assert.equal(grid[0], "2026-08-31");
  assert.equal(grid.length, 42);
  assert.equal(grid[41], "2026-10-11");
  assert.equal(new Set(grid).size, 42);
});
test("calendar navigation crosses years", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});
test("calendar supports the minimum and maximum accepted years", () => {
  assert.equal(monthDays("1900-01").length, 42);
  assert.equal(monthDays("2200-12").length, 42);
});
for (const field of ["stay", "notes", "title", "outfitId", "outfitIds", "gear"])
  test(`shortening dates never silently erases day ${field}`, () => {
    const t = seed().trips[0];
    t.activities = [];
    t.days = {
      "2026-09-21": {
        ...blankDay(),
        [field]:
          field === "outfitIds"
            ? ["city"]
            : field === "gear"
              ? ["camera"]
              : "Keep this",
      },
    };
    const before = JSON.stringify(t);
    assert.throws(() => resizeTrip(t, "2026-09-22", t.end));
    assert.equal(JSON.stringify(t), before);
  });
test("shortening dates never silently erases activities", () => {
  const t = seed().trips[0];
  assert.throws(() => resizeTrip(t, "2026-09-22", t.end));
});
test("empty day records may be pruned with date changes", () => {
  const t = seed().trips[0];
  t.days["2026-09-27"] = blankDay();
  const n = resizeTrip(t, t.start, "2026-09-26");
  assert(!n.days["2026-09-27"]);
});
test("shifting dates moves all event and day metadata together", () => {
  const t = seed().trips[0],
    n = resizeTrip(t, "2026-10-01", "2026-10-07", true);
  assert.equal(n.activities[0].date, "2026-10-01");
  assert.equal(n.activities[2].date, "2026-10-03");
  assert.equal(n.days["2026-10-01"].notes, t.days["2026-09-21"].notes);
  assert.equal(t.start, "2026-09-21");
});
test("duplicate creates independent IDs and resets completed/packed flags", () => {
  const t = seed().trips[0];
  t.packed = ["linen"];
  t.extras[0].packed = true;
  t.activities[0].completed = true;
  const n = duplicateTrip(t);
  assert.notEqual(n.id, t.id);
  assert.notEqual(n.activities[0].id, t.activities[0].id);
  assert.notEqual(n.extras[0].id, t.extras[0].id);
  assert.equal(n.days["2026-09-21"].outfitId, "city");
  assert.equal(n.activities[0].completed, false);
  assert.deepEqual(n.packed, []);
  assert.equal(n.extras[0].packed, false);
});
for (const [label, mutate] of Object.entries({
  "impossible dates": (w: Workspace) => {
    w.trips[0].start = "2026-02-30";
  },
  "out-of-trip events": (w: Workspace) => {
    w.trips[0].activities[0].date = "2026-10-01";
  },
  "missing outfit pieces": (w: Workspace) => {
    w.outfits[0].items.push("missing");
  },
  "missing daily gear": (w: Workspace) => {
    w.trips[0].days["2026-09-21"].gear = ["missing"];
  },
  "missing day looks": (w: Workspace) => {
    w.trips[0].days["2026-09-21"].outfitIds = ["missing"];
  },
  "negative weights": (w: Workspace) => {
    w.items[0].weight = -1;
  },
  "infinite costs": (w: Workspace) => {
    w.trips[0].activities[0].cost = Infinity;
  },
  "duplicate trips": (w: Workspace) => {
    w.trips.push(structuredClone(w.trips[0]));
  },
  "duplicate items": (w: Workspace) => {
    w.items.push(structuredClone(w.items[0]));
  },
  "fractional quantity": (w: Workspace) => {
    w.trips[0].extras[0].quantity = 1.5;
  },
  "external photo sources": (w: Workspace) => {
    w.items[0].image = "https://example.com/photo.png";
  },
  "empty names": (w: Workspace) => {
    w.items[0].name = "  ";
  },
  "bad colours": (w: Workspace) => {
    w.items[0].color = "red";
  },
  "bad time ranges": (w: Workspace) => {
    w.trips[0].activities[0].endTime = "09:00";
  },
  "javascript references": (w: Workspace) => {
    w.trips[0].activities[0].link = "javascript:alert(1)";
  },
}))
  test(`validation rejects ${label}`, () => {
    const w = seed();
    mutate(w);
    assert.equal(workspaceSchema.safeParse(w).success, false);
  });
for (const link of [
  "javascript:alert(1)",
  "data:text/html,hi",
  "https://user:pass@example.com",
  "https://",
  "file:///tmp/read",
  "//example.com",
])
  test(`unsafe reference is rejected: ${link}`, () =>
    assert.equal(safeLink(link), false));
test("safe references support encoded place parameters", () =>
  assert(safeLink("https://example.com/?a=Test%20walk")));
test("all-day activities are valid but an end-time needs a start-time", () => {
  const a = { ...seed().trips[0].activities[0], time: "" };
  assert(activitySchema.safeParse(a).success);
  assert(!activitySchema.safeParse({ ...a, endTime: "11:00" }).success);
});
test("overlap warnings apply only to intersecting intervals on the same day", () => {
  const a = seed().trips[0].activities[0],
    events = [
      { ...a, endTime: "12:00" },
      { ...a, id: "b", time: "11:30", endTime: "13:00" },
      { ...a, id: "c", time: "12:00", endTime: "13:00" },
      { ...a, id: "d", date: "2026-09-22", time: "11:00", endTime: "11:30" },
    ];
  assert.deepEqual([...overlaps(events)].sort(), ["b", "c", "walk"]);
  assert.equal(overlaps([events[0], events[2]]).size, 0);
});
test("calendar exports local wall times and escapes text", () => {
  const t = seed().trips[0];
  t.activities[0].title = "Coffee, then; wander";
  const ics = calendarICS(t);
  assert(ics.includes("DTSTART:20260921T100000"));
  assert(ics.includes("SUMMARY:Coffee\\, then\\; wander"));
  assert(ics.endsWith("END:VCALENDAR\r\n"));
});
test("calendar exports all-day dates with exclusive end and actual event end times", () => {
  const t = seed().trips[0];
  t.activities[0].time = "";
  t.activities[1].endTime = "20:00";
  const ics = calendarICS(t);
  assert(ics.includes("DTSTART;VALUE=DATE:20260921"));
  assert(ics.includes("DTEND;VALUE=DATE:20260922"));
  assert(ics.includes("DTEND:20260921T200000"));
});
test("calendar permits exclusive end after final supported trip year", () => {
  const t = seed().trips[0];
  t.activities = [{ ...t.activities[0], date: "2200-12-31", time: "" }];
  assert(calendarICS(t).includes("DTEND;VALUE=DATE:22010101"));
});
test("calendar escapes carriage returns instead of injecting properties", () => {
  const t = seed().trips[0];
  t.activities[0].title = "Walk\rATTENDEE:someone";
  assert(!calendarICS(t).includes("\rATTENDEE:"));
});
test("UTF-8 folding respects 75 octets including continuation spaces", () => {
  const text = "SUMMARY:" + "🌿 Café in the hills ".repeat(20),
    folded = foldICS(text);
  assert.equal(folded.replaceAll("\r\n ", ""), text);
  for (const line of folded.split("\r\n"))
    assert(new TextEncoder().encode(line).length <= 75);
});
test("CSV quotes punctuation and preserves per-piece weights", () => {
  const w = seed();
  w.trips[0].extras.push({
    id: "test",
    name: 'Socks, "wool"',
    quantity: 3,
    weight: 30,
    packed: true,
  });
  assert(
    packingCSV(w, w.trips[0]).includes('"Socks, ""wool""","3","30","Yes"'),
  );
});
for (const value of [
  "=CMD()",
  "+SUM(1)",
  "-10+1",
  "@lookup",
  "  =HYPERLINK(1)",
  "\t=1",
])
  test(`CSV neutralises formula ${value}`, () => {
    const w = seed();
    w.trips[0].extras[0].name = value;
    assert(packingCSV(w, w.trips[0]).includes("\"'" + value));
  });
test("filenames cannot introduce paths", () => {
  assert.equal(filename("../../Weekend / Away!"), "weekend-away");
  assert.equal(filename("🌿"), "trips-loom-trip");
});
function portable() {
  const w = seed(),
    t = w.trips[0];
  return {
    schemaVersion: 2,
    wardrobe: w.items.map((i) => ({
      ...i,
      category: i.category.toLowerCase(),
      art: i.shape,
    })),
    outfits: w.outfits.map((o) => ({ ...o, itemIds: o.items })),
    trips: [
      {
        ...t,
        travelers: t.travellers,
        luggageLimit: t.weightLimit,
        days: tripDates(t).map((date) => ({
          date,
          ...blankDay(),
          ...t.days[date],
          outfitIds: dayOutfits(t.days[date]),
          itemIds: date === t.start ? ["camera"] : [],
          events: t.activities
            .filter((a) => a.date === date)
            .map((a) => ({
              ...a,
              type: a.category === "Food & drink" ? "food" : "explore",
              itemIds: a.gear,
              url: a.link,
            })),
        })),
        packing: t.extras,
        packedItems: { linen: true },
      },
    ],
  };
}
test("portable React backup migrates every day, outfit, gear and packing flag", () => {
  const raw = portable(),
    parsed = parseBackup(JSON.stringify(raw)).workspace,
    t = parsed.trips[0];
  assert.equal(t.activities.length, 3);
  assert.equal(t.travellers, 2);
  assert.equal(t.budget, 1500);
  assert.equal(t.weightLimit, 8);
  assert.equal(t.days["2026-09-21"].gear?.[0], "camera");
  assert.deepEqual(dayOutfits(t.days["2026-09-21"]), ["city"]);
  assert.deepEqual(t.packed, ["linen"]);
});
test("legacy portable v1 backup supplies absent budget", () => {
  const raw = portable(),
    legacy = {
      ...raw,
      schemaVersion: 1,
      trips: raw.trips.map((t) =>
        Object.fromEntries(
          Object.entries(t).filter(([key]) => key !== "budget"),
        ),
      ),
    };
  assert.equal(
    parseBackup(JSON.stringify(legacy)).workspace.trips[0].budget,
    0,
  );
});
test("duplicate portable day dates cannot silently erase plans", () => {
  const raw = portable();
  raw.trips[0].days.push(raw.trips[0].days[0]);
  assert.throws(() => parseBackup(JSON.stringify(raw)), /Duplicate day/);
});
test("portable data URLs are extracted instead of sent to the workspace API", () => {
  const raw = portable();
  raw.wardrobe[0].image = "data:image/png;base64,aGVsbG8=";
  const p = parseBackup(JSON.stringify(raw));
  assert.equal(p.photos.length, 1);
  assert.equal(p.workspace.items[0].image, "");
});
test("legacy hosted workspace backup is still supported", () =>
  assert.equal(parseBackup(JSON.stringify(seed())).workspace.items.length, 6));
test("new data-only backup round trips through validated envelope", async () => {
  const w = seed(),
    text = await exportBackup(w, false),
    envelope = JSON.parse(text),
    p = parseBackup(text);
  assert.equal(envelope.format, "tripsloom-backup");
  assert.equal(p.workspace.trips[0].id, "test-journey");
  assert.equal(p.photos.length, 0);
});
test("Elsewhere backup envelopes remain importable after the rename", async () => {
  const text = await exportBackup(seed(), false),
    envelope = JSON.parse(text);
  envelope.format = "elsewhere-backup";
  assert.equal(
    parseBackup(JSON.stringify(envelope)).workspace.trips[0].id,
    "test-journey",
  );
});
for (const photos of [
  [{ itemId: "missing", data: "data:image/png;base64,aGVsbG8=" }],
  [{ itemId: "linen", data: "data:image/svg+xml;base64,aGVsbG8=" }],
  [
    { itemId: "linen", data: "data:image/png;base64,aGVsbG8=" },
    { itemId: "linen", data: "data:image/png;base64,aGVsbG8=" },
  ],
])
  test(`reject invalid backup photos ${JSON.stringify(photos)}`, () =>
    assert.throws(() =>
      parseBackup(
        JSON.stringify({
          format: "tripsloom-backup",
          backupVersion: 2,
          workspace: seed(),
          photos,
        }),
      ),
    ));
test("invalid backup cannot mutate current workspace", () => {
  const w = seed(),
    snapshot = JSON.stringify(w);
  assert.throws(() => parseBackup("{nope"));
  assert.equal(JSON.stringify(w), snapshot);
});
test("future backup versions are rejected", () =>
  assert.throws(() =>
    parseBackup(
      JSON.stringify({
        format: "tripsloom-backup",
        backupVersion: 99,
        workspace: seed(),
        photos: [],
      }),
    ),
  ));
test("restore upload failure leaves original workspace untouched", async () => {
  const workspace = seed(),
    pending = {
      workspace,
      photos: [{ itemId: "linen", data: "data:image/png;base64,aGVsbG8=" }],
    },
    original = JSON.stringify(workspace),
    prev = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Test unavailable" }), {
      status: 503,
    });
  try {
    await assert.rejects(() => prepareRestore(pending), /Test unavailable/);
    assert.equal(JSON.stringify(workspace), original);
  } finally {
    globalThis.fetch = prev;
  }
});
test("restore uploads photo bytes to the existing private endpoint then rewrites references", async () => {
  const workspace = seed(),
    old = globalThis.fetch;
  let called = false;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/images");
    assert.equal(init?.method, "POST");
    assert(init?.body instanceof FormData);
    called = true;
    return new Response(
      JSON.stringify({
        url: "/api/images/00000000-0000-4000-8000-000000000001",
      }),
    );
  };
  try {
    const next = await prepareRestore({
      workspace,
      photos: [{ itemId: "linen", data: "data:image/png;base64,aGVsbG8=" }],
    });
    assert(called);
    assert.equal(
      next.items[0].image,
      "/api/images/00000000-0000-4000-8000-000000000001",
    );
    assert.equal(workspace.items[0].image, "");
  } finally {
    globalThis.fetch = old;
  }
});
