/** What AI understood from a sentence, checked on the phone; a trek's route turned into stages and compared. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { altitudeWarnings, briefOf, highPoint, monthsInWords, routeChanges, seasonStart, stageFacts, stageTitle, trekSuggestions, type Trek } from '../brief';

const stage = (from: string, to: string, end: number, km = 7, h = 4, start = 0) => ({ day: 0, from, to, distance_km: km, hours: h, start_altitude: start, end_altitude: end, note: '' });
const SIX: Trek = { summit: 'Dzongri Top', summit_altitude: 4200, typical_days: 9, permits: ['Khangchendzonga National Park permit'], stages: [
  stage('Yuksom', 'Sachen', 2200, 8, 5, 1780), stage('Sachen', 'Tshoka', 2950), stage('Tshoka', 'Dzongri', 4020), stage('Dzongri', 'Dzongri', 4020, 0, 0),
  stage('Dzongri', 'Tshoka', 2950), stage('Tshoka', 'Yuksom', 1780, 15, 7),
] };

test('the server’s answer is checked again; a trek without stages is not a trek; nonsense is not understood', () => {
  const b = briefOf({ understood: true, destination: 'Yuksom', region: 'Sikkim, India', country_code: 'in', title: 'Goechala trek', kind: 'trek', days: 6, people: 99, party: 'gang', month: 13, start: 'soon', food: 'veg', budget: 'x',
    places: [], note: 'Goechala is in Sikkim, India, not Nepal.', question: '', trek: { summit: 'Dzongri Top', summit_altitude: 4200, typical_days: 9, permits: ['Park permit', 7], stages: [{ from: 'Yuksom', to: 'Sachen', distance_km: 8, hours: 5, start_altitude: 1780, end_altitude: 2200 }, { from: '', to: 'x' }] } })!;
  assert.deepEqual([b.understood, b.kind, b.country_code, b.people, b.party, b.month, b.start, b.food, b.budget], [true, 'trek', 'IN', 20, '', 12, '', 'veg', '']);
  assert.equal(b.trek!.stages.length, 1);
  assert.deepEqual(b.trek!.permits, ['Park permit']);
  assert.equal(briefOf({ understood: true, destination: 'Manali', kind: 'trek', trek: { stages: [] } })!.kind, 'city');
  assert.equal(briefOf({ understood: true, destination: '', kind: 'city' })!.understood, false);
  assert.equal(briefOf('nope'), null);
});

test('stages in words', () => {
  assert.equal(stageTitle(SIX.stages[0]), 'Yuksom → Sachen');
  assert.equal(stageTitle(SIX.stages[3]), 'Rest day at Dzongri');
  assert.equal(stageFacts(SIX.stages[0]), '8 km · 5 h · 1,780 → 2,200 m');
  assert.equal(stageFacts(SIX.stages[3]), '4,020 m');
  assert.equal(stageFacts(SIX.stages[0], 'imperial'), '5 mi · 5 h · 5,840 → 7,218 ft');
  assert.equal(highPoint(SIX), 4200);
});

test('what changed when the route was re-planned', () => {
  const nine: Trek = { ...SIX, summit: 'Goecha La viewpoint', summit_altitude: 4940, stages: [...SIX.stages.slice(0, 4), stage('Dzongri', 'Thansing', 3930), stage('Thansing', 'Lamuney', 4150), stage('Lamuney', 'Thansing', 3930), stage('Thansing', 'Tshoka', 2950), stage('Tshoka', 'Yuksom', 1780)] };
  assert.deepEqual(routeChanges(SIX, nine), ['9 days (was 6)', 'Reaches Goecha La viewpoint (4,940 m)', 'Now via Thansing, Lamuney']);
  assert.deepEqual(routeChanges(SIX, SIX), []);
  const noRest: Trek = { ...SIX, stages: SIX.stages.filter((x) => x.from !== x.to) };
  assert.ok(routeChanges(SIX, noRest).includes('0 rest days (was 1)'));
});

test('what to offer next on a trek', () => {
  const labels = trekSuggestions(SIX).map((x) => x.label);
  assert.ok(labels.includes('The full 9-day route'));
  assert.ok(!labels.includes('Add a rest day'), 'it already has one');
  assert.ok(trekSuggestions({ ...SIX, stages: SIX.stages.filter((x) => x.from !== x.to) }).some((x) => x.label === 'Add a rest day'));
});

test('fast climbs at altitude are flagged from the route itself', () => {
  const route: Trek = { ...SIX, stages: [stage('Yuksom', 'Sachen', 2200, 8, 5, 1780), stage('Sachen', 'Tshoka', 2950, 7, 4, 2200), stage('Tshoka', 'Dzongri', 4020, 9, 6, 2950), stage('Dzongri', 'Tshoka', 2950, 9, 5, 4020)] };
  const w = altitudeWarnings(route);
  assert.equal(w.length, 1);
  assert.match(w[0], /^Day 3 climbs 1,070 m to sleep at 4,020 m/);
  assert.deepEqual(altitudeWarnings({ ...SIX, stages: [stage('Manali', 'Chika', 3100, 4, 3, 2050)] }), [], 'below 3,000 m before the climb: fine');
});

test('treks start in season', () => {
  assert.equal(monthsInWords([4, 5, 9, 10, 11]), 'April to May and September to November');
  assert.equal(monthsInWords([12]), 'December');
  // From 19 Oct, three weeks out is 9 Nov: November is in season → the first Saturday from then.
  assert.deepEqual(seasonStart([4, 5, 10, 11], '2026-10-19'), { date: '2026-11-14', why: 'It’s best done in April to May and October to November.' });
  // December isn't: the next good month is April.
  assert.equal(seasonStart([4, 5, 10, 11], '2026-11-20')!.date, '2027-04-03');
  // They named May, a good month: May it is.
  assert.equal(seasonStart([4, 5, 10, 11], '2026-10-19', 5)!.date, '2027-05-01');
  assert.equal(seasonStart([], '2026-10-19'), null);
});
