import { tripDates, uid, type Item, type Outfit, type Trip, type Workspace } from '../data/model';
import { sky, type DayWeather } from '../services/weather';
import { plansOn } from './trips';

/** One outfit for each trip day from the clothes you own, rotating pieces and adding a layer on wet or cold days. */
export function styleTrip(w: Workspace, trip: Trip, weather: Record<string, DayWeather>, shuffle = 0): { date: string; outfit: Outfit }[] {
  const by = (c: Item['category']) => w.items.filter((i) => i.category === c);
  const tops = by('Tops'), bottoms = by('Bottoms'), layers = by('Layers'), shoes = by('Shoes'), accessories = by('Accessories');
  return tripDates(trip).map((date, day) => {
    const i = day + shuffle;
    const items: string[] = [];
    const wx = weather[date];
    const wet = wx ? sky(wx.code) === 'rain' || sky(wx.code) === 'snow' : false;
    const cold = wx ? wx.high <= 14 : false;
    if (tops.length) items.push(tops[i % tops.length].id);
    if (bottoms.length) items.push(bottoms[Math.floor(i / 2) % bottoms.length].id);
    if (layers.length && (wet || cold || i % 3 === 2)) {
      // The heaviest layer for rain, otherwise rotate.
      const pick = wet ? [...layers].sort((a, b) => b.weight - a.weight)[0] : layers[i % layers.length];
      items.push(pick.id);
    }
    if (shoes.length) items.push(shoes[Math.floor(i / 3) % shoes.length].id);
    if (accessories.length && (wx ? sky(wx.code) === 'sun' : i % 2 === 0)) items.push(accessories[i % accessories.length].id);
    const highlight = plansOn(trip, date).find((a) => a.category === 'Explore' || a.category === 'Event') ?? plansOn(trip, date)[0];
    const name = [`Day ${day + 1}`, highlight?.place?.split(',')[0] || highlight?.title, wet ? 'rain' : cold ? 'cool' : ''].filter(Boolean).join(' · ').slice(0, 200);
    return { date, outfit: { id: uid(), name, items: [...new Set(items)], occasion: 'Everyday', notes: '' } };
  });
}

/** Applies generated outfits to a trip, replacing outfits the stylist made before (named "Day N…") on those days. */
export function applyStyle(w: Workspace, tripId: string, plan: { date: string; outfit: Outfit }[]) {
  const trip = w.trips.find((t) => t.id === tripId);
  if (!trip) return;
  const old = new Set(Object.values(trip.days).map((d) => d.outfitId).filter(Boolean));
  const stillUsed = new Set(w.trips.filter((t) => t.id !== tripId).flatMap((t) => Object.values(t.days).flatMap((d) => [d.outfitId, ...(d.outfitIds ?? [])])));
  w.outfits = w.outfits.filter((o) => !(old.has(o.id) && /^Day \d+/.test(o.name) && !stillUsed.has(o.id)));
  for (const { date, outfit } of plan) {
    if (!outfit.items.length) continue;
    w.outfits.push(outfit);
    const day = trip.days[date] ?? { outfitId: '', outfitIds: [], title: '', stay: '', notes: '', gear: [] };
    trip.days[date] = { ...day, outfitId: outfit.id, outfitIds: [] };
  }
}

/** Distinct outfit combinations the wardrobe can make. */
export const combinations = (items: Item[]) => items.filter((i) => i.category === 'Tops').length * items.filter((i) => i.category === 'Bottoms').length;
