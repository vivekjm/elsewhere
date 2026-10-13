/**
 * Coordinates for plan places and check-ins. iOS geocodes on the device (Apple, no key, no permission);
 * Android uses Photon (OpenStreetMap, free, no key) because its on-device geocoder needs location permission.
 */
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { PlanPlace } from '../data/extras';
import { cached, getJSON } from './net';

export type LatLng = { lat: number; lng: number };

/** Finds a place, biased to the trip's city ("El Born" → "El Born, Barcelona"). Cached for 90 days. */
export async function geocodePlace(place: string, city: string): Promise<PlanPlace | null> {
  // Airports, stations and ports are often where you leave from, outside the destination: don't pin them to its city.
  const hub = /\b(airport|terminal|station|railway|bus stand|port|harbour|harbor)\b/i.test(place);
  const query = city && !hub && !place.toLowerCase().includes(city.toLowerCase()) ? `${place}, ${city}` : place;
  if (query.trim().length < 2) return null;
  return cached(`geo.${query.toLowerCase()}`, 90 * 86400000, async () => {
    if (Platform.OS === 'ios') {
      try {
        const [hit] = await Location.geocodeAsync(query);
        if (hit) return { lat: hit.latitude, lng: hit.longitude, query };
      } catch { /* Fall through to Photon. */ }
    }
    const data = await getJSON<{ features?: { geometry?: { coordinates?: [number, number] } }[] }>(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`);
    const c = data?.features?.[0]?.geometry?.coordinates;
    return c ? { lat: c[1], lng: c[0], query } : null;
  });
}

/** The phone's position, asking for permission the first time. Null when refused or unavailable. */
export async function currentPosition(): Promise<LatLng | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: fix.coords.latitude, lng: fix.coords.longitude };
}

/** A short name for a position ("El Born, Barcelona"); empty when nothing is known. */
export async function placeName(at: LatLng): Promise<string> {
  // On a shoreline the nearest "name" can be the sea itself; a traveller expects the beach or village instead.
  const water = (n?: string | null) => !!n && /\b(sea|ocean|bay|gulf|strait|channel)\b/i.test(n);
  try {
    const [r] = await Location.reverseGeocodeAsync({ latitude: at.lat, longitude: at.lng });
    if (r) {
      const spot = [r.name && r.name !== r.street && !water(r.name) ? r.name : '', r.district, r.street].find((x) => x && !water(x)) ?? '';
      const area = [r.city, r.subregion, r.region].find((x) => x && x !== spot && !water(x)) ?? '';
      const label = [spot, area].filter(Boolean).join(', ');
      if (label) return label;
    }
  } catch { /* Try Photon. */ }
  const data = await getJSON<{ features?: { properties?: { name?: string; city?: string } }[] }>(`https://photon.komoot.io/reverse?lat=${at.lat}&lon=${at.lng}&limit=1`);
  const p = data?.features?.[0]?.properties;
  return p ? [water(p.name) ? '' : p.name, p.city].filter(Boolean).join(', ') : '';
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Smallest box around the points, padded so markers aren't on the edge. [west, south, east, north]. */
export function boundsOf(points: LatLng[], padKm = 1): [number, number, number, number] | null {
  if (!points.length) return null;
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  const dLat = padKm / 111, dLng = padKm / (111 * Math.max(0.2, Math.cos((lats[0] * Math.PI) / 180)));
  return [Math.min(...lngs) - dLng, Math.min(...lats) - dLat, Math.max(...lngs) + dLng, Math.max(...lats) + dLat];
}
