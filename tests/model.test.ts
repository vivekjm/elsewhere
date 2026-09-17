import { test } from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  packing,
  removeItem,
  removeOutfit,
  workspaceSchema,
  tripDates,
} from "../lib/model.ts";
import { calendarICS, packingCSV } from "../lib/exports.ts";
test("reused outfit pieces and activity gear count once", () => {
  const w = seed(),
    t = w.trips[0];
  const rows = packing(w, t);
  assert.equal(rows.filter((i) => i.id === "linen").length, 1);
  assert.equal(rows.filter((i) => i.id === "camera").length, 1);
  assert.equal(rows.length, 9);
  assert.equal(
    rows.reduce((n, i) => n + i.weight * i.quantity, 0),
    2760,
  );
});
test("unassigning outfits removes unused automatic packing", () => {
  const w = seed();
  removeOutfit(w, "evening");
  assert(!packing(w, w.trips[0]).some((i) => i.id === "dress"));
  assert(workspaceSchema.safeParse(w).success);
});
test("deleting a piece cleans all wardrobe and plan references", () => {
  const w = seed();
  removeItem(w, "camera");
  removeItem(w, "linen");
  assert(w.outfits.every((o) => !o.items.includes("linen")));
  assert(
    w.trips.every((t) => t.activities.every((a) => !a.gear.includes("camera"))),
  );
  assert(workspaceSchema.safeParse(w).success);
});
test("dates include both endpoints across year boundaries", () => {
  assert.deepEqual(tripDates({ start: "2026-12-31", end: "2027-01-02" }), [
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
  ]);
});
test("reject impossible dates, out-of-trip events, unsafe links and broken references", () => {
  for (const mutate of [
    (w: ReturnType<typeof seed>) => {
      w.trips[0].start = "2026-02-30";
    },
    (w: ReturnType<typeof seed>) => {
      w.trips[0].activities[0].date = "2026-10-01";
    },
    (w: ReturnType<typeof seed>) => {
      w.trips[0].activities[0].link = "javascript:alert(1)";
    },
    (w: ReturnType<typeof seed>) => {
      w.outfits[0].items.push("missing");
    },
  ]) {
    const w = seed();
    mutate(w);
    assert(!workspaceSchema.safeParse(w).success);
  }
});
test("calendar exports local wall times and escapes text", () => {
  const w = seed(),
    t = w.trips[0];
  t.activities[0].title = "Coffee, then; wander";
  const ics = calendarICS(t);
  assert(ics.includes("DTSTART:20260921T100000"));
  assert(ics.includes("SUMMARY:Coffee\\, then\\; wander"));
  assert(ics.includes("END:VCALENDAR"));
});
test("CSV quotes embedded punctuation and quantity weights stay per-piece", () => {
  const w = seed(),
    t = w.trips[0];
  t.extras.push({
    id: "test",
    name: 'Socks, "wool"',
    quantity: 3,
    weight: 30,
    packed: true,
  });
  assert(packingCSV(w, t).includes('"Socks, ""wool""","3","30","Yes"'));
});
