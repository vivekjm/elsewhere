/**
 * Pieces shared by the trip planner (plan mode, for a new trip) and the planning board (an existing trip, planned
 * together): a day as a timeline (and its pins for the map), a trek's route, and the icons for kinds of place.
 */
import React from 'react';
import { LayoutAnimation, View } from 'react-native';
import { altitude, longDay, shortDay } from '../domain/format';
import { altitudeWarnings, stageFacts, stageTitle, type Trek } from '../domain/brief';
import { clock, isTheCity, KIND_LABEL, sunTimes, toMin, type Kind, type Plan, type Stop } from '../domain/planmode';
import { Barcode, colors, Icon, kinds, PressScale, T, type IconName, type Tint } from '../loom';
import { AiLine, ElevationProfile, TimelineStop } from './planui';
import type { MapPin } from './planmap';

export const KIND_ICON: Record<Kind | 'meal' | 'arrive' | 'leave', IconName> = {
  beach: 'sun', fort: 'flag', heritage: 'mountain', temple: 'star', church: 'star', museum: 'image', viewpoint: 'eye', market: 'ticket', nightmarket: 'moon',
  cafe: 'fork', restaurant: 'fork', bar: 'moon', club: 'moon', nature: 'mountain', waterfall: 'drop', activity: 'activity', shopping: 'card', area: 'pin',
  other: 'pin', meal: 'fork', arrive: 'bed', leave: 'plane',
};
export const KIND_TINT: Record<Kind, Tint> = {
  beach: 'peach', fort: 'rose', heritage: 'rose', temple: 'lavender', church: 'lavender', museum: 'lavender', viewpoint: 'peach', market: 'mint', nightmarket: 'lavender',
  cafe: 'mint', restaurant: 'mint', bar: 'lavender', club: 'lavender', nature: 'mint', waterfall: 'mint', activity: 'peach', shopping: 'grey', area: 'grey', other: 'grey',
};

/** Each kind of place in the 3.0 earth colours: its pin, its number on the day's line, its chip's mark. */
export const KIND_COLOR: Record<Kind, string> = {
  beach: kinds.water, fort: kinds.heritage, heritage: kinds.heritage, temple: kinds.culture, church: kinds.culture, museum: kinds.culture, viewpoint: kinds.nature,
  market: kinds.food, nightmarket: kinds.nightlife, cafe: kinds.food, restaurant: kinds.food, bar: kinds.nightlife, club: kinds.nightlife, nature: kinds.nature,
  waterfall: kinds.water, activity: kinds.heritage, shopping: kinds.culture, area: colors.inkMuted, other: colors.inkMuted,
};

/** A plan someone added by hand, shown in the draft as it is: drafting never moves it. */
export type KeptPlan = { id: string; time: string; title: string };

/** A day's draft stops and its kept plans in time order (a kept plan with no time goes first). */
function withKept(stops: Stop[], kept: KeptPlan[]): ({ kind: 'kept'; id: string; time: string; title: string } | { kind: 'stop'; stop: Stop; index: number })[] {
  const all = [...kept.map((k) => ({ kind: 'kept' as const, ...k })), ...stops.map((stop, index) => ({ kind: 'stop' as const, stop, index }))];
  const at = (e: (typeof all)[number]) => (e.kind === 'kept' ? (e.time ? toMin(e.time) : -1) : toMin(e.stop.time));
  return all.sort((x, y) => at(x) - at(y));
}

const isoAddDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/* ------------------------------------------------------------------ flat views for plan mode */

/** A day's places as pins for the map, numbered in the same order as the day's line. */
export function dayPins(day: Plan['days'][number], marks?: Record<string, string>): MapPin[] {
  return day.stops.filter((s) => s.placeId).map((s, i) => ({ s, n: i + 1 })).filter(({ s }) => s.lat !== undefined && s.lng !== undefined)
    .map(({ s, n }) => ({ id: `${day.date}-${s.id}`, lat: s.lat!, lng: s.lng!, label: String(n), color: KIND_COLOR[s.kind as Kind] ?? colors.inkMuted, ring: !!(s.placeId && marks?.[s.placeId]) }));
}

/**
 * One day as a line through the hours: its date and sunset, then each stop with its time. Places are numbered (as
 * on the map); meals and arrival are quieter. Tapping a place calls `onStop`. `marks`: what just happened to a
 * place ("New", "Moved here"), by its id.
 */
export function DayView({ day, index, tz, city, sourceOf, onStop, kept, marks, extra }: {
  day: Plan['days'][number]; index: number; tz: number; city?: string; sourceOf: (s: Stop) => string; onStop?: (s: Stop, dayIndex: number) => void;
  /** Plans already on this day (added by hand): shown in time order, as they are. */
  kept?: KeptPlan[];
  marks?: Record<string, string>;
  /** Under the day's name: a note such as "too full". */
  extra?: React.ReactNode;
}) {
  const center = day.stops.find((s) => s.lat !== undefined && s.lng !== undefined);
  const sunset = center ? sunTimes(center.lat!, center.lng!, day.date, tz)?.sunset : undefined;
  let n = 0;
  // The day at a glance, 07:00 to 22:00: a block for each place, a faint one for meals, the sunset in orange.
  const at = (min: number) => Math.max(0, Math.min(1, (min - 7 * 60) / (15 * 60)));
  const ticks = [
    ...day.stops.map((st) => ({ at: at(toMin(st.time)), kind: st.placeId ? 'block' as const : 'quiet' as const })),
    ...(sunset !== undefined ? [{ at: at(sunset), kind: 'accent' as const }] : []),
  ];
  return <View style={{ gap: 16 }}>
    <View style={{ gap: 10 }}>
      <View accessible accessibilityRole="header" accessibilityLabel={`Day ${index + 1}, ${longDay(day.date)}: ${day.title}`} style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <T v="title" style={{ flex: 1 }}>{longDay(day.date)}</T>
        {sunset !== undefined ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingBottom: 3 }}><View style={{ width: 3, height: 11, backgroundColor: colors.accent }} /><T v="meta">{`Sunset ${clock(sunset)}`}</T></View> : null}
      </View>
      {extra}
      <Barcode marks={ticks} from="07:00" to="22:00" />
    </View>
    <View>{(kept?.length ? withKept(day.stops, kept) : day.stops.map((stop, index) => ({ kind: 'stop' as const, stop, index }))).map((e, j, all) => {
      if (e.kind === 'kept') return <TimelineStop key={e.id} time={e.time || '·'} title={e.title} meta="Already planned: stays as it is" color={colors.ink} first={j === 0} last={j === all.length - 1} />;
      const s = e.stop;
      const place = !!s.placeId;
      if (place) n += 1;
      const atSunset = sunset !== undefined && (s.kind === 'fort' || s.kind === 'viewpoint' || s.kind === 'beach') && toMin(s.time) >= sunset - 100 && toMin(s.time) <= sunset;
      const label = KIND_LABEL[s.kind as Kind];
      const meta = place
        ? [atSunset ? 'Catch the sunset' : '', label !== 'Place' ? label : '', city && isTheCity(s.place, city) ? '' : s.place, sourceOf(s)].filter(Boolean).join(' · ')
        : s.why;
      const travel = s.travel && j > 0 && place ? (s.travel <= 10 ? 'Nearby' : `${s.travel} min`) : '';
      return <TimelineStop key={s.id} time={s.time} title={s.title} meta={meta} muted={!place} n={place ? n : undefined} travel={travel || undefined}
        badge={s.placeId ? marks?.[s.placeId] : undefined}
        color={place ? KIND_COLOR[s.kind as Kind] ?? colors.inkMuted : colors.inkFaint} first={j === 0} last={j === all.length - 1}
        onPress={place && onStop ? () => onStop(s, index) : undefined} />;
    })}</View>
  </View>;
}

/**
 * A trek: its altitude profile (tap a camp), then the days in a line. The chosen day opens in place with its
 * distance, climb, note and any altitude warning. `start`: the first day's date, once there is one.
 */
export function TrekView({ trek, selected, onSelect, start, unit = 'metric' }: { trek: Trek; selected: number; onSelect: (i: number) => void; start?: string; unit?: 'metric' | 'imperial' }) {
  const i = Math.min(selected, trek.stages.length - 1);
  const warnings = altitudeWarnings(trek);
  const date = (n: number) => (start ? shortDay(isoAddDays(start, n)) : '');
  const pick = (n: number) => { if (n === i) return; LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity')); onSelect(n); };
  return <View style={{ gap: 14 }}>
    <ElevationProfile points={trek.stages.map((s) => ({ start: s.start_altitude, end: s.end_altitude }))} selected={i} onSelect={pick} unit={unit} />
    <View>{trek.stages.map((s, n) => {
      const on = n === i;
      const warn = warnings.filter((w) => w.startsWith(`Day ${n + 1} `));
      return <PressScale key={`${n}-${s.from}-${s.to}`} accessibilityRole="button" accessibilityState={{ selected: on, expanded: on }} accessibilityLabel={`Day ${n + 1}: ${stageTitle(s)}`}
        onPress={() => pick(n)} style={{ paddingVertical: 14, gap: 8, borderTopWidth: n ? 1 : 0, borderTopColor: colors.hairline }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 54 }}>
            <T v="meta" color={on ? colors.ink : colors.inkMuted}>{`Day ${n + 1}`}</T>
            {start ? <T v="meta" style={{ fontSize: 11 }}>{date(n)}</T> : null}
          </View>
          <T v="row" style={{ flex: 1, fontSize: on ? 17 : 15 }} lines={on ? 2 : 1}>{stageTitle(s)}</T>
          {warn.length && !on ? <Icon name="shield" size={14} color={colors.danger} /> : null}
          <T v="meta" style={{ fontVariant: ['tabular-nums'], color: on ? colors.ink : colors.inkMuted }}>{s.end_altitude ? altitude(s.end_altitude, unit) : ''}</T>
        </View>
        {on ? <View style={{ paddingLeft: 66, gap: 6 }}>
          {stageFacts(s, unit) ? <T v="small" color={colors.ink}>{stageFacts(s, unit)}</T> : null}
          {s.note ? <T v="small">{s.note}</T> : null}
          {warn.map((w) => <AiLine key={w} text={w.replace(/^Day \d+ /, 'This day ')} tone="warn" />)}
        </View> : null}
      </PressScale>;
    })}</View>
    <View style={{ gap: 6 }}>
      {trek.permits.length ? <T v="small" color={colors.ink}>{`Permits: ${trek.permits.join(' · ')}`}</T> : null}
      <T v="meta">Route, distances and altitudes suggested by AI: check them with your trek organiser or guide.</T>
    </View>
  </View>;
}
