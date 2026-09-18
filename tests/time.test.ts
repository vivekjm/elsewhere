import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatDate,
  formatTime,
  isDate,
  isTime,
  monthGrid,
  parseDate,
  parseTime,
  shiftMonth,
  shiftTime,
} from "../lib/time.ts";
import { emptyTrip } from "../lib/planning.ts";
import { TRIP_MOODS, tripSchema } from "../lib/model.ts";

test("custom date picker accepts the formats people actually type", () => {
  assert.equal(parseDate("2026-11-01"), "2026-11-01");
  assert.equal(parseDate("1 Nov 2026"), "2026-11-01");
  assert.equal(parseDate("Nov 1 2026"), "2026-11-01");
  assert.equal(parseDate("01/11/2026"), "2026-11-01");
  assert.equal(parseDate("1.11.2026"), "2026-11-01");
  assert.equal(parseDate("  26  Feb  2027 "), "2027-02-26");
  assert.equal(parseDate("2026/11/01"), "2026-11-01");
});

test("impossible and malformed dates are rejected instead of rolled over", () => {
  for (const value of [
    "2026-02-30",
    "2026-13-01",
    "31/04/2026",
    "not a date",
    "",
    "2026-11",
    "1 Foo 2026",
    "1 Nov 26",
  ])
    assert.equal(parseDate(value), null, value);
  assert.equal(parseDate("2028-02-29"), "2028-02-29");
  assert.equal(parseDate("2027-02-29"), null);
});

test("date picker formatting and helpers stay UTC-stable", () => {
  assert.equal(formatDate("2026-11-01"), "1 Nov 2026");
  assert.ok(isDate("2026-09-21"));
  assert.ok(!isDate("2026-9-21"));
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  const grid = monthGrid("2026-09");
  assert.equal(grid.length, 42);
  assert.equal(grid[0], "2026-08-31");
  assert.equal(grid[41], "2026-10-11");
  assert.ok(grid.includes("2026-09-30"));
});

test("custom time picker normalises 12 and 24 hour input", () => {
  assert.equal(parseTime("11:00"), "11:00");
  assert.equal(parseTime("9:05"), "09:05");
  assert.equal(parseTime("2:30 pm"), "14:30");
  assert.equal(parseTime("2.30pm"), "14:30");
  assert.equal(parseTime("12:00 am"), "00:00");
  assert.equal(parseTime("12:15 pm"), "12:15");
  assert.equal(parseTime("1430"), "14:30");
  assert.equal(parseTime("24:00"), null);
  assert.equal(parseTime("13:00 pm"), null);
  assert.equal(parseTime("noon"), null);
});

test("time formatting and nudging keep a 24 hour value", () => {
  assert.equal(formatTime("09:05"), "09:05");
  assert.equal(formatTime("09:05", true), "9:05am");
  assert.equal(formatTime("13:00", true), "1:00pm");
  assert.equal(formatTime("00:30", true), "12:30am");
  assert.ok(isTime("23:59"));
  assert.ok(!isTime("23:60"));
  assert.equal(shiftTime("23:50", 15), "00:05");
  assert.equal(shiftTime("00:05", -15), "23:50");
  assert.equal(shiftTime("", 30), "09:30");
});

test("trip covers accept every mood and fall back instead of rejecting a trip", () => {
  // Required text fields live outside this check; the cover is what is tested.
  const base = {
    ...emptyTrip(),
    name: "A week somewhere",
    destination: "Somewhere",
    travellers: 2,
  };
  for (const mood of TRIP_MOODS) {
    const parsed = tripSchema.safeParse({ ...base, theme: mood });
    assert.equal(parsed.success, true, mood);
    assert.equal(
      parsed.success && parsed.data.theme,
      mood,
      `${mood} should round-trip`,
    );
  }
  const unknown = tripSchema.safeParse({ ...base, theme: "volcano" });
  assert.equal(unknown.success, true);
  assert.equal(unknown.success && unknown.data.theme, "mountains");
  // Legacy covers from before the mood list grew stay valid.
  const legacy = tripSchema.safeParse({ ...base, theme: "coast" });
  assert.equal(legacy.success && legacy.data.theme, "coast");
});
