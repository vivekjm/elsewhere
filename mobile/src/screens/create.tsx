import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useOpenTripPage, useRouter } from '../core/nav';
import * as ImagePicker from 'expo-image-picker';
import { track } from '../core/analytics';
import { inIndia } from '../domain/ideas';
import * as Clipboard from 'expo-clipboard';
import { usePro } from '../core/pro';
import { usePrefs, useSelection, useTrips } from '../core/state';
import { addDays, CURRENCIES, emptyExtras, isMood, uid, useAuth, useExtras, type Activity, type Trip, type TripKind } from '../data';
import { getTemplate, planFrom, type Template } from '../services/templates';
import { templateDraft, type Draft } from '../domain/drafter';
import { parseBookings, type ParsedBooking } from '../domain/bookings';
import { dateRange, fromDate, money, planTime, plural, shortDay, toDate, todayISO } from '../domain/format';
import { CATEGORY, coverOf, KIND_LABEL, KIND_MOOD, KIND_TINT, MOOD_ART, upcomingTrips } from '../domain/trips';
import {
  Button, Card, CheckToggle, colors, DateField, EmptyState, Field, FieldLabel, fonts, Group, Header, Hero, HeroText, Icon, IconTile, Illustration,
  Note, Radio, radii, RoundButton, Row, RowView, Screen, Section, shadows, Stack, T, Tag,
  inputText, singleLine, PressScale, SheetActions, Sheet,
} from '../loom';
import { canReadPdf, canScanReceipts, draftWithModel, onDeviceModelAvailable, readImageText, readPdfText } from '../services/intelligence';
import * as DocumentPicker from 'expo-document-picker';
import { TripForm, validateTrip, type TripDraft, type TripErrors } from './trip';

function CloseButton() {
  return <RoundButton icon="x" back label="Close" />;
}

/** Creates a trip (and its extras) and opens it. */
export function useCreateTrip() {
  const { edit } = useTrips();
  const extras = useExtras();
  const { select } = useSelection();
  const openTrip = useOpenTripPage();
  return (trip: Trip, kind: TripKind, cover = '', invite = false, more?: (e: ReturnType<typeof emptyExtras>) => void, then?: string) => {
    if (!edit((w) => { w.trips.push(trip); })) return false;
    const fresh = { ...emptyExtras(kind), cover };
    more?.(fresh);
    extras.put(trip.id, fresh);
    track('trip_created', { kind, days: Math.round((toDate(trip.end).getTime() - toDate(trip.start).getTime()) / 86400000) + 1 });
    select(trip.id);
    // Started as a group trip: the next step is bringing everyone in.
    openTrip(kind === 'trek' ? '/adventure' : '/trip', invite || then ? then ?? '/invite' : undefined);
    return true;
  };
}

/* ------------------------------------------------------------------ New trip */

export function NewTripScreen() {
  const params = useLocalSearchParams<{ destination?: string; invite?: string }>();
  const prefs = usePrefs();
  const create = useCreateTrip();
  const start = fromDate(new Date(toDate(todayISO()).getTime() + 14 * 86400000));
  const [draft, setDraft] = useState<TripDraft>({
    name: params.destination ? `${params.destination.split(',')[0]} trip` : '', destination: params.destination ?? '', start, end: addDays(start, 3),
    travellers: '1', budget: '', currency: prefs.currency, weightLimit: '', theme: 'city', kind: 'city', notes: '', photo: '',
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
    create(trip, draft.kind, draft.photo, params.invite === '1');
  };
  const set = (patch: Partial<TripDraft>) => setDraft((d) => {
    const auto = !d.name || d.name === `${d.destination.split(',')[0]} trip`;
    return { ...d, ...patch, ...(patch.destination !== undefined && auto ? { name: patch.destination ? `${patch.destination.split(',')[0]} trip` : '' } : {}) };
  });
  return <Screen footer={<Button label="Create trip" icon="chev" onPress={save} />}>
    <Header title="New trip" back={false} right={<CloseButton />} />
    <TripForm draft={draft} set={set} errors={errors} />
  </Screen>;
}

/* ------------------------------------------------------------------ Planner */

const SUGGESTIONS_INDIA = ['Goa long weekend with 5 friends, beaches and cafés', 'Six days in Spiti by road', 'Rishikesh rafting weekend, 4 of us', 'A week in Vietnam under ₹60,000 each'];
const SUGGESTIONS_WORLD = ['A long weekend in Porto, food and tiles', 'Six days hut to hut in the Dolomites', 'Kyoto in November with two friends', 'A beach week in Crete under €1,500'];
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
    setBusy(true);
    track('trip_draft_started', { model });
    const hints = { destination: params.destination, kind: (['city', 'beach', 'trek', 'road', 'dive'] as const).find((k) => k === params.kind), currency: prefs.currency };
    try {
      pendingDraft = (model ? await draftWithModel(text, hints).catch((e) => { if (__DEV__) console.warn('On-device draft failed', e); return null; }) : null) ?? templateDraft(text, hints);
      router.push('/planner-draft' as never);
    } finally { setBusy(false); }
  };
  const suggestions = inIndia(prefs.homeBase, prefs.currency) ? SUGGESTIONS_INDIA : SUGGESTIONS_WORLD;
  // Honest about what this is: a day-by-day skeleton from the words you type, free and unlimited. A model writes the
  // days only where the phone has one (Apple Intelligence), and says so.
  return <Screen footer={<Button label={busy ? 'Building…' : 'Build my days'} icon={busy ? undefined : 'sparkle'} leading={busy ? <ActivityIndicator color="#FFFFFF" /> : undefined} onPress={() => void draft()} />}>
    <Header title="Quick start" back={false} right={<CloseButton />} />
    <Hero padding={18}>
      <RowView gap={12}>
        <IconTile icon="sparkle" bg="rgba(255,255,255,0.2)" color="#FFFFFF" />
        <View style={{ flex: 1, gap: 2 }}><HeroText v="row" style={{ fontSize: 18 }}>Describe your trip</HeroText><HeroText v="small">Where, how long, who’s going and what you care about. You get a day-by-day outline to fill in.</HeroText></View>
      </RowView>
    </Hero>
    <View style={{ minHeight: 150, padding: 16, borderRadius: radii.card, backgroundColor: colors.card, boxShadow: shadows.rest }}>
      <TextInput multiline value={prompt} onChangeText={setPrompt} accessibilityLabel="Describe your trip" placeholderTextColor={colors.placeholder} maxLength={600} autoFocus={!params.prompt}
        placeholder={suggestions === SUGGESTIONS_INDIA ? 'Goa in December with 5 friends, 4 days, beaches, cafés and one party night. ₹15,000 each.' : 'A week in Portugal in April, food and tiles, slow mornings, one beach day. Three friends, no driving.'} maxFontSizeMultiplier={1.6}
        style={[inputText, { fontSize: 17, minHeight: 118, textAlignVertical: 'top' }]} />
    </View>
    <Stack gap={8}><FieldLabel>Try</FieldLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{suggestions.map((s) => <PressScale key={s} accessibilityRole="button" onPress={() => setPrompt(s)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.button, backgroundColor: colors.card, boxShadow: shadows.button }}>
        <Icon name="sparkle" size={14} /><T v="small" color={colors.ink} style={{ fontSize: 14 }}>{s}</T></PressScale>)}</View>
    </Stack>
    <Note>{model ? 'Days written on this phone with Apple Intelligence. Your words aren’t sent anywhere.' : 'An outline built on this phone from your words: dates, length, people, budget and a shape for each day. Add the real places yourself or with your group. Nothing is sent anywhere.'}</Note>
  </Screen>;
}

export function PlannerDraftScreen() {
  const router = useRouter();
  const prefs = usePrefs();
  const create = useCreateTrip();
  const [draft, setDraft] = useState<Draft | null>(pendingDraft);
  const [destination, setDestination] = useState(pendingDraft?.destination ?? '');
  const [error, setError] = useState('');
  if (!draft) return <Screen><Header title="Draft trip" back={false} right={<CloseButton />} /><EmptyState art="compass" title="No draft" body="Describe a trip to get a draft." action={<Button label="Back to the planner" onPress={() => router.back()} />} /></Screen>;
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
    }, draft.kind)) { pendingDraft = null; track('trip_draft_saved', { days: draft.days, source: draft.source }); }
  };
  const shift = (days: number) => setDraft({ ...draft, start: addDays(draft.start, days) < todayISO() ? todayISO() : addDays(draft.start, days) });
  return <Screen footer={<Button label="Use this plan" icon="check" onPress={use} />}>
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
        <Tag text={draft.source === 'on-device' ? 'Written with Apple Intelligence' : 'Outline'} tint="mint" />
      </RowView>
    </Card>
    <Field label="Destination" value={destination} onChangeText={(t) => { setDestination(t); setError(''); }} icon="pin" kind="place" error={error} placeholder="City or region" />
    <RowView align="flex-start">
      <DateField flex label="Starts" value={draft.start} min={todayISO()} onChange={(start) => setDraft({ ...draft, start })} />
      <View style={{ flex: 1, gap: 6 }}><FieldLabel>Length</FieldLabel>
        <RowView gap={8} style={{ minHeight: 56, paddingHorizontal: 12, borderRadius: radii.field, backgroundColor: colors.card, boxShadow: shadows.rest, justifyContent: 'space-between' }}>
          <PressScale accessibilityRole="button" accessibilityLabel="One day shorter" hitSlop={8} onPress={() => draft.days > 1 && setDraft({ ...draft, days: draft.days - 1, plan: draft.plan.slice(0, draft.days - 1) })}><Icon name="minus" size={18} /></PressScale>
          <T v="row" style={{ fontSize: 15 }}>{plural(draft.days, 'day')}</T>
          <PressScale accessibilityRole="button" accessibilityLabel="One day longer" hitSlop={8} onPress={() => draft.days < 30 && setDraft({ ...draft, days: draft.days + 1, plan: [...draft.plan, { title: 'Free day', stops: [] }] })}><Icon name="plus" size={18} /></PressScale>
        </RowView>
      </View>
    </RowView>
    <Section title="Days">
      <Stack>{draft.plan.map((day, i) => <Card key={i} padding={14}>
        <RowView style={{ justifyContent: 'space-between' }}><T v="eyebrow">Day {i + 1} · {shortDay(addDays(draft.start, i))}</T>
          {draft.plan.length > 1 ? <PressScale accessibilityRole="button" accessibilityLabel={`Remove day ${i + 1}`} hitSlop={8} onPress={() => setDraft({ ...draft, days: draft.days - 1, plan: draft.plan.filter((_, j) => j !== i) })}><Icon name="trash" size={16} color={colors.stone} /></PressScale> : null}</RowView>
        <T v="row">{day.title}</T>
        {day.stops.length ? day.stops.map((s, j) => <RowView key={j} gap={10}><T v="meta" style={{ width: 60 }} lines={1}>{planTime(s.time)}</T><Tag text={CATEGORY[s.category].label} tint={CATEGORY[s.category].tint} /><T v="small" style={{ flex: 1 }}>{s.title}</T></RowView>)
          : <T v="small">Nothing planned — add plans after saving.</T>}
      </Card>)}</Stack>
    </Section>
    <RowView><Button label="A week earlier" kind="white" height={44} style={{ flex: 1 }} onPress={() => shift(-7)} /><Button label="A week later" kind="white" height={44} style={{ flex: 1 }} onPress={() => shift(7)} /></RowView>
  </Screen>;
}

/* ------------------------------------------------------------------ Import bookings */

export function ImportBookingsScreen() {
  const router = useRouter();
  const openTrip = useOpenTripPage();
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
    if (parsed.length) track('booking_imported', { count: parsed.length });
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
  // A screenshot of a ticket, boarding pass or booking (IRCTC, airline, hotel apps): its text is read on this phone.
  const [reading, setReading] = useState(false);
  const fromScreenshot = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (result.canceled || !result.assets[0]) return;
    setReading(true);
    try {
      const read = await readImageText(result.assets[0].uri);
      if (!read.trim()) { Alert.alert('No text found', 'Try a sharper screenshot of the booking, or paste the confirmation text.'); return; }
      setText(read);
    } catch (e) { Alert.alert('Couldn’t read the screenshot', e instanceof Error ? e.message : 'Try again, or paste the text.'); } finally { setReading(false); }
  };
  const fromPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    setReading(true);
    try {
      const read = await readPdfText(result.assets[0].uri);
      if (!read.trim()) { Alert.alert('No text in this PDF', 'It may be a scanned image: take a screenshot of it and use Read a screenshot instead.'); return; }
      setText(read.slice(0, 100000));
    } catch (e) { Alert.alert('Couldn’t read the PDF', e instanceof Error ? e.message : 'Try pasting the text instead.'); } finally { setReading(false); }
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
    openTrip('/trip/days');
  };
  return <Screen footer={found.length ? <Button label={`Add ${chosen.size} to ${trip?.name ?? 'the trip'}`} icon="plus" onPress={add} /> : <SheetActions
    primary={<Button label="Paste from clipboard" icon="copy" onPress={() => void paste()} />}
    actions={[canScanReceipts && { icon: 'image', label: reading ? 'Reading the screenshot' : 'Read a screenshot', onPress: () => void fromScreenshot() },
      canReadPdf && { icon: 'file', label: 'Read a PDF ticket or booking', onPress: () => void fromPdf() }]} />}>
    <Header title="Import bookings" back={false} right={<CloseButton />} />
    {!found.length ? <>
      <Card>
        <RowView gap={14}><IconTile icon="mail" size={48} tint="peach" /><View style={{ flex: 1, gap: 2 }}><T v="row">Paste a confirmation</T><T v="meta">Copy the text of a flight, train, hotel or ticket email and paste it, or pick a screenshot or PDF of the booking. It’s read on this phone only.</T></View></RowView>
      </Card>
      <Field label="Confirmation text" value={text} onChangeText={setText} multiline placeholder="Booking reference ABC123 · Flight TP 1234 · 12 Nov 10:45 LIS → KIX" maxLength={100000}
        error={text.trim().length > 20 ? 'No bookings found in this text. Paste the whole confirmation email, including dates.' : undefined} />
    </> : <>
      <Card>
        <RowView gap={14}><IconTile icon="scan" size={48} tint="mint" /><View style={{ flex: 1, gap: 2 }}><T v="row">{plural(found.length, 'booking')} found</T><T v="meta">Each one becomes a plan on its day and a document.</T></View>
          <PressScale accessibilityRole="button" onPress={() => setText('')} hitSlop={8}><T v="small" style={{ fontFamily: fonts.medium }}>Clear</T></PressScale></RowView>
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

/* ------------------------------------------------------------------ Templates ("do it again") */

/** Opened from a template link (https://tripsloom.com/r/<code>): copy someone's trip onto your own dates. */
export function UseTemplateSheet() {
  const params = useLocalSearchParams<{ code?: string }>();
  const auth = useAuth();
  const prefs = usePrefs();
  const create = useCreateTrip();
  const [template, setTemplate] = useState<Template | null | 'loading'>('loading');
  const [start, setStart] = useState(fromDate(new Date(toDate(todayISO()).getTime() + 21 * 86400000)));
  useEffect(() => {
    if (!auth.client || !params.code) { setTemplate(null); return; }
    void getTemplate(auth.client, params.code).then(setTemplate).catch(() => setTemplate(null));
  }, [auth.client, params.code]);
  if (template === 'loading') return <Sheet title="Copy a trip"><Card><RowView gap={12}><ActivityIndicator color={colors.ember} /><T v="small">Opening the plan…</T></RowView></Card></Sheet>;
  if (!template) return <Sheet title="Copy a trip"><EmptyState title="This plan isn’t available" body="It may have been removed by the person who shared it." /></Sheet>;
  const end = addDays(start, template.days - 1);
  const use = () => {
    const { activities, days } = planFrom(template, start);
    const currency = ((CURRENCIES as readonly string[]).includes(template.currency) ? template.currency : prefs.currency) as Trip['currency'];
    // The query only sends when awaited or then-ed.
    if (auth.client && params.code) void auth.client.rpc('count_template_fork', { p_code: params.code }).then(() => {}, () => {});
    track('trip_draft_saved', { source: 'template', days: template.days });
    create({
      id: uid(), name: template.name.slice(0, 200), destination: template.destination.slice(0, 200), start, end, travellers: template.people,
      budget: template.perPerson ? Math.round(template.perPerson * template.people) : 0, currency, weightLimit: 0, activities, days, extras: [], packed: [],
      theme: (isMood(template.theme) ? template.theme : KIND_MOOD[template.kind]), notes: `Based on ${template.author}’s trip.`,
    }, template.kind);
  };
  const stops = template.plan.reduce((a, d) => a + d.stops.length, 0);
  return <Sheet title="Copy a trip" footer={<Button label="Make it my trip" icon="plus" onPress={use} />}>
    <Hero padding={18}>
      <HeroText faint style={{ fontSize: 14 }}>{`${template.author}’s trip${template.forks ? ` · copied ${plural(template.forks, 'time')}` : ''}`}</HeroText>
      <HeroText v="title" style={{ fontSize: 24 }}>{template.name}</HeroText>
      <HeroText faint style={{ fontSize: 14 }}>{`${plural(template.days, 'day')} · ${plural(stops, 'plan')}${template.destination ? ` · ${template.destination}` : ''}${template.perPerson ? ` · about ${money(template.perPerson, template.currency)} each` : ''}`}</HeroText>
    </Hero>
    <DateField label="Your first day" value={start} min={todayISO()} onChange={setStart} />
    <Note>{`${dateRange(start, end)}. Every day and plan is copied; change anything afterwards and share it with your own group.`}</Note>
    {template.plan.slice(0, template.days).map((d, i) => <Stack key={i} gap={6}>
      <T v="label" style={{ paddingLeft: 4 }}>{`Day ${i + 1}${d.title ? ` · ${d.title}` : ''}`}</T>
      {d.stops.length ? <Group>{d.stops.slice(0, 6).map((s, j) => <Row key={j} icon="pin" title={s.title} meta={[s.time ? planTime(s.time) : '', s.place].filter(Boolean).join(' · ')} trailing={null} />)}</Group>
        : <T v="meta" style={{ paddingLeft: 4 }}>A free day</T>}
    </Stack>)}
  </Sheet>;
}
