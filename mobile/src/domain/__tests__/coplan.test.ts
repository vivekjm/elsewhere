/** Planning with AI: plain requests understood on the phone, edits checked and applied, suggestions from the plan. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEdits, cleanEdits, localEdits, placeNamed, suggestionsFor } from '../coplan';
import { buildPlan, sunTimes, type Answers, type PlanPlace } from '../planmode';

const place = (id: string, title: string, kind: PlanPlace['kind'], lat: number, lng: number, area: string, extra: Partial<PlanPlace> = {}): PlanPlace =>
  ({ id, title, kind, lat, lng, area, pick: 'must', evidence: [], ...extra });
const GOA = [
  place('chapora', 'Chapora Fort', 'fort', 15.606, 73.7353, 'Anjuna', { slot: 'sunset' }),
  place('baga', 'Baga Beach', 'beach', 15.5553, 73.7517, 'Calangute'),
  place('gun', 'Gunpowder', 'restaurant', 15.6037, 73.8099, 'Verla'),
  place('bom', 'Basilica of Bom Jesus', 'church', 15.5009, 73.9116, 'Old Goa', { pick: 'maybe' }),
];
const A: Answers = { destination: 'Goa', start: '2026-12-11', days: 4, party: 'friends', people: 4, pace: 'balanced', food: 'any', budget: 'comfortable', arrive: 'afternoon', leave: 'afternoon', maybes: 'fit' };

test('places by the words people use', () => {
  assert.equal(placeNamed('the fort', GOA)?.id, 'chapora');
  assert.equal(placeNamed('baga', GOA)?.id, 'baga');
  assert.equal(placeNamed('Gunpowder', GOA)?.id, 'gun');
  assert.equal(placeNamed('the beach', GOA)?.id, 'baga');
  assert.equal(placeNamed('the museum', GOA), null);
  assert.equal(placeNamed('go', GOA), null);
});

test('plain requests are handled on the phone; anything else goes to the AI whole', () => {
  assert.deepEqual(localEdits('More relaxed', GOA, A), [{ type: 'set', field: 'pace', value: 'relaxed' }]);
  assert.deepEqual(localEdits('make it 5 days', GOA, A), [{ type: 'set', field: 'days', value: '5' }]);
  assert.deepEqual(localEdits('Add a day', GOA, A), [{ type: 'set', field: 'days', value: '5' }]);
  assert.deepEqual(localEdits("we're vegetarian", GOA, A), [{ type: 'set', field: 'food', value: 'veg' }]);
  assert.deepEqual(localEdits('remove the fort', GOA, A), [{ type: 'remove_place', id: 'chapora' }]);
  assert.deepEqual(localEdits('move Baga to day 3', GOA, A), [{ type: 'move_place', id: 'baga', day: 3 }]);
  assert.deepEqual(localEdits('put gunpowder on the last day', GOA, A), [{ type: 'move_place', id: 'gun', day: 4 }]);
  assert.deepEqual(localEdits('make Bom Jesus a must', GOA, A), [{ type: 'set_pick', id: 'bom', pick: 'must' }]);
  assert.deepEqual(localEdits('Add a day and make it more relaxed', GOA, A), [{ type: 'set', field: 'days', value: '5' }, { type: 'set', field: 'pace', value: 'relaxed' }]);
  // Half understood is not understood: the AI gets the whole request.
  assert.equal(localEdits('remove the fort and add a beach shack', GOA, A), null);
  assert.equal(localEdits('Add a good sunset spot', GOA, A), null);
  assert.equal(localEdits('make day 2 lighter', GOA, A), null);
  assert.equal(localEdits('move baga to day 9', GOA, A), null);
  assert.equal(localEdits('no rush', GOA, A), null);
});

test('edits from the server are checked again: unknown places, bad values and days past the end are dropped', () => {
  const edits = cleanEdits([
      { type: 'set', field: 'pace', value: 'relaxed' },
      { type: 'set', field: 'pace', value: 'zoom' },
      { type: 'set', field: 'days', value: '3' },
      { type: 'move_place', id: 'baga', day: 4 },
      { type: 'remove_place', id: 'made-up' },
      { type: 'add_place', title: 'Fort Aguada', why: 'Sunset', day: 2, pick: 'must' },
      { type: 'add_place', title: 'https://spam.example', why: '', day: 0, pick: 'must' },
      { type: 'eat_cake', id: 'gun' },
  ], GOA, 4);
  assert.deepEqual(edits, [
    { type: 'set', field: 'pace', value: 'relaxed' },
    { type: 'set', field: 'days', value: '3' },
    { type: 'move_place', id: 'baga', day: 0 },
    { type: 'add_place', title: 'Fort Aguada', why: 'Sunset', day: 2, pick: 'must' },
  ]);
});

test('applying edits: new inputs for the engine and the changes in words', () => {
  const r = applyEdits(GOA, A, [
    { type: 'set', field: 'days', value: '3' },
    { type: 'move_place', id: 'baga', day: 3 },
    { type: 'remove_place', id: 'chapora' },
    { type: 'add_place', title: 'Fort Aguada', why: 'Sunset over the sea', day: 2, pick: 'must' },
    { type: 'add_place', title: 'Gunpowder', why: 'again', day: 0, pick: 'must' },
    { type: 'add_place', title: 'Mystery Café', why: '', day: 0, pick: 'maybe' },
  ], { 'Fort Aguada': { lat: 15.4925, lng: 73.7736, area: 'Candolim', kind: 'fort' } }, '2026-10-19');
  assert.equal(r.answers.days, 3);
  assert.equal(r.places.find((p) => p.id === 'baga')!.day, 2);
  assert.equal(r.places.find((p) => p.id === 'chapora')!.pick, 'skip');
  const aguada = r.places.find((p) => p.title === 'Fort Aguada')!;
  assert.deepEqual([aguada.day, aguada.kind, aguada.area, aguada.evidence[0].source], [1, 'fort', 'Candolim', 'ai']);
  assert.equal(r.places.filter((p) => p.title === 'Gunpowder').length, 1, 'not added twice');
  assert.equal(r.places.find((p) => p.title === 'Mystery Café')!.lat, undefined);
  assert.deepEqual(r.changes, ['3 days, until Sun 13 Dec', 'Moved Baga Beach to day 3', 'Left out Chapora Fort', 'Added Fort Aguada to day 2', 'Added Mystery Café as a maybe (not found on the map)']);
  // The originals aren't touched (undo keeps them).
  assert.equal(GOA.find((p) => p.id === 'chapora')!.pick, 'must');
  // Shortening the trip lets go of days that no longer exist.
  const short = applyEdits([{ ...GOA[0], day: 3 }], A, [{ type: 'set', field: 'days', value: '2' }]);
  assert.equal(short.places[0].day, undefined);
  // A start date in the past is ignored.
  assert.deepEqual(applyEdits(GOA, A, [{ type: 'set', field: 'start', value: '2026-01-01' }], {}, '2026-10-19').changes, []);
});

test('suggestions come from the plan', () => {
  const sun = (lat: number, lng: number, iso: string) => sunTimes(lat, lng, iso, 330);
  const thin = buildPlan([GOA[2]], { ...A, days: 4 }, { sun });
  const labels = suggestionsFor(thin, A).map((s) => s.label);
  assert.ok(labels.some((l) => /^Fill day [23]$/.test(l)), labels.join(', '));
  assert.ok(labels.includes('A sunset spot'));
  const veg = suggestionsFor(thin, { ...A, food: 'veg' }).find((s) => s.label === 'More food spots')!;
  assert.match(veg.message, /suit our food/);
});

test('a place to eat the AI adds is scheduled as a meal, even when the map can’t tell', () => {
  const sun = (lat: number, lng: number, iso: string) => sunTimes(lat, lng, iso, 330);
  const r = applyEdits(GOA, A, [{ type: 'add_place', title: 'Upre by 1559 AD', why: 'Romantic lake-view dinner', day: 2, pick: 'must', eat: true }]);
  const upre = r.places.find((p) => p.title === 'Upre by 1559 AD')!;
  assert.equal(upre.kind, 'restaurant');
  const day2 = buildPlan(r.places, r.answers, { sun }).days[1];
  const stop = day2.stops.find((s) => s.placeId === upre.id)!;
  assert.ok(stop.time >= '12:30', stop.time);
  // "Jag Mandir" is a palace, not a temple.
  assert.equal(applyEdits(GOA, A, [{ type: 'add_place', title: 'Jag Mandir', why: '', day: 0, pick: 'must' }]).places.at(-1)!.kind, 'heritage');
});
