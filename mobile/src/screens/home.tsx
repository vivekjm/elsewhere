import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useOpenTripPage, useRouter } from '../core/nav';
import { CoverImage, TripPhoto } from '../core/cover';
import { useExpand, useIsExpandCopy, type Landing } from '../core/expand';
import { track } from '../core/analytics';
import { dayCard, dayMessage, shareText } from './organiser';
import { takePendingLanding } from '../core/landing';
import { usePrefs, useSelection, useTrips } from '../core/state';
import { tripDates, useExtras, type Trip, type TripExtras } from '../data';
import { compactRange, dateRange, money, planTime, plural, shortDay, todayISO } from '../domain/format';
import { IDEA_FILTERS, IDEAS, IDEAS_INDIA, inIndia, type Idea } from '../domain/ideas';
import { budgetOf, CATEGORY, countdownLabel, coverOf, featuredTrip, KIND_LABEL, KIND_TINT, pastTrips, placeOf, planArt, plansOn, statusOf, todos, upcomingTrips } from '../domain/trips';
import {
  Banner, Barcode, Blocks, Button, Card, Chips, colors, EmptyState, fonts, Gauge, GlassFill, Header, Hero, HeroText, HScroll, Icon, IconTile, Illustration, MediaRow, Mosaic, MosaicRow, Numeral, Pill,
  PhotoCard, PressScale, radii, RoundButton, RowView, Screen, Section, shadows, Stack, T, TileLabel,
  inputText, singleLine, StaticTabBar, TRIP_TABS, ADVENTURE_TABS, Swap,
} from '../loom';
import { useRates } from '../services/currency';
import { isFlightPlan } from '../services/flights';
import { suggest, type Place } from '../services/places';
import { AdventureCard, AdventureHeader } from './adventure';
import { RecapHeader, RecapHero, TripCard, TripHeader } from './trip';

/** Opens a trip in the right section: treks get the adventure tabs. */
export function useOpenTrip() {
  const openTrip = useOpenTripPage();
  const { select } = useSelection();
  const extras = useExtras();
  return (trip: Trip, path = '') => {
    select(trip.id);
    const adventure = extras.get(trip.id).kind === 'trek';
    openTrip(path || (adventure ? '/adventure' : '/trip'));
  };
}

/**
 * Opens a trip from a card with the shared "card grows into its page" transition (src/core/expand.tsx).
 * `colour` and `radius` are the card's own, which the growing copy starts from.
 */
function TripLink({ trip, path, label, radius = radii.card, colour = colors.card, picture, children }: {
  trip: Trip; path?: string; label: string; radius?: number; colour?: string; children: React.ReactNode;
  /** The cover thumbnail on the card, which grows into the page's cover. */
  picture?: React.RefObject<View | null>;
}) {
  const { select } = useSelection();
  const extras = useExtras();
  const expand = useExpand();
  const card = useRef<View>(null);
  const trek = extras.get(trip.id).kind === 'trek';
  const href = path || (trek ? '/adventure' : '/trip');
  const extra = extras.get(trip.id);
  // The copy lands as the page's own first view (header, card and tab bar), so the page never fills in piece by piece.
  const to: Landing = href === '/recap'
    ? { target: 'recap', colour: colors.ember, radius: radii.hero, height: 250, header: <RecapHeader trip={trip} />, page: <RecapHero trip={trip} extras={extra} /> }
    : trek
      ? { target: 'adventure', colour: colors.card, radius: radii.hero, height: 2000, header: <AdventureHeader />, bar: <StaticTabBar items={ADVENTURE_TABS} />, coverHeight: 190, page: <AdventureCard trip={trip} extras={extra} /> }
      : { target: 'trip', colour: colors.card, radius: radii.hero, height: 2000, header: <TripHeader />, bar: <StaticTabBar items={TRIP_TABS} />, coverHeight: 210, page: <TripCard trip={trip} extras={extra} /> };
  return <PressScale accessibilityRole="button" accessibilityLabel={label} scaleTo={0.98}
    onPress={() => {
      select(trip.id);
      expand(card, href, {
        colour, radius, content: children, to,
        // A trek's page cover is the summit (unless it has a photo), so its thumbnail only travels when they match.
        picture: picture && (!trek || extra.cover || coverOf(trip) === 'summit')
          ? { ref: picture, radius: 12, node: <CoverImage trip={trip} extras={extra} /> } : undefined,
      });
    }}>
    <View ref={card} pointerEvents="none" collapsable={false}>{children}</View>
  </PressScale>;
}

/** Workspace sync problems, shown at the top of Home and Profile. */
export function SyncBanner() {
  const { status, error, sync, discardAndReload } = useTrips();
  if (status === 'offline') return <Banner icon="cloud" tint="grey" title="You’re offline" body="Changes are saved on this phone and sync when you’re back online." action="Retry" onAction={() => void sync()} />;
  if (status === 'error') return <Banner icon="cloud" tint="rose" title="Couldn’t sync" body={error || 'Your changes are saved on this phone.'} action="Retry" onAction={() => void sync()} />;
  if (status === 'conflict') return <Banner icon="refresh" tint="peach" title="Changed on another device" body="Your edits here are kept. Load the newer copy to continue editing." action="Load" onAction={() => void discardAndReload().catch(() => {})} />;
  return null;
}

/** No trip coming up: a first trip for a new user, or the next one after a past trip. */
function FirstTripHero({ name, last }: { name: string; last?: Trip | null }) {
  const router = useRouter();
  const prefs = usePrefs();
  const group = prefs.native.party !== 'solo';
  const who = prefs.native.party === 'family' ? 'family' : prefs.native.party === 'partner' ? 'partner' : 'friends';
  const greeting = last ? 'Welcome back' : 'Welcome';
  // Groups start with the people: create the trip, then invite everyone from it.
  return <Hero gap={16}>
    <RowView align="flex-start" style={{ justifyContent: 'space-between' }}>
      <View style={{ gap: 4, flex: 1 }}>
        <HeroText faint style={{ fontSize: 14 }}>{name ? `${greeting}, ${name}` : greeting}</HeroText>
        <HeroText v="display" style={{ fontSize: 28, lineHeight: 32, letterSpacing: -0.5 }}>{last ? 'Where next?' : 'Where to first?'}</HeroText>
        <HeroText faint style={{ fontSize: 14 }}>{group
          ? `Start the trip, send one link to your ${who}, and decide, plan and split costs together.`
          : last ? `Your last trip was ${last.name}. Plan the next one, or start from an idea below.` : 'Add a trip you’ve booked, or describe one and get a day-by-day outline.'}</HeroText>
      </View>
      <Illustration name="compass" width={64} height={64} radius={12} />
    </RowView>
    {group ? <Button label={`Start a trip with ${who === 'partner' ? 'my partner' : `my ${who}`}`} icon="shared" kind="white" height={50} onPress={() => router.push({ pathname: '/new-trip', params: { invite: '1' } } as never)} />
      : <Button label="Quick start from a sentence" icon="sparkle" kind="white" height={50} onPress={() => router.push('/planner' as never)} />}
    <Button label={group ? 'Quick start from a sentence' : 'Add a trip I’ve booked'} icon={group ? 'sparkle' : 'plus'} kind="dark" height={50} onPress={() => router.push((group ? '/planner' : '/new-trip') as never)} />
  </Hero>;
}

/** Nothing saved on this phone and the server couldn't be reached: say so instead of pretending there are no trips. */
function LoadFailedHero() {
  const { status, error, reload } = useTrips();
  const [busy, setBusy] = useState(false);
  return <Hero gap={16}>
    <RowView align="flex-start" style={{ justifyContent: 'space-between' }}>
      <View style={{ gap: 4, flex: 1 }}>
        <HeroText faint style={{ fontSize: 14 }}>{status === 'offline' ? 'You’re offline' : 'Something went wrong'}</HeroText>
        <HeroText v="display" style={{ fontSize: 28, lineHeight: 32, letterSpacing: -0.5 }}>Couldn’t load your trips</HeroText>
        <HeroText faint style={{ fontSize: 14 }}>{status === 'offline'
          ? 'This phone doesn’t have a saved copy yet. Connect to the internet, then try again.'
          : error || 'Your trips are safe. Try again in a moment.'}</HeroText>
      </View>
      <Illustration name="compass" width={64} height={64} radius={12} />
    </RowView>
    <Button label={busy ? 'Trying…' : 'Try again'} icon="refresh" kind="white" height={50}
      onPress={busy ? undefined : () => { setBusy(true); void reload().catch(() => {}).finally(() => setBusy(false)); }} />
  </Hero>;
}

/** The currency's symbol alone ("₹"), for a big numeral with a small symbol before it. */
function symbolOf(currency: string): string {
  return money(0, currency).replace(/[\d.,\s\u00a0]/g, '');
}
const whole = (n: number) => Math.round(n).toLocaleString('en-IN');

/** A tile in the overview: its name as GymSync writes it ("Total spent:"), its reading, and a tap through to where it changes. */
function Pane({ label, onPress, children, style, hint }: { label: string; onPress?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; hint?: string }) {
  return <PressScale accessibilityRole="button" accessibilityLabel={label.replace(/:$/, '')} accessibilityHint={hint} onPress={onPress} scaleTo={0.985}
    style={[{ flex: 1, minHeight: 172, padding: 16, gap: 12 }, style]}>
    <GlassFill kind="surface" radius={radii.check} />
    <TileLabel>{label}</TileLabel>
    {children}
  </PressScale>;
}

/** Text links across the top of the hero, as GymSync's Overview · Workouts: the first is where you are. */
function HeroTabs({ items }: { items: { label: string; onPress?: () => void }[] }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 22 }}>
    {items.map((t, i) => <PressScale key={t.label} accessibilityRole="button" accessibilityState={{ selected: i === 0 }} hitSlop={10} onPress={t.onPress} style={{ paddingBottom: 6 }}>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.regular, fontSize: 14, color: i === 0 ? colors.ink : colors.inkMuted }}>{t.label}</Text>
      {i === 0 ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: colors.ink }} /> : null}
    </PressScale>)}
  </View>;
}

/**
 * The trip on Home, as one panel of tiles that touch. The top tile is the trip's photo with the greeting as a
 * sentence, who's going, the countdown, and the days as a barcode; under it the spend, the budget's pace, how full
 * the days are and what's left; last the one live thing in khaki (today's plan or stage, or the next step).
 */
function TripOverview({ trip, extras }: { trip: Trip; extras: TripExtras }) {
  const prefs = usePrefs();
  const router = useRouter();
  const open = useOpenTrip();
  const { select } = useSelection();
  const { workspace, status: sync } = useTrips();
  const rates = useRates(trip.currency);
  const status = statusOf(trip);
  const dates = tripDates(trip);
  const today = todayISO();
  const trek = extras.kind === 'trek';
  const stages = extras.adventure.stages;
  const plans = (d: string) => trip.activities.filter((a) => a.date === d && a.category !== 'Stay');
  const planned = (d: string) => (trek ? stages.some((st) => st.date === d) : plans(d).length > 0);
  const pct = Math.round((dates.filter(planned).length / Math.max(1, dates.length)) * 100);
  const left = workspace ? todos(workspace, trip, extras) : [];
  const budget = budgetOf(trip, extras, rates, trip.currency);
  const people = Math.max(1, extras.live ? extras.members.length : 1 + extras.people.length);
  const name = prefs.firstName;
  const kind = trek ? 'trek' : 'trip';
  const go = (path: string) => open(trip, path);
  const base = trek ? '/adventure' : '/trip';

  const sentence = status.phase === 'active'
    ? <>{name ? `Hi ${name}, it’s ` : 'It’s '}<Text style={{ fontFamily: fonts.semibold }}>{`day ${status.dayNumber} of ${status.totalDays}`}</Text>{` of your ${trip.name} ${kind}.`}</>
    : <>{name ? `Hi ${name}, you’ve ` : 'You’ve '}<Text style={{ fontFamily: fonts.semibold }}>{`planned ${pct}%`}</Text>{` of your ${trip.name} ${kind}.`}</>;
  const inSync = sync !== 'offline' && sync !== 'error' && sync !== 'conflict';
  const todayIndex = dates.indexOf(today);
  const days = dates.map((d, i) => ({ at: dates.length > 1 ? i / (dates.length - 1) : 0.5, kind: i === todayIndex ? 'accent' as const : planned(d) ? 'block' as const : 'quiet' as const }))
    .filter((m) => m.kind !== 'quiet');

  // The spend: what's spent once anything is logged, else what the plans cost.
  const amount = budget.spent > 0 ? budget.spent : budget.planned;
  const pace = budget.limit ? budget.planned / budget.limit : 0;
  const paceWord = !budget.limit ? 'Not set' : pace > 1 ? 'Over' : pace > 0.85 ? 'Tight' : 'Normal';
  const paceSub = !budget.limit ? 'Add a budget' : pace > 1 ? `${money(budget.planned - budget.limit, trip.currency)} over` : pace > 0.85 ? 'Near the limit' : 'On plan';

  // How full each day is; today (or the busiest day) is the orange block.
  const counts = dates.slice(0, 10).map((d) => Math.min(6, trek ? (stages.some((st) => st.date === d) ? 1 : 0) : plans(d).length));
  const busiest = counts.indexOf(Math.max(...counts));
  const mark = todayIndex >= 0 && todayIndex < counts.length ? todayIndex : busiest;
  const highest = Math.max(0, ...stages.map((st) => st.endAltitude || 0));

  // The one live thing: today's stage or plan during the trip; the first stage or the next step before it.
  const stage = trek ? stages.find((st) => st.date === today) ?? stages.find((st) => !st.done) : undefined;
  const now = new Date();
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const next = status.phase === 'active' && !trek ? plans(today).find((a) => !a.completed && (!a.time || a.time >= clock)) : undefined;
  const live = stage
    ? { label: status.phase === 'active' ? 'Live trek' : 'First stage', meta: [stage.date ? `Day ${dates.indexOf(stage.date) + 1}` : '', stage.date ? shortDay(stage.date) : ''].filter(Boolean).join(' · '),
      title: stage.title || [stage.from, stage.to].filter(Boolean).join(' → ') || 'Today’s stage',
      facts: [stage.distanceKm ? [String(stage.distanceKm), 'km'] : null, stage.hours ? [String(stage.hours), 'h'] : null, stage.endAltitude ? [stage.endAltitude.toLocaleString('en-IN'), 'm'] : null].filter((f): f is string[] => !!f),
      action: status.phase === 'active' ? 'Start the day' : 'Prepare', path: status.phase === 'active' ? '/adventure/climb' : '/adventure/prepare' }
    : next
      ? { label: 'Next today', meta: planTime(next.time) || shortDay(today), title: next.title, facts: [], note: placeOf(next) || CATEGORY[next.category].label, action: 'Open the day', path: '/trip/days' }
      : { label: status.phase === 'active' ? 'Today' : 'Next step', meta: status.phase === 'active' ? shortDay(today) : countdownLabel(status),
        title: status.phase === 'active' ? 'Nothing else planned today' : left[0] ?? 'All set for the trip', facts: [],
        note: status.phase === 'active' ? 'Add a plan, or keep the day free' : left.length > 1 ? `Then: ${left.slice(1, 3).join(', ').toLowerCase()}` : '',
        action: status.phase === 'active' ? 'Open the day' : 'Open trip', path: status.phase === 'active' ? (trek ? '/adventure' : '/trip/days') : base };

  return <Mosaic>
    {/* The trip's photo: the one place on Home a picture says something. */}
    <View style={{ minHeight: 430, padding: 16, gap: 18, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card, overflow: 'hidden' }}>
      <TripPhoto trip={trip} extras={extras} />
      <HeroTabs items={[{ label: 'Overview' }, { label: trek ? 'Route' : 'Days', onPress: () => go(trek ? '/adventure' : '/trip/days') }, { label: trek ? 'Gear' : 'Budget', onPress: () => go(trek ? '/adventure/gear' : '/trip/budget') }]} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.25} style={{ flex: 1, fontFamily: fonts.light, fontSize: 30, lineHeight: 35, letterSpacing: -0.6, color: colors.ink }}>{sentence}</Text>
        <PressScale accessibilityRole="button" accessibilityLabel={`${people === 1 ? 'Just you' : `${people} people`}, ${inSync ? 'in sync' : 'not synced yet'}. Invite`}
          onPress={() => { select(trip.id); router.push('/invite' as never); }} style={{ width: 122, padding: 10, gap: 4, borderRadius: radii.chip }}>
          <GlassFill kind="strong" radius={radii.chip} />
          <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.ink }}>My trip</Text>
          <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.light, fontSize: 12, color: colors.inkMuted }}>{people === 1 ? 'Just you' : plural(people - 1, 'friend')}</Text>
          <RowView gap={6}>
            <View style={{ width: 14, height: 14, borderRadius: radii.check, alignItems: 'center', justifyContent: 'center', backgroundColor: inSync ? colors.successFill : colors.controlGlass }}>
              <Icon name={inSync ? 'check' : 'cloud'} size={10} strokeWidth={2.2} /></View>
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.light, fontSize: 12, color: colors.inkMuted }}>{inSync ? 'In sync' : 'Offline'}</Text>
          </RowView>
        </PressScale>
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ gap: 4 }}>
        <TileLabel>{status.phase === 'active' ? 'Today:' : 'Starts in:'}</TileLabel>
        {status.phase === 'active'
          ? <Numeral size="xl" value={`Day ${status.dayNumber}`} unit={`of ${status.totalDays}`} />
          : <Numeral size="xl" value={String(status.daysUntil)} unit={status.daysUntil === 1 ? 'day' : 'days'} />}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          <PressScale accessibilityRole="button" accessibilityLabel="Map" onPress={() => go(trek ? '/adventure' : '/trip/map')} style={{ width: 40, height: 40, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center' }}>
            <GlassFill kind="glass" radius={radii.chip} /><Icon name="map" size={18} /></PressScale>
          <PressScale accessibilityRole="button" accessibilityLabel="Invite people" onPress={() => { select(trip.id); router.push('/invite' as never); }} style={{ width: 40, height: 40, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center' }}>
            <GlassFill kind="glass" radius={radii.chip} /><Icon name="share" size={18} /></PressScale>
        </View>
        <Barcode style={{ flex: 1 }} marks={days} ticks={40} from="Day 1" to={`Day ${dates.length}`} />
      </View>
    </View>

    <MosaicRow>
      <Pane label={budget.spent > 0 ? 'Total spent:' : 'Planned costs:'} onPress={() => go(trek ? base : '/trip/budget')}>
        <Numeral prefix={symbolOf(trip.currency)} value={whole(amount)} />
        {amount ? <View style={{ gap: 8 }}>
          <View><TileLabel>A day</TileLabel><Text style={{ fontFamily: fonts.regular, fontSize: 16, color: colors.ink }}>{whole(amount / Math.max(1, status.totalDays))}</Text></View>
          {people > 1 ? <View><TileLabel>Each</TileLabel><Text style={{ fontFamily: fonts.regular, fontSize: 16, color: colors.ink }}>{whole(amount / people)}</Text></View> : null}
        </View> : <T v="meta">Add costs to plans, or log what you spend</T>}
      </Pane>
      <Pane label="Budget pace:" onPress={() => go(trek ? base : '/trip/budget')} style={{ alignItems: 'center' }}>
        <Gauge value={budget.limit ? Math.min(1, pace) : null} display={paceWord} sub={paceSub} size={140} />
      </Pane>
    </MosaicRow>
    <MosaicRow>
      {trek && highest
        ? <Pane label="Altitude:" onPress={() => go('/adventure')}>
          <Numeral value={highest.toLocaleString('en-IN')} unit="m" />
          <T v="meta">{`Highest camp · ${plural(stages.length, 'stage')}`}</T>
        </Pane>
        : <Pane label="Places a day:" onPress={() => go(trek ? base : '/trip/days')} style={{ justifyContent: 'space-between' }}>
          {counts.some(Boolean)
            ? <Blocks columns={counts.map((c, i) => ({ value: c, tone: i === mark && c ? 'accent' as const : undefined }))} max={4} />
            : <T v="meta">No plans yet</T>}
        </Pane>}
      <Pane label="Left to do:" onPress={() => go(base)}>
        <Numeral value={left.length ? String(left.length) : '0'} unit={left.length === 1 ? 'thing' : 'things'} />
        <T v="meta" lines={2}>{left[0] ?? 'Nothing left on the list'}</T>
      </Pane>
    </MosaicRow>

    {/* The one live thing, in khaki. */}
    <View style={{ borderBottomLeftRadius: radii.card, borderBottomRightRadius: radii.card, overflow: 'hidden' }}>
      <GlassFill kind="khaki" radius={0} />
      <View style={{ padding: 16, gap: 12 }}>
        <RowView style={{ justifyContent: 'space-between' }}>
          <TileLabel color={colors.ink}>{live.label}</TileLabel>
          {live.meta ? <TileLabel color={colors.ink}>{live.meta}</TileLabel> : null}
        </RowView>
        <T v="title" lines={2}>{live.title}</T>
        {live.facts.length ? <RowView gap={22}>{live.facts.map(([v, u]) => <Numeral key={u} size="sm" value={v} unit={u} color={colors.ink} />)}</RowView> : null}
        {'note' in live && live.note ? <T v="small" color={colors.ink}>{live.note}</T> : null}
      </View>
      <PressScale accessibilityRole="button" onPress={() => go(live.path)} scaleTo={0.99}
        style={{ height: 52, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: colors.khakiRule, backgroundColor: 'rgba(251, 248, 241, 0.04)' }}>
        <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.ink }}>{live.action}</Text>
      </PressScale>
    </View>
  </Mosaic>;
}

/** During a trip: what's left today, with the next plan marked. A flight opens its live status; a trek shows today's stage. */
function TodaySection({ trip, extras }: { trip: Trip; extras: TripExtras }) {
  const prefs = usePrefs();
  const router = useRouter();
  const { select } = useSelection();
  const open = useOpenTrip();
  const today = todayISO();
  if (extras.kind === 'trek') {
    const stage = extras.adventure.stages.find((st) => st.date === today);
    return <Section title="Today" action="Trek" onAction={() => open(trip)}>
      {stage
        ? <MediaRow ill="summit" tint="lavender" eyebrow={stage.done ? 'Stage done' : 'Today’s stage'} title={stage.title || `${stage.from} to ${stage.to}`}
          meta={[stage.title && stage.from && stage.to ? '' : stage.from || stage.to, stage.distanceKm ? `${stage.distanceKm} km` : '', stage.hours ? `${stage.hours} h` : '', stage.endAltitude ? `${stage.endAltitude.toLocaleString()} m` : ''].filter(Boolean).join(' · ')}
          onPress={() => open(trip, '/adventure/climb')} />
        : <MediaRow ill="tent" tint="lavender" eyebrow={shortDay(today)} title="No stage planned" meta="A rest day, or add today’s stage" onPress={() => open(trip)} />}
    </Section>;
  }
  const now = new Date();
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const all = plansOn(trip, today);
  const left = all.filter((a) => !a.completed);
  const next = left.find((a) => !a.time || a.time >= clock);
  const show = (id: string, flight: boolean) => {
    select(trip.id);
    router.push((flight ? { pathname: '/flight', params: { id } } : { pathname: '/add-plan', params: { id } }) as never);
  };
  const addPlan = () => { select(trip.id); router.push({ pathname: '/add-plan', params: { date: today } } as never); };
  return <Section title="Today" action="Itinerary" onAction={() => open(trip, '/trip/days')}>
    {left.length ? <Stack>{left.slice(0, 4).map((a, i) => {
      const flight = isFlightPlan(a);
      const label = flight ? 'Flight' : CATEGORY[a.category].label;
      return <MediaRow key={a.id} ill={planArt(trip, a)} tint={CATEGORY[a.category].tint}
        eyebrow={[a.id === next?.id ? 'Next' : '', planTime(a.time) || label].filter(Boolean).join(' · ')}
        title={a.title} meta={flight ? 'Live flight status' : placeOf(a) || label} onPress={() => show(a.id, flight)} />;
    })}</Stack>
      : all.length
        ? <MediaRow ill="compass" tint="mint" eyebrow={shortDay(today)} title="All done for today" meta={`${plural(all.length, 'plan')} done · check in where you are`}
          onPress={() => open(trip, '/trip/map')} />
        : <MediaRow ill="compass" tint="mint" eyebrow={shortDay(today)} title="Nothing planned today" meta="Add a plan, or keep the day free" onPress={addPlan} />}
    {left.length && (extras.people.length || extras.live) ? <Button label="Send today’s plan to the group" icon="share" kind="white" height={48}
      onPress={() => void shareText(dayMessage(trip, extras, today, prefs.name, prefs.native.shareLanguage), 'day_sheet_shared', dayCard(trip, today, prefs.native.shareLanguage))} /> : null}
  </Section>;
}

function OtherWaysToStart() {
  return <Section title="Other ways to start">
    <Stack>
      <MediaRow ill="passport" tint="lavender" eyebrow="Invited?" title="Join a friend’s trip" meta="Paste the invite link or code they sent" href="/join-trip" />
      <MediaRow ill="receipt" tint="peach" eyebrow="Already booked?" title="Import a booking" meta="Paste a flight or hotel confirmation" href="/import-bookings" />
    </Stack>
  </Section>;
}

/** Ideas that fit where the person lives: Indian trips first for India, the world list after them. */
function ideasFor(prefs: { homeBase: string; currency: string }): Idea[] {
  return inIndia(prefs.homeBase, prefs.currency) ? [...IDEAS_INDIA, ...IDEAS] : IDEAS;
}

function IdeaCard({ idea, big }: { idea: Idea; big?: boolean }) {
  const router = useRouter();
  return <PhotoCard ill={idea.art} label={idea.label} title={idea.title} meta={idea.meta} width={big ? 250 : 236} height={big ? 300 : 200}
    onPress={() => { track('discover_idea_opened', { idea: idea.id }); router.push({ pathname: '/planner', params: { prompt: idea.prompt, destination: idea.destination, kind: idea.kind } } as never); }} />;
}

export function HomeScreen() {
  const router = useRouter();
  const prefs = usePrefs();
  const { trips, status, workspace } = useTrips();
  const extras = useExtras();
  const open = useOpenTrip();
  const { select } = useSelection();
  const featured = featuredTrip(trips);
  const phase = featured ? statusOf(featured).phase : null;
  // A trip under way or coming up gets the trip hero; with only past trips, Home looks forward to the next one.
  const current = featured && phase !== 'past' ? featured : null;
  const others = upcomingTrips(trips).filter((t) => t.id !== current?.id);
  const past = pastTrips(trips);
  const loading = status === 'loading' && !trips.length;
  const loadFailed = !workspace && (status === 'offline' || status === 'error');

  useFocusEffect(React.useCallback(() => {
    const landing = takePendingLanding();
    if (landing) setTimeout(() => router.push(landing as never), 350);
  }, [router]));

  if (loading) return <Screen bar="tabs" gap={22}>
    <View accessibilityLabel="Loading your trips" style={{ height: 320, borderRadius: radii.hero, backgroundColor: colors.card, opacity: 0.6 }} />
    <View style={{ height: 120, borderRadius: radii.card, backgroundColor: colors.card, opacity: 0.4 }} />
  </Screen>;
  // The ideas are part of the app, so they still work offline.
  if (loadFailed) return <Screen bar="tabs" gap={22}>
    <LoadFailedHero />
    <Section title="Ideas to explore" action="See all" onAction={() => router.push('/discover' as never)}>
      <HScroll gap={12}>{ideasFor(prefs).slice(0, 4).map((idea) => <IdeaCard key={idea.id} idea={idea} />)}</HScroll>
    </Section>
  </Screen>;

  return <Screen bar="tabs" gap={22}>
    <SyncBanner />
    {current ? <TripOverview trip={current} extras={extras.get(current.id)} /> : <FirstTripHero name={prefs.firstName} last={past[0]} />}
    {current && phase === 'active' && extras.get(current.id).kind !== 'trek' ? <TodaySection trip={current} extras={extras.get(current.id)} /> : null}
    {others.length ? <Section title="Up next">
      <HScroll gap={12}>{others.map((t) => <TripLink key={t.id} trip={t} label={`Open ${t.name}`}>
        <PhotoCard ill={coverOf(t)} image={<CoverImage trip={t} extras={extras.get(t.id)} />} label={compactRange(t.start, t.end)} title={t.name} meta={`${KIND_LABEL[extras.get(t.id).kind]} · ${countdownLabel(statusOf(t))}`} />
      </TripLink>)}</HScroll>
    </Section> : null}
    {!current ? <OtherWaysToStart /> : null}
    {past.length ? <Section title="Past trips">
      <Stack>{past.slice(0, 5).map((t) => <TripLink key={t.id} trip={t} path="/recap" label={`Recap of ${t.name}`}>
        <MediaRow ill={coverOf(t)} eyebrow={compactRange(t.start, t.end)} tint={KIND_TINT[extras.get(t.id).kind]} title={t.name} meta={`Recap · ${plural(statusOf(t).totalDays, 'day')} · ${t.destination}`} />
      </TripLink>)}</Stack>
    </Section> : null}
    {!others.length ? <Section title={trips.length ? 'Ideas for your next trip' : 'Ideas to start from'} action="See all" onAction={() => router.push('/discover' as never)}>
      <HScroll gap={12}>{ideasFor(prefs).slice(0, 4).map((idea) => <IdeaCard key={idea.id} idea={idea} />)}</HScroll>
    </Section> : null}
  </Screen>;
}

/* ------------------------------------------------------------------ Discover */

export function DiscoverScreen() {
  const [filter, setFilter] = useState(0);
  const router = useRouter();
  const kinds = IDEA_FILTERS[filter].kinds;
  const prefs = usePrefs();
  const all = ideasFor(prefs);
  const ideas = kinds ? all.filter((i) => kinds.includes(i.kind)) : all;
  const top = kinds ? ideas : ideas.slice(0, 6);
  const more = kinds ? [] : ideas.slice(6);
  return <Screen bar="tabs">
    <Header big title="Discover" right={<RoundButton icon="search" label="Search places" href="/search" />} />
    <Chips value={filter} onChange={setFilter} items={IDEA_FILTERS.map((f) => ({ label: f.label, icon: f.icon }))} />
    <Swap k={filter} style={{ gap: 16 }}>
    <Section title={kinds ? IDEA_FILTERS[filter].label : 'Ideas for you'}>
      <HScroll gap={12}>{top.map((idea) => <IdeaCard key={idea.id} idea={idea} big />)}</HScroll>
    </Section>
    {more.length ? <Section title="More to explore">
      <Stack>{more.map((idea, i) => <MediaRow key={idea.id} ill={idea.art} eyebrow={idea.label} tint={idea.tint} title={idea.title} meta={idea.meta}
        onPress={() => router.push({ pathname: '/planner', params: { prompt: idea.prompt, destination: idea.destination, kind: idea.kind } } as never)} />)}</Stack>
    </Section> : null}
    </Swap>
    <T v="small" style={{ paddingHorizontal: 4 }}>Tap an idea for a day-by-day outline you can change before you save it. Costs are a rough guide per person, before getting there.</T>
  </Screen>;
}

export function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => { void suggest(q).then((r) => { if (active) { setResults(r); setSearching(false); } }); }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  const ideaMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q.length < 2 ? [] : [...IDEAS_INDIA, ...IDEAS].filter((i) => `${i.title} ${i.destination} ${i.label} ${i.kind}`.toLowerCase().includes(q));
  }, [query]);
  return <Screen>
    <RowView gap={12} style={{ minHeight: 56, paddingHorizontal: 16, borderRadius: radii.field, backgroundColor: colors.card, boxShadow: shadows.lift }}>
      <Icon name="search" size={20} />
      <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Where to?" placeholderTextColor={colors.placeholder} returnKeyType="search"
        accessibilityLabel="Search places" maxFontSizeMultiplier={1.6} autoCorrect={false} style={[inputText, singleLine, { fontSize: 16 }]} />
      <PressScale accessibilityRole="button" onPress={() => router.back()} hitSlop={8}><T v="small" style={{ fontFamily: fonts.medium, fontSize: 14 }}>Cancel</T></PressScale>
    </RowView>
    {ideaMatches.length ? <Section title="Trip ideas">
      <Stack>{ideaMatches.map((idea, i) => <MediaRow key={idea.id} ill={idea.art} eyebrow={idea.label} tint={idea.tint} title={idea.title} meta={idea.meta}
        onPress={() => router.push({ pathname: '/planner', params: { prompt: idea.prompt, destination: idea.destination, kind: idea.kind } } as never)} />)}</Stack>
    </Section> : null}
    {results.length ? <Section title="Places">
      <Stack>{results.map((p, i) => <MediaRow key={`${p.label}${i}`} ill="compass" eyebrow={p.country || 'Place'} tint="peach" title={p.name}
        meta={`Start a trip to ${p.label}`} onPress={() => router.push({ pathname: '/new-trip', params: { destination: p.label } } as never)} />)}</Stack>
    </Section> : null}
    {query.trim().length >= 2 && !searching && !results.length && !ideaMatches.length
      ? <EmptyState art="compass" title="No places found" body="Check the spelling, or start a trip with this name anyway."
        action={<Button label={`Start a trip to “${query.trim()}”`} icon="plus" onPress={() => router.push({ pathname: '/new-trip', params: { destination: query.trim() } } as never)} />} /> : null}
    {query.trim().length < 2 ? <T v="small" style={{ paddingHorizontal: 4 }}>Search any city, region or country to start a trip, or a word like “trek” or “beach” for ideas.</T> : null}
  </Screen>;
}
