/** Plan mode's engine. Run from the repo root: node --import tsx --test mobile/src/domain/__tests__/*.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, capacity, isTheCity, kindOf, suggestDays, sunTimes, toMin, travelMinutes, type Answers, type PlanPlace } from '../planmode';

const IST = 330;
const place = (id: string, title: string, lat: number, lng: number, area: string, pick: PlanPlace['pick'] = 'must', osm = ''): PlanPlace =>
  ({ id, title, lat, lng, area, kind: kindOf(title, osm), pick, evidence: [] });

const GOA = [
  place('chapora', 'Chapora Fort', 15.6060, 73.7353, 'Anjuna', 'must', 'historic=castle'),
  place('vagator', 'Vagator Beach', 15.5995, 73.7390, 'Anjuna'),
  place('anjuna', 'Anjuna Flea Market', 15.5739, 73.7406, 'Anjuna'),
  place('bom', 'Basilica of Bom Jesus', 15.5009, 73.9116, 'Old Goa'),
  place('se', 'Se Cathedral', 15.5040, 73.9123, 'Old Goa'),
  place('aguada', 'Fort Aguada', 15.4925, 73.7736, 'Candolim'),
  place('baga', 'Baga Beach', 15.5553, 73.7517, 'Baga'),
  place('thalassa', 'Thalassa', 15.5925, 73.7420, 'Anjuna', 'maybe'),
  place('palolem', 'Palolem Beach', 15.0100, 74.0232, 'Canacona', 'maybe'),
];
const A: Answers = { destination: 'Goa', start: '2026-11-13', days: 4, party: 'friends', people: 4, pace: 'relaxed', food: 'veg', budget: 'comfortable', arrive: 'afternoon', leave: 'afternoon', maybes: 'fit' };
const sun = (lat: number, lng: number, iso: string) => sunTimes(lat, lng, iso, IST);

test('kinds from names and map tags', () => {
  assert.equal(kindOf('Chapora Fort'), 'fort');
  assert.equal(kindOf('Vagator Beach'), 'beach');
  assert.equal(kindOf('Basilica of Bom Jesus'), 'church');
  assert.equal(kindOf('Wat Arun'), 'temple');
  assert.equal(kindOf('Jodd Fairs Night Market'), 'nightmarket');
  assert.equal(kindOf('Anjuna Flea Market'), 'market');
  assert.equal(kindOf('Tichuca', 'amenity=bar'), 'bar');
  assert.equal(kindOf('Dudhsagar Falls'), 'waterfall');
});

test('sunset and sunrise in Goa in mid-November (about 18:00 and 06:35 IST)', () => {
  const s = sunTimes(15.6, 73.74, '2026-11-13', IST)!;
  assert.ok(Math.abs(s.sunset - (18 * 60 + 2)) <= 10, `sunset ${s.sunset}`);
  assert.ok(Math.abs(s.sunrise - (6 * 60 + 35)) <= 10, `sunrise ${s.sunrise}`);
});

test('travel time grows with distance', () => {
  assert.equal(travelMinutes(GOA[0], GOA[1]), 10);
  assert.ok((travelMinutes(GOA[0], GOA[3]) ?? 0) >= 45);
});

test('trip length fits the places at the pace', () => {
  assert.equal(capacity(0, 4, { pace: 'relaxed', arrive: 'afternoon', leave: 'afternoon' }), 1);
  assert.equal(capacity(3, 4, { pace: 'relaxed', arrive: 'afternoon', leave: 'afternoon' }), 1);
  assert.equal(suggestDays(7, 'relaxed'), 4);
  assert.equal(suggestDays(7, 'packed'), 2);
  assert.equal(suggestDays(12, 'packed'), 3);
  assert.equal(suggestDays(2, 'relaxed'), 2);
});

test('a Goa plan: nearby places share a day, one sunset a day, sunset spots at sunset, lunch and arrival', () => {
  const plan = buildPlan(GOA, A, { sun });
  assert.equal(plan.days.length, 4);
  assert.equal(plan.days[0].date, '2026-11-13');
  assert.equal(plan.days[0].stops[0].kind, 'arrive');
  assert.equal(plan.days[3].stops.at(-1)!.kind, 'leave');
  const dayOf = (id: string) => plan.days.findIndex((d) => d.stops.some((s) => s.placeId === id));
  // Old Goa's two churches together.
  assert.equal(dayOf('bom'), dayOf('se'));
  // Every must-do is in.
  for (const id of ['chapora', 'vagator', 'anjuna', 'bom', 'se', 'aguada', 'baga']) assert.ok(dayOf(id) >= 0, `${id} placed`);
  // One sunset stop per day.
  for (const d of plan.days) assert.ok(d.stops.filter((s) => (s.kind === 'fort' || s.kind === 'viewpoint') && toMin(s.time) >= 16 * 60).length <= 1, d.title);
  // A fort at sunset starts 40–60 minutes before the sun goes down.
  const chapora = plan.days[dayOf('chapora')].stops.find((s) => s.placeId === 'chapora')!;
  const sunset = sun(15.606, 73.7353, plan.days[dayOf('chapora')].date)!.sunset;
  assert.ok(sunset - toMin(chapora.time) >= 40 && sunset - toMin(chapora.time) <= 65, `${chapora.time} vs ${sunset}`);
  // Churches in the morning.
  const bom = plan.days[dayOf('bom')].stops.find((s) => s.placeId === 'bom')!;
  assert.ok(toMin(bom.time) < 13 * 60, bom.time);
  // A full day has a lunch break, veg-aware.
  const full = plan.days.find((d) => d.stops.filter((s) => s.placeId).length >= 2 && d.stops.some((s) => s.kind === 'meal'))!;
  assert.ok(full, 'a day with a meal break');
  assert.match(full.stops.find((s) => s.kind === 'meal')!.why, /veg/i);
  // Times only go forward within a day.
  for (const d of plan.days) { const t = d.stops.map((s) => toMin(s.time)); assert.deepEqual(t, [...t].sort((x, y) => x - y), `${d.title}: ${t.join(',')}`); }
});

test('maybes wait for the group when asked', () => {
  const plan = buildPlan(GOA, { ...A, maybes: 'group' }, { sun });
  const placed = plan.days.flatMap((d) => d.stops.map((s) => s.placeId)).filter(Boolean);
  assert.ok(!placed.includes('thalassa') && !placed.includes('palolem'));
  assert.deepEqual(plan.unplaced.map((p) => p.id).sort(), ['palolem', 'thalassa']);
});

test('skipped places never appear, and places the map couldn’t find still get a day', () => {
  const plan = buildPlan([...GOA.slice(0, 3), { id: 'x', title: 'Secret cove', area: '', kind: 'beach', pick: 'must', evidence: [] }, { ...GOA[5], pick: 'skip' }], { ...A, days: 3 }, { sun });
  const placed = plan.days.flatMap((d) => d.stops.map((s) => s.placeId)).filter(Boolean);
  assert.ok(placed.includes('x'));
  assert.ok(!placed.includes('aguada'));
});

test('a place moved to a day stays there when the plan is rebuilt', () => {
  const moved = GOA.map((p) => (p.id === 'baga' ? { ...p, day: 1 } : p.id === 'bom' ? { ...p, day: 3 } : p));
  const plan = buildPlan(moved, A, { sun });
  const dayOf = (id: string) => plan.days.findIndex((d) => d.stops.some((s) => s.placeId === id));
  assert.equal(dayOf('baga'), 1);
  assert.equal(dayOf('bom'), 3);
});

test('a dinner place moved to the day you leave stays there, as lunch', () => {
  const places: PlanPlace[] = [
    { ...place('baga', 'Baga Beach', 15.5553, 73.7517, 'Calangute') },
    { ...place('gun', 'Gunpowder', 15.6080, 73.7836, 'Verla', 'must', 'amenity=restaurant'), day: 3 },
  ];
  const plan = buildPlan(places, { ...A, days: 4, leave: 'afternoon' }, { sun });
  const gun = plan.days[3].stops.find((s) => s.placeId === 'gun');
  assert.ok(gun, 'stays on day 4');
  assert.ok(toMin(gun!.time) >= 12 * 60 && toMin(gun!.time) <= 13 * 60 + 30, gun!.time);
  assert.equal(plan.days[3].stops.at(-1)!.kind, 'leave');
});

test('a sunset dinner goes after the sunset fort, not instead of it', () => {
  const places: PlanPlace[] = [
    place('chapora', 'Chapora Fort', 15.6060, 73.7353, 'Anjuna', 'must', 'historic=castle'),
    { ...place('thal', 'Thalassa', 15.6265, 73.7600, 'Badem', 'must', 'amenity=restaurant'), slot: 'sunset' },
    place('baga', 'Baga Beach', 15.5553, 73.7517, 'Calangute'),
  ];
  const plan = buildPlan(places, { ...A, days: 3, pace: 'balanced' }, { sun });
  const day = plan.days.find((d) => d.stops.some((s) => s.placeId === 'chapora'))!;
  const fort = day.stops.find((s) => s.placeId === 'chapora')!;
  const dinner = day.stops.find((s) => s.placeId === 'thal')!;
  assert.ok(dinner, 'same day');
  const sunset = sun(15.606, 73.7353, day.date)!.sunset;
  assert.ok(sunset - toMin(fort.time) >= 40, fort.time);
  assert.ok(toMin(dinner.time) > toMin(fort.time) && toMin(dinner.time) >= sunset - 20, dinner.time);
});

test('dinner: an evening street-food market is dinner; a late stop gets dinner before it; never after half past nine', () => {
  const ICT = 420;
  const bkkSun = (lat: number, lng: number, iso: string) => sunTimes(lat, lng, iso, ICT);
  const bkk = { ...A, destination: 'Bangkok', days: 3, pace: 'relaxed' as const, food: 'any' as const };
  const market: PlanPlace[] = [
    place('arun', 'Wat Arun', 13.7437, 100.4888, 'Bangkok Yai', 'must', 'amenity=place_of_worship'),
    { ...place('yaowarat', 'Yaowarat Road', 13.7398, 100.5101, 'Samphanthawong'), kind: 'market', slot: 'night' },
  ];
  const day = buildPlan(market, bkk, { sun: bkkSun }).days.find((d) => d.stops.some((s) => s.placeId === 'yaowarat'))!;
  const y = day.stops.find((s) => s.placeId === 'yaowarat')!;
  assert.equal(y.time, '19:00');
  assert.ok(!day.stops.some((s) => s.kind === 'meal' && s.title.startsWith('Dinner')), day.stops.map((s) => `${s.time} ${s.title}`).join(', '));
  const late: PlanPlace[] = [
    place('arun', 'Wat Arun', 13.7437, 100.4888, 'Bangkok Yai', 'must', 'amenity=place_of_worship'),
    { ...place('mahanakhon', 'Mahanakhon Skywalk', 13.7234, 100.5283, 'Bang Rak', 'must', 'tourism=viewpoint'), slot: 'night' },
  ];
  const d2 = buildPlan(late, bkk, { sun: bkkSun }).days.find((d) => d.stops.some((s) => s.placeId === 'mahanakhon'))!;
  const sky = d2.stops.find((s) => s.placeId === 'mahanakhon')!;
  const dinner = d2.stops.find((s) => s.title.startsWith('Dinner'));
  assert.ok(dinner && toMin(dinner.time) < toMin(sky.time), d2.stops.map((s) => `${s.time} ${s.title}`).join(', '));
  for (const d of [day, d2]) for (const s of d.stops) if (s.title.startsWith('Dinner')) assert.ok(toMin(s.time) <= 21 * 60 + 30, s.time);
});

test('the destination city is never a day title or a meal’s "near"', () => {
  assert.ok(isTheCity('Jaipur Municipal Corporation', 'Jaipur, Rajasthan, India'));
  assert.ok(isTheCity('Bangkok', 'Bangkok'));
  assert.ok(!isTheCity('Amber', 'Jaipur, Rajasthan, India'));
  const places: PlanPlace[] = [
    place('hawa', 'Hawa Mahal', 26.9239, 75.8267, 'Jaipur Municipal Corporation', 'must', 'historic=palace'),
    { ...place('nahar', 'Nahargarh Fort', 26.9373, 75.8155, 'Jaipur Municipal Corporation', 'must', 'historic=castle'), slot: 'sunset' },
  ];
  const plan = buildPlan(places, { ...A, destination: 'Jaipur, Rajasthan, India', days: 3, party: 'solo', people: 1 }, { sun });
  for (const d of plan.days) {
    assert.ok(!/Municipal/.test(d.title), d.title);
    for (const s of d.stops) assert.ok(!/Municipal/.test(s.title), s.title);
  }
});
