import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useRouter } from '../core/nav';
import * as Clipboard from 'expo-clipboard';
import { usePro } from '../core/pro';
import { usePrefs, useSelection, useTrips } from '../core/state';
import { addDays, CURRENCIES, emptyExtras, uid, useExtras, type Activity, type Trip, type TripKind } from '../data';
import { templateDraft, type Draft } from '../domain/drafter';
import { parseBookings, type ParsedBooking } from '../domain/bookings';
import { dateRange, fromDate, plural, shortDay, toDate, todayISO } from '../domain/format';
import { CATEGORY, coverOf, KIND_LABEL, KIND_MOOD, KIND_TINT, MOOD_ART, upcomingTrips } from '../domain/trips';
import {
  Button, Card, CheckToggle, colors, DateField, EmptyState, Field, FieldLabel, fonts, Group, Header, Hero, HeroText, Icon, IconTile, Illustration,
  Note, Radio, radii, RoundButton, Row, RowView, Screen, Section, shadows, Stack, T, Tag,
} from '../loom';
import { draftWithModel, onDeviceModelAvailable } from '../services/intelligence';
import { TripForm, validateTrip, type TripDraft, type TripErrors } from './trip';

function CloseButton() {
  return <RoundButton icon="x" back label="Close" />;
}

/** Creates a trip (and its extras) and opens it. */
function useCreateTrip() {
  const { edit } = useTrips();
  const extras = useExtras();
  const { select } = useSelection();
  const router = useRouter();
  return (trip: Trip, kind: TripKind) => {
    if (!edit((w) => { w.trips.push(trip); })) return false;
    extras.put(trip.id, { ...emptyExtras(kind) });
    select(trip.id);
    if (router.canDismiss()) router.dismissAll();
    router.push((kind === 'trek' ? '/adventure' : '/trip') as never);
    return true;
  };
}

/* ------------------------------------------------------------------ New trip */

export function NewTripScreen() {
  const params = useLocalSearchParams<{ destination?: string }>();
  const prefs = usePrefs();
  const create = useCreateTrip();
  const start = fromDate(new Date(toDate(todayISO()).getTime() + 14 * 86400000));
  const [draft, setDraft] = useState<TripDraft>({
    name: params.destination ? `${params.destination.split(',')[0]} trip` : '', destination: params.destination ?? '', start, end: addDays(start, 3),
    travellers: '1', budget: '', currency: prefs.currency, weightLimit: '', theme: 'city', kind: 'city', notes: '',
  });
  const [errors, setErrors] = useState<TripErrors>({});
  const save = () => {
    const e = validateTrip(draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    const trip: Trip = {
      id: uid(), name: draft.name.trim(), destination: draft.destination.trim(), start: draft.start, end: draft.end, travellers: Number(draft.travellers) || 1,
      budget: Number(draft.budget.replace(',', '.')) || 0, currency: draft.currency as Trip['currency'], weightLimit: Number(draft.weightLimit.replace(',', '.')) || 0,
      activities: [], days: {}, extras: [], packed: [], theme: draft.theme, notes: draft.notes,
    };
    create(trip, draft.kind);
  };
  const set = (patch: Partial<TripDraft>) => setDraft((d) => {
    const auto = !d.name || d.name === `${d.destination.split(',')[0]} trip`;
    return { ...d, ...patch, ...(patch.destination !== undefined && auto ? { name: patch.destination ? `${patch.destination.split(',')[0]} trip` : '' } : {}) };
  });
  return <Screen modal footer={<Button label="Create trip" icon="chev" onPress={save} />}>
    <Header title="New trip" back={false} right={<CloseButton />} />
    <TripForm draft={draft} set={set} errors={errors} />
  </Screen>;
}

/* ------------------------------------------------------------------ Planner */

const SUGGESTIONS = ['A long weekend in Porto, food and tiles', 'Six days hut to hut in the Dolomites', 'Kyoto in November with two friends', 'A beach week in Crete under €1,500'];
let pendingDraft: Draft | null = null;

export function PlannerScreen() {
  const params = useLocalSearchParams<{ prompt?: string; destination?: string; kind?: string }>();
  const router = useRouter();
  const prefs = usePrefs();
  const pro = usePro();
  const [prompt, setPrompt] = useState(params.prompt ?? '');
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState(false);
  useEffect(() => { void onDeviceModelAvailable().then(setModel); }, []);
  const draft = async () => {
    const text = prompt.trim();
    if (text.length < 8) { Alert.alert('Say a little more', 'Where, how long, and what you care about — for example “5 days in Lisbon in May, food and tiles”.'); return; }
    if (!(await pro.useDraft())) {
      Alert.alert('You’ve used this month’s free drafts', 'Pro gives you unlimited drafts. You can still add a trip by hand.', [
        { text: 'Not now', style: 'cancel' }, { text: 'See Pro', onPress: () => router.push('/paywall' as never) },
      ]);
      return;
    }
    setBusy(true);
    const hints = { destination: params.destination, kind: (['city', 'beach', 'trek', 'road', 'dive'] as const).find((k) => k === params.kind), currency: prefs.currency };
    try {
      pendingDraft = (model ? await draftWithModel(text, hints).catch((e) => { if (__DEV__) console.warn('On-device draft failed', e); return null; }) : null) ?? templateDraft(text, hints);
      router.push('/planner-draft' as never);
    } finally { setBusy(false); }
  };
  return <Screen modal footer={<>
    <Button label={busy ? 'Drafting…' : 'Draft trip'} icon={busy ? undefined : 'sparkle'} leading={busy ? <ActivityIndicator color="#FFFFFF" /> : undefined} onPress={() => void draft()} />
    <T v="meta" center>{pro.draftsLeft === null ? 'Unlimited drafts with Pro' : `${pro.draftsLeft} of 3 free drafts left this month · `}
      {pro.draftsLeft !== null ? <Text onPress={() => router.push('/paywall' as never)} style={{ fontFamily: fonts.semibold, color: colors.ink }}>Go unlimited</Text> : null}</T>
  </>}>
    <Header title="Plan with AI" back={false} right={<CloseButton />} />
    <Hero padding={18}>
      <RowView gap={12}>
        <IconTile icon="sparkle" bg="rgba(255,255,255,0.2)" color="#FFFFFF" />
        <View style={{ flex: 1, gap: 2 }}><HeroText v="row" style={{ fontSize: 18 }}>Describe your trip</HeroText><HeroText v="small">Where, how long, who’s going and what you care about.</HeroText></View>
      </RowView>
    </Hero>
    <View style={{ minHeight: 150, padding: 16, borderRadius: radii.card, backgroundColor: colors.card, boxShadow: shadows.rest }}>
      <TextInput multiline value={prompt} onChangeText={setPrompt} accessibilityLabel="Describe your trip" placeholderTextColor={colors.placeholder} maxLength={600} autoFocus={!params.prompt}
        placeholder="A week in Portugal in April, food and tiles, slow mornings, one beach day. Three friends, no driving." maxFontSizeMultiplier={1.6}
        style={{ fontFamily: fonts.medium, fontSize: 17, lineHeight: 26, color: colors.ink, minHeight: 118, textAlignVertical: 'top' }} />
    </View>
    <Stack gap={8}><FieldLabel>Try</FieldLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{SUGGESTIONS.map((s) => <Pressable key={s} accessibilityRole="button" onPress={() => setPrompt(s)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.button, backgroundColor: colors.card, boxShadow: shadows.button }}>
        <Icon name="sparkle" size={14} /><T v="small" color={colors.ink} style={{ fontSize: 14 }}>{s}</T></Pressable>)}</View>
    </Stack>
    <Note>{model ? 'Drafted on this phone with Apple Intelligence. Your words aren’t sent anywhere.' : 'Drafted on this phone from your words — nothing is sent anywhere. You can change everything before saving.'}</Note>
  </Screen>;
}

export function PlannerDraftScreen() {
  const router = useRouter();
  const prefs = usePrefs();
  const create = useCreateTrip();
  const [draft, setDraft] = useState<Draft | null>(pendingDraft);
  const [destination, setDestination] = useState(pendingDraft?.destination ?? '');
  const [error, setError] = useState('');
  if (!draft) return <Screen modal><Header title="Draft trip" back={false} right={<CloseButton />} /><EmptyState art="compass" title="No draft" body="Describe a trip to get a draft." action={<Button label="Back to the planner" onPress={() => router.back()} />} /></Screen>;
  const end = addDays(draft.start, draft.days - 1);
  const title = draft.title === 'New trip' && destination ? `${destination.split(',')[0]} trip` : draft.title;
  const use = () => {
    if (!destination.trim()) { setError('Where is this trip?'); return; }
    const activities: Activity[] = draft.plan.flatMap((day, i) => day.stops.map((s) => ({
      id: uid(), date: addDays(draft.start, i), time: s.time, endTime: '', title: s.title.slice(0, 200), place: '', category: s.category, cost: 0, link: '', notes: '', outfitId: '', gear: [], completed: false,
    })));
    const days = Object.fromEntries(draft.plan.map((day, i) => [addDays(draft.start, i), { outfitId: '', outfitIds: [], title: day.title.slice(0, 200), stay: '', notes: '', gear: [] }]));
    const currency = (draft.currency && (CURRENCIES as readonly string[]).includes(draft.currency) ? draft.currency : prefs.currency) as Trip['currency'];
    if (create({
      id: uid(), name: title.slice(0, 200), destination: destination.trim().slice(0, 200), start: draft.start, end,
      travellers: draft.travellers, budget: draft.budget, currency, weightLimit: 0, activities, days, extras: [], packed: [], theme: KIND_MOOD[draft.kind], notes: '',
    }, draft.kind)) pendingDraft = null;
  };
  const shift = (days: number) => setDraft({ ...draft, start: addDays(draft.start, days) < todayISO() ? todayISO() : addDays(draft.start, days) });
  return <Screen modal footer={<Button label="Use this plan" icon="check" onPress={use} />}>
    <Header title="Draft trip" right={<CloseButton />} />
    <Card>
      <RowView gap={14}>
        <Illustration name={MOOD_ART[KIND_MOOD[draft.kind]]} width={64} height={64} radius={radii.tile} />
        <View style={{ flex: 1, gap: 4 }}><T v="title">{title}</T><T v="small">{plural(draft.days, 'day')} · {dateRange(draft.start, end)}</T></View>
      </RowView>
      <RowView gap={8} style={{ flexWrap: 'wrap' }}>
        <Tag text={KIND_LABEL[draft.kind]} tint={KIND_TINT[draft.kind]} /><Tag text={plural(draft.travellers, 'traveller')} tint="lavender" />
        {draft.budget ? <Tag text={`Budget ${draft.budget.toLocaleString()} ${draft.currency ?? prefs.currency}`} tint="rose" /> : null}
        {draft.interests.slice(0, 3).map((i) => <Tag key={i} text={i} tint="grey" />)}
        <Tag text={draft.source === 'on-device' ? 'Apple Intelligence' : 'Template'} tint="mint" />
      </RowView>
    </Card>
    <Field label="Destination" value={destination} onChangeText={(t) => { setDestination(t); setError(''); }} icon="pin" kind="place" error={error} placeholder="City or region" />
    <RowView align="flex-start">
      <DateField flex label="Starts" value={draft.start} min={todayISO()} onChange={(start) => setDraft({ ...draft, start })} />
      <View style={{ flex: 1, gap: 6 }}><FieldLabel>Length</FieldLabel>
        <RowView gap={8} style={{ minHeight: 56, paddingHorizontal: 12, borderRadius: radii.field, backgroundColor: colors.card, boxShadow: shadows.rest, justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="One day shorter" hitSlop={8} onPress={() => draft.days > 1 && setDraft({ ...draft, days: draft.days - 1, plan: draft.plan.slice(0, draft.days - 1) })}><Icon name="minus" size={18} /></Pressable>
          <T v="row" style={{ fontSize: 15 }}>{plural(draft.days, 'day')}</T>
          <Pressable accessibilityRole="button" accessibilityLabel="One day longer" hitSlop={8} onPress={() => draft.days < 30 && setDraft({ ...draft, days: draft.days + 1, plan: [...draft.plan, { title: 'Free day', stops: [] }] })}><Icon name="plus" size={18} /></Pressable>
        </RowView>
      </View>
    </RowView>
    <Section title="Days">
      <Stack>{draft.plan.map((day, i) => <Card key={i} padding={14}>
        <RowView style={{ justifyContent: 'space-between' }}><T v="eyebrow">Day {i + 1} · {shortDay(addDays(draft.start, i))}</T>
          {draft.plan.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove day ${i + 1}`} hitSlop={8} onPress={() => setDraft({ ...draft, days: draft.days - 1, plan: draft.plan.filter((_, j) => j !== i) })}><Icon name="trash" size={16} color={colors.stone} /></Pressable> : null}</RowView>
        <T v="row">{day.title}</T>
        {day.stops.length ? day.stops.map((s, j) => <RowView key={j} gap={10}><T v="meta" style={{ width: 44 }}>{s.time}</T><Tag text={CATEGORY[s.category].label} tint={CATEGORY[s.category].tint} /><T v="small" style={{ flex: 1 }}>{s.title}</T></RowView>)
          : <T v="small">Nothing planned — add plans after saving.</T>}
      </Card>)}</Stack>
    </Section>
    <RowView><Button label="A week earlier" kind="white" height={44} style={{ flex: 1 }} onPress={() => shift(-7)} /><Button label="A week later" kind="white" height={44} style={{ flex: 1 }} onPress={() => shift(7)} /></RowView>
  </Screen>;
}

/* ------------------------------------------------------------------ Import bookings */

export function ImportBookingsScreen() {
  const router = useRouter();
  const { trips, edit } = useTrips();
  const store = useExtras();
  const { select } = useSelection();
  const [text, setText] = useState('');
  const [found, setFound] = useState<ParsedBooking[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const upcoming = upcomingTrips(trips);
  const [tripId, setTripId] = useState<string | null>(upcoming[0]?.id ?? trips[0]?.id ?? null);
  useEffect(() => {
    const parsed = parseBookings(text);
    setFound(parsed);
    setChosen(new Set(parsed.map((p) => p.id)));
  }, [text]);
  const paste = async () => {
    const clip = (await Clipboard.getStringAsync()).slice(0, 100000);
    // A Trips Loom invite belongs in Join, not in a booking.
    if (/^\s*tripsloom:\/\/\/?join\?/i.test(clip)) {
      Alert.alert('That’s a trip invite', 'Open it to join the trip instead of importing it as a booking.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open invite', onPress: () => router.push({ pathname: '/join-trip', params: { d: clip.trim().replace(/^.*?[?&]d=/, '') } } as never) },
      ]);
      return;
    }
    if (!clip.trim()) { Alert.alert('Nothing to paste', 'Copy the text of a confirmation email first, then tap Paste.'); return; }
    setText(clip);
  };
  const trip = trips.find((t) => t.id === tripId) ?? null;
  const add = () => {
    if (!trip) { Alert.alert('Choose a trip', 'Pick the trip these bookings belong to, or create one first.'); return; }
    const picked = found.filter((b) => chosen.has(b.id));
    if (!picked.length) { Alert.alert('Nothing selected', 'Tick at least one booking to add.'); return; }
    const outside = picked.filter((b) => b.date && (b.date < trip.start || b.date > trip.end));
    const ok = edit((w) => {
      const t = w.trips.find((x) => x.id === trip.id)!;
      for (const b of picked) {
        const date = b.date && b.date >= t.start && b.date <= t.end ? b.date : b.date && b.date > t.end ? t.end : t.start;
        if (t.activities.some((a) => a.date === date && a.title === b.title)) continue;
        t.activities.push({ id: uid(), date, time: b.time, endTime: '', title: b.title.slice(0, 200), place: '', category: b.category, cost: 0, link: '', notes: b.detail.slice(0, 5000), outfitId: '', gear: [], completed: false });
        if (b.kind === 'stay') t.days[date] = { ...(t.days[date] ?? { outfitId: '', outfitIds: [], title: '', stay: '', notes: '', gear: [] }), stay: b.title.slice(0, 200) };
      }
    });
    if (!ok) return;
    store.change(trip.id, (d) => {
      for (const b of picked) if (!d.documents.some((x) => x.title === b.title)) d.documents.push({ id: uid(), kind: b.kind, title: b.title.slice(0, 200), detail: b.detail.slice(0, 500), date: b.date, createdAt: new Date().toISOString() });
    });
    select(trip.id);
    if (outside.length) Alert.alert('Some dates were outside the trip', `${plural(outside.length, 'booking')} landed on the trip’s first or last day. Edit the plan or the trip dates if that’s wrong.`);
    if (router.canDismiss()) router.dismissAll();
    router.push('/trip/days' as never);
  };
  return <Screen modal footer={found.length ? <Button label={`Add ${chosen.size} to ${trip?.name ?? 'the trip'}`} icon="plus" onPress={add} /> : <Button label="Paste from clipboard" icon="copy" onPress={() => void paste()} />}>
    <Header title="Import bookings" back={false} right={<CloseButton />} />
    {!found.length ? <>
      <Card>
        <RowView gap={14}><IconTile icon="mail" size={48} tint="peach" /><View style={{ flex: 1, gap: 2 }}><T v="row">Paste a confirmation</T><T v="meta">Copy the text of a flight, train, hotel or ticket email, then paste it here. It’s read on this phone only.</T></View></RowView>
      </Card>
      <Field label="Confirmation text" value={text} onChangeText={setText} multiline placeholder="Booking reference ABC123 · Flight TP 1234 · 12 Nov 10:45 LIS → KIX" maxLength={100000}
        error={text.trim().length > 20 ? 'No bookings found in this text. Paste the whole confirmation email, including dates.' : undefined} />
    </> : <>
      <Card>
        <RowView gap={14}><IconTile icon="scan" size={48} tint="mint" /><View style={{ flex: 1, gap: 2 }}><T v="row">{plural(found.length, 'booking')} found</T><T v="meta">Each one becomes a plan on its day and a document.</T></View>
          <Pressable accessibilityRole="button" onPress={() => setText('')} hitSlop={8}><T v="small" style={{ fontFamily: fonts.semibold }}>Clear</T></Pressable></RowView>
      </Card>
      <Group>{found.map((b) => <Row key={b.id} icon={b.kind === 'flight' ? 'plane' : b.kind === 'stay' ? 'bed' : 'ticket'} tint={b.kind === 'flight' ? 'lavender' : b.kind === 'stay' ? 'peach' : 'mint'}
        title={b.title} meta={[b.date ? shortDay(b.date) : 'No date found', b.time, b.detail].filter(Boolean).join(' · ')}
        trailing={<CheckToggle checked={chosen.has(b.id)} label={b.title} onChange={(on) => { const next = new Set(chosen); if (on) next.add(b.id); else next.delete(b.id); setChosen(next); }} />} />)}</Group>
      <Section title="Add to">
        {trips.length ? <Group>{(upcoming.length ? upcoming : trips).slice(0, 6).map((t) => <Row key={t.id} leading={<Illustration name={coverOf(t)} width={40} height={40} radius={10} />} title={t.name}
          meta={dateRange(t.start, t.end)} trailing={<Radio on={tripId === t.id} />} onPress={() => setTripId(t.id)} />)}</Group>
          : <Card><T v="small">You don’t have a trip yet.</T><Button label="Create a trip" icon="plus" kind="mist" height={44} onPress={() => router.push('/new-trip' as never)} /></Card>}
      </Section>
    </>}
  </Screen>;
}
