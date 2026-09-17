import test from 'node:test';
import assert from 'node:assert/strict';
import { MOODS, seed, workspaceSchema, blankDay, removeItem } from '../lib/model.ts';
import { daySnapshot } from '../lib/planning.ts';

for (const mood of MOODS) {
  test(`Mood ${mood} round-trips through the shared workspace schema`, () => {
    const w = seed();
    w.trips[0].theme = mood;
    assert.equal(workspaceSchema.parse(JSON.parse(JSON.stringify(w))).trips[0].theme, mood);
  });
}
test('Legacy workspaces without a mood keep the mountain default', () => {
  const w = seed(); delete w.trips[0].theme;
  assert.equal(workspaceSchema.parse(w).trips[0].theme, 'mountains');
});
test('Unrecognized mood values cannot reach saved workspaces', () => {
  const w = seed(); Object.assign(w.trips[0], { theme: 'invalid' });
  assert.throws(() => workspaceSchema.parse(w));
});
test('Snapshot includes both day and activity looks without duplicating garments', () => {
  const w = seed(), trip = w.trips[0], date = trip.start;
  const snap = daySnapshot(w, trip, date);
  assert.equal(snap.activities.length, 2);
  assert.equal(snap.outfits.length, 2);
  assert.equal(snap.pieces.length, new Set(snap.pieces.map(i => i.id)).size);
  assert.equal(snap.gear[0].id, 'camera');
  assert.ok(snap.pieces.some(i => i.id === 'camera'));
  assert.ok(snap.hasContent);
});
test('Equipment-only dates get real visual snapshots', () => {
  const w = seed(), trip = w.trips[0];
  trip.days['2026-09-22'] = { ...blankDay(), gear: ['camera'] };
  const snap = daySnapshot(w, trip, '2026-09-22');
  assert.equal(snap.activities.length, 0); assert.equal(snap.outfits.length, 0);
  assert.deepEqual(snap.pieces.map(i => i.id), ['camera']); assert.ok(snap.hasContent);
});
test('Stay, note and title-only dates are not displayed as empty', () => {
  for (const details of [{stay:'Small guesthouse'},{notes:'Bring cash'},{title:'A quiet day'}]) {
    const w = seed(), trip = w.trips[0];
    trip.days['2026-09-22'] = {...blankDay(), ...details};
    assert.ok(daySnapshot(w, trip, '2026-09-22').hasContent);
  }
});
test('Empty dates have no phantom counts or snapshot pieces', () => {
  const w = seed(), snap = daySnapshot(w, w.trips[0], '2026-09-22');
  assert.equal(snap.hasContent, false);
  for (const items of [snap.activities, snap.outfits, snap.gear, snap.pieces]) assert.equal(items.length, 0);
});
test('Removing a wardrobe piece removes it from calendar snapshots too', () => {
  const w = seed(); const updated = removeItem(w, 'camera');
  assert.ok(!daySnapshot(updated, updated.trips[0], updated.trips[0].start).pieces.some(i => i.id === 'camera'));
});
test('Snapshot plans retain chronological order without changing source data', () => {
  const w = seed(), trip = w.trips[0]; trip.activities.reverse();
  const before = JSON.stringify(trip);
  const times = daySnapshot(w, trip, trip.start).activities.map(a => a.time);
  assert.deepEqual(times, [...times].sort()); assert.equal(JSON.stringify(trip), before);
});
