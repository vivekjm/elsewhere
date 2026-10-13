/**
 * Directions in the phone's maps app (Wanderlog-style "route for the day"). Apple Maps on iOS,
 * Google Maps elsewhere; both open the installed app or fall back to the web.
 */
import { Linking, Platform } from 'react-native';

/** A stop gets the trip's city appended so "Museu Picasso" finds the right one. */
const where = (place: string, city: string) => (city && !place.toLowerCase().includes(city.toLowerCase()) ? `${place}, ${city}` : place);

export function routeUrl(places: string[], city: string, mode: 'walking' | 'transit' | 'driving' = 'walking'): string | null {
  const stops = places.map((p) => p.trim()).filter(Boolean).map((p) => where(p, city));
  if (!stops.length) return null;
  if (Platform.OS === 'ios') {
    // Apple Maps chains stops with "to:"; a single stop gives directions from here.
    const dirflg = mode === 'driving' ? 'd' : mode === 'transit' ? 'r' : 'w';
    const daddr = stops.map((s, i) => (i ? `to:${s}` : s)).join(' ');
    return `https://maps.apple.com/?daddr=${encodeURIComponent(daddr)}&dirflg=${dirflg}`;
  }
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1).join('|');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=${mode}`;
}

export async function openRoute(places: string[], city: string, mode?: 'walking' | 'transit' | 'driving'): Promise<boolean> {
  const url = routeUrl(places, city, mode);
  if (!url) return false;
  await Linking.openURL(url);
  return true;
}
