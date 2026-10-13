/**
 * Packing suggestions from the trip's forecast, length, kind and plans (in the spirit of PackPoint).
 * Pure: the caller passes the weather it has. Items already on the list are left out.
 */
import type { TripKind } from '../data/extras';
import type { EXTRA_CATEGORIES, Trip } from '../data/model';
import type { DayWeather } from '../services/weather';

type Category = (typeof EXTRA_CATEGORIES)[number];
export type Suggestion = { name: string; category: Category; quantity: number; reason: string };

export function suggestPacking(trip: Trip, kind: TripKind, weather: DayWeather[], existing: string[]): Suggestion[] {
  const out: Suggestion[] = [];
  // "Passport" already covers "Passport or ID"; "Sunglasses" covers "Sunglasses". Compare by key words.
  const words = (n: string) => n.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !['with', 'your', 'travel', 'details', 'kit', 'and'].includes(w));
  const have = existing.map(words);
  const covered = (name: string) => { const w = words(name); return have.some((h) => h.some((x) => w.includes(x))); };
  const add = (name: string, category: Category, reason: string, quantity = 1) => {
    const key = name.toLowerCase();
    if (covered(name) || out.some((s) => s.name.toLowerCase() === key)) return;
    out.push({ name, category, quantity, reason });
  };
  const days = Math.max(1, Math.round((Date.parse(trip.end) - Date.parse(trip.start)) / 86400000) + 1);
  const changes = Math.min(days + 1, 7);
  const titles = trip.activities.map((a) => `${a.title} ${a.notes}`.toLowerCase()).join(' ');
  const hot = weather.some((d) => d.high >= 25);
  const cold = weather.some((d) => d.low <= 8);
  const freezing = weather.some((d) => d.low <= 2);
  const wet = weather.some((d) => d.rain >= 40);

  // Every trip
  add('Passport or ID', 'Documents', 'Every trip');
  add('Travel insurance details', 'Documents', 'Every trip');
  add('Phone charger', 'Electronics', 'Every trip');
  add('Wallet and cards', 'Essentials', 'Every trip');
  add('Toothbrush and toothpaste', 'Toiletries', 'Every trip');
  add('Medication', 'Health & care', 'Every trip');
  add('Underwear', 'Essentials', `${days} ${days === 1 ? 'day' : 'days'}${days > 6 ? ', with a wash' : ''}`, changes);
  add('Socks', 'Essentials', `${days} ${days === 1 ? 'day' : 'days'}${days > 6 ? ', with a wash' : ''}`, changes);
  add('Sleepwear', 'Essentials', 'Every trip');
  add('Travel adapter', 'Electronics', 'Check the plug type in Essentials');
  if (days > 6) add('Laundry bag', 'Other', 'Longer than a week');
  if (days > 3) add('Power bank', 'Electronics', 'Long days out');

  // Weather
  if (wet) add('Compact umbrella', 'Essentials', 'Rain in the forecast');
  if (wet) add('Rain jacket', 'Essentials', 'Rain in the forecast');
  if (hot) add('Sunscreen', 'Toiletries', 'Highs of 25° or more');
  if (hot) add('Sunglasses', 'Essentials', 'Highs of 25° or more');
  if (hot) add('Sun hat', 'Essentials', 'Highs of 25° or more');
  if (hot) add('Refillable water bottle', 'Other', 'Hot days');
  if (cold) add('Warm jacket', 'Essentials', 'Lows under 8°');
  if (freezing) add('Gloves', 'Essentials', 'Near-freezing nights');
  if (freezing) add('Warm hat', 'Essentials', 'Near-freezing nights');
  if (freezing) add('Thermal base layer', 'Essentials', 'Near-freezing nights');

  // Kind of trip
  if (kind === 'beach' || kind === 'dive') {
    add('Swimsuit', 'Essentials', 'Beach days', 2);
    add('Beach towel', 'Other', 'Beach days');
    add('Sandals', 'Essentials', 'Beach days');
    add('After-sun', 'Toiletries', 'Beach days');
  }
  if (kind === 'dive') {
    add('Dive certification card', 'Documents', 'Diving');
    add('Logbook', 'Documents', 'Diving');
    add('Mask', 'Other', 'Diving');
    add('Reef-safe sunscreen', 'Toiletries', 'Diving');
  }
  if (kind === 'trek') {
    add('Hiking boots', 'Essentials', 'Trekking');
    add('Daypack', 'Other', 'Trekking');
    add('Head torch', 'Electronics', 'Trekking');
    add('First-aid kit', 'Health & care', 'Trekking');
    add('Blister plasters', 'Health & care', 'Trekking');
    add('Water purification', 'Health & care', 'Trekking');
  }
  if (kind === 'road') {
    add('Driving licence', 'Documents', 'Road trip');
    add('Car charger', 'Electronics', 'Road trip');
    add('Snacks', 'Other', 'Road trip');
  }
  if (kind === 'city') add('Comfortable walking shoes', 'Essentials', 'City days on foot');

  // Plans
  const flying = trip.activities.some((a) => a.category === 'Travel' && /\b(flight|fly|airport|[A-Z]{2}\s?\d{2,4})\b/i.test(`${a.title} ${a.notes}`));
  if (flying) {
    add('Liquids bag', 'Toiletries', 'You have a flight');
    add('Travel pillow', 'Other', 'You have a flight');
    add('Headphones', 'Electronics', 'You have a flight');
  }
  if (/\b(hike|hiking|walk|trail|trek)\b/.test(titles) && kind !== 'trek') add('Trainers or walking shoes', 'Essentials', 'A hike is planned');
  if (/\b(swim|beach|pool|snorkel|spa|onsen|sauna)\b/.test(titles) && kind !== 'beach' && kind !== 'dive') add('Swimsuit', 'Essentials', 'Swimming is planned');
  if (/\b(dinner|restaurant|theatre|theater|opera|concert|gala|wedding)\b/.test(titles)) add('Smart outfit', 'Essentials', 'A dinner or show is planned');
  if (/\b(ski|snow|glacier)\b/.test(titles)) add('Ski gloves', 'Essentials', 'Snow is planned');
  if (/\b(temple|mosque|church|cathedral|shrine)\b/.test(titles)) add('Scarf or cover-up', 'Essentials', 'Places of worship need covered shoulders');
  if (trip.activities.some((a) => a.category === 'Event')) add('Tickets', 'Documents', 'Events are planned');
  return out;
}
