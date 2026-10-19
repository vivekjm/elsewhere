import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useRouter } from '../core/nav';
import * as WebBrowser from 'expo-web-browser';
import { CoverImage } from '../core/cover';
import { ExpandTarget } from '../core/expand';
import { OffersCard } from './offers';
import { publishTemplate, templateLink } from '../services/templates';
import { dayCard, dayMessage, recapCard, recapMessage, shareText } from './organiser';
import { reportError, useCurrentTrip, usePrefs, useSelection, useTrips } from '../core/state';
import { ACTIVITY_TYPES, blankDay, EXPENSE_CATEGORIES, safeLink, TRIP_KINDS, TRIP_MOODS, tripDates, uid, useAuth, useExtras, useWorkspace, type Activity, type Trip, type TripExtras, type TripKind } from '../data';
import { clockTime, dateRange, planTimes, dayOfMonth, daysFromToday, localDay, longDay, money, plural, shortDay, todayISO, weekday } from '../domain/format';
import { budgetOf, CATEGORY, convert, EXPENSE_LABEL, countdownLabel, KIND_LABEL, KIND_MOOD, KIND_TINT, MOOD_ART, MOOD_LABEL, packingOf, placeOf, planArt, plannedDays, plansOn, statusOf, type Mood } from '../domain/trips';
import {
  CoverParallax,
  Button, Card, Checkbox, Chips, colors, CurrencyField, Dashed, DateField, EmptyState, Field, FieldLabel, fonts, Group, Header, Hero, HeroRule, HeroText, Icon,
  Illustration, Loading, MediaRow, Note, PlaceField, radii, RoundButton, Row, RowView, Screen, Section, shadows, Sheet, Stack, Swatches, T, Tag, TimeField, Toggle,
  DayChip, SheetActions, Swap,
  useDirty, PressScale,
} from '../loom';
import { useRates } from '../services/currency';
import { exportCalendar, exportItineraryPDF, exportTravelBook } from '../services/exports';
import { openRoute } from '../services/maps';
import { askForReview } from '../services/review';
import { isFlightPlan } from '../services/flights';
import { tripWeatherLine, useTripWeather, weatherIcon } from '../services/weather';

/** A trip screen needs a trip; when none exists (deleted elsewhere, fresh account) say so instead of crashing. */
export function NoTrip() {
  const router = useRouter();
  return <Screen><Header title="Trip" /><EmptyState art="compass" title="No trip open" body="This trip isn’t on this account any more. Pick another from Home or plan a new one."
    action={<Button label="Go to Home" onPress={() => router.replace('/home' as never)} />} /></Screen>;
}

/* ------------------------------------------------------------------ Overview */

/**
 * The trip's main card: cover, name, where and when, and the way into the itinerary. Also drawn by the shared
 * transition from Home, so the card arrives complete rather than filling in after the page appears.
 */
export function TripCard({ trip, extras }: { trip: Trip; extras: TripExtras }) {
  const prefs = usePrefs();
  const weather = useTripWeather(trip);
  const status = statusOf(trip);
  const line = tripWeatherLine(tripDates(trip).map((d) => weather[d]).filter(Boolean), prefs.unit);
  const planned = plannedDays(trip);
  return <View style={{ backgroundColor: colors.card, borderRadius: radii.hero, overflow: 'hidden', boxShadow: shadows.lift }}>
    <View style={{ height: 210 }}>
      <CoverParallax height={210}><CoverImage trip={trip} extras={extras} /></CoverParallax>
    <View style={{ position: 'absolute', top: 12, right: 12 }}><RoundButton icon="camera" label="Change cover" href="/edit-trip" size={40} /></View>
      <View style={{ position: 'absolute', left: 16, bottom: 12, flexDirection: 'row', gap: 6 }}>
        <Tag text={`${KIND_LABEL[extras.kind]} · ${plural(status.totalDays, 'day')}`} tint={KIND_TINT[extras.kind]} />
        {extras.invitedBy ? <Tag text={`From ${extras.invitedBy}`} tint="lavender" /> : null}
      </View>
    </View>
    <View style={{ padding: 16, paddingTop: 14, gap: 12 }}>
      <T v="display" style={{ lineHeight: 34 }}>{trip.name}</T>
      <Stack gap={8}>
        <RowView align="flex-start"><Icon name="pin" size={18} color={colors.stone} /><T v="body" style={{ flex: 1 }}>{trip.destination} · {countdownLabel(status)}</T></RowView>
        <RowView align="flex-start"><Icon name="calendar" size={18} color={colors.stone} /><T v="body" style={{ flex: 1 }}>{dateRange(trip.start, trip.end)} · <Text style={{ color: colors.ink, fontFamily: fonts.medium }}>{planned} of {status.totalDays} days planned</Text></T></RowView>
        {line ? <RowView align="flex-start"><Icon name="cloud" size={18} color={colors.stone} /><T v="body" style={{ flex: 1 }}>{line}</T></RowView> : null}
      </Stack>
      <RowView gap={8} style={{ marginTop: 4 }}>
        <Button label="Itinerary" icon="chev" full={false} height={48} href="/trip/days" />
        <RoundButton icon="share" label="Share trip" href="/invite" />
        <RoundButton icon="edit" label="Edit trip" href="/edit-trip" />
      </RowView>
    </View>
  </View>;
}

export function TripHeader() {
  return <Header title="Your trip" right={<RoundButton icon="more" label="Trip options" href="/trip-actions" />} />;
}

export function TripScreen() {
  const current = useCurrentTrip();
  const router = useRouter();
  const { workspace, status: sync } = useTrips();
  const rates = useRates(current?.trip.currency ?? 'EUR');
  if (!current) return sync === 'loading' ? <Loading /> : <NoTrip />;
  const { trip, extras } = current;
  const status = statusOf(trip);
  const pack = workspace ? packingOf(workspace, trip) : null;
  const budget = budgetOf(trip, extras, rates, trip.currency);
  return <Screen bar="tabs">
    <TripHeader />
    <ExpandTarget id="trip"><TripCard trip={trip} extras={extras} /></ExpandTarget>
    <Stack>
      {status.phase !== 'past' ? <MediaRow ill="compass" eyebrow={extras.members.length > 1 || extras.people.length ? 'Plan together' : 'Plan'} tint="peach"
        title={extras.shortlist.length ? `${plural(extras.shortlist.length, 'idea')} on the board` : 'Ideas, votes and AI'}
        meta={extras.plan?.draftedAt ? 'Add ideas or draft the days again' : extras.members.length > 1 || extras.people.length ? 'Add places, vote, draft the days' : 'Add places, ask AI, and draft the days'} href="/plan" /> : null}
      {status.phase === 'past' ? <MediaRow ill="compass" eyebrow="Recap" tint="peach" title="How was it?" meta="Highlights, totals and your rating" href="/recap" /> : null}
      {extras.kind === 'trek' ? <MediaRow ill="summit" eyebrow="Adventure" tint="mint" title="Route, gear and safety" meta="Stages, porter bag, check-ins" onPress={() => router.replace('/adventure' as never)} /> : null}
      <MediaRow ill="suitcase" eyebrow="Packing" tint="mint" title={pack?.total ? `${pack.packed} of ${pack.total} packed` : 'Start your list'}
        meta={pack?.total ? (pack.packedGrams || trip.weightLimit ? `${(pack.packedGrams / 1000).toFixed(1)} kg packed${trip.weightLimit ? ` of ${trip.weightLimit} kg` : ''}` : `${pack.total - pack.packed} still to pack`) : 'Outfits and essentials add themselves'} href="/trip/packing" />
      <MediaRow ill="receipt" eyebrow="Budget" tint="rose" title={budget.limit ? `${money(budget.planned, trip.currency)} of ${money(budget.limit, trip.currency)}` : budget.planned ? `${money(budget.planned, trip.currency)} planned` : 'No budget yet'}
        meta={budget.spent ? `${money(budget.spent, trip.currency)} spent so far` : 'Plans with a price and expenses count here'} href="/trip/budget" />
      <MediaRow ill="peaks" eyebrow="Map" tint="mint" title="Your places on a map" meta="Day routes, check-ins, save for offline" href="/trip/map" />
      <MediaRow ill="compass" eyebrow="Essentials" tint="lavender" title={`Local time, plugs and money`} meta="Emergency number, driving side, tipping" href="/essentials" />
      <MediaRow ill="passport" eyebrow="Documents" tint="lavender" title={extras.documents.length ? plural(extras.documents.length, 'document') : 'No documents yet'}
        meta={extras.documents.length ? extras.documents.slice(0, 2).map((d) => d.title).join(' · ') : 'Tickets, bookings, insurance'} href="/trip/documents" />
      <MediaRow ill="stay" eyebrow="People" tint="peach" title={extras.people.length ? `You and ${plural(extras.people.length, 'other')}` : trip.travellers > 1 ? plural(trip.travellers, 'traveller') : 'Just you'}
        meta={trip.travellers > extras.people.length + 1 ? `Add ${trip.travellers - extras.people.length - 1 === 1 ? 'their name' : 'their names'} to split costs and vote` : extras.people.length ? 'Split costs and vote on plans' : 'Add friends to split costs'} href="/people" />
      {extras.kind === 'dive' || extras.kind === 'beach' ? <MediaRow ill="tide" eyebrow="Tides" tint="mint" title={extras.kind === 'dive' ? 'Tides and your dive log' : 'Today’s tides'} meta={extras.kind === 'dive' ? 'Best windows to dive, and every dive logged' : 'High and low water for each beach day'} href="/trip/tides" /> : null}
    </Stack>
    <OffersCard trip={trip} />
  </Screen>;
}

/* ------------------------------------------------------------------ Trip actions */

export function TripActionsSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const { edit } = useTrips();
  const store = useExtras();
  const { select } = useSelection();
  const [busy, setBusy] = useState('');
  if (!current) return <Sheet title="Trip"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const { trip, extras, editExtras } = current;
  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } catch (e) { reportError(e, 'Couldn’t export'); } finally { setBusy(''); } };
  const duplicate = () => {
    const copy: Trip = JSON.parse(JSON.stringify(trip));
    copy.id = uid(); copy.name = `${trip.name} (copy)`.slice(0, 200);
    copy.activities = copy.activities.map((a) => ({ ...a, id: uid(), completed: false }));
    copy.extras = copy.extras.map((e) => ({ ...e, id: uid(), packed: false }));
    copy.packed = [];
    if (edit((w) => { w.trips.push(copy); })) {
      store.put(copy.id, { ...extras, expenses: [], settlements: [], polls: [], documents: [], rating: 0, recapNote: '', invitedBy: '' });
      select(copy.id);
      router.back();
    }
  };
  const remove = () => Alert.alert(`Delete “${trip.name}”?`, 'This removes its plans, packing list, costs and documents on every device. It can’t be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete trip', style: 'destructive', onPress: () => {
      if (edit((w) => { w.trips = w.trips.filter((t) => t.id !== trip.id); })) {
        store.remove(trip.id);
        select(null);
        if (router.canDismiss()) router.dismissAll();
        router.replace('/home' as never);
      }
    } },
  ]);
  return <Sheet title="Trip options">
    <Group>
      <Row icon="edit" title="Edit trip" meta="Name, dates, budget, cover" onPress={() => router.replace('/edit-trip' as never)} />
      <Row icon="share" title="Share with the people on it" meta="Send an invite link" onPress={() => router.replace('/invite' as never)} />
      <Row icon="doc" title="Itinerary PDF" meta="Print or send the day-by-day plan" onPress={() => void run('pdf', () => exportItineraryPDF(trip))} trailing={busy === 'pdf' ? <T v="meta">Preparing…</T> : 'chev'} />
      <Row icon="calendar" title="Add to Calendar" meta="Every plan as a calendar event" onPress={() => void run('ics', () => exportCalendar(trip))} trailing={busy === 'ics' ? <T v="meta">Preparing…</T> : 'chev'} />
      <Row icon="copy" title="Duplicate" meta="Same plan, fresh packing and costs" onPress={duplicate} />
    </Group>
    <Stack gap={8}><FieldLabel>Kind of trip</FieldLabel>
      <Chips value={TRIP_KINDS.indexOf(extras.kind)} onChange={(i) => editExtras((d) => { d.kind = TRIP_KINDS[i]; })} items={TRIP_KINDS.map((k) => ({ label: KIND_LABEL[k] }))} />
      <Note>Treks add route, gear and safety tabs. Dives add tides and a dive log.</Note>
    </Stack>
    <Group><Row icon="trash" tint="rose" title="Delete trip" onPress={remove} /></Group>
  </Sheet>;
}

/* ------------------------------------------------------------------ Trip form (new and edit) */

export type TripDraft = { name: string; destination: string; start: string; end: string; travellers: string; budget: string; currency: string; weightLimit: string; theme: Mood; kind: TripKind; notes: string; /** Uploaded cover photo path, or ''. */ photo: string };
export type TripErrors = Partial<Record<keyof TripDraft, string>>;

/**
 * The cover: the person's own photo (uploaded to their image store) or one of the mood illustrations.
 * Choosing an illustration sets the photo aside; the photo tile offers to change or remove it.
 */
function CoverPicker({ value, onChange, photo, onPhoto }: { value: Mood; onChange: (m: Mood) => void; photo: string; onPhoto: (path: string) => void }) {
  const ws = useWorkspace();
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true };
    if (!perm.granted) { Alert.alert('Camera access is off', 'Allow camera access for Trips Loom in Settings, or choose a photo instead.'); return; }
    // No crop step: iOS only offers a square crop, and the cover frames the whole photo itself. 60% keeps a
    // full-size photo under the server's 5 MB limit.
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, exif: false };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPreview(asset.uri);
    setUploading(true);
    try {
      onPhoto(await ws.uploadWardrobePhoto(asset.uri, asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg'));
    } catch (e) {
      reportError(e, 'Couldn’t upload the photo');
    } finally { setPreview(null); setUploading(false); }
  };
  const choose = () => {
    if (uploading) return;
    // The picker opens once the alert has finished closing; presenting during its dismissal can leave iOS stuck.
    const later = (camera: boolean) => () => { setTimeout(() => void pick(camera), 450); };
    Alert.alert(photo ? 'Cover photo' : 'Add a cover photo', undefined, [
      { text: 'Choose from library', onPress: later(false) },
      { text: 'Take photo', onPress: later(true) },
      ...(photo ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => onPhoto('') }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };
  const tile = (on: boolean, art: React.ReactNode) => <View style={{ borderRadius: radii.tile, borderWidth: 3, borderColor: on ? colors.inkButton : 'transparent' }}>
    {art}
    {on ? <View style={{ position: 'absolute', right: 4, bottom: 4, width: 24, height: 24, borderRadius: radii.check, backgroundColor: colors.inkButton, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /></View> : null}
  </View>;
  const shown = preview || photo;
  return <Stack gap={8}><FieldLabel>Cover</FieldLabel>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
      <PressScale accessibilityRole="button" accessibilityLabel={photo ? 'Cover photo: change or remove' : 'Upload a cover photo'} onPress={choose} style={{ alignItems: 'center', gap: 4 }}>
        {tile(!!photo, shown
          ? <View style={{ width: 68, height: 68, borderRadius: radii.tile, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {preview ? <Image source={{ uri: preview }} style={{ position: 'absolute', width: 68, height: 68 }} /> : <CoverImage trip={{ theme: value }} extras={{ cover: photo }} width={68} height={68} />}
            {uploading ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color="#FFFFFF" /></View> : null}
          </View>
          : <View style={{ width: 68, height: 68, borderRadius: radii.tile, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.stone, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }}>
            <Icon name="camera" size={22} color={colors.ink} />
          </View>)}
        <T v="meta" style={{ fontSize: 11 }}>{uploading ? 'Uploading…' : photo ? 'Your photo' : 'Upload'}</T>
      </PressScale>
      {TRIP_MOODS.map((mood) => {
        const on = !photo && mood === value;
        return <PressScale key={mood} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={MOOD_LABEL[mood]} onPress={() => { onChange(mood); if (photo) onPhoto(''); }} style={{ alignItems: 'center', gap: 4 }}>
          {tile(on, <Illustration name={MOOD_ART[mood]} width={68} height={68} radius={9} />)}
          <T v="meta" style={{ fontSize: 11 }}>{MOOD_LABEL[mood]}</T>
        </PressScale>;
      })}
    </ScrollView>
  </Stack>;
}

export function TripForm({ draft, set, errors }: { draft: TripDraft; set: (patch: Partial<TripDraft>) => void; errors: TripErrors }) {
  return <>
    <Field label="Trip name" value={draft.name} onChangeText={(name) => set({ name })} icon="edit" maxLength={200} error={errors.name} placeholder="Weekend in Lisbon" />
    <PlaceField label="Destination" value={draft.destination} onChange={(destination) => set({ destination })} error={errors.destination} />
    <RowView align="flex-start">
      <DateField flex label="From" value={draft.start} onChange={(start) => set({ start, end: draft.end < start ? start : draft.end })} />
      <DateField flex label="To" value={draft.end} min={draft.start} onChange={(end) => set({ end })} />
    </RowView>
    {errors.end ? <T v="meta" color={colors.danger}>{errors.end}</T> : null}
    <Stack gap={8}><FieldLabel>Kind of trip</FieldLabel>
      <Chips value={TRIP_KINDS.indexOf(draft.kind)} onChange={(i) => set({ kind: TRIP_KINDS[i], theme: draft.theme === KIND_MOOD[draft.kind] ? KIND_MOOD[TRIP_KINDS[i]] : draft.theme })}
        items={TRIP_KINDS.map((k) => ({ label: KIND_LABEL[k] }))} />
    </Stack>
    <CoverPicker value={draft.theme} onChange={(theme) => set({ theme })} photo={draft.photo} onPhoto={(photo) => set({ photo })} />
    <RowView align="flex-start">
      <Field flex label="Travellers" value={draft.travellers} onChangeText={(travellers) => set({ travellers: travellers.replace(/\D/g, '').slice(0, 3) })} icon="users" kind="count" error={errors.travellers} />
      <Field flex label="Bag limit (kg)" value={draft.weightLimit} onChangeText={(weightLimit) => set({ weightLimit })} icon="trips" kind="number" placeholder="None" error={errors.weightLimit} />
    </RowView>
    <RowView align="flex-start">
      <Field flex label="Budget" value={draft.budget} onChangeText={(budget) => set({ budget })} icon="card" kind="number" placeholder="No limit" error={errors.budget} />
      <CurrencyField flex value={draft.currency} onChange={(currency) => set({ currency })} />
    </RowView>
    <Field label="Notes" value={draft.notes} onChangeText={(notes) => set({ notes })} multiline maxLength={5000} placeholder="Anything to remember" />
  </>;
}

export function validateTrip(d: TripDraft): TripErrors {
  const e: TripErrors = {};
  if (!d.name.trim()) e.name = 'Give the trip a name.';
  if (!d.destination.trim()) e.destination = 'Where are you going?';
  if (d.end < d.start) e.end = 'The trip has to end on or after the day it starts.';
  else if (daysFromToday(d.end, d.start) > 365) e.end = 'Trips can be at most 366 days.';
  const travellers = Number(d.travellers);
  if (!Number.isInteger(travellers) || travellers < 1 || travellers > 100) e.travellers = '1 to 100.';
  const budget = d.budget.trim() ? Number(d.budget.replace(',', '.')) : 0;
  if (!Number.isFinite(budget) || budget < 0 || budget > 10000000) e.budget = 'Up to 10,000,000.';
  const weight = d.weightLimit.trim() ? Number(d.weightLimit.replace(',', '.')) : 0;
  if (!Number.isFinite(weight) || weight < 0 || weight > 1000) e.weightLimit = '0 to 1,000 kg.';
  return e;
}

export const draftFromTrip = (t: Trip, kind: TripKind, photo = ''): TripDraft => ({
  name: t.name, destination: t.destination, start: t.start, end: t.end, travellers: String(t.travellers), budget: t.budget ? String(t.budget) : '',
  currency: t.currency, weightLimit: t.weightLimit ? String(t.weightLimit) : '', theme: (t.theme ?? 'mountains') as Mood, kind, notes: t.notes ?? '', photo,
});

export function applyDraft(t: Trip, d: TripDraft) {
  t.name = d.name.trim(); t.destination = d.destination.trim(); t.start = d.start; t.end = d.end;
  t.travellers = Number(d.travellers) || 1; t.budget = Number(d.budget.replace(',', '.')) || 0;
  t.currency = d.currency as Trip['currency']; t.weightLimit = Number(d.weightLimit.replace(',', '.')) || 0;
  t.theme = d.theme; t.notes = d.notes;
  // Plans and day notes outside the new dates can't be kept (the server rejects them).
  t.activities = t.activities.filter((a) => a.date >= d.start && a.date <= d.end);
  t.days = Object.fromEntries(Object.entries(t.days).filter(([date]) => date >= d.start && date <= d.end));
}

export function EditTripSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const [draft, setDraft] = useState<TripDraft | null>(current ? draftFromTrip(current.trip, current.extras.kind, current.extras.cover) : null);
  const [errors, setErrors] = useState<TripErrors>({});
  const dirty = useDirty([draft]);
  if (!current || !draft) return <Sheet title="Edit trip"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const save = () => {
    const e = validateTrip(draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    const outside = current.trip.activities.filter((a) => a.date < draft.start || a.date > draft.end).length;
    const commit = () => {
      if (current.editTrip((t) => applyDraft(t, draft))) {
        if (draft.kind !== current.extras.kind || draft.photo !== current.extras.cover) current.editExtras((x) => { x.kind = draft.kind; x.cover = draft.photo; });
        router.back();
      }
    };
    if (outside) {
      Alert.alert('Remove plans outside the new dates?', `${plural(outside, 'plan')} fall outside ${dateRange(draft.start, draft.end)} and will be removed.`, [
        { text: 'Cancel', style: 'cancel' }, { text: 'Remove and save', style: 'destructive', onPress: commit },
      ]);
    } else commit();
  };
  return <Sheet title="Edit trip" dirty={dirty} footer={<Button label="Save" icon="check" onPress={save} />}>
    <TripForm draft={draft} set={(patch) => setDraft({ ...draft, ...patch })} errors={errors} />
  </Sheet>;
}

/* ------------------------------------------------------------------ Days */

/** A plan's likely kind from its title, or null when nothing fits. */
export function guessPlanKind(title: string): Activity['category'] | null {
  const s = title.toLowerCase();
  if (/\b(flight|fly|airport|train|ferry|bus|coach|transfer|taxi|drive|car hire|rental|check-out|depart|departure)\b/.test(s)) return 'Travel';
  if (/\b(hotel|hostel|airbnb|apartment|check-in|check in|ryokan|guesthouse|lodge|camping)\b/.test(s)) return 'Stay';
  if (/\b(dinner|lunch|breakfast|brunch|cafe|café|coffee|restaurant|bar|drinks|tapas|food|market|wine|tasting)\b/.test(s)) return 'Food & drink';
  if (/\b(concert|show|match|game|festival|theatre|theater|opera|gig|party|wedding)\b/.test(s)) return 'Event';
  if (/\b(museum|gallery|tour|walk|hike|beach|park|cathedral|church|temple|palace|castle|view|viewpoint)\b/.test(s)) return 'Explore';
  return null;
}

export function initialDay(trip: Trip, param?: string): string {
  const dates = tripDates(trip);
  if (param && dates.includes(param)) return param;
  const today = todayISO();
  return dates.includes(today) ? today : dates[0];
}

export function DayStrip({ dates, value, onChange, weather }: { dates: string[]; value: string; onChange: (d: string) => void; weather?: Record<string, { code: number }> }) {
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, dates.indexOf(value));
  useEffect(() => { const t = setTimeout(() => ref.current?.scrollTo({ x: Math.max(0, index * 62 - 120), animated: false }), 50); return () => clearTimeout(t); }, [index]);
  const today = todayISO();
  return <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -16, marginVertical: -12 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
    {dates.map((d) => {
      const on = d === value;
      return <DayChip key={d} top={weekday(d)} bottom={String(dayOfMonth(d))} on={on} today={d === today} label={`${longDay(d)}${d === today ? ', today' : ''}`} onPress={() => onChange(d)}
        below={<View collapsable={false} style={{ height: 12, width: 12 }}>
          {/* One fixed slot whether or not the forecast has arrived: swapping an icon for a flattened spacer
              changed the native child order mid-animation and crashed (unmount index mismatch). */}
          {weather?.[d] ? <Icon name={weatherIcon(weather[d].code)} size={12} color={on ? '#FFFFFF' : colors.stone} /> : null}
        </View>} />;
    })}
  </ScrollView>;
}

export function DaysScreen() {
  const current = useCurrentTrip();
  const prefs = usePrefs();
  const router = useRouter();
  const { workspace, status } = useTrips();
  const params = useLocalSearchParams<{ date?: string }>();
  const weather = useTripWeather(current?.trip ?? null);
  const [date, setDate] = useState(current ? initialDay(current.trip, params.date) : '');
  if (!current) return status === 'loading' ? <Loading /> : <NoTrip />;
  const { trip, editTrip } = current;
  const dates = tripDates(trip);
  const day = dates.includes(date) ? date : dates[0];
  const plans = plansOn(trip, day);
  const info = trip.days[day];
  const wx = weather[day];
  const outfit = workspace?.outfits.find((o) => o.id === info?.outfitId);
  const outfitItems = outfit && workspace ? workspace.items.filter((i) => outfit.items.includes(i.id)) : [];
  const t = (c: number) => prefs.unit === 'imperial' ? `${Math.round(c * 9 / 5 + 32)}°` : `${c}°`;
  const city = trip.destination.split(',')[0].trim();
  const toggleDone = (a: Activity) => editTrip((tr) => { const x = tr.activities.find((y) => y.id === a.id); if (x) x.completed = !x.completed; });
  return <Screen bar="tabs">
    <Header title="Itinerary" right={<RowView gap={8}><RoundButton icon="share" label={`Send ${weekday(day)}’s plan to the group`} onPress={() => void shareText(dayMessage(trip, current.extras, day, prefs.name, prefs.native.shareLanguage), 'day_sheet_shared', dayCard(trip, day, prefs.native.shareLanguage))} /><RoundButton icon="map" label="Map" href="/trip/map" /><RoundButton icon="plus" dark label="Add a plan" onPress={() => router.push({ pathname: '/add-plan', params: { date: day } } as never)} /></RowView>} />
    <DayStrip dates={dates} value={day} onChange={setDate} weather={weather} />
    {/* Another day cross-fades in instead of snapping. */}
    <Swap k={day} style={{ gap: 16 }}>
    <RowView style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
      <View style={{ flex: 1 }}><T v="section">{longDay(day)}</T><T v="meta">Day {dates.indexOf(day) + 1} of {dates.length}{info?.title ? ` · ${info.title}` : ''}</T></View>
      {wx ? <RowView gap={6}><Icon name={weatherIcon(wx.code)} size={18} color={colors.stone} /><T v="small" style={{ fontSize: 14 }}>{t(wx.high)} / {t(wx.low)}{wx.typical ? ' · usually' : ''}</T></RowView> : null}
    </RowView>
    {plans.length ? <Stack>{plans.map((a, i) => <MediaRow key={a.id} ill={planArt(trip, a)} eyebrow={`${CATEGORY[a.category].label}${a.time ? ` · ${planTimes(a.time, a.endTime)}` : ''}`} tint={CATEGORY[a.category].tint}
      title={a.title} meta={[placeOf(a), a.cost ? money(a.cost, trip.currency) : ''].filter(Boolean).join(' · ') || 'Tap to add details'}
      onPress={() => router.push({ pathname: '/add-plan', params: { id: a.id } } as never)}
      trailing={<PressScale accessibilityRole="checkbox" accessibilityState={{ checked: !!a.completed }} accessibilityLabel={`${a.title} done`} hitSlop={10} onPress={() => toggleDone(a)}><Checkbox checked={!!a.completed} /></PressScale>} />)}</Stack>
      : <Card><T v="row" style={{ fontSize: 15 }}>Nothing planned yet</T><T v="small">Add a sight, a meal or a booking for {shortDay(day)}.</T></Card>}
    <Dashed label={`Add a plan to ${weekday(day)}`} onPress={() => router.push({ pathname: '/add-plan', params: { date: day } } as never)} />
    {plans.some((a) => a.place.trim()) ? <Button label={plans.filter((a) => a.place.trim()).length > 1 ? `Route for ${weekday(day)} in Maps` : 'Directions in Maps'} icon="map" kind="white" height={48}
      onPress={() => void openRoute(plans.map((a) => a.place), city).catch((e) => reportError(e, 'Couldn’t open Maps'))} /> : null}
    <Group>
      <Row icon="bed" title={info?.stay ? info.stay : 'Where you’re staying'} meta={info?.stay ? 'Tap to change the stay, title or notes' : 'Add a stay, a day title or notes'}
        onPress={() => router.push({ pathname: '/day', params: { date: day } } as never)} />
      <Row leading={outfitItems.length ? <Swatches colors={outfitItems.slice(0, 3).map((i) => i.color || '#8b8b73')} /> : undefined} icon={outfitItems.length ? undefined : 'wardrobe'}
        title={outfit ? `${weekday(day)}’s outfit` : 'Plan an outfit'} meta={outfitItems.length ? outfitItems.map((i) => i.name).join(', ') : 'From the clothes in your wardrobe'}
        onPress={() => router.push({ pathname: '/trip/stylist', params: { date: day } } as never)} />
    </Group>
    </Swap>
  </Screen>;
}

/** Stay, title and notes for one day. */
export function DaySheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = current ? initialDay(current.trip, params.date) : '';
  const info = current?.trip.days[date];
  const [stay, setStay] = useState(info?.stay ?? '');
  const [title, setTitle] = useState(info?.title ?? '');
  const [notes, setNotes] = useState(info?.notes ?? '');
  const [allNights, setAllNights] = useState(false);
  const dirty = useDirty([stay, title, notes, allNights]);
  if (!current) return <Sheet title="Day"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const save = () => {
    if (current.editTrip((t) => {
      const dates = allNights ? tripDates(t).filter((d) => d >= date && d < t.end) : [date];
      for (const d of dates.length ? dates : [date]) t.days[d] = { ...(t.days[d] ?? blankDay()), stay: stay.trim().slice(0, 200) };
      t.days[date] = { ...(t.days[date] ?? blankDay()), stay: stay.trim().slice(0, 200), title: title.trim().slice(0, 200), notes: notes.slice(0, 5000) };
    })) router.back();
  };
  return <Sheet title={longDay(date)} dirty={dirty} footer={<Button label="Save" icon="check" onPress={save} />}>
    <Field label="Where you’re staying" value={stay} onChangeText={setStay} kind="spot" icon="bed" placeholder="Hotel, flat, refuge…" maxLength={200} />
    {date < current.trip.end ? <Group><Row icon="calendar" title="Same stay for the rest of the trip" meta="Fills every later night" trailing={<Toggle value={allNights} onChange={setAllNights} label="Same stay for later nights" />} /></Group> : null}
    <Field label="Day title" value={title} onChangeText={setTitle} icon="edit" placeholder="Arrival day, a day at the beach" maxLength={200} />
    <Field label="Notes" value={notes} onChangeText={setNotes} multiline maxLength={5000} placeholder="Reservations, reminders…" />
  </Sheet>;
}

/* ------------------------------------------------------------------ Add / edit plan */

export function AddPlanSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; date?: string; category?: string; title?: string }>();
  const existing = current?.trip.activities.find((a) => a.id === params.id);
  const [title, setTitle] = useState(existing?.title ?? params.title ?? '');
  const [category, setCategory] = useState<Activity['category']>(existing?.category ?? ((ACTIVITY_TYPES as readonly string[]).includes(params.category ?? '') ? params.category as Activity['category'] : 'Explore'));
  const [date, setDate] = useState(existing?.date ?? (current ? initialDay(current.trip, params.date) : ''));
  // Until the person picks a kind (or opened the sheet with one), guess it from the title ("Flight" → Move).
  const [picked, setPicked] = useState(!!existing || !!params.category);
  const [time, setTime] = useState(existing?.time ?? '');
  const [endTime, setEndTime] = useState(existing?.endTime ?? '');
  const [place, setPlace] = useState(existing?.place ?? '');
  const [cost, setCost] = useState(existing?.cost ? String(existing.cost) : '');
  const [link, setLink] = useState(existing?.link ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [done, setDone] = useState(!!existing?.completed);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = useDirty([title, category, date, time, endTime, place, cost, link, notes, done]);
  if (!current) return <Sheet title="Add a plan"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const { trip, editTrip } = current;
  const save = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'What’s the plan?';
    const price = cost.trim() ? Number(cost.replace(',', '.')) : 0;
    if (!Number.isFinite(price) || price < 0 || price > 10000000) e.cost = 'Enter a price, or leave it empty.';
    if (link.trim() && !safeLink(link.trim())) e.link = 'Use a full https:// link.';
    if (endTime && (!time || endTime <= time)) e.endTime = 'It has to end after it starts.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const ok = editTrip((t) => {
      const value: Activity = {
        id: existing?.id ?? uid(), date, time, endTime, title: title.trim().slice(0, 200), place: place.trim().slice(0, 200), category,
        cost: Math.round(price * 100) / 100, link: link.trim(), notes: notes.slice(0, 5000), outfitId: existing?.outfitId ?? '', gear: existing?.gear ?? [], completed: done,
      };
      const i = t.activities.findIndex((a) => a.id === value.id);
      if (i >= 0) t.activities[i] = value; else t.activities.push(value);
    });
    if (ok) router.back();
  };
  const remove = () => Alert.alert('Delete this plan?', existing?.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {
    if (editTrip((t) => { t.activities = t.activities.filter((a) => a.id !== existing!.id); })) router.back();
  } }]);
  return <Sheet title={existing ? 'Edit plan' : 'Add a plan'} dirty={dirty} footer={<SheetActions primary={<Button label={existing ? 'Save' : `Add to ${weekday(date)}`} icon={existing ? 'check' : 'plus'} onPress={save} />} actions={[
    !!existing && isFlightPlan({ category, title, notes }) && { icon: 'plane', label: 'Live flight status', onPress: () => router.push({ pathname: '/flight', params: { id: existing.id } } as never) },
    !!existing && !!place.trim() && { icon: 'map', label: 'Directions', onPress: () => void openRoute([place], current.trip.destination.split(',')[0].trim()).catch((e) => reportError(e, 'Couldn’t open Maps')) },
    !!existing && { icon: 'trash', label: 'Delete plan', onPress: remove, danger: true },
  ]} />}>
    <Field label="What" value={title} onChangeText={(v) => { setTitle(v); setErrors({ ...errors, title: '' }); if (!picked) { const g = guessPlanKind(v); if (g) setCategory(g); } }} icon="edit" placeholder="Museum visit, dinner, a walking tour" maxLength={200} error={errors.title} autoFocus={!existing} />
    <Stack gap={8}><FieldLabel>Kind</FieldLabel><Chips value={ACTIVITY_TYPES.indexOf(category)} onChange={(i) => { setPicked(true); setCategory(ACTIVITY_TYPES[i]); }} items={ACTIVITY_TYPES.map((k) => ({ label: CATEGORY[k].label, icon: CATEGORY[k].icon }))} /></Stack>
    <DateField label="Day" value={date} onChange={setDate} min={trip.start} max={trip.end} />
    <RowView align="flex-start">
      <TimeField flex label="Starts" value={time} onChange={setTime} optional />
      <TimeField flex label="Ends" value={endTime} onChange={setEndTime} optional />
    </RowView>
    {errors.endTime ? <T v="meta" color={colors.danger}>{errors.endTime}</T> : null}
    <Field label="Where" value={place} onChangeText={setPlace} icon="pin" kind="place" placeholder="Address or neighbourhood" maxLength={200} />
    <Field label={`Cost (${trip.currency})`} value={cost} onChangeText={setCost} icon="card" kind="number" placeholder="Free" error={errors.cost} />
    <Field label="Link" value={link} onChangeText={setLink} icon="link" kind="email" placeholder="https://" error={errors.link} maxLength={2000}
      trailing={link && safeLink(link) ? <PressScale accessibilityRole="link" accessibilityLabel="Open link" hitSlop={8} onPress={() => void WebBrowser.openBrowserAsync(link)}><Icon name="chev" size={16} color={colors.stone} /></PressScale> : null} />
    <Field label="Notes" value={notes} onChangeText={setNotes} multiline maxLength={5000} placeholder="Booking reference, what to bring…" />
    {existing ? <Group><Row icon="check" title="Done" meta="Tick it off when it’s happened" trailing={<Toggle value={done} onChange={setDone} label="Done" />} /></Group> : null}
  </Sheet>;
}

/* ------------------------------------------------------------------ Recap */

export function RecapHeader({ trip }: { trip: Trip }) {
  return <Header title="Recap" right={<RoundButton icon="share" label="Share itinerary PDF" onPress={() => void exportItineraryPDF(trip).catch((e) => reportError(e, 'Couldn’t share'))} />} />;
}

/** The recap's summary header. Also drawn by the shared transition from Home. */
export function RecapHero({ trip, extras }: { trip: Trip; extras: TripExtras }) {
  const rates = useRates(trip.currency);
  const st = statusOf(trip);
  const budget = budgetOf(trip, extras, rates, trip.currency);
  const outfits = new Set(Object.values(trip.days).map((d) => d.outfitId).filter(Boolean)).size;
  // One line per number: long totals ("₹1,21,900") shrink to fit instead of wrapping mid-number.
  const stat = (value: string, label: string, wide?: boolean) => <View style={{ flex: wide ? 1.6 : 1, gap: 2, minWidth: 0 }}>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.medium, fontSize: 22, letterSpacing: -0.4, color: '#FFFFFF' }}>{value}</Text>
    <HeroText v="meta" lines={1} style={{ opacity: 0.85 }}>{label}</HeroText></View>;
  return <Hero>
    <RowView align="flex-start" style={{ justifyContent: 'space-between' }}>
      <View style={{ gap: 4, flex: 1 }}>
        <HeroText v="small" style={{ fontFamily: fonts.medium, fontSize: 14 }}>{st.phase === 'past' ? 'Recap' : 'So far'}</HeroText>
        <HeroText v="display" style={{ lineHeight: 34 }}>{trip.name}</HeroText>
        <HeroText faint style={{ fontSize: 14 }}>{dateRange(trip.start, trip.end)}{extras.people.length ? ` · with ${extras.people.map((p) => p.name).join(', ')}` : ''}</HeroText>
      </View>
      <CoverImage trip={trip} extras={extras} width={84} height={84} radius={radii.card} />
    </RowView>
    <HeroRule />
    <RowView gap={8}>{stat(String(st.totalDays), st.totalDays === 1 ? 'day' : 'days')}{stat(String(trip.activities.length), 'plans')}{stat(String(outfits), 'outfits')}{stat(money(budget.planned, trip.currency, true), 'total', true)}</RowView>
  </Hero>;
}

export function RecapScreen() {
  const current = useCurrentTrip();
  const auth = useAuth();
  const prefs = usePrefs();
  const { status } = useTrips();
  const rates = useRates(current?.trip.currency ?? 'EUR');
  const [note, setNote] = useState(current?.extras.recapNote ?? '');
  // A finished trip is the happiest moment to ask for a review; ask once, after the recap has been seen.
  const finished = !!current && current.trip.end < todayISO();
  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => { void askForReview(); }, 2500);
    return () => clearTimeout(t);
  }, [finished]);
  if (!current) return status === 'loading' ? <Loading /> : <NoTrip />;
  const { trip, extras, editExtras } = current;
  const budget = budgetOf(trip, extras, rates, trip.currency);
  const done = trip.activities.filter((a) => a.completed);
  const highlights = (done.length ? done : trip.activities).filter((a) => a.category === 'Explore' || a.category === 'Event' || a.category === 'Food & drink').slice(0, 4);
  // "Do it again": the days and plans (no costs or notes) as a link anyone can copy onto their own dates.
  const shareTemplate = async () => {
    if (!auth.client) { Alert.alert('You’re offline', 'Connect to share the plan.'); return; }
    try {
      const people = Math.max(1, extras.people.length + 1);
      const spent = extras.expenses.reduce((a, e) => a + (e.currency === trip.currency ? e.amount : 0), 0);
      const code = await publishTemplate(auth.client, trip, extras, prefs.name, spent / people);
      await shareText(`Our ${trip.name} plan, day by day. Copy it for your own trip: ${templateLink(code)}`, 'template_shared');
    } catch (e) { reportError(e, 'Couldn’t share the plan'); }
  };
  return <Screen>
    <RecapHeader trip={trip} />
    <ExpandTarget id="recap"><RecapHero trip={trip} extras={extras} /></ExpandTarget>
    <Card>
      <RowView style={{ justifyContent: 'space-between' }}>
        <View style={{ gap: 2, flex: 1 }}><T v="row" style={{ fontSize: 15 }}>How was it?</T><T v="meta">Your rating stays private</T></View>
        <RowView gap={4}>{[1, 2, 3, 4, 5].map((n) => <PressScale key={n} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} accessibilityState={{ selected: extras.rating >= n }} hitSlop={4}
          onPress={() => editExtras((d) => { d.rating = d.rating === n ? 0 : n; })}><Icon name="star" size={26} filled color={extras.rating >= n ? colors.ember : colors.track} /></PressScale>)}</RowView>
      </RowView>
      <Field label="A note for next time" value={note} onChangeText={setNote} onBlur={() => editExtras((d) => { d.recapNote = note; })} multiline maxLength={2000} placeholder="What you’d do again, or differently" />
    </Card>
    {highlights.length ? <Section title="Highlights">
      <Stack>{highlights.map((a, i) => <MediaRow key={a.id} ill={planArt(trip, a)} eyebrow={longDay(a.date)} tint={CATEGORY[a.category].tint} title={a.title} meta={placeOf(a) || CATEGORY[a.category].label} trailing={null} />)}</Stack>
    </Section> : null}
    {budget.limit ? <Note>Budget {money(budget.limit, trip.currency)} · {budget.remaining >= 0 ? `${money(budget.remaining, trip.currency)} under` : `${money(-budget.remaining, trip.currency)} over`}</Note> : null}
    {extras.journal.length ? <Section title="Where you went">
      <Group>{[...extras.journal].sort((a, b) => a.at.localeCompare(b.at)).map((s) => <Row key={s.id} icon="pin" title={s.place || 'Check-in'} meta={`${shortDay(localDay(s.at))} · ${clockTime(s.at)}`} trailing={null} />)}</Group>
    </Section> : null}
    <Button label="Make a travel book (PDF)" icon="doc" onPress={() => {
      const byCat = EXPENSE_CATEGORIES.map((c) => ({ label: EXPENSE_LABEL[c], amount: extras.expenses.filter((e) => e.category === c).reduce((sum, e) => sum + convert(e.amount, e.currency, trip.currency, rates, trip.currency), 0) })).filter((x) => x.amount > 0);
      const country = trip.destination.split(',').length > 1 ? [trip.destination.split(',').pop()!.trim()] : [];
      void exportTravelBook(trip, extras, byCat, country).catch((e) => reportError(e, 'Couldn’t make the travel book'));
    }} />
    <Button label="Map of the trip" icon="map" kind="white" href="/trip/map" />
    <Button label="Share the trip in numbers" icon="share" kind="white" onPress={() => void shareText(recapMessage(trip, extras, rates, prefs.native.shareLanguage), 'recap_shared', recapCard(trip, extras))} />
    <Button label="Share it as a plan others can copy" icon="copy" kind="white" onPress={() => void shareTemplate()} />
  </Screen>;
}
