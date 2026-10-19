/**
 * The group's shortlist ("Reel-to-Room"): places people want to go, from a reel or post link, a Google Maps link, a
 * caption or a screenshot. Everyone votes; top places go onto the days, grouped by area so each day stays local.
 * Also the plain-words summary of where the group stands (votes, dates, who's in).
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from '../core/nav';
import { track } from '../core/analytics';
import { useCurrentTrip } from '../core/state';
import { ME, tripDates, uid, type Trip, type TripExtras } from '../data';
import { dateRange, plural, shortDay, todayISO } from '../domain/format';
import { freeDays, groupByArea, type Candidate } from '../domain/shortlist';
import { nameOf } from '../domain/trips';
import {
  Button, Card, CheckToggle, colors, EmptyState, Field, Group, haptic, Icon, IconTile, Note, PressScale, radii, Row, RowView, Section, Sheet, SheetActions, Stack, T, Tag,
} from '../loom';
import { canScanReceipts, readImageText } from '../services/intelligence';
import { findPlaces, locate } from '../services/shortlist';

/* ------------------------------------------------------------------ Shortlist on the Shared tab */

export function ShortlistCard({ trip, extras, onAdd, onPlan, editExtras }: {
  trip: Trip; extras: TripExtras; onAdd: () => void; onPlan: () => void; editExtras: (fn: (d: TripExtras) => void) => void;
}) {
  const items = [...extras.shortlist].sort((a, b) => b.votes.length - a.votes.length || a.createdAt.localeCompare(b.createdAt));
  const people = Math.max(1, extras.members.filter((m) => m.rsvp !== 'out').length || extras.people.length + 1);
  const vote = (id: string) => {
    haptic.select();
    editExtras((d) => { const x = d.shortlist.find((s) => s.id === id); if (!x) return; x.votes = x.votes.includes(ME) ? x.votes.filter((v) => v !== ME) : [...x.votes, ME]; });
    track('vote_cast', { poll: 'shortlist' });
  };
  const unplanned = items.filter((x) => !x.planned && x.votes.length);
  return <Section title="Shortlist" action="Add a place" onAction={onAdd}>
    {items.length ? <Card>
      {items.slice(0, 8).map((x) => <RowView key={x.id} gap={12}>
        <CheckToggle checked={x.votes.includes(ME)} label={`I want to go to ${x.title}`} onChange={() => vote(x.id)} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="row" style={{ fontSize: 15 }} lines={1}>{x.title}</T>
          <T v="meta" lines={1}>{x.planned ? `On ${shortDay(x.planned)}` : `${x.votes.length} of ${people} want to go`}{x.addedBy && x.addedBy !== ME ? ` · from ${nameOf(extras.people, x.addedBy)}` : ''}</T>
        </View>
        {x.planned ? <Tag text="Planned" tint="mint" /> : null}
      </RowView>)}
      {items.length > 8 ? <T v="meta">and {items.length - 8} more</T> : null}
      <Button label={unplanned.length ? 'Plan the days together' : 'Open the planning board'} icon="sparkle" kind="mist" height={44} onPress={onPlan} />
    </Card> : <Card>
      <RowView gap={12}><IconTile icon="pin" tint="peach" /><View style={{ flex: 1, gap: 2 }}>
        <T v="row" style={{ fontSize: 15 }}>Saw a place on a reel?</T>
        <T v="meta">Paste the link, a Maps pin or a screenshot here. Everyone votes, and the favourites go on the days.</T>
      </View></RowView>
      <Button label="Add a place" icon="plus" kind="mist" height={44} onPress={onAdd} />
    </Card>}
  </Section>;
}

/* ------------------------------------------------------------------ Adding places */

export function ShortlistAddSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'find' | 'shot' | null>(null);
  const [found, setFound] = useState<Candidate[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  if (!current) return <Sheet title="Add a place"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const { trip, editExtras } = current;
  const city = trip.destination.split(',')[0]?.trim().toLowerCase() ?? '';
  const find = async (input: string) => {
    if (!input.trim()) return;
    setBusy('find');
    try {
      const places = (await findPlaces(input)).filter((c) => c.title.toLowerCase() !== city);
      const located = await Promise.all(places.map((c) => locate(c, trip.destination)));
      setFound(located);
      setPicked(new Set(located.map((_, i) => i)));
      if (!located.length) Alert.alert('No places found', 'Try pasting the place name, a Google Maps link, or a screenshot that shows the name.');
    } finally { setBusy(null); }
  };
  const paste = async () => {
    const clip = (await Clipboard.getStringAsync()).slice(0, 5000);
    if (!clip.trim()) { Alert.alert('Nothing to paste', 'Copy a reel, post or Maps link (or the caption) first, or type the place below.'); return; }
    setText(clip);
    void find(clip);
  };
  const screenshot = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (result.canceled || !result.assets[0]) return;
    setBusy('shot');
    try {
      const read = await readImageText(result.assets[0].uri);
      setText(read);
      await find(read);
    } catch { Alert.alert('Couldn’t read the screenshot', 'Paste the place name or link instead.'); } finally { setBusy(null); }
  };
  const add = () => {
    const chosen = (found ?? []).filter((_, i) => picked.has(i));
    if (!chosen.length) return;
    editExtras((d) => {
      for (const c of chosen) {
        if (d.shortlist.some((x) => x.title.toLowerCase() === c.title.toLowerCase())) continue;
        d.shortlist.push({ id: uid(), title: c.title, place: c.title, ...(c.lat !== undefined ? { lat: c.lat, lng: c.lng } : {}), ...(c.url ? { url: c.url } : {}),
          note: '', addedBy: ME, votes: [ME], planned: '', createdAt: new Date().toISOString() });
      }
    });
    track('shortlist_added', { count: chosen.length });
    router.back();
  };
  return <Sheet title="Add a place" footer={found?.length ? <Button label={`Add ${plural(picked.size, 'place')}`} icon="plus" onPress={add} />
    : <SheetActions primary={<Button label={busy === 'find' ? 'Finding places…' : 'Paste a link or text'} icon={busy ? undefined : 'copy'} leading={busy ? <ActivityIndicator color="#FFFFFF" /> : undefined} onPress={() => void paste()} />}
      actions={[canScanReceipts && { icon: 'image', label: busy === 'shot' ? 'Reading the screenshot' : 'From a screenshot', onPress: () => void screenshot() }]} />}>
    {found?.length ? <>
      <Note>Found in what you shared. Untick anything that isn’t a place you want to go.</Note>
      <Group>{found.map((c, i) => <Row key={i} icon="pin" tint={c.lat !== undefined ? 'mint' : 'grey'} title={c.title} meta={c.lat !== undefined ? 'On the map' : 'Couldn’t find it on the map yet'}
        trailing={<CheckToggle checked={picked.has(i)} label={c.title} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />} />)}</Group>
      <Button label="Try something else" kind="mist" height={44} onPress={() => { setFound(null); setText(''); }} />
    </> : <>
      <Note>Share a reel or post link, a Google Maps link, the caption, or just type the place. Screenshots are read on this phone.</Note>
      <Field label="Link, caption or place" value={text} onChangeText={setText} multiline icon="link" placeholder={'https://www.instagram.com/reel/…\nor “Thalassa, Vagator”'} maxLength={5000}
        onSubmitEditing={() => void find(text)} />
      {text.trim() ? <Button label="Find places" icon="search" kind="white" height={48} onPress={() => void find(text)} /> : null}
    </>}
  </Sheet>;
}

/* ------------------------------------------------------------------ Shortlist → days */

/** Puts the top unplanned places onto the trip's quietest days, a few per day, grouped by area. */
export function ShortlistPlanSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  if (!current) return <Sheet title="Plan the shortlist"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const { trip, extras, editTrip, editExtras } = current;
  // Only days still to come (a trip under way shouldn't get plans in its past).
  const today = todayISO();
  const dates = tripDates(trip).filter((d) => d >= today).length ? tripDates(trip).filter((d) => d >= today) : tripDates(trip);
  const top = [...extras.shortlist].filter((x) => !x.planned && x.votes.length).sort((a, b) => b.votes.length - a.votes.length).slice(0, dates.length * 3);
  const days = freeDays(dates, (d) => trip.activities.filter((a) => a.date === d).length).slice(0, Math.max(1, Math.ceil(top.length / 3)));
  const groups = groupByArea(top, days.length);
  const plan = groups.map((g, i) => ({ date: days[i] ?? dates[0], items: g })).sort((a, b) => a.date.localeCompare(b.date));
  const apply = () => {
    const times = ['10:00', '13:00', '16:30', '19:00'];
    editTrip((t) => {
      for (const day of plan) day.items.forEach((x, i) => {
        t.activities.push({ id: uid(), date: day.date, time: times[i] ?? '', endTime: '', title: x.title.slice(0, 200), place: x.place.slice(0, 200), category: 'Explore', cost: 0, link: x.url ?? '', notes: '', outfitId: '', gear: [], completed: false });
      });
    });
    editExtras((d) => { for (const day of plan) for (const x of day.items) { const s = d.shortlist.find((y) => y.id === x.id); if (s) s.planned = day.date; } });
    track('trip_draft_saved', { source: 'shortlist', places: top.length });
    router.back();
  };
  return <Sheet title="Put places on the days" footer={top.length ? <Button label={`Add ${plural(top.length, 'place')} to the itinerary`} icon="calendar" onPress={apply} /> : undefined}>
    {top.length ? <>
      <Note>The most-wanted places, a few a day on the quietest days, with places close together on the same day. You can move anything afterwards.</Note>
      {plan.map((day) => <Stack key={day.date} gap={8}>
        <T v="label" style={{ paddingLeft: 4 }}>{shortDay(day.date)}</T>
        <Group>{day.items.map((x) => <Row key={x.id} icon="pin" tint="peach" title={x.title} meta={`${x.votes.length} want to go`} trailing={null} />)}</Group>
      </Stack>)}
    </> : <EmptyState title="Nothing left to plan" body="Every place someone wants to go is already on a day." />}
  </Sheet>;
}

/* ------------------------------------------------------------------ Where the group stands */

/**
 * One paragraph on where things stand: who's in, the dates, the top places and open votes, in plain words. Built
 * from the trip's own data (no model), so it's never wrong about what people chose.
 */
export function groupSummary(trip: Trip, extras: TripExtras, myName: string): string[] {
  const lines: string[] = [];
  if (extras.members.length) {
    const ins = extras.members.filter((m) => m.rsvp === 'in').length;
    const unsure = extras.members.filter((m) => !m.rsvp || m.rsvp === 'maybe').map((m) => (m.id === ME ? 'you' : m.name.split(' ')[0]));
    lines.push(`${ins} of ${extras.members.length} are in${unsure.length ? `; waiting on ${unsure.slice(0, 3).join(', ')}${unsure.length > 3 ? ` and ${unsure.length - 3} more` : ''}` : ''}.`);
  }
  const poll = extras.datePoll;
  if (poll && !poll.lockedId) {
    const scored = poll.options.map((o) => ({ o, n: Object.values(poll.votes).filter((v) => v.includes(o.id)).length })).sort((a, b) => b.n - a.n);
    if (scored[0]?.n) lines.push(`Dates: ${dateRange(scored[0].o.start, scored[0].o.end)} works for ${scored[0].n}${scored[1]?.n ? `, ${dateRange(scored[1].o.start, scored[1].o.end)} for ${scored[1].n}` : ''}.`);
  }
  const wanted = extras.shortlist.filter((x) => !x.planned && x.votes.length).sort((a, b) => b.votes.length - a.votes.length).slice(0, 3);
  if (wanted.length) lines.push(`Most wanted: ${wanted.map((x) => `${x.title} (${x.votes.length})`).join(', ')}.`);
  for (const p of extras.polls.slice(0, 2)) {
    const counts = p.options.map((o) => ({ o, n: Object.values(p.votes).filter((v) => v === o.id).length })).sort((a, b) => b.n - a.n);
    if (counts[0]?.n) lines.push(`${p.question.replace(/\?$/, '')}: ${counts[0].o.label} leads with ${counts[0].n}${counts[1] && counts[1].n === counts[0].n ? `, tied with ${counts[1].o.label}` : ''}.`);
  }
  const prefs = extras.members.map((m) => m.prefs);
  const veg = prefs.filter((p) => p.food === 'veg' || p.food === 'jain').length;
  const relaxed = prefs.filter((p) => p.pace === 'relaxed').length;
  if (veg) lines.push(`${veg} ${veg === 1 ? 'eats' : 'eat'} vegetarian${prefs.some((p) => p.food === 'jain') ? ' (incl. Jain)' : ''}; pick places with good veg options.`);
  const packed = prefs.filter((p) => p.pace === 'packed').length;
  if (relaxed > prefs.length / 2) lines.push('Most of the group want a relaxed pace: keep days light.');
  else if (relaxed && relaxed * 2 === prefs.length && relaxed > packed) lines.push('Half the group want a relaxed pace: keep days light.');
  void myName;
  return lines;
}

export function GroupSummaryCard({ trip, extras, myName }: { trip: Trip; extras: TripExtras; myName: string }) {
  const lines = groupSummary(trip, extras, myName);
  if (lines.length < 2) return null;
  return <Card>
    <RowView gap={10}><Icon name="sparkle" size={18} color={colors.ember} /><T v="row" style={{ fontSize: 15 }}>Where things stand</T></RowView>
    {lines.map((l, i) => <T key={i} v="small">{l}</T>)}
  </Card>;
}

/* ------------------------------------------------------------------ Group preferences */

const BUDGET: [NonNullable<TripExtras['members'][number]['prefs']['budget']>, string][] = [['backpacker', 'Backpacker'], ['comfortable', 'Comfortable'], ['treat', 'Treat ourselves']];
const FOOD: [NonNullable<TripExtras['members'][number]['prefs']['food']>, string][] = [['veg', 'Veg'], ['nonveg', 'Non-veg'], ['jain', 'Jain'], ['any', 'Anything']];
const PACE: [NonNullable<TripExtras['members'][number]['prefs']['pace']>, string][] = [['packed', 'See it all'], ['relaxed', 'Take it easy']];

/** Your three answers for this group, as tappable chips. */
export function MyPrefs({ value, onChange }: { value: TripExtras['members'][number]['prefs']; onChange: (p: TripExtras['members'][number]['prefs']) => void }) {
  const chips = <K extends 'budget' | 'food' | 'pace'>(key: K, options: [string, string][]) => <RowView gap={6} style={{ flexWrap: 'wrap' }}>
    {options.map(([v, label]) => {
      const on = value[key] === v;
      return <PressScale key={v} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { haptic.select(); onChange({ ...value, [key]: v }); }}
        style={{ paddingVertical: 7, paddingHorizontal: 11, borderRadius: radii.chip, backgroundColor: on ? colors.inkButton : colors.controlGlass, borderWidth: 1, borderColor: on ? colors.khakiRule : colors.hairline }}>
        <T v="small" color={on ? '#FFFFFF' : colors.ink} style={{ fontSize: 13 }}>{label}</T>
      </PressScale>;
    })}
  </RowView>;
  return <Stack gap={10}>
    <T v="label">How you like to travel (the group sees this)</T>
    {chips('budget', BUDGET)}
    {chips('food', FOOD)}
    {chips('pace', PACE)}
  </Stack>;
}
