/** The sentence someone types to start a plan: where, how long, who's going. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinationCandidates, parseDays, parseDestination, parseTravellers } from '../sentence';

test('where: the opening place, else the first place after in/to, never a month or a word from the next sentence', () => {
  assert.equal(parseDestination('Goa with friends in December. Sunset at the Dil Chahta Hai fort, then dinner at Gunpowder in Assagao'), 'Goa');
  assert.equal(parseDestination('3 days in Jaipur on my own from 12 December. Amber Fort, Hawa Mahal, Nahargarh Fort at sunset'), 'Jaipur');
  assert.equal(parseDestination('Bangkok with friends: Wat Pho, Chinatown street food and the Grand Palace'), 'Bangkok');
  assert.equal(parseDestination('Bali in March, just the two of us'), 'Bali');
  assert.equal(parseDestination('Plan a trip to Hampi next month'), 'Hampi');
  assert.equal(parseDestination('A long weekend in December. Then Coorg for coffee'), '');
  assert.equal(parseDestination('We want to visit Old Manali in May'), 'Old Manali');
  assert.equal(parseDestination('4 days in Goa with friends in December. Fontainhas, Chapora Fort'), 'Goa');
  assert.equal(parseDestination('somewhere warm'), '');
});

test('who is going', () => {
  assert.equal(parseTravellers('3 days in jaipur on my own from 12 december'), 1);
  assert.equal(parseTravellers('solo trip to goa'), 1);
  assert.equal(parseTravellers('just me, 4 days in hampi'), 1);
  assert.equal(parseTravellers('goa with 3 friends'), 4);
  assert.equal(parseTravellers('weekend in pondicherry with my wife'), 2);
  assert.equal(parseTravellers('bangkok in november'), null);
});

test('how long', () => {
  assert.equal(parseDays('3 days in jaipur on my own'), 3);
  assert.equal(parseDays('a long weekend in coorg'), 4);
  assert.equal(parseDays('two nights in pondy'), 3);
  assert.equal(parseDays('bangkok in november'), null);
});

test('without AI: a trip word is never the destination; lowercase places count; the most specific first', () => {
  assert.equal(parseDestination('Trek in nepal in goechala for 6 days'), '');
  assert.deepEqual(destinationCandidates('Trek in nepal in goechala for 6 days'), ['goechala', 'nepal']);
  assert.deepEqual(destinationCandidates('4 days in Goa with friends in December'), ['Goa']);
  assert.deepEqual(destinationCandidates('weekend in pondy'), ['pondy']);
  assert.deepEqual(destinationCandidates('goa'), ['goa']);
  assert.deepEqual(destinationCandidates('Weekend trip to Old Manali with friends'), ['Old Manali']);
  assert.deepEqual(destinationCandidates('somewhere warm'), ['warm']);
});
