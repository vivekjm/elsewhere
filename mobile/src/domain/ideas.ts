import type { IllustrationName } from '../loom/graphics';
import type { Tint } from '../loom/tokens';
import type { TripKind } from '../data/extras';

/** Editorial trip ideas for Discover. Each one opens the planner with a ready prompt. */
export type Idea = { id: string; kind: TripKind; art: IllustrationName; tint: Tint; label: string; title: string; meta: string; destination: string; days: number; prompt: string };

/** Ideas for travellers from India: long weekends with friends and short-haul trips abroad. `meta` carries a rough
 * per-person cost band (stay, food and local travel; not getting there), so a group can see if it fits before planning. */
export const IDEAS_INDIA: Idea[] = [
  { id: 'goa-friends', kind: 'beach', art: 'cove', tint: 'mint', label: 'Long weekend', title: 'Goa with friends', meta: '4 days · ₹12–20k each · beaches and cafés', destination: 'Goa, India', days: 4, prompt: 'A long weekend in North Goa with 5 friends, beaches, cafés, one party night and a quiet beach day. About ₹15,000 each.' },
  { id: 'gokarna', kind: 'beach', art: 'island', tint: 'peach', label: 'Beach', title: 'Gokarna beach trek', meta: '3 days · ₹6–10k each · cliff-side beaches', destination: 'Gokarna, Karnataka', days: 3, prompt: '3 days in Gokarna with friends, the beach trek from Kudle to Paradise beach, sunsets and simple shacks. About ₹8,000 each.' },
  { id: 'rishikesh', kind: 'trek', art: 'forest', tint: 'mint', label: 'Adventure', title: 'Rishikesh rafting weekend', meta: '3 days · ₹8–14k each · rafting and cafés', destination: 'Rishikesh, Uttarakhand', days: 3, prompt: 'A weekend in Rishikesh with 4 friends, white water rafting, a camp by the Ganga, the evening aarti and cafés in Tapovan.' },
  { id: 'spiti', kind: 'road', art: 'road', tint: 'lavender', label: 'Road trip', title: 'Spiti Valley circuit', meta: '7 days · ₹25–40k each · high passes', destination: 'Kaza, Himachal Pradesh', days: 7, prompt: '7-day Spiti Valley road trip from Manali with friends, Chandratal, Key monastery, Langza and Kaza, slow for the altitude.' },
  { id: 'kasol', kind: 'trek', art: 'peaks', tint: 'mint', label: 'Trek', title: 'Kasol and Kheerganga', meta: '4 days · ₹8–15k each · hot springs', destination: 'Kasol, Himachal Pradesh', days: 4, prompt: '4 days in Kasol with friends, the Kheerganga trek with a night at the top, Tosh village and cafés by the Parvati river.' },
  { id: 'coorg', kind: 'road', art: 'forest', tint: 'mint', label: 'Weekend', title: 'Coorg coffee estates', meta: '3 days · ₹10–18k each · homestays', destination: 'Madikeri, Karnataka', days: 3, prompt: 'A weekend in Coorg in a coffee estate homestay with friends, Abbey falls, a plantation walk and Raja’s Seat at sunset.' },
  { id: 'hampi', kind: 'city', art: 'dunes', tint: 'peach', label: 'Heritage', title: 'Hampi ruins by cycle', meta: '3 days · ₹7–12k each · boulders and temples', destination: 'Hampi, Karnataka', days: 3, prompt: '3 days in Hampi with friends, cycling the ruins, sunrise on Matanga hill, a coracle ride and Hippie Island.' },
  { id: 'meghalaya', kind: 'trek', art: 'lake', tint: 'lavender', label: 'North-East', title: 'Meghalaya living roots', meta: '6 days · ₹22–35k each · root bridges', destination: 'Shillong, Meghalaya', days: 6, prompt: '6 days in Meghalaya with friends, the double-decker root bridge trek, Dawki river, Cherrapunji waterfalls and Shillong cafés.' },
  { id: 'udaipur', kind: 'city', art: 'lake', tint: 'rose', label: 'City', title: 'Udaipur lakes', meta: '3 days · ₹12–25k each · palaces', destination: 'Udaipur, Rajasthan', days: 3, prompt: '3 days in Udaipur, City Palace, a sunset boat on Lake Pichola, rooftop dinners and a day trip to Kumbhalgarh.' },
  { id: 'pondicherry', kind: 'beach', art: 'tram', tint: 'peach', label: 'Long weekend', title: 'Pondicherry and Auroville', meta: '3 days · ₹10–16k each · French quarter', destination: 'Puducherry, India', days: 3, prompt: 'A long weekend in Pondicherry with friends, the French quarter on cycles, Auroville, Paradise beach and seafood dinners.' },
  { id: 'vietnam', kind: 'city', art: 'torii', tint: 'rose', label: 'Abroad', title: 'Vietnam north to south', meta: '8 days · ₹45–70k each · street food', destination: 'Hanoi, Vietnam', days: 8, prompt: '8 days in Vietnam with friends from Hanoi to Ha Long Bay and Hoi An, street food, a night cruise and tailor shops. About ₹60,000 each.' },
  { id: 'thailand', kind: 'beach', art: 'island', tint: 'mint', label: 'Abroad', title: 'Phuket and Krabi', meta: '6 days · ₹40–65k each · islands', destination: 'Krabi, Thailand', days: 6, prompt: '6 days in Phuket and Krabi with friends, island hopping to Phi Phi, Railay beach, night markets and one big night out.' },
  { id: 'bali-friends', kind: 'beach', art: 'island', tint: 'peach', label: 'Abroad', title: 'Bali with the gang', meta: '7 days · ₹50–80k each · villas', destination: 'Ubud, Indonesia', days: 7, prompt: '7 days in Bali with friends between Ubud and Canggu, a private pool villa, rice terraces, a sunrise trek on Batur and beach clubs.' },
  { id: 'srilanka', kind: 'road', art: 'tide', tint: 'lavender', label: 'Abroad', title: 'Sri Lanka by train', meta: '7 days · ₹40–60k each · hill country', destination: 'Kandy, Sri Lanka', days: 7, prompt: '7 days in Sri Lanka with friends, the Kandy to Ella train, Nine Arches bridge, Sigiriya and the south coast beaches.' },
  { id: 'dubai', kind: 'city', art: 'dunes', tint: 'peach', label: 'Abroad', title: 'Dubai long weekend', meta: '4 days · ₹45–75k each · desert safari', destination: 'Dubai, UAE', days: 4, prompt: 'A long weekend in Dubai with friends, a desert safari, the old souks, a beach club and the Burj Khalifa at sunset.' },
  { id: 'kedarkantha', kind: 'trek', art: 'summit', tint: 'mint', label: 'Snow trek', title: 'Kedarkantha winter trek', meta: '6 days · ₹10–16k each · 3,800 m', destination: 'Sankri, Uttarakhand', days: 6, prompt: 'The Kedarkantha winter trek from Sankri over 6 days with friends, snow camps, summit at sunrise, moderate pace.' },
];

/** True when the person's home or currency is India, so Discover and examples show trips that fit. */
export function inIndia(homeBase: string, currency: string): boolean {
  return currency === 'INR' || /\bindia\b/i.test(homeBase);
}

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
