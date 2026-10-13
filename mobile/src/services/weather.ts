import { useEffect, useState } from 'react';
import type { IconName } from '../loom/graphics';
import { daysFromToday, fromDate, toDate, todayISO } from '../domain/format';
import { lookup } from './places';
import { cached, getJSON } from './net';

export type DayWeather = {
  date: string; code: number; high: number; low: number; rain: number;
  /** True when the trip is beyond the 16-day forecast and this is last year's weather on the same date. */
  typical: boolean;
};

export function sky(code: number): 'sun' | 'cloud' | 'rain' | 'snow' {
  if (code <= 1) return 'sun';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  return 'cloud';
}
export function summary(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Snow';
  if (code >= 95) return 'Thunderstorms';
  return 'Cloudy';
}
export const weatherIcon = (code: number): IconName => ({ sun: 'sun', cloud: 'cloud', rain: 'drop', snow: 'cloud' } as const)[sky(code)];
/** SF Symbol name for widgets and Live Activities. */
export function weatherSymbol(code: number): string {
  if (code === 0) return 'sun.max.fill';
  if (code <= 2) return 'cloud.sun.fill';
  if (code === 45 || code === 48) return 'cloud.fog.fill';
  if (code >= 51 && code <= 57) return 'cloud.drizzle.fill';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'cloud.rain.fill';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'cloud.snow.fill';
  if (code >= 95) return 'cloud.bolt.rain.fill';
  return 'cloud.fill';
}

type Daily = { time: string[]; weather_code: (number | null)[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[]; precipitation_probability_max?: (number | null)[]; precipitation_sum?: (number | null)[] };

function parseDaily(d: Daily | undefined, typical: boolean, shift = 0): Record<string, DayWeather> {
  const out: Record<string, DayWeather> = {};
  if (!d?.time) return out;
  d.time.forEach((iso, i) => {
    const high = d.temperature_2m_max[i], low = d.temperature_2m_min[i];
    if (high == null || low == null || Math.abs(high) > 80 || Math.abs(low) > 80) return;
    const date = shift ? fromDate(new Date(toDate(iso).getFullYear() + shift, toDate(iso).getMonth(), toDate(iso).getDate(), 12)) : iso;
    const rain = typical ? ((d.precipitation_sum?.[i] ?? 0) >= 1 ? 60 : 10) : d.precipitation_probability_max?.[i] ?? 0;
    out[date] = { date, code: d.weather_code[i] ?? 3, high: Math.round(high), low: Math.round(low), rain, typical };
  });
  return out;
}

const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min';

/** Weather for each date of a trip at its destination: live forecast within 16 days, last year's weather beyond. */
export async function tripWeather(destination: string, start: string, end: string): Promise<Record<string, DayWeather>> {
  const today = todayISO();
  if (!destination || end < today || daysFromToday(start, today) > 400) return {};
  const place = await lookup(destination);
  if (!place) return {};
  const usesForecast = daysFromToday(start, today) <= 15;
  const key = `weather.v1.${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}.${start}.${end}`;
  return (await cached(key, usesForecast ? 3 * 3600000 : 7 * 86400000, async () => {
    const result: Record<string, DayWeather> = {};
    if (usesForecast) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=${DAILY},precipitation_probability_max&timezone=auto&forecast_days=16`;
      Object.assign(result, parseDaily((await getJSON<{ daily?: Daily }>(url))?.daily, false));
    }
    const lateStart = [start, fromDate(new Date(toDate(today).getTime() + 16 * 86400000))].sort()[1];
    if (lateStart <= end) {
      const back = (iso: string) => { const d = toDate(iso); return fromDate(new Date(d.getFullYear() - 1, d.getMonth(), d.getDate(), 12)); };
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${place.latitude}&longitude=${place.longitude}&start_date=${back(lateStart)}&end_date=${back(end)}&daily=${DAILY},precipitation_sum&timezone=auto`;
      Object.assign(result, parseDaily((await getJSON<{ daily?: Daily }>(url))?.daily, true, 1));
    }
    const kept: Record<string, DayWeather> = {};
    for (const [date, day] of Object.entries(result)) if (date >= start && date <= end) kept[date] = day;
    return Object.keys(kept).length ? kept : null;
  })) ?? {};
}

export function useTripWeather(trip: { destination: string; start: string; end: string } | null): Record<string, DayWeather> {
  const [weather, setWeather] = useState<Record<string, DayWeather>>({});
  const key = trip ? `${trip.destination}|${trip.start}|${trip.end}` : '';
  useEffect(() => {
    if (!trip) { setWeather({}); return; }
    let active = true;
    void tripWeather(trip.destination, trip.start, trip.end).then((w) => { if (active) setWeather(w); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return weather;
}

/** One line for a trip header: "Usually 15° and overcast" / "15° / 7°, rain likely". */
export function tripWeatherLine(days: DayWeather[], unit: 'metric' | 'imperial'): string {
  if (!days.length) return '';
  const t = (c: number) => unit === 'imperial' ? `${Math.round(c * 9 / 5 + 32)}°` : `${Math.round(c)}°`;
  const avg = Math.round(days.reduce((s, d) => s + d.high, 0) / days.length);
  const rainy = days.filter((d) => sky(d.code) === 'rain' || d.rain >= 50).length;
  const word = rainy > days.length / 2 ? 'rain on most days' : rainy ? `rain on ${rainy} ${rainy === 1 ? 'day' : 'days'}` : summary(days[0].code).toLowerCase();
  return days[0].typical ? `Usually ${t(avg)} and ${word} on these dates` : `Around ${t(avg)}, ${word}`;
}
