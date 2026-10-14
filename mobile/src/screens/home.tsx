import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { useRouter } from '../core/nav';
import { takePendingLanding } from '../core/landing';
import { usePrefs, useSelection, useTrips } from '../core/state';
import { useExtras, type Trip, type TripExtras } from '../data';
import { compactRange, dateRange, money, planTime, plural, shortDay, todayISO } from '../domain/format';
import { IDEA_FILTERS, IDEAS, type Idea } from '../domain/ideas';
import { budgetOf, CATEGORY, countdownLabel, coverOf, featuredTrip, KIND_LABEL, KIND_TINT, pastTrips, planArt, plansOn, statusOf, todos, upcomingTrips } from '../domain/trips';
import {
  Banner, Button, Chips, colors, EmptyState, fonts, Header, Hero, HeroRule, HeroText, HScroll, Icon, Illustration, MediaRow, Pill,
  PhotoCard, PressScale, radii, RoundButton, RowView, Screen, Section, shadows, Stack, T, type IllustrationName, type Tint,
  inputText, singleLine,
} from '../loom';
import { useRates } from '../services/currency';
import { isFlightPlan } from '../services/flights';
import { suggest, type Place } from '../services/places';

/** Opens a trip in the right section: treks get the adventure tabs. */
export function useOpenTrip() {
  const router = useRouter();
  const { select } = useSelection();
  const extras = useExtras();
  return (trip: Trip, path = '') => {
    select(trip.id);
    const adventure = extras.get(trip.id).kind === 'trek';
    router.push((path || (adventure ? '/adventure' : '/trip')) as never);
  };
}

/**
 * Opens a trip from a card with the iOS zoom transition: the card grows into the trip screen (and shrinks back on
 * the way out). The card's own buttons are just visuals here; the whole card is the target.
 */
function TripLink({ trip, path, label, radius = radii.card, children }: { trip: Trip; path?: string; label: string; radius?: number; children: React.ReactNode }) {
  const { select } = useSelection();
  const extras = useExtras();
  const href = path || (extras.get(trip.id).kind === 'trek' ? '/adventure' : '/trip');
  return <Link href={href as never} asChild onPress={() => select(trip.id)}>
    <PressScale accessibilityRole="button" accessibilityLabel={label} scaleTo={0.98}>
      {/* iOS zooms a snapshot of this view: it must have the card's own rounded corners, or the transparent
          corners of a square box show as black while the card grows. */}
      <Link.AppleZoom><View pointerEvents="none" style={{ borderRadius: radius, overflow: 'hidden', borderCurve: 'continuous' }}>{children}</View></Link.AppleZoom>
    </PressScale>
  </Link>;
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
  const greeting = last ? 'Welcome back' : 'Welcome';
  return <Hero gap={16}>
    <RowView align="flex-start" style={{ justifyContent: 'space-between' }}>
      <View style={{ gap: 4, flex: 1 }}>
        <HeroText faint style={{ fontSize: 14 }}>{name ? `${greeting}, ${name}` : greeting}</HeroText>
        <HeroText v="display" style={{ fontSize: 28, lineHeight: 32, letterSpacing: -0.5 }}>{last ? 'Where next?' : 'Where to first?'}</HeroText>
        <HeroText faint style={{ fontSize: 14 }}>{last
          ? `Your last trip was ${last.name}. Plan the next one, or start from an idea below.`
          : 'Add a trip you’ve booked, or describe one and get a first draft of days and packing.'}</HeroText>
      </View>
      <Illustration name="compass" width={64} height={64} radius={12} />
    </RowView>
    <Button label="Plan with AI" icon="sparkle" kind="white" height={50} onPress={() => router.push('/planner' as never)} />
    <Button label="Add a trip I’ve booked" icon="plus" kind="dark" height={50} onPress={() => router.push('/new-trip' as never)} />
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

function TripHero({ trip, extras }: { trip: Trip; extras: TripExtras }) {
  const prefs = usePrefs();
  const open = useOpenTrip();
  const { workspace } = useTrips();
  const rates = useRates(trip.currency);
  const status = statusOf(trip);
  const left = workspace ? todos(workspace, trip, extras) : [];
  const budget = budgetOf(trip, extras, rates, trip.currency);
  const big = status.phase === 'upcoming' ? String(status.daysUntil) : status.phase === 'active' ? String(status.dayNumber) : '✓';
  const bigLabel = status.phase === 'upcoming' ? (status.daysUntil === 1 ? 'day to go' : 'days to go') : status.phase === 'active' ? `of ${status.totalDays} days` : 'trip finished';
  const greeting = status.phase === 'active' ? 'Enjoy it' : 'Welcome back';
  return <Hero gap={16}>
    <RowView align="flex-start" style={{ justifyContent: 'space-between' }}>
      <View style={{ gap: 4, flex: 1 }}>
        <HeroText faint style={{ fontSize: 14 }}>{prefs.firstName ? `${greeting}, ${prefs.firstName}` : greeting}</HeroText>
        <HeroText v="display" lines={2} style={{ fontSize: 28, lineHeight: 32, letterSpacing: -0.5 }}>{trip.name}</HeroText>
        <HeroText faint style={{ fontSize: 14 }}>{dateRange(trip.start, trip.end)} · {plural(status.totalDays, 'day')}</HeroText>
      </View>
      <Illustration name={coverOf(trip)} width={64} height={64} radius={12} />
    </RowView>
    <RowView gap={8} align="baseline">
      <HeroText style={{ fontFamily: fonts.semibold, fontSize: 56, lineHeight: 60, letterSpacing: -2 }}>{big}</HeroText>
      <HeroText faint style={{ fontSize: 15 }}>{bigLabel}</HeroText>
    </RowView>
    <HeroRule />
    <Stack gap={10}>
      <RowView style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <HeroText style={{ fontSize: 14 }}>{left.length ? `${plural(left.length, 'thing')} left to do` : 'All set'}</HeroText>
        <HeroText faint style={{ fontSize: 14, flexShrink: 1, textAlign: 'right' }}>{left[0] ?? 'Nothing left on the list'}</HeroText>
      </RowView>
      <RowView style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <HeroText style={{ fontSize: 14 }}>Budget</HeroText>
        <HeroText faint style={{ fontSize: 14, flexShrink: 1, textAlign: 'right' }}>
          {budget.limit ? `${money(budget.limit, trip.currency)} · ${budget.planned ? `${money(budget.planned, trip.currency)} planned` : 'nothing spent'}`
            : budget.planned ? `${money(budget.planned, trip.currency)} planned` : 'No budget set'}
        </HeroText>
      </RowView>
    </Stack>
    <Button label={status.phase === 'past' ? 'See the recap' : 'Open trip'} icon="chev" kind="white" height={50} />
  </Hero>;
}

function TripHeroLink({ trip, extras }: { trip: Trip; extras: TripExtras }) {
  const past = statusOf(trip).phase === 'past';
  return <TripLink trip={trip} path={past ? '/recap' : undefined} radius={radii.hero} label={`${past ? 'Recap of' : 'Open'} ${trip.name}`}><TripHero trip={trip} extras={extras} /></TripLink>;
}

/** During a trip: what's left today, with the next plan marked. A flight opens its live status; a trek shows today's stage. */
function TodaySection({ trip, extras }: { trip: Trip; extras: TripExtras }) {
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
        title={a.title} meta={flight ? 'Live flight status' : a.place || label} onPress={() => show(a.id, flight)} />;
    })}</Stack>
      : all.length
        ? <MediaRow ill="compass" tint="mint" eyebrow={shortDay(today)} title="All done for today" meta={`${plural(all.length, 'plan')} done · check in where you are`}
          onPress={() => open(trip, '/trip/map')} />
        : <MediaRow ill="compass" tint="mint" eyebrow={shortDay(today)} title="Nothing planned today" meta="Add a plan, or keep the day free" onPress={addPlan} />}
  </Section>;
}

/** Where each to-do is finished, so its row opens the right place. */
function todoDetail(todo: string): { ill: IllustrationName; tint: Tint; meta: string; path: string } {
  if (/stay/i.test(todo)) return { ill: 'stay', tint: 'lavender', meta: 'Add the hotel or flat for each night', path: '/trip/days' };
  if (/plan/i.test(todo)) return { ill: 'compass', tint: 'mint', meta: 'Add plans, or draft them with AI', path: '/trip/days' };
  if (/pack/i.test(todo)) return { ill: 'suitcase', tint: 'peach', meta: 'Tick off items, or get suggestions', path: '/trip/packing' };
  return { ill: 'ticket', tint: 'rose', meta: 'Keep tickets offline in one place', path: '/trip/documents' };
}

/** Before a trip: the open to-dos, so the next step is one tap away. */
function BeforeYouGo({ trip, extras }: { trip: Trip; extras: TripExtras }) {
  const open = useOpenTrip();
  const { workspace } = useTrips();
  const left = workspace ? todos(workspace, trip, extras) : [];
  if (!left.length) return null;
  return <Section title="Before you go">
    <Stack>{left.slice(0, 3).map((t, i) => { const d = todoDetail(t); return <MediaRow key={t} ill={d.ill} tint={d.tint} eyebrow={trip.name} title={t} meta={d.meta}
      onPress={() => open(trip, d.path)} />; })}</Stack>
  </Section>;
}

/** Ways in besides planning from scratch: an invite from a friend, or a booking confirmation. */
function OtherWaysToStart() {
  return <Section title="Other ways to start">
    <Stack>
      <MediaRow ill="passport" tint="lavender" eyebrow="Invited?" title="Join a friend’s trip" meta="Paste the invite link or code they sent" href="/join-trip" />
      <MediaRow ill="receipt" tint="peach" eyebrow="Already booked?" title="Import a booking" meta="Paste a flight or hotel confirmation" href="/import-bookings" />
    </Stack>
  </Section>;
}

function IdeaCard({ idea, big }: { idea: Idea; big?: boolean }) {
  const router = useRouter();
  return <PhotoCard ill={idea.art} label={idea.label} title={idea.title} meta={idea.meta} width={big ? 250 : 236} height={big ? 300 : 200}
    onPress={() => router.push({ pathname: '/planner', params: { prompt: idea.prompt, destination: idea.destination, kind: idea.kind } } as never)} />;
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
      <HScroll gap={12}>{IDEAS.slice(0, 4).map((idea) => <IdeaCard key={idea.id} idea={idea} />)}</HScroll>
    </Section>
  </Screen>;

  return <Screen bar="tabs" gap={22}>
    <SyncBanner />
    {current ? <TripHeroLink trip={current} extras={extras.get(current.id)} /> : <FirstTripHero name={prefs.firstName} last={past[0]} />}
    {current ? <Section title="Quick actions">
      <HScroll>
        {extras.get(current.id).kind === 'trek' ? <>
          <Pill label="Climb" icon="activity" onPress={() => open(current, '/adventure/climb')} />
          <Pill label="Gear" icon="trips" onPress={() => open(current, '/adventure/gear')} />
          <Pill label="Prepare" icon="flag" onPress={() => open(current, '/adventure/prepare')} />
          <Pill label="Safety" icon="shield" onPress={() => open(current, '/adventure/safety')} />
        </> : <>
          <Pill label="Packing" icon="check" onPress={() => open(current, '/trip/packing')} />
          <Pill label="Budget" icon="card" onPress={() => open(current, '/trip/budget')} />
          <Pill label="Map" icon="map" onPress={() => open(current, '/trip/map')} />
          <Pill label="Documents" icon="doc" onPress={() => open(current, '/trip/documents')} />
          <Pill label="Essentials" icon="globe" onPress={() => { select(current.id); router.push('/essentials' as never); }} />
        </>}
        <Pill label="New trip" icon="plus" href="/new-trip" />
        <Pill label="AI plan" icon="sparkle" href="/planner" />
      </HScroll>
    </Section> : null}
    {current && phase === 'active' ? <TodaySection trip={current} extras={extras.get(current.id)} /> : null}
    {current && phase === 'upcoming' ? <BeforeYouGo trip={current} extras={extras.get(current.id)} /> : null}
    {others.length ? <Section title="Up next">
      <HScroll gap={12}>{others.map((t) => <TripLink key={t.id} trip={t} label={`Open ${t.name}`}>
        <PhotoCard ill={coverOf(t)} label={compactRange(t.start, t.end)} title={t.name} meta={`${KIND_LABEL[extras.get(t.id).kind]} · ${countdownLabel(statusOf(t))}`} />
      </TripLink>)}</HScroll>
    </Section> : null}
    {!current ? <OtherWaysToStart /> : null}
    {past.length ? <Section title="Past trips">
      <Stack>{past.slice(0, 5).map((t) => <TripLink key={t.id} trip={t} path="/recap" label={`Recap of ${t.name}`}>
        <MediaRow ill={coverOf(t)} eyebrow={compactRange(t.start, t.end)} tint={KIND_TINT[extras.get(t.id).kind]} title={t.name} meta={`Recap · ${plural(statusOf(t).totalDays, 'day')} · ${t.destination}`} />
      </TripLink>)}</Stack>
    </Section> : null}
    {!others.length ? <Section title={trips.length ? 'Ideas for your next trip' : 'Ideas to start from'} action="See all" onAction={() => router.push('/discover' as never)}>
      <HScroll gap={12}>{IDEAS.slice(0, 4).map((idea) => <IdeaCard key={idea.id} idea={idea} />)}</HScroll>
    </Section> : null}
  </Screen>;
}

/* ------------------------------------------------------------------ Discover */

export function DiscoverScreen() {
  const [filter, setFilter] = useState(0);
  const router = useRouter();
  const kinds = IDEA_FILTERS[filter].kinds;
  const ideas = kinds ? IDEAS.filter((i) => kinds.includes(i.kind)) : IDEAS;
  const top = kinds ? ideas : ideas.slice(0, 6);
  const more = kinds ? [] : ideas.slice(6);
  return <Screen bar="tabs">
    <Header big title="Discover" right={<RoundButton icon="search" label="Search places" href="/search" />} />
    <Chips value={filter} onChange={setFilter} items={IDEA_FILTERS.map((f) => ({ label: f.label, icon: f.icon }))} />
    <Section title={kinds ? IDEA_FILTERS[filter].label : 'Ideas for you'}>
      <HScroll gap={12}>{top.map((idea) => <IdeaCard key={idea.id} idea={idea} big />)}</HScroll>
    </Section>
    {more.length ? <Section title="More to explore">
      <Stack>{more.map((idea, i) => <MediaRow key={idea.id} ill={idea.art} eyebrow={idea.label} tint={idea.tint} title={idea.title} meta={idea.meta}
        onPress={() => router.push({ pathname: '/planner', params: { prompt: idea.prompt, destination: idea.destination, kind: idea.kind } } as never)} />)}</Stack>
    </Section> : null}
    <T v="small" style={{ paddingHorizontal: 4 }}>Tap an idea to draft it with AI, then change anything before you save it.</T>
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
    return q.length < 2 ? [] : IDEAS.filter((i) => `${i.title} ${i.destination} ${i.label} ${i.kind}`.toLowerCase().includes(q));
  }, [query]);
  return <Screen>
    <RowView gap={12} style={{ minHeight: 56, paddingHorizontal: 16, borderRadius: radii.field, backgroundColor: colors.card, boxShadow: shadows.lift }}>
      <Icon name="search" size={20} />
      <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Where to?" placeholderTextColor={colors.placeholder} returnKeyType="search"
        accessibilityLabel="Search places" maxFontSizeMultiplier={1.6} autoCorrect={false} style={[inputText, singleLine, { fontSize: 16 }]} />
      <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}><T v="small" style={{ fontFamily: fonts.semibold, fontSize: 14 }}>Cancel</T></Pressable>
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
