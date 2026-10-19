import React, { useEffect, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { CoverImage } from '../core/cover';
import { ExpandTarget } from '../core/expand';
import { useLocalSearchParams } from 'expo-router';
import { useRouter } from '../core/nav';
import { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reportError, useCurrentTrip, usePrefs, useTrips } from '../core/state';
import { GEAR_GROUPS, tripDates, uid, type Adventure, type Trip, type TripExtras, type CheckIn, type GearGroup, type Stage } from '../data';
import { altitude, dateRange, distance, longDay, planTime, plural, shortDay, todayISO, weekday, weight } from '../domain/format';
import { statusOf } from '../domain/trips';
import {
  Bars, Button, Card, CheckToggle, Chips, colors, DateField, EmptyState, Field, FieldLabel, fonts, Group, Header, Hero, HeroText, Icon, IconTile, Illustration, Loading,
  MediaRow, Note, Press, Progress, radii, Ring, RoundButton, routeArt, Row, RowView, Screen, Section, Segmented, shadows, Sheet, Stack, T, Tag, tints, Toggle, type IconName,
  SheetActions, Swap, MotionSurface, Selectable,
  useDirty, PressScale,
} from '../loom';
import { requestNotifications } from '../services/notifications';
import { summitForecast, sunrise, type SummitDay } from '../services/outdoors';
import { NoTrip } from './trip';

/* ------------------------------------------------------------------ helpers */

/** A 0–100 score from permits, training, packed gear, an emergency contact and a guide, plus what to do next. */
export function readiness(a: Adventure): { score: number; next: string[] } {
  const ratio = (done: number, total: number) => (total ? done / total : 0);
  const openPermits = a.permits.filter((p) => !p.done).length;
  const openSessions = a.training.filter((t) => !t.done).length;
  const permits = ratio(a.permits.length - openPermits, a.permits.length);
  const training = ratio(a.training.length - openSessions, a.training.length);
  const gear = ratio(a.gear.filter((g) => g.packed).length, a.gear.length);
  const contact = a.emergency.name && a.emergency.phone ? 1 : 0;
  const guide = a.guide.name ? 1 : 0;
  const score = Math.round(permits * 30 + training * 30 + gear * 25 + contact * 10 + guide * 5);
  const next: string[] = [];
  if (!a.permits.length) next.push('Add your permits'); else if (openPermits) next.push(`${plural(openPermits, 'permit')} to sort`);
  if (!a.training.length) next.push('Plan training sessions'); else if (openSessions) next.push(`${plural(openSessions, 'session')} of training left`);
  if (!contact) next.push('Add an emergency contact');
  const toBuy = a.gear.filter((g) => g.missing).length;
  if (toBuy) next.push(`${plural(toBuy, 'gear item')} to buy`);
  return { score, next };
}

const GROUP_LABEL: Record<GearGroup, string> = { sleep: 'Sleep', layers: 'Layers', safety: 'Safety', kit: 'Kit', other: 'Other' };
const GROUP_ICON: Record<GearGroup, IconName> = { sleep: 'moon', layers: 'wardrobe', safety: 'heart', kit: 'packing', other: 'more' };

/** The stage for a date: that day's, else the next one, else the last. */
export function stageFor(stages: Stage[], date: string): Stage | null {
  const sorted = [...stages].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.find((s) => s.date === date) ?? sorted.find((s) => s.date > date) ?? sorted[sorted.length - 1] ?? null;
}

const toNumber = (v: string, max: number) => Math.min(max, Math.max(0, Number(v.replace(',', '.')) || 0));
const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

function useAdventureTrip() {
  const current = useCurrentTrip();
  const { status } = useTrips();
  return { current, fallback: status === 'loading' ? <Loading /> : <NoTrip /> };
}

/* ------------------------------------------------------------------ Overview */

/**
 * Where each stage's camp sits on the drawn trail, 0 (trailhead) to 1 (summit): by altitude when the stages have
 * heights, otherwise evenly with the summit left for the last day.
 */
function stageHeights(stages: { startAltitude: number; endAltitude: number }[], summit?: number): number[] {
  const ends = stages.map((s) => s.endAltitude);
  const base = Math.min(...stages.map((s) => s.startAltitude || s.endAltitude || 0));
  const top = summit || 0;
  // Altitudes only place camps against a known summit; without one the highest camp isn't the top.
  if (stages.length && top > 0 && ends.every((e) => e > 0) && top > base) return ends.map((e) => Math.max(0.05, Math.min(1, (e - base) / (top - base))));
  return stages.map((_, i) => (i + 1) / Math.max(stages.length + 1, 2));
}

export function AdventureHeader() {
  return <Header title="Your trip" right={<RoundButton icon="edit" label="Summit and safety details" href="/safety-details" />} />;
}

/** The trek's main card (summit cover, name, readiness). Also drawn by the shared transition from Home. */
export function AdventureCard({ trip, extras }: { trip: Trip; extras: TripExtras }) {
  const prefs = usePrefs();
  const router = useRouter();
  const a = extras.adventure;
  const st = statusOf(trip);
  const r = readiness(a);
  const stages = [...a.stages].sort((x, y) => x.date.localeCompare(y.date));
  const totalKm = stages.reduce((s, x) => s + x.distanceKm, 0);
  const facts = [a.summitAltitude ? altitude(a.summitAltitude, prefs.unit) : '', totalKm ? distance(totalKm, prefs.unit) : '', stages.length ? plural(stages.length, 'stage') : 'No stages yet'].filter(Boolean).join(' · ');
  return <View style={{ backgroundColor: colors.card, borderRadius: radii.hero, overflow: 'hidden', boxShadow: shadows.lift }}>
    <View style={{ height: 190 }}>
      <CoverImage trip={trip} extras={extras} art="summit" />
      <View style={{ position: 'absolute', top: 12, right: 12 }}><RoundButton icon="camera" label="Change cover" href="/edit-trip" size={40} /></View>
      <View style={{ position: 'absolute', left: 16, bottom: 12 }}><Tag text={`Trek · ${plural(st.totalDays, 'day')}`} tint="mint" /></View>
    </View>
    <View style={{ padding: 16, paddingTop: 12, gap: 12 }}>
      <T v="display" style={{ lineHeight: 34 }}>{trip.name}</T>
      <RowView gap={16} align="flex-start">
        <Stack gap={6} style={{ flex: 1 }}>
          <RowView align="flex-start"><Icon name="calendar" size={18} color={colors.stone} /><T v="body" style={{ flex: 1 }}>{dateRange(trip.start, trip.end)}</T></RowView>
          <RowView align="flex-start"><Icon name="mountain" size={18} color={colors.stone} /><T v="body" style={{ flex: 1 }}>{facts}</T></RowView>
        </Stack>
        <PressScale accessibilityRole="button" accessibilityLabel={`Readiness ${r.score} of 100`} onPress={() => router.push('/adventure/prepare' as never)} style={{ alignItems: 'center', gap: 2 }}>
          <Ring pct={r.score} color={colors.ink} track={colors.track}><T v="title" style={{ fontSize: 18 }}>{r.score}</T></Ring>
          <T v="meta">readiness</T>
        </PressScale>
      </RowView>
      <RowView gap={8}>
        <Button label="Route" icon="map" full={false} height={48} href="/trail-map" />
        <RoundButton icon="share" label="Share trip" href="/invite" />
        <RoundButton icon="more" label="Trip options" href="/trip-actions" />
      </RowView>
    </View>
  </View>;
}

export function AdventureScreen() {
  const { current, fallback } = useAdventureTrip();
  const prefs = usePrefs();
  const router = useRouter();
  if (!current) return fallback;
  const { trip, extras } = current;
  const a = extras.adventure;
  const stages = [...a.stages].sort((x, y) => x.date.localeCompare(y.date));
  return <Screen bar="tabs">
    <AdventureHeader />
    <ExpandTarget id="adventure"><AdventureCard trip={trip} extras={extras} /></ExpandTarget>
    <Press href="/adventure/safety" label="Safety" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: radii.card, boxShadow: shadows.rest }}>
      <IconTile icon="shield" tint={a.emergency.phone ? 'mint' : 'rose'} />
      <View style={{ flex: 1, gap: 2 }}><T v="row" style={{ fontSize: 15 }}>Safety</T><T v="meta">{a.emergency.phone ? `Emergency contact: ${a.emergency.name || a.emergency.phone}` : 'Add an emergency contact before you go'}</T></View>
      <Icon name="chev" size={18} color={colors.stone} />
    </Press>
    <Section title="Stages" action="Add stage" onAction={() => router.push('/add-stage' as never)}>
      {stages.length ? <Stack>{stages.map((s, i) => <MediaRow key={s.id} ill={i === stages.length - 1 ? 'summit' : i % 2 ? 'peaks' : 'tent'}
        eyebrow={`Day ${tripDates(trip).indexOf(s.date) + 1 || i + 1} · ${shortDay(s.date)}${s.done ? ' · walked' : ''}`} tint={s.done ? 'lavender' : 'mint'} title={s.title || [s.from, s.to].filter(Boolean).join(' → ')}
        meta={[s.startAltitude || s.endAltitude ? `${altitude(s.startAltitude, prefs.unit)} → ${altitude(s.endAltitude, prefs.unit)}` : '', s.distanceKm ? distance(s.distanceKm, prefs.unit) : '', s.hours ? `${s.hours} h` : ''].filter(Boolean).join(' · ') || 'Add altitude and distance'}
        onPress={() => router.push({ pathname: '/add-stage', params: { id: s.id } } as never)} />)}</Stack>
        : <EmptyState art="tent" title="No stages yet" body="Add each day’s walk: where you start, where you sleep, the climb and the distance." action={<Button label="Add the first stage" icon="plus" href="/add-stage" />} />}
    </Section>
    <Button label="Plans, packing and budget" icon="chev" kind="white" href="/trip" />
  </Screen>;
}

/* ------------------------------------------------------------------ Prepare */

export function PrepareScreen() {
  const { current, fallback } = useAdventureTrip();
  const router = useRouter();
  const [newPermit, setNewPermit] = useState('');
  const [newSession, setNewSession] = useState('');
  if (!current) return fallback;
  const { trip, extras, editExtras } = current;
  const a = extras.adventure;
  const r = readiness(a);
  const st = statusOf(trip);
  const addPermit = () => {
    if (!newPermit.trim()) return;
    editExtras((d) => { d.adventure.permits.push({ id: uid(), name: newPermit.trim().slice(0, 200), reference: '', done: false }); });
    setNewPermit('');
  };
  const addSession = () => {
    if (!newSession.trim()) return;
    editExtras((d) => { d.adventure.training.push({ id: uid(), title: newSession.trim().slice(0, 200), date: todayISO(), done: false }); });
    setNewSession('');
  };
  const confirmRemove = (title: string, remove: () => void) => Alert.alert(title, 'Remove it from this trip?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: remove }]);
  const toBuy = a.gear.filter((g) => g.missing).length;
  return <Screen bar="tabs">
    <Header title="Prepare" />
    <Hero padding={18}>
      <RowView gap={16}>
        <Ring pct={r.score} size={72}><HeroText v="title" style={{ fontSize: 22 }}>{r.score}</HeroText></Ring>
        <View style={{ flex: 1, gap: 4 }}>
          <HeroText v="title" style={{ fontSize: 22, letterSpacing: -0.4 }}>Readiness {r.score}</HeroText>
          <HeroText v="small">{r.next.length ? `${r.next.slice(0, 2).join(' · ')}.` : 'Everything is in place.'}{st.phase === 'upcoming' ? ` ${plural(st.daysUntil, 'day')} to go.` : ''}</HeroText>
        </View>
      </RowView>
    </Hero>
    <Section title="Permits and paperwork">
      <Group>
        {a.permits.map((p) => <Row key={p.id} icon="doc" tint={p.done ? 'mint' : undefined} title={p.name} meta={p.done ? 'Sorted' : 'To sort'}
          onPress={() => confirmRemove(p.name, () => editExtras((d) => { d.adventure.permits = d.adventure.permits.filter((x) => x.id !== p.id); }))}
          trailing={<CheckToggle checked={p.done} label={`${p.name} sorted`} onChange={(on) => editExtras((d) => { const x = d.adventure.permits.find((y) => y.id === p.id); if (x) x.done = on; })} />} />)}
        <Row icon="profile" tint={a.guide.name ? 'mint' : undefined} title="Guide" meta={a.guide.name ? [a.guide.name, a.guide.phone].filter(Boolean).join(' · ') : 'Add your guide or operator'} href="/safety-details" />
      </Group>
      <Field label="Add a permit or document" value={newPermit} onChangeText={setNewPermit} icon="plus" placeholder="Park permit, visa, insurance…" maxLength={200} returnKeyType="done" onSubmitEditing={addPermit}
        trailing={newPermit.trim() ? <RoundButton icon="check" size={36} label="Add permit" onPress={addPermit} /> : undefined} />
    </Section>
    <Section title="Training">
      {a.training.length ? <Group>{[...a.training].sort((x, y) => x.date.localeCompare(y.date)).map((s) => <Row key={s.id} icon="walk" tint={s.done ? 'mint' : undefined} title={s.title} meta={`${shortDay(s.date)}${s.done ? ' · done' : ''}`}
        onPress={() => confirmRemove(s.title, () => editExtras((d) => { d.adventure.training = d.adventure.training.filter((x) => x.id !== s.id); }))}
        trailing={<CheckToggle checked={s.done} label={`${s.title} done`} onChange={(on) => editExtras((d) => { const x = d.adventure.training.find((y) => y.id === s.id); if (x) x.done = on; })} />} />)}</Group>
        : <Note>Long hikes with a loaded pack are the best preparation. Add the sessions you plan.</Note>}
      <Field label="Add a session" value={newSession} onChangeText={setNewSession} icon="plus" placeholder="Long hike, 18 km, 900 m up" maxLength={200} returnKeyType="done" onSubmitEditing={addSession}
        trailing={newSession.trim() ? <RoundButton icon="check" size={36} label="Add session" onPress={addSession} /> : undefined} />
    </Section>
    <Section title="Gear">
      <MediaRow ill="suitcase" eyebrow="Gear" tint="mint" title={a.gear.length ? `${a.gear.filter((g) => g.packed).length} of ${a.gear.length} packed` : 'No gear list yet'}
        meta={toBuy ? `${toBuy} to buy` : 'Porter bag and day pack'} onPress={() => router.push('/adventure/gear' as never)} />
    </Section>
  </Screen>;
}

/* ------------------------------------------------------------------ Climb */

export function ClimbScreen() {
  const { current, fallback } = useAdventureTrip();
  const prefs = usePrefs();
  const [forecast, setForecast] = useState<SummitDay[] | null | 'loading'>('loading');
  const [rise, setRise] = useState<string | null>(null);
  const a = current?.extras.adventure;
  const summitStage = a ? [...a.stages].sort((x, y) => y.endAltitude - x.endAltitude)[0] : undefined;
  const destination = current?.trip.destination ?? '';
  const summitAltitude = a?.summitAltitude ?? 0;
  const day = summitStage?.date || current?.trip.start || todayISO();
  useEffect(() => {
    if (!destination || !summitAltitude) return;
    let active = true;
    setForecast('loading');
    void summitForecast(destination, summitAltitude).then((f) => { if (active) setForecast(f); });
    void sunrise(destination, day).then((s) => { if (active) setRise(s); });
    return () => { active = false; };
  }, [destination, summitAltitude, day]);
  if (!current || !a) return fallback;
  const stages = [...a.stages].sort((x, y) => x.date.localeCompare(y.date));
  if (!a.summitAltitude) return <Screen bar="tabs"><Header title="Climb" />
    <EmptyState art="summit" title="Set your summit" body="Add the summit’s name and height to see the wind and temperature up there each morning." action={<Button label="Add summit details" icon="mountain" href="/safety-details" />} />
  </Screen>;
  const list = forecast !== 'loading' && forecast ? forecast : [];
  const f = list.find((d) => d.date === summitStage?.date) ?? list.find((d) => d.date >= todayISO());
  const imperial = prefs.unit === 'imperial';
  const wind = (kmh: number) => `${imperial ? Math.round(kmh * 0.621) : kmh} ${imperial ? 'mph' : 'km/h'}`;
  const stat = (icon: IconName, label: string, value: string) => <View style={{ flex: 1, gap: 2, padding: 12, borderRadius: radii.tile, backgroundColor: 'rgba(255,255,255,0.18)' }}>
    <RowView gap={6}><Icon name={icon} size={14} color="#FFFFFF" /><HeroText v="meta">{label}</HeroText></RowView>
    <HeroText v="row" style={{ fontSize: 18 }}>{value}</HeroText>
  </View>;
  const sleeps = stages.slice(0, -1).map((s) => s.endAltitude);
  return <Screen bar="tabs">
    <Header title="Climb" right={<RoundButton icon="edit" label="Edit summit" href="/safety-details" />} />
    <Hero>
      <RowView align="flex-start" style={{ justifyContent: 'space-between' }}>
        <View style={{ gap: 4, flex: 1 }}>
          <HeroText faint style={{ fontSize: 14 }}>Summit{a.summitName ? ` · ${a.summitName}` : ''}</HeroText>
          <HeroText v="hero" style={{ fontSize: 40, lineHeight: 44, letterSpacing: -1.2 }}>{altitude(a.summitAltitude, prefs.unit)}</HeroText>
        </View>
        <Illustration name="summit" width={72} height={72} radius={radii.card} />
      </RowView>
      <RowView gap={10}>
        {stat('wind', 'Wind', f ? wind(f.windKmh) : '–')}
        {stat('thermo', 'Dawn', f?.dawnTemp != null ? `${imperial ? Math.round(f.dawnTemp * 9 / 5 + 32) : f.dawnTemp}°` : '–')}
        {stat('sun', 'Sunrise', rise ?? '–')}
      </RowView>
      <HeroText v="small">{forecast === 'loading' ? 'Loading the forecast at summit height…' : f ? `${f.date === summitStage?.date ? 'Summit day' : shortDay(f.date)}: strongest morning wind at summit height.` : 'The summit forecast appears up to 16 days ahead.'}</HeroText>
    </Hero>
    {list.length ? <Section title="Summit wind, next days">
      <Card>
        <Bars values={list.slice(0, 10).map((d) => d.windKmh)} labels={list.slice(0, 10).map((d) => weekday(d.date).slice(0, 2))} active={list.slice(0, 10).findIndex((d) => d.date === summitStage?.date)} color="#A9B3E6" faded={tints.lavender.bg} height={80} />
        <T v="meta">Under 30 km/h is comfortable. Above 60 km/h most guides wait.</T>
      </Card>
    </Section> : null}
    {stages.length ? <Section title="Altitude profile">
      <Card>
        <Bars values={stages.map((s) => s.endAltitude)} labels={stages.map((_, i) => `D${i + 1}`)} active={stages.findIndex((s) => s.id === summitStage?.id)} color="#A9B3E6" faded={tints.lavender.bg} height={100} />
        <RowView style={{ justifyContent: 'space-between', gap: 12 }} align="flex-start">
          <T v="meta">Highest sleep {sleeps.length ? altitude(Math.max(...sleeps), prefs.unit) : '–'}</T>
          <T v="meta" style={{ flexShrink: 1, textAlign: 'right' }}>Summit {summitStage ? shortDay(summitStage.date) : '–'}</T>
        </RowView>
      </Card>
    </Section> : <Button label="Add stages to see the profile" icon="plus" kind="white" href="/add-stage" />}
    <Note>Climb high, sleep low. Above 3,000 m, try not to sleep more than 300–500 m higher each night.</Note>
  </Screen>;
}

/* ------------------------------------------------------------------ Gear */

export function GearScreen() {
  const { current, fallback } = useAdventureTrip();
  const prefs = usePrefs();
  const router = useRouter();
  const [filter, setFilter] = useState(0);
  if (!current) return fallback;
  const { extras, editExtras } = current;
  const a = extras.adventure;
  const porter = a.gear.filter((g) => g.bag === 'porter').reduce((s, g) => s + g.grams, 0);
  const dayPack = a.gear.filter((g) => g.bag === 'day').reduce((s, g) => s + g.grams, 0);
  const limit = a.porterLimitKg * 1000;
  const pct = limit ? Math.round((porter / limit) * 100) : 0;
  const toBuy = a.gear.filter((g) => g.missing).length;
  const visible = a.gear.filter((g) => [true, g.bag === 'porter', g.bag === 'day', g.missing][filter]);
  return <Screen bar="tabs">
    <Header title="Gear" right={<RoundButton icon="plus" dark label="Add gear" href="/add-gear" />} />
    <Hero padding={18}>
      <RowView gap={16}>
        <Ring pct={Math.min(100, pct)}><HeroText v="row" style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{pct}%</HeroText></Ring>
        <View style={{ flex: 1, gap: 6 }}>
          <HeroText faint style={{ fontSize: 13 }}>Porter bag</HeroText>
          <HeroText v="title" style={{ fontSize: 24, lineHeight: 28, letterSpacing: -0.5 }}>{weight(porter, prefs.unit)} of {weight(limit, prefs.unit)}</HeroText>
          <HeroText v="small" style={{ fontSize: 14 }}>Day pack {weight(dayPack, prefs.unit)}</HeroText>
          <Progress pct={Math.min(100, pct)} color="#FFFFFF" track="rgba(255,255,255,0.35)" />
        </View>
      </RowView>
    </Hero>
    {limit && porter > limit ? <Note>Over the porter limit by {weight(porter - limit, prefs.unit)}. Move something to your day pack or leave it behind.</Note> : null}
    {a.gear.length ? <Chips value={filter} onChange={setFilter} items={[{ label: `All · ${a.gear.length}` }, { label: 'Porter bag' }, { label: 'Day pack' }, { label: `To buy · ${toBuy}` }]} /> : null}
    <Swap k={filter} style={{ gap: 16 }}>
    {GEAR_GROUPS.map((group) => {
      const items = visible.filter((g) => g.group === group);
      return items.length ? <Section key={group} title={GROUP_LABEL[group]}>
        <Group>{items.map((g) => <Row key={g.id} icon={GROUP_ICON[group]} tint={g.missing ? 'rose' : g.packed ? 'mint' : undefined} title={g.name}
          meta={[g.bag === 'porter' ? 'Porter bag' : 'Day pack', g.grams ? weight(g.grams, prefs.unit) : '', g.missing ? 'to buy' : ''].filter(Boolean).join(' · ')}
          onPress={() => router.push({ pathname: '/add-gear', params: { id: g.id } } as never)}
          trailing={<CheckToggle checked={g.packed} label={`${g.name} packed`} onChange={(on) => editExtras((d) => { const x = d.adventure.gear.find((y) => y.id === g.id); if (x) { x.packed = on; if (on) x.missing = false; } })} />} />)}</Group>
      </Section> : null;
    })}
    {!a.gear.length ? <EmptyState art="suitcase" title="No gear yet" body="List what goes in the porter bag and what you carry, with weights, so you stay under the limit." action={<Button label="Add gear" icon="plus" href="/add-gear" />} />
      : !visible.length ? <Note center>Nothing here.</Note> : null}
    </Swap>
  </Screen>;
}

export function AddGearSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const existing = current?.extras.adventure.gear.find((g) => g.id === params.id);
  const [name, setName] = useState(existing?.name ?? '');
  const [group, setGroup] = useState<GearGroup>(existing?.group ?? 'layers');
  const [bag, setBag] = useState<'porter' | 'day'>(existing?.bag ?? 'porter');
  const [grams, setGrams] = useState(existing?.grams ? String(existing.grams) : '');
  const [missing, setMissing] = useState(existing?.missing ?? false);
  const [error, setError] = useState('');
  const dirty = useDirty([name, group, bag, grams, missing]);
  if (!current) return <Sheet title="Add gear"><EmptyState title="No trip open" body="Open a trip first." /></Sheet>;
  const save = () => {
    if (!name.trim()) { setError('Name the item.'); return; }
    const value = { id: existing?.id ?? uid(), name: name.trim().slice(0, 200), group, bag, grams: Math.round(toNumber(grams, 50000)), packed: existing?.packed ?? false, missing };
    current.editExtras((d) => { const i = d.adventure.gear.findIndex((x) => x.id === value.id); if (i >= 0) d.adventure.gear[i] = value; else d.adventure.gear.push(value); });
    router.back();
  };
  const remove = () => { if (!existing) return; current.editExtras((d) => { d.adventure.gear = d.adventure.gear.filter((x) => x.id !== existing.id); }); router.back(); };
  return <Sheet title={existing ? 'Edit gear' : 'Add gear'} dirty={dirty} footer={<Stack gap={10}><Button label="Save" icon="check" onPress={save} />{existing ? <Button label="Remove" icon="trash" kind="white" onPress={remove} /> : null}</Stack>}>
    <Field label="Item" value={name} onChangeText={(t) => { setName(t); setError(''); }} icon="trips" placeholder="Down jacket" maxLength={200} error={error} autoFocus={!existing} />
    <Stack gap={8}><FieldLabel>Group</FieldLabel><Chips value={GEAR_GROUPS.indexOf(group)} onChange={(i) => setGroup(GEAR_GROUPS[i])} items={GEAR_GROUPS.map((g) => ({ label: GROUP_LABEL[g], icon: GROUP_ICON[g] }))} /></Stack>
    <Stack gap={8}><FieldLabel>Carried in</FieldLabel><Segmented options={['Porter bag', 'Day pack']} value={bag === 'porter' ? 'Porter bag' : 'Day pack'} onChange={(v) => setBag(v === 'Porter bag' ? 'porter' : 'day')} /></Stack>
    <Field label="Weight in grams" value={grams} onChangeText={setGrams} icon="packing" kind="count" placeholder="620" />
    <Group><Row icon="card" title="Still to buy or borrow" trailing={<Toggle value={missing} onChange={setMissing} label="Still to buy or borrow" />} /></Group>
  </Sheet>;
}

/* ------------------------------------------------------------------ Stages */

export function AddStageSheet() {
  const current = useCurrentTrip();
  const prefs = usePrefs();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const stages = current?.extras.adventure.stages ?? [];
  const existing = stages.find((s) => s.id === params.id);
  const last = [...stages].sort((a, b) => b.date.localeCompare(a.date))[0];
  const dates = current ? tripDates(current.trip) : [];
  const nextDate = last ? (dates[dates.indexOf(last.date) + 1] ?? last.date) : (dates[0] ?? todayISO());
  const ft = prefs.unit === 'imperial';
  const shown = (metres: number) => (metres ? String(Math.round(ft ? metres * 3.28084 : metres)) : '');
  const [date, setDate] = useState(existing?.date ?? nextDate);
  const [from, setFrom] = useState(existing?.from ?? last?.to ?? '');
  const [to, setTo] = useState(existing?.to ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [startAlt, setStartAlt] = useState(shown(existing ? existing.startAltitude : last?.endAltitude ?? 0));
  const [endAlt, setEndAlt] = useState(shown(existing?.endAltitude ?? 0));
  const [km, setKm] = useState(existing?.distanceKm ? String(Math.round((ft ? existing.distanceKm * 0.621371 : existing.distanceKm) * 10) / 10) : '');
  const [hours, setHours] = useState(existing?.hours ? String(existing.hours) : '');
  const [done, setDone] = useState(existing?.done ?? false);
  const [error, setError] = useState('');
  const dirty = useDirty([date, from, to, title, startAlt, endAlt, km, hours, done]);
  if (!current) return <Sheet title="Add stage"><EmptyState title="No trip open" body="Open a trip first." /></Sheet>;
  const save = () => {
    if (!to.trim() && !title.trim()) { setError('Where does this stage end?'); return; }
    const metres = (v: string) => Math.round(toNumber(v, ft ? 29600 : 9000) / (ft ? 3.28084 : 1));
    const value: Stage = {
      id: existing?.id ?? uid(), date, from: from.trim().slice(0, 120), to: to.trim().slice(0, 120), title: title.trim().slice(0, 200),
      startAltitude: metres(startAlt), endAltitude: metres(endAlt), distanceKm: Math.round((toNumber(km, 500) / (ft ? 0.621371 : 1)) * 10) / 10, hours: toNumber(hours, 48), done,
    };
    current.editExtras((d) => { const i = d.adventure.stages.findIndex((x) => x.id === value.id); if (i >= 0) d.adventure.stages[i] = value; else d.adventure.stages.push(value); });
    router.back();
  };
  const remove = () => { if (!existing) return; current.editExtras((d) => { d.adventure.stages = d.adventure.stages.filter((x) => x.id !== existing.id); }); router.back(); };
  return <Sheet title={existing ? 'Edit stage' : 'Add stage'} dirty={dirty} footer={<SheetActions primary={<Button label="Save" icon="check" onPress={save} />} actions={[!!existing && { icon: 'trash', label: 'Remove stage', onPress: remove, danger: true }]} />}>
    <DateField label="Day" value={date} onChange={setDate} min={current.trip.start} max={current.trip.end} />
    <Field label="From" value={from} onChangeText={setFrom} icon="pin" placeholder="Machame Gate" maxLength={120} />
    <Field label="To" value={to} onChangeText={(t) => { setTo(t); setError(''); }} icon="flag" placeholder="Machame Camp" maxLength={120} error={error} />
    <Field label="Name (optional)" value={title} onChangeText={setTitle} icon="edit" placeholder="Into the rainforest" maxLength={200} />
    <RowView align="flex-start">
      <Field flex label={`Start, ${ft ? 'ft' : 'm'}`} value={startAlt} onChangeText={setStartAlt} kind="count" icon="mountain" placeholder={ft ? '5,900' : '1,800'} />
      <Field flex label={`End, ${ft ? 'ft' : 'm'}`} value={endAlt} onChangeText={setEndAlt} kind="count" icon="mountain" placeholder={ft ? '9,800' : '3,000'} />
    </RowView>
    <RowView align="flex-start">
      <Field flex label={ft ? 'Miles' : 'Kilometres'} value={km} onChangeText={setKm} kind="number" icon="walk" placeholder={ft ? '7' : '11'} />
      <Field flex label="Hours" value={hours} onChangeText={setHours} kind="number" icon="clock" placeholder="6" />
    </RowView>
    {existing ? <Group><Row icon="check" title="Walked" trailing={<Toggle value={done} onChange={setDone} label="Walked" />} /></Group> : null}
  </Sheet>;
}

/* ------------------------------------------------------------------ Safety */

const SCORES = ['none', 'mild', 'moderate', 'severe'];

/** General guidance only; the screen says plainly that this isn't medical advice. */
export function assess(c: Pick<CheckIn, 'spo2' | 'score' | 'altitude'>): { tint: 'mint' | 'peach' | 'rose'; text: string } {
  const high = c.altitude >= 3000;
  if (c.score >= 3 || c.spo2 < (high ? 75 : 88)) return { tint: 'rose', text: 'These are warning signs. Stop climbing, tell your guide and get medical help. Descend if symptoms get worse.' };
  if (c.score === 2 || c.spo2 < (high ? 82 : 92)) return { tint: 'peach', text: 'Take it easy. Rest, drink, don’t go higher tonight and check again in the morning. Tell your guide.' };
  return { tint: 'mint', text: 'Within the usual range for this altitude. Drink, eat and sleep, then check again at breakfast.' };
}

export function SafetyScreen() {
  const { current, fallback } = useAdventureTrip();
  const router = useRouter();
  const prefs = usePrefs();
  if (!current) return fallback;
  const { extras, editExtras } = current;
  const a = extras.adventure;
  const call = (phone: string, who: string) => Alert.alert(`Call ${who}?`, phone, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Call', onPress: () => void Linking.openURL(telLink(phone)).catch((e) => reportError(e, 'Couldn’t start the call')) },
  ]);
  const reminders = async (on: boolean) => {
    if (on && (await requestNotifications()) !== 'granted') {
      Alert.alert('Notifications are off', 'Turn them on in Settings to get the evening check-in reminder.', [{ text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => void Linking.openSettings() }]);
      return;
    }
    editExtras((d) => { d.adventure.checkInReminders = on; });
  };
  const checkIns = [...a.checkIns].sort((x, y) => y.at.localeCompare(x.at));
  const last = checkIns[0];
  const totalKm = a.stages.reduce((s, x) => s + x.distanceKm, 0);
  return <Screen bar="tabs">
    <Header title="Safety" right={<RoundButton icon="edit" label="Edit safety details" href="/safety-details" />} />
    <View style={{ backgroundColor: colors.card, borderRadius: radii.hero, overflow: 'hidden', boxShadow: shadows.lift }}>
      <Press href="/trail-map" label="Open route" style={{ height: 160 }}>
        <SvgXml xml={routeArt('wide', stageHeights([...a.stages].sort((x, y) => x.date.localeCompare(y.date)), a.summitAltitude))} width="100%" height="100%" />
        {a.stages.length ? <View style={{ position: 'absolute', top: 12, left: 12 }}><Tag text="Saved on this phone" tint="mint" /></View> : null}
      </Press>
      <RowView style={{ justifyContent: 'space-between', padding: 14, paddingHorizontal: 16 }}>
        <View style={{ gap: 2, flex: 1 }}><T v="row" style={{ fontSize: 15 }}>Route</T><T v="meta">{a.stages.length ? `${distance(totalKm, prefs.unit)} over ${plural(a.stages.length, 'stage')}` : 'Add stages to build the route'}</T></View>
        <Icon name="chev" size={18} color={colors.stone} />
      </RowView>
    </View>
    {a.rescuePhone ? <Press label="Emergency call" onPress={() => call(a.rescuePhone, 'rescue')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingHorizontal: 16, borderRadius: radii.card, backgroundColor: colors.danger }}>
      <IconTile icon="phone" bg="rgba(255,255,255,0.16)" color="#FFFFFF" />
      <View style={{ flex: 1, gap: 2 }}><T v="row" color="#FFFFFF">Emergency call</T><T v="meta" color="rgba(255,255,255,0.85)">Rescue · {a.rescuePhone}</T></View>
      <Icon name="chev" size={18} color="#FFFFFF" />
    </Press> : <Card>
      <RowView gap={12}><IconTile icon="phone" tint="rose" /><View style={{ flex: 1, gap: 2 }}><T v="row" style={{ fontSize: 15 }}>Add the local rescue number</T><T v="meta">Park rescue, mountain rescue or the local emergency number.</T></View></RowView>
      <Button label="Add safety details" kind="white" height={44} href="/safety-details" />
    </Card>}
    <Group>
      <Row icon="profile" title={a.emergency.name ? `${a.emergency.name}${a.emergency.relation ? ` · ${a.emergency.relation}` : ''}` : 'Emergency contact'} meta={a.emergency.phone || 'Add someone at home'}
        onPress={() => (a.emergency.phone ? call(a.emergency.phone, a.emergency.name || 'your contact') : router.push('/safety-details' as never))} />
      {a.guide.phone ? <Row icon="users" title={`Guide · ${a.guide.name || a.guide.phone}`} meta={a.guide.phone} onPress={() => call(a.guide.phone, a.guide.name || 'your guide')} /> : null}
      <Row icon="heart" title="Altitude check-in" meta={last ? `Last ${shortDay(last.at.slice(0, 10))} · SpO₂ ${last.spo2}%` : 'Log oxygen, pulse and symptoms each evening'} href="/altitude-check-in" />
      <Row icon="bell" title="Evening reminder" meta={`${planTime('19:30')} on each day of the trek`} trailing={<Toggle value={a.checkInReminders} onChange={(on) => void reminders(on)} label="Evening check-in reminder" />} />
    </Group>
    {checkIns.length ? <Section title="Check-ins">
      <Group>{checkIns.slice(0, 7).map((c) => <Row key={c.id} icon="heart" tint={assess(c).tint} title={`SpO₂ ${c.spo2}% · ${c.heartRate} bpm`}
        meta={`${shortDay(c.at.slice(0, 10))}${c.altitude ? ` · ${altitude(c.altitude, prefs.unit)}` : ''} · symptoms ${SCORES[c.score] ?? 'none'}`} trailing={null} />)}</Group>
    </Section> : null}
    <Note>Trips Loom isn’t a medical device. If you feel unwell at altitude, descend and get help.</Note>
  </Screen>;
}

export function SafetyDetailsSheet() {
  const current = useCurrentTrip();
  const prefs = usePrefs();
  const router = useRouter();
  const a = current?.extras.adventure;
  const ft = prefs.unit === 'imperial';
  const [summitName, setSummitName] = useState(a?.summitName ?? '');
  const [summitAlt, setSummitAlt] = useState(a?.summitAltitude ? String(Math.round(ft ? a.summitAltitude * 3.28084 : a.summitAltitude)) : '');
  const [porter, setPorter] = useState(String(a?.porterLimitKg ?? 15));
  const [guideName, setGuideName] = useState(a?.guide.name ?? '');
  const [guidePhone, setGuidePhone] = useState(a?.guide.phone ?? '');
  const [contactName, setContactName] = useState(a?.emergency.name ?? '');
  const [relation, setRelation] = useState(a?.emergency.relation ?? '');
  const [contactPhone, setContactPhone] = useState(a?.emergency.phone ?? '');
  const [rescue, setRescue] = useState(a?.rescuePhone ?? '');
  const dirty = useDirty([summitName, summitAlt, porter, guideName, guidePhone, contactName, relation, contactPhone, rescue]);
  if (!current) return <Sheet title="Summit and safety"><EmptyState title="No trip open" body="Open a trip first." /></Sheet>;
  const save = () => {
    current.editExtras((d) => {
      d.adventure.summitName = summitName.trim().slice(0, 120);
      d.adventure.summitAltitude = Math.round(toNumber(summitAlt, ft ? 29600 : 9000) / (ft ? 3.28084 : 1));
      d.adventure.porterLimitKg = toNumber(porter, 60);
      d.adventure.guide = { name: guideName.trim().slice(0, 120), phone: guidePhone.trim().slice(0, 40) };
      d.adventure.emergency = { name: contactName.trim().slice(0, 120), relation: relation.trim().slice(0, 60), phone: contactPhone.trim().slice(0, 40) };
      d.adventure.rescuePhone = rescue.trim().slice(0, 40);
    });
    router.back();
  };
  return <Sheet title="Summit and safety" dirty={dirty} footer={<Button label="Save" icon="check" onPress={save} />}>
    <Section title="Summit">
      <Field label="Name" value={summitName} onChangeText={setSummitName} icon="flag" placeholder="Uhuru Peak" maxLength={120} />
      <RowView align="flex-start">
        <Field flex label={`Height, ${ft ? 'ft' : 'm'}`} value={summitAlt} onChangeText={setSummitAlt} kind="number" icon="mountain" placeholder={ft ? '19341' : '5895'} />
        <Field flex label="Porter limit, kg" value={porter} onChangeText={setPorter} kind="number" icon="trips" />
      </RowView>
    </Section>
    <Section title="Guide">
      <Field label="Name" value={guideName} onChangeText={setGuideName} icon="profile" kind="name" maxLength={120} />
      <Field label="Phone" value={guidePhone} onChangeText={setGuidePhone} icon="phone" kind="phone" maxLength={40} />
    </Section>
    <Section title="Emergency contact">
      <Field label="Name" value={contactName} onChangeText={setContactName} icon="profile" kind="name" maxLength={120} />
      <Field label="Relation" value={relation} onChangeText={setRelation} icon="heart" maxLength={60} placeholder="Sister" />
      <Field label="Phone" value={contactPhone} onChangeText={setContactPhone} icon="phone" kind="phone" maxLength={40} placeholder="+44 7700 900123" />
    </Section>
    <Field label="Local rescue number" value={rescue} onChangeText={setRescue} icon="phone" kind="phone" maxLength={40} hint="Park or mountain rescue. It stays private to you and isn’t included in invites." />
  </Sheet>;
}

/* ------------------------------------------------------------------ Check-in */

function Stepper({ label, value, set, unit, min, max }: { label: string; value: number; set: (v: number) => void; unit: string; min: number; max: number }) {
  return <RowView style={{ justifyContent: 'space-between', padding: 14, paddingHorizontal: 16, borderRadius: radii.card, backgroundColor: colors.card, boxShadow: shadows.rest }}>
    <View style={{ gap: 2, flex: 1 }}>
      <T v="label">{label}</T>
      <T v="display" style={{ fontSize: 28, lineHeight: 32 }}>{value} <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.stone }}>{unit}</Text></T>
    </View>
    <RowView gap={8}>
      <RoundButton icon="minus" size={44} label={`Lower ${label}`} onPress={() => set(Math.max(min, value - 1))} />
      <RoundButton icon="plus" size={44} label={`Raise ${label}`} onPress={() => set(Math.min(max, value + 1))} />
    </RowView>
  </RowView>;
}

export function AltitudeCheckInSheet() {
  const current = useCurrentTrip();
  const prefs = usePrefs();
  const router = useRouter();
  const a = current?.extras.adventure;
  const today = todayISO();
  const stage = a ? stageFor(a.stages, today) : null;
  const last = a ? [...a.checkIns].sort((x, y) => y.at.localeCompare(x.at))[0] : undefined;
  const [spo2, setSpo2] = useState(last?.spo2 ?? 92);
  const [hr, setHr] = useState(last?.heartRate ?? 72);
  const [score, setScore] = useState(0);
  const [note, setNote] = useState('');
  const dirty = useDirty([spo2, hr, score, note]);
  if (!current) return <Sheet title="Altitude check-in"><EmptyState title="No trip open" body="Open a trip first." /></Sheet>;
  const alt = stage?.endAltitude ?? 0;
  const result = assess({ spo2, score, altitude: alt });
  const save = () => {
    current.editExtras((d) => { d.adventure.checkIns.push({ id: uid(), at: new Date().toISOString(), altitude: alt, spo2, heartRate: hr, score, note: note.trim().slice(0, 500) }); });
    router.back();
  };
  return <Sheet title="Altitude check-in" dirty={dirty} footer={<Button label="Save check-in" icon="check" onPress={save} />}>
    <RowView gap={12} style={{ paddingHorizontal: 4, flexWrap: 'wrap' }}>
      <Tag text={stage ? `${stage.to || stage.title || shortDay(stage.date)}${alt ? ` · ${altitude(alt, prefs.unit)}` : ''}` : longDay(today)} tint="lavender" />
    </RowView>
    <Stepper label="Blood oxygen, SpO₂" value={spo2} set={setSpo2} unit="%" min={50} max={100} />
    <Stepper label="Resting heart rate" value={hr} set={setHr} unit="bpm" min={30} max={220} />
    <Stack gap={8}>
      <T v="label" style={{ paddingLeft: 4 }}>Headache, nausea, dizziness or poor sleep</T>
      <RowView gap={8}>{SCORES.map((t, i) => {
        const on = i === score;
        return <PressScale key={t} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`Symptoms ${t}`} onPress={() => setScore(i)}
          style={{ flex: 1, borderRadius: radii.tile, boxShadow: shadows.rest }}>
          <Selectable on={on} render={(chosen) => <View style={{ flexGrow: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: radii.tile, backgroundColor: chosen ? colors.inkButton : colors.card }}>
            <T v="title" color={chosen ? '#FFFFFF' : undefined}>{i}</T>
            <T v="meta" color={chosen ? 'rgba(255,255,255,0.8)' : undefined}>{t}</T>
          </View>} />
        </PressScale>;
      })}</RowView>
    </Stack>
    <RowView gap={14} align="flex-start" style={{ padding: 12, paddingHorizontal: 16, borderRadius: radii.card, backgroundColor: tints[result.tint].bg }}>
      <Icon name={result.tint === 'mint' ? 'check' : 'heart'} size={20} color={tints[result.tint].fg} />
      <T v="small" color={tints[result.tint].fg} style={{ flex: 1 }}>{result.text}</T>
    </RowView>
    <Field label="Note" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="Slept badly, mild headache after lunch" />
    <Note>General guidance, not medical advice.</Note>
  </Sheet>;
}

/* ------------------------------------------------------------------ Route */

export function TrailMapScreen() {
  const { current, fallback } = useAdventureTrip();
  const prefs = usePrefs();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const stages = current ? [...current.extras.adventure.stages].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const [picked, setPicked] = useState<number | null>(null);
  if (!current) return fallback;
  const upcoming = stages.findIndex((s) => s.date >= todayISO());
  const index = Math.min(picked ?? (upcoming >= 0 ? upcoming : 0), Math.max(0, stages.length - 1));
  const stage = stages[index];
  const walked = stages.filter((s) => s.done).length;
  const climb = stage ? stage.endAltitude - stage.startAltitude : 0;
  return <MotionSurface enter={false}><View style={{ flex: 1, backgroundColor: tints.lavender.bg }}>
    <SvgXml xml={routeArt('tall', stageHeights(stages, current?.extras.adventure.summitAltitude), stages.length ? index : -1)} width="100%" height="100%" style={{ position: 'absolute' }} />
    <RowView style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, justifyContent: 'space-between' }}>
      <RoundButton icon="back" back label="Back" />
      <View style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: radii.button, backgroundColor: colors.card, boxShadow: shadows.button, flexShrink: 1 }}>
        <T v="row" style={{ fontSize: 14 }} lines={1}>{stages.length ? `${walked} of ${plural(stages.length, 'stage')} walked` : 'Route'}</T>
      </View>
      <RoundButton icon="plus" label="Add stage" href="/add-stage" />
    </RowView>
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, gap: 10 }}>
      {stages.length && stage ? <>
        {stages.length > 1 ? <RowView gap={8} style={{ flexWrap: 'wrap' }}>{stages.map((s, i) => <PressScale key={s.id} accessibilityRole="button" accessibilityState={{ selected: i === index }} accessibilityLabel={`Stage ${i + 1}, ${shortDay(s.date)}`} onPress={() => setPicked(i)}
          style={{ borderRadius: radii.tile, boxShadow: shadows.button }}>
          <Selectable on={i === index} render={(on) => <View style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: radii.tile, alignItems: 'center', backgroundColor: on ? colors.inkButton : colors.card }}>
            <T v="meta" color={on ? '#FFFFFF' : s.done ? colors.stone : colors.ink} style={{ fontFamily: fonts.medium }}>D{i + 1}</T>
          </View>} />
        </PressScale>)}</RowView> : null}
        <Swap k={index}><Card lifted padding={18} style={{ borderRadius: radii.hero }}>
          <RowView align="flex-start" style={{ justifyContent: 'space-between' }}>
            <View style={{ gap: 2, flex: 1 }}>
              <T v="eyebrow">Stage {index + 1} · {shortDay(stage.date)}{stage.date === todayISO() ? ' · today' : ''}</T>
              <T v="title">{stage.title || [stage.from, stage.to].filter(Boolean).join(' → ')}</T>
              <T v="small">{[stage.distanceKm ? distance(stage.distanceKm, prefs.unit) : '', stage.hours ? `${stage.hours} h` : '', climb ? `${climb > 0 ? 'up' : 'down'} ${altitude(Math.abs(climb), prefs.unit)}` : ''].filter(Boolean).join(' · ') || 'No distance or altitude yet'}</T>
            </View>
            <RoundButton icon={stage.done ? 'check' : 'walk'} dark={stage.done} label={stage.done ? 'Walked, tap to undo' : 'Mark as walked'} onPress={() => current.editExtras((d) => { const s = d.adventure.stages.find((x) => x.id === stage.id); if (s) s.done = !s.done; })} />
          </RowView>
          <Progress pct={(walked / stages.length) * 100} />
          <RowView style={{ justifyContent: 'space-between' }} gap={12}>
            <T v="meta" style={{ flexShrink: 1 }}>{stage.from || 'Start'}</T>
            <T v="meta" style={{ flexShrink: 1, textAlign: 'right' }}>{stage.to || 'Finish'}{stage.endAltitude ? ` · ${altitude(stage.endAltitude, prefs.unit)}` : ''}</T>
          </RowView>
          <Button label="Edit stage" icon="edit" kind="white" height={44} onPress={() => router.push({ pathname: '/add-stage', params: { id: stage.id } } as never)} />
        </Card></Swap>
      </> : <Card lifted padding={18}><T v="title">No route yet</T><T v="small">Add each day’s stage and it shows here.</T><Button label="Add a stage" icon="plus" href="/add-stage" /></Card>}
    </View>
  </View></MotionSurface>;
}
