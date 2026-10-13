/** Tides (Open-Meteo marine model) and summit conditions (pressure-level forecast at the summit's height). */
import { lookup } from './places';
import { cached, getJSON } from './net';

export type TidePoint = { time: string; height: number };
export type TideDay = { points: TidePoint[]; highs: TidePoint[]; lows: TidePoint[]; inland: boolean };

export async function tides(destination: string, date: string): Promise<TideDay | null> {
  const place = await lookup(destination);
  if (!place) return null;
  return cached(`tides.${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}.${date}`, 6 * 3600000, async () => {
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${place.latitude.toFixed(4)}&longitude=${place.longitude.toFixed(4)}&hourly=sea_level_height_msl&timezone=auto&start_date=${date}&end_date=${date}`;
    const data = await getJSON<{ hourly?: { time: string[]; sea_level_height_msl: (number | null)[] } }>(url);
    if (!data?.hourly) return null;
    const points = data.hourly.time.map((time, i) => ({ time: time.slice(11, 16), height: data.hourly!.sea_level_height_msl[i] })).filter((p): p is TidePoint => p.height != null);
    if (points.length < 6) return { points: [], highs: [], lows: [], inland: true };
    const highs: TidePoint[] = [], lows: TidePoint[] = [];
    for (let i = 1; i < points.length - 1; i++) {
      if (points[i].height > points[i - 1].height && points[i].height >= points[i + 1].height) highs.push(points[i]);
      if (points[i].height < points[i - 1].height && points[i].height <= points[i + 1].height) lows.push(points[i]);
    }
    return { points, highs, lows, inland: false };
  });
}

export type SummitDay = { date: string; windKmh: number; dawnTemp: number | null };
const LEVELS = [700, 600, 500, 400, 300];

/** Peak morning wind and dawn temperature at the summit's altitude for the next 16 days. */
export async function summitForecast(destination: string, altitude: number): Promise<SummitDay[] | null> {
  if (!altitude) return null;
  const place = await lookup(destination);
  if (!place) return null;
  return cached(`summit.${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}.${altitude}`, 3 * 3600000, async () => {
    const vars = LEVELS.flatMap((l) => [`wind_speed_${l}hPa`, `temperature_${l}hPa`, `geopotential_height_${l}hPa`]).join(',');
    const data = await getJSON<{ hourly?: Record<string, (number | null)[]> & { time: string[] } }>(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&hourly=${vars}&forecast_days=16&timezone=auto`, 15000);
    const h = data?.hourly;
    if (!h?.time) return null;
    const at = (prefix: string, i: number): number | null => {
      const samples = LEVELS.map((l) => ({ h: h[`geopotential_height_${l}hPa`]?.[i], v: h[`${prefix}_${l}hPa`]?.[i] }))
        .filter((s): s is { h: number; v: number } => s.h != null && s.v != null).sort((a, b) => a.h - b.h);
      if (!samples.length) return null;
      if (altitude <= samples[0].h) return samples[0].v;
      if (altitude >= samples[samples.length - 1].h) return samples[samples.length - 1].v;
      for (let k = 0; k < samples.length - 1; k++) {
        const a = samples[k], b = samples[k + 1];
        if (altitude >= a.h && altitude <= b.h) return a.v + (b.v - a.v) * ((altitude - a.h) / Math.max(b.h - a.h, 1));
      }
      return null;
    };
    const days = new Map<string, { winds: number[]; dawn: number | null }>();
    h.time.forEach((time, i) => {
      const hour = Number(time.slice(11, 13));
      if (hour < 1 || hour > 11) return;
      const day = time.slice(0, 10);
      const entry = days.get(day) ?? { winds: [], dawn: null };
      const w = at('wind_speed', i); if (w != null) entry.winds.push(w);
      if (hour === 6) entry.dawn = at('temperature', i);
      days.set(day, entry);
    });
    const out = [...days.entries()].filter(([, e]) => e.winds.length).map(([date, e]) => ({ date, windKmh: Math.round(Math.max(...e.winds)), dawnTemp: e.dawn == null ? null : Math.round(e.dawn) }));
    return out.length ? out : null;
  });
}

/** Sunrise in UTC for a date and place (NOAA solar position), or null in polar day or night. */
export function solarSunrise(date: string, latitude: number, longitude: number): Date | null {
  const [y, m, d] = date.split('-').map(Number);
  const rad = Math.PI / 180;
  const day = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
  const gamma = (2 * Math.PI / 365) * (day - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const cosHa = Math.cos(90.833 * rad) / (Math.cos(latitude * rad) * Math.cos(decl)) - Math.tan(latitude * rad) * Math.tan(decl);
  if (cosHa < -1 || cosHa > 1) return null;
  const ha = Math.acos(cosHa) / rad;
  const minutes = 720 - 4 * (longitude + ha) - eqTime;
  return new Date(Date.UTC(y, m - 1, d) + minutes * 60000);
}

/** Sunrise at a place on a date ("06:28"), local to the place. Forecast data when in range, else computed. */
export async function sunrise(destination: string, date: string): Promise<string | null> {
  const place = await lookup(destination);
  if (!place) return null;
  return cached(`sunrise.${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}.${date}`, 30 * 86400000, async () => {
    const data = await getJSON<{ daily?: { sunrise?: string[] } }>(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=sunrise&timezone=auto&start_date=${date}&end_date=${date}`);
    const fromForecast = data?.daily?.sunrise?.[0]?.slice(11, 16);
    if (fromForecast) return fromForecast;
    const at = solarSunrise(date, place.latitude, place.longitude);
    if (!at) return null;
    try {
      return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: place.timeZone || undefined }).format(at);
    } catch {
      return null;
    }
  });
}
