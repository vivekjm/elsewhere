import type { IllustrationName } from '../loom/graphics';
import type { Tint } from '../loom/tokens';
import type { TripKind } from '../data/extras';

/** Editorial trip ideas for Discover. Each one opens the planner with a ready prompt. */
export type Idea = { id: string; kind: TripKind; art: IllustrationName; tint: Tint; label: string; title: string; meta: string; destination: string; days: number; prompt: string };

export const IDEAS: Idea[] = [
  { id: 'amalfi', kind: 'beach', art: 'cove', tint: 'mint', label: 'Beach', title: 'Amalfi Coast in May', meta: '5 days · boats · quiet coves', destination: 'Amalfi, Italy', days: 5, prompt: '5 days on the Amalfi Coast in May, boat days, swimming coves, long lunches, no driving' },
  { id: 'iceland', kind: 'road', art: 'aurora', tint: 'lavender', label: 'Road trip', title: 'Iceland’s south coast', meta: '6 days · 700 km · hot springs', destination: 'Reykjavik, Iceland', days: 6, prompt: '6-day road trip along Iceland’s south coast, waterfalls, black beaches, hot springs, northern lights' },
  { id: 'kyoto', kind: 'city', art: 'torii', tint: 'peach', label: 'City', title: 'Kyoto in autumn', meta: '5 days · temples · kaiseki', destination: 'Kyoto, Japan', days: 5, prompt: '5 days in Kyoto in November for autumn leaves, temples at dawn, food markets and a tea ceremony' },
  { id: 'mont-blanc', kind: 'trek', art: 'peaks', tint: 'mint', label: 'Trek', title: 'Tour du Mont Blanc', meta: '7 days · refuges · 3 countries', destination: 'Chamonix, France', days: 7, prompt: '7-day hut-to-hut trek on the Tour du Mont Blanc from Chamonix, moderate pace, refuges each night' },
  { id: 'lisbon', kind: 'city', art: 'tram', tint: 'rose', label: 'City', title: 'Lisbon long weekend', meta: '4 days · tiles · pastéis', destination: 'Lisbon, Portugal', days: 4, prompt: 'A long weekend in Lisbon, food and tiles, miradouros at sunset, a day trip to Sintra' },
  { id: 'morocco', kind: 'road', art: 'dunes', tint: 'peach', label: 'Desert', title: 'Atlas to Sahara', meta: '6 days · kasbahs · dunes', destination: 'Marrakesh, Morocco', days: 6, prompt: '6 days from Marrakesh over the Atlas mountains to the Sahara, kasbahs, a night in a desert camp' },
  { id: 'dahab', kind: 'dive', art: 'tide', tint: 'lavender', label: 'Dive', title: 'Dahab reef week', meta: '6 days · shore dives · Blue Hole', destination: 'Dahab, Egypt', days: 6, prompt: 'A dive week in Dahab, shore dives, the Blue Hole and Lighthouse reef, slow evenings by the sea' },
  { id: 'kilimanjaro', kind: 'trek', art: 'summit', tint: 'mint', label: 'Summit', title: 'Kilimanjaro, Machame', meta: '7 days · 5,895 m', destination: 'Moshi, Tanzania', days: 7, prompt: 'Climb Kilimanjaro on the Machame route over 7 days with acclimatisation, porters and a summit night' },
  { id: 'lofoten', kind: 'road', art: 'lake', tint: 'lavender', label: 'Islands', title: 'Lofoten by car', meta: '5 days · fishing villages', destination: 'Svolvær, Norway', days: 5, prompt: '5 days driving the Lofoten islands, fishing villages, easy hikes, red cabins by the water' },
  { id: 'bali', kind: 'beach', art: 'island', tint: 'peach', label: 'Island', title: 'Bali, slowly', meta: '8 days · rice terraces · surf', destination: 'Ubud, Indonesia', days: 8, prompt: '8 slow days in Bali between Ubud and the coast, rice terraces, a surf lesson, temples and spas' },
  { id: 'black-forest', kind: 'trek', art: 'forest', tint: 'mint', label: 'Hiking', title: 'Black Forest trails', meta: '4 days · inn to inn', destination: 'Freiburg, Germany', days: 4, prompt: '4 days walking inn to inn in the Black Forest from Freiburg, moderate trails, cake stops' },
  { id: 'paris', kind: 'city', art: 'tram', tint: 'rose', label: 'City', title: 'Paris weekend', meta: '3 days · museums · bistros', destination: 'Paris, France', days: 3, prompt: 'A 3-day Paris weekend, one big museum a day, bistros, a walk along the Seine at night' },
];

export const IDEA_FILTERS: { label: string; kinds: TripKind[] | null; icon?: 'mountain' | 'trips' | 'sun' | 'map' | 'drop' }[] = [
  { label: 'For you', kinds: null },
  { label: 'Treks', kinds: ['trek'], icon: 'mountain' },
  { label: 'Cities', kinds: ['city'], icon: 'trips' },
  { label: 'Beaches', kinds: ['beach'], icon: 'sun' },
  { label: 'Road trips', kinds: ['road'], icon: 'map' },
  { label: 'Dives', kinds: ['dive'], icon: 'drop' },
];
