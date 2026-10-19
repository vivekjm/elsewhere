/** Planning together: everyone's input into one draft. Run: node --import tsx --test mobile/src/domain/__tests__/*.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDraft, draftInput, groupStyle, ideaStatus, priorityOf, votersOf } from '../together';
import { buildPlan, sunTimes, toMin } from '../planmode';

const ME = 'me';
const member = (id: string, name: string, prefs = {}, rsvp: 'in' | 'maybe' | 'out' | null = 'in') => ({ id, name, role: 'member' as const, rsvp, ready: {}, prefs });
const idea = (id: string, title: string, votes: string[], extra = {}) => ({ id, title, place: '', note: '', addedBy: votes[0] ?? ME, votes, planned: '', createdAt: `2026-10-0${id.length}`, ...extra });

test('who plans: members who are coming; else you and the people on the trip', () => {
  const members = [member(ME, 'Vivek'), member('u-a', 'Asha'), member('u-k', 'Kabir', {}, 'out')];
  assert.deepEqual(votersOf({ members, people: [] }, ME).map((v) => v.name), ['You', 'Asha']);
  assert.deepEqual(votersOf({ members: [], people: [{ id: 'p-1', name: 'Rohan' }] }, ME).map((v) => v.name), ['You', 'Rohan']);
});

test('votes decide: most of the group → must; someone → maybe; nobody → left out; alone, wanting it is enough', () => {
  assert.equal(priorityOf({ votes: ['a', 'b', 'c'] }, 4), 'must');
  assert.equal(priorityOf({ votes: ['a', 'b'] }, 4), 'maybe');
  assert.equal(priorityOf({ votes: ['a', 'b'] }, 2), 'must');
  assert.equal(priorityOf({ votes: [] }, 4), 'skip');
  assert.equal(priorityOf({ votes: [ME] }, 1), 'must');
  assert.equal(priorityOf({ votes: [], pinned: '2026-11-14' }, 4), 'must');
});

test('pace and food come from everyone’s preferences, unless set for the group', () => {
  const v = [
    { id: ME, name: 'You', prefs: { pace: 'relaxed' as const, food: 'veg' as const } },
    { id: 'a', name: 'Asha', prefs: { pace: 'relaxed' as const } },
    { id: 'k', name: 'Kabir', prefs: { pace: 'packed' as const, food: 'jain' as const, budget: 'backpacker' as const } },
  ];
  const s = groupStyle(v, null);
  assert.equal(s.pace, 'relaxed');
  assert.match(s.why.pace, /You and Asha like to take it easy/);
  assert.equal(s.food, 'jain');
  assert.match(s.why.food, /Kabir eats Jain, you veg/);
  assert.equal(groupStyle([{ id: ME, name: 'You', prefs: { pace: 'relaxed' } }], null).why.pace, 'You like to take it easy.');
  assert.equal(groupStyle([{ id: 'k', name: 'Kabir', prefs: { food: 'jain' } }, { id: 'a', name: 'Asha', prefs: { food: 'veg' } }, { id: ME, name: 'You', prefs: { food: 'veg' } }], null).why.food, 'Kabir eats Jain, Asha and you veg: meal breaks say so.');
  assert.equal(groupStyle([{ id: 'a', name: 'Asha', prefs: { pace: 'relaxed' } }, { id: ME, name: 'You', prefs: { pace: 'relaxed' } }], null).why.pace, 'Asha and you like to take it easy.');
  assert.equal(s.budget, 'backpacker');
  const set = groupStyle(v, { pace: 'packed', food: '', arrive: 'morning', leave: 'evening', drafted: [], draftedAt: '', draftedBy: '' });
  assert.equal(set.pace, 'packed');
  assert.equal(set.why.pace, 'Set for the whole group.');
  assert.equal(groupStyle([{ id: ME, name: 'You', prefs: { pace: 'relaxed' } }, { id: 'a', name: 'Asha', prefs: { pace: 'packed' } }], null).pace, 'balanced');
});

test('ideas sorted by what the group wants', () => {
  const voters = votersOf({ members: [member(ME, 'V'), member('u-a', 'A'), member('u-r', 'R')], people: [] }, ME);
  const s = ideaStatus([idea('1', 'Nobody', []), idea('22', 'Some', ['u-a']), idea('333', 'Most', [ME, 'u-r'])], voters);
  assert.deepEqual(s.map((x) => [x.item.title, x.priority, `${x.votes}/${x.of}`]), [['Most', 'must', '2/3'], ['Some', 'maybe', '1/3'], ['Nobody', 'skip', '0/3']]);
});

test('a group draft: must-dos placed, pinned day kept, manual plans keep their room and stay; re-drafting replaces only the draft', () => {
  const trip = {
    start: '2026-11-13', end: '2026-11-16', destination: 'Goa', travellers: 3,
    activities: [
      { id: 'flight', date: '2026-11-13', title: 'Flight to Goa', category: 'Travel' as const },
      { id: 'old-draft', date: '2026-11-14', title: 'Fort Aguada', category: 'Explore' as const },
      { id: 'by-hand', date: '2026-11-16', title: 'Thalassa', category: 'Food & drink' as const },
    ],
  };
  const extras = {
    members: [member(ME, 'Vivek', { pace: 'relaxed' }), member('u-a', 'Asha', { pace: 'relaxed', food: 'veg' }), member('u-r', 'Rohan')],
    people: [],
    plan: { pace: '' as const, food: '' as const, arrive: 'afternoon' as const, leave: 'afternoon' as const, drafted: ['old-draft'], draftedAt: '', draftedBy: '' },
    shortlist: [
      idea('1', 'Chapora Fort', [ME, 'u-a'], { lat: 15.606, lng: 73.7353, kind: 'fort', place: 'Anjuna' }),
      idea('22', 'Baga Beach', [ME, 'u-a', 'u-r'], { lat: 15.5553, lng: 73.7517, kind: 'beach', place: 'Calangute' }),
      idea('333', 'Basilica of Bom Jesus', ['u-r'], { lat: 15.5009, lng: 73.9116, kind: 'church', place: 'Old Goa', pinned: '2026-11-15' }),
      idea('4444', 'Nobody wants this', [], { lat: 15.5, lng: 73.8 }),
      idea('55555', 'thalassa', [ME, 'u-a', 'u-r'], { lat: 15.5925, lng: 73.742, kind: 'restaurant' }),
    ],
  };
  const input = draftInput(trip, extras, ME);
  assert.equal(input.answers.pace, 'relaxed');
  assert.equal(input.answers.food, 'veg');
  assert.equal(input.answers.days, 4);
  assert.deepEqual(input.busy, [1, 0, 0, 1]); // the flight and Thalassa; the old draft doesn't count
  assert.equal(input.byHand.get('55555'), '2026-11-16', 'already in the itinerary by hand');
  assert.ok(!input.places.some((p) => p.id === '55555'), 'not drafted again');
  const plan = buildPlan(input.places, input.answers, { busy: input.busy, sun: (a, b, d) => sunTimes(a, b, d, 330) });
  const dayOf = (id: string) => plan.days.findIndex((d) => d.stops.some((s) => s.placeId === id));
  assert.ok(dayOf('1') >= 0 && dayOf('22') >= 0);
  assert.equal(dayOf('333'), 2);
  assert.equal(dayOf('4444'), -1);
  const meal = plan.days.flatMap((d) => d.stops).find((s) => s.kind === 'meal');
  assert.match(meal!.why, /veg/);
  const next = plan.days.flatMap((d) => d.stops.map((s) => ({ id: `n-${s.id}`, date: d.date, category: s.category, kind: s.kind })));
  const applied = applyDraft(trip.activities, extras.plan.drafted, next);
  assert.ok(applied.activities.some((a) => a.id === 'flight'));
  assert.ok(!applied.activities.some((a) => a.id === 'old-draft'));
  assert.ok(!applied.activities.some((a) => a.id.startsWith('n-arrive')), 'no "Arrive and check in" on a day with a flight');
  assert.ok(!plan.days[3].stops.some((s) => s.kind === 'leave'), 'no departure stop on a last day planned by hand');
  assert.ok(applied.activities.some((a) => a.id === 'by-hand'));
  assert.ok(applied.drafted.length > 0 && applied.drafted.every((id) => id.startsWith('n-')));
  for (const d of plan.days) { const t = d.stops.map((s) => toMin(s.time)); assert.deepEqual(t, [...t].sort((x, y) => x - y)); }
});
