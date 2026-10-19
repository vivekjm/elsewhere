/**
 * Organiser tools for group trips:
 * - Ready Check: each person ticks what they've sorted (travel, their share, ID or visa, packing); the organiser sees
 *   who's ready and sends one friendly nudge to the group chat.
 * - The kitty: everyone puts the same amount in with one person, who pays shared costs from it.
 * - Trip Pass: unlocks these tools for one trip (Pro members have them on every trip).
 * Members can always tick their own Ready Check and top up a kitty; starting a kitty and nudging are the organiser tools.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Share, View } from 'react-native';
import { useRouter } from '../core/nav';
import { track } from '../core/analytics';
import { tripLink, useLive } from '../core/live';
import { FRIENDS_FOR_FREE_TOOLS, useOrganiserTools, usePro } from '../core/pro';
import { reportError, useCurrentTrip, usePrefs, useTrips } from '../core/state';
import { ME, packing, uid, type Trip, type TripExtras } from '../data';
import { dateRange, initials, money, todayISO } from '../domain/format';
import { balances, convert, nameOf, placeOf, transfers } from '../domain/trips';
import {
  Avatar, Banner, Button, Card, CheckToggle, EmptyState, IconTile, T, Field, FieldLabel, Group, Hero, HeroText, Note, Progress, Radio, Row, RowView,
  Section, Sheet, Stack, Tag,
} from '../loom';
import { useRates } from '../services/currency';
import { payWithUpi } from '../services/upi';
import { renderCard, type Card as CardSpec } from '../services/intelligence';
import { tintFor } from '../domain/people';
import { M, type Lang } from '../domain/messages';

/* ------------------------------------------------------------------ Ready Check */

export const READY_ITEMS: { key: string; label: string; hint: string }[] = [
  { key: 'booked', label: 'Travel booked', hint: 'Your train, flight or ride there' },
  { key: 'paid', label: 'Paid my share', hint: 'Ticks itself once costs are in and you owe nobody' },
  { key: 'id', label: 'ID or visa sorted', hint: 'Keep a copy in Documents; it stays private' },
  { key: 'packed', label: 'Packed', hint: 'Ticks itself when your packing list is done' },
];

/** "Travel booked" → "travel booked", keeping "ID" as it is. */
const lowerFirst = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** Your Ready Check: what you ticked, plus what the app can tell for itself (nothing owed, list packed). */
export function useMyReady(trip: Trip, extras: TripExtras): Record<string, boolean> {
  const { workspace } = useTrips();
  const rates = useRates(trip.currency);
  const owe = transfers(balances(trip, extras, rates, trip.currency)).some((t) => t.from === ME);
  const rows = workspace ? packing(workspace, trip) : [];
  const packed = rows.length > 0 && rows.every((r) => r.packed);
  const mine = extras.members.find((m) => m.id === ME)?.ready ?? {};
  return { ...mine, paid: mine.paid || (!owe && extras.expenses.length > 0), packed: mine.packed || packed };
}

/** The standard items plus the organiser's own (a medical form, a fitness check, a deposit…). */
export const readyItemsOf = (extras: TripExtras) => [...READY_ITEMS, ...extras.readyItems];

/** "3 of 5 ready" for the Shared tab. */
export function ReadyRow({ trip, extras, onOpen }: { trip: Trip; extras: TripExtras; onOpen: () => void }) {
  const mine = useMyReady(trip, extras);
  const items = readyItemsOf(extras);
  const done = (r: Record<string, boolean>) => items.every((i) => r[i.key]);
  const ready = extras.members.filter((m) => (m.id === ME ? done(mine) : done(m.ready))).length;
  const myCount = items.filter((i) => mine[i.key]).length;
  return <Section title="Ready check">
    <Card>
      <Row icon="check" tint={ready === extras.members.length ? 'mint' : 'peach'} title={`${ready} of ${extras.members.length} ready`}
        meta={myCount === items.length ? 'You’re all set' : `You: ${myCount} of ${items.length} done`} onPress={onOpen} />
    </Card>
  </Section>;
}

export function ReadyCheckSheet() {
  const prefs = usePrefs();
  const current = useCurrentTrip();
  const router = useRouter();
  const live = useLive();
  const tools = useOrganiserTools(current?.extras ?? { pass: false });
  const mine = useMyReady(current?.trip ?? ({} as Trip), current?.extras ?? ({ members: [], expenses: [], people: [], settlements: [] } as unknown as TripExtras));
  if (!current?.extras.live) return <Sheet title="Ready check"><EmptyState title="Share the trip first" body="Ready check works on a shared trip, so everyone can tick their own list." /></Sheet>;
  const { trip, extras, editExtras } = current;
  const organiser = extras.live?.role === 'organiser';
  const items = readyItemsOf(extras);
  const readyOf = (id: string, ready: Record<string, boolean>) => (id === ME ? mine : ready);
  const missing = extras.members.map((m) => ({ m, todo: items.filter((i) => !readyOf(m.id, m.ready)[i.key]) })).filter((x) => x.todo.length && x.m.rsvp !== 'out');
  const days = Math.max(0, Math.round((new Date(trip.start).getTime() - new Date(todayISO()).getTime()) / 86400000));
  const nudge = async () => {
    if (!tools) { router.push({ pathname: '/trip-pass' } as never); return; }
    if (!missing.length) { Alert.alert('Everyone’s ready', 'Nothing to chase.'); return; }
    const lang = prefs.native.shareLanguage;
    const lines = missing.map(({ m, todo }) => `• ${m.id === ME ? M.me(lang) : m.name.split(' ')[0]}: ${todo.map((t) => lowerFirst(t.label)).join(', ')}`);
    const message = [M.nudgeHead(lang, trip.name, days), ...lines, M.nudgeTail(lang, tripLink(extras.live!.code))].join('\n');
    try { const r = await Share.share({ message }); if (r.action === Share.sharedAction) track('nudge_sent', { people: missing.length }); } catch (e) { reportError(e); }
  };
  return <Sheet title="Ready check" footer={organiser ? <Button label={tools ? 'Nudge the group' : 'Nudge the group · Trip Pass'} icon="share" onPress={() => void nudge()} /> : undefined}>
    <Section title="You">
      <Group>{items.map((i) => <Row key={i.key} title={i.label} meta={i.hint || (i.key.startsWith('c-') ? 'Asked by the organiser' : '')}
        trailing={<CheckToggle checked={!!mine[i.key]} label={i.label} onChange={(on) => void live.setReady(trip.id, i.key, on)} />} />)}</Group>
      {organiser ? <AddReadyItem count={extras.readyItems.length} onAdd={(label, hint) => editExtras((d) => { d.readyItems.push({ key: `c-${uid().slice(0, 12).toLowerCase().replace(/[^a-z0-9-]/g, '')}`, label, hint }); })}
        onRemove={extras.readyItems.length ? () => Alert.alert('Remove an item', undefined, [
          ...extras.readyItems.map((x) => ({ text: x.label, style: 'destructive' as const, onPress: () => editExtras((d) => { d.readyItems = d.readyItems.filter((y) => y.key !== x.key); }) })),
          { text: 'Cancel', style: 'cancel' as const },
        ]) : undefined} /> : null}
    </Section>
    <Section title="Everyone">
      <Group>{extras.members.filter((m) => m.rsvp !== 'out').map((m) => {
        const r = readyOf(m.id, m.ready);
        const n = items.filter((i) => r[i.key]).length;
        return <Row key={m.id} leading={<Avatar initials={initials(m.name)} tint={tintFor(m.id)} size={40} />} title={m.id === ME ? `${m.name} (you)` : m.name}
          meta={n === items.length ? 'All set' : `Still to do: ${items.filter((i) => !r[i.key]).map((i) => lowerFirst(i.label)).join(', ')}`}
          trailing={<Tag text={`${n}/${items.length}`} tint={n === items.length ? 'mint' : 'peach'} />} />;
      })}</Group>
    </Section>
    <Note>Only the ticks are shared. Documents and packing lists stay on each person’s phone.</Note>
  </Sheet>;
}

/** The organiser adds their own requirement (up to 8): "Medical form", "Fitness: 5 km in 40 min", "Deposit paid". */
function AddReadyItem({ count, onAdd, onRemove }: { count: number; onAdd: (label: string, hint: string) => void; onRemove?: () => void }) {
  const [label, setLabel] = useState('');
  if (count >= 8) return onRemove ? <Button label="Remove an item" kind="mist" height={44} onPress={onRemove} /> : null;
  return <Stack gap={8}>
    <Field label="Ask everyone for something else" value={label} onChangeText={setLabel} icon="plus" placeholder="Medical form, fitness check, deposit…" maxLength={60}
      returnKeyType="done" onSubmitEditing={(typed) => { if (typed.trim()) { onAdd(typed.trim(), ''); setLabel(''); } }} />
    <RowView gap={8}>
      {label.trim() ? <Button label="Add" icon="plus" kind="mist" height={44} full={false} onPress={() => { onAdd(label.trim(), ''); setLabel(''); }} /> : null}
      {onRemove ? <Button label="Remove one" kind="white" height={44} full={false} onPress={onRemove} /> : null}
    </RowView>
  </Stack>;
}

/* ------------------------------------------------------------------ Kitty */

/** The kitty on the Shared tab: what's in it, what's been spent, and who has topped up. */
export function KittyCard({ trip, extras, onStart, onTopUp }: { trip: Trip; extras: TripExtras; onStart: () => void; onTopUp: () => void }) {
  const prefs = usePrefs();
  const rates = useRates(trip.currency);
  const organiser = !extras.live || extras.live.role === 'organiser';
  const kitty = extras.kitty;
  if (!kitty) return organiser ? <Button label="Start a trip kitty" icon="card" kind="white" onPress={onStart} /> : null;
  const everyone = [ME, ...extras.people.map((p) => p.id)];
  const inOf = (id: string) => extras.settlements.filter((s) => s.kitty && s.from === id && s.to === kitty.holder).reduce((a, s) => a + s.amount, 0) + (id === kitty.holder ? kitty.each : 0);
  const pot = everyone.reduce((a, id) => a + Math.min(inOf(id), kitty.each), 0);
  const spent = extras.expenses.filter((e) => e.fromKitty).reduce((a, e) => a + convert(e.amount, e.currency, trip.currency, rates, trip.currency), 0);
  const holder = nameOf(extras.people, kitty.holder, 'you');
  const topped = everyone.filter((id) => inOf(id) >= kitty.each).length;
  const mineDone = inOf(ME) >= kitty.each;
  return <Section title="Trip kitty">
    <Hero padding={18} gap={10}>
      <RowView style={{ justifyContent: 'space-between' }}>
        <View style={{ gap: 2, flex: 1 }}>
          <HeroText faint style={{ fontSize: 14 }}>{money(kitty.each, trip.currency)} each · held by {holder}</HeroText>
          <HeroText v="title" style={{ fontSize: 24 }}>{money(pot - spent, trip.currency)} left</HeroText>
          <HeroText faint style={{ fontSize: 14 }}>{money(pot, trip.currency)} in · {money(spent, trip.currency)} spent · {topped} of {everyone.length} topped up</HeroText>
        </View>
      </RowView>
      <Progress pct={(topped / everyone.length) * 100} color="#FFFFFF" track="rgba(255,255,255,0.35)" />
      {!mineDone && kitty.holder !== ME ? <Button label={`Put in ${money(kitty.each - inOf(ME), trip.currency)}`} icon="card" kind="white" height={44} onPress={onTopUp} /> : null}
      {kitty.holder === ME && topped < everyone.length ? <Button label="Mark who’s paid in" icon="check" kind="white" height={44} onPress={onTopUp} /> : null}
    </Hero>
    {kitty.holder === ME && !prefs.native.upiId && trip.currency === 'INR' ? <Note>Add your UPI ID in Travel preferences so everyone can top up in one tap.</Note> : null}
  </Section>;
}

export function KittySheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const pro = usePro();
  const tools = useOrganiserTools(current?.extras ?? { pass: false });
  const [each, setEach] = useState(current?.extras.kitty ? String(current.extras.kitty.each) : '');
  const [holder, setHolder] = useState(current?.extras.kitty?.holder ?? ME);
  if (!current) return <Sheet title="Trip kitty"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const { trip, extras, editExtras } = current;
  const kitty = extras.kitty;
  const everyone = [{ id: ME, name: 'You' }, ...extras.people];
  const value = Number(each.replace(',', '.'));
  // The holder marks others as paid in; anyone else records their own top-up (paying by UPI where they can).
  if (kitty) {
    const inOf = (id: string) => extras.settlements.filter((s) => s.kitty && s.from === id && s.to === kitty.holder).reduce((a, s) => a + s.amount, 0);
    const topUp = (from: string, amount: number) => {
      editExtras((d) => { d.settlements.push({ id: uid(), from, to: kitty.holder, amount, currency: trip.currency, date: todayISO(), kitty: true }); });
      track('kitty_topped_up');
    };
    const holderPerson = extras.people.find((p) => p.id === kitty.holder);
    const left = Math.max(0, kitty.each - inOf(ME));
    return <Sheet title="Trip kitty" footer={kitty.holder !== ME && left > 0 ? <Stack gap={10}>
      {holderPerson?.upi && trip.currency === 'INR' ? <Button label={`Pay ${money(left, 'INR')} with UPI`} icon="card" onPress={() => void payWithUpi({ upi: holderPerson.upi!, name: holderPerson.name }, left, `${trip.name} kitty`).then((ok) => {
        if (!ok) Alert.alert('No UPI app found', 'Pay another way, then mark it here.');
      })} /> : null}
      <Button label="I’ve put my share in" icon="check" kind={holderPerson?.upi ? 'white' : 'dark'} onPress={() => { topUp(ME, left); router.back(); }} />
    </Stack> : undefined}>
      <Note>{money(kitty.each, trip.currency)} each, held by {nameOf(extras.people, kitty.holder, 'you')}. Costs paid from the kitty are split between everyone automatically.</Note>
      <Group>{everyone.map((p) => {
        const paid = p.id === kitty.holder ? kitty.each : inOf(p.id);
        const done = paid >= kitty.each;
        return <Row key={p.id} leading={<Avatar initials={initials(p.name)} tint={tintFor(p.id)} size={40} />} title={p.id === kitty.holder ? `${p.name} (holds it)` : p.name}
          meta={done ? 'Topped up' : paid > 0 ? `${money(paid, trip.currency)} of ${money(kitty.each, trip.currency)}` : 'Not yet'}
          trailing={kitty.holder === ME && !done ? <Button label="Paid in" kind="mist" full={false} height={36} onPress={() => topUp(p.id, kitty.each - paid)} /> : <Tag text={done ? 'In' : 'Waiting'} tint={done ? 'mint' : 'grey'} />}
          // The holder can take back a top-up marked by mistake.
          onPress={kitty.holder === ME && p.id !== ME && paid > 0 ? () => Alert.alert(`Undo ${p.name}’s top-up?`, `${money(paid, trip.currency)} comes off what they’ve put in.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Undo', style: 'destructive', onPress: () => editExtras((d) => { d.settlements = d.settlements.filter((s) => !(s.kitty && s.from === p.id && s.to === kitty.holder)); }) },
          ]) : undefined} />;
      })}</Group>
      {kitty.holder === ME || extras.live?.role === 'organiser' ? <Button label="Change the kitty" kind="mist" height={44} onPress={() => Alert.alert('End this kitty?', 'Past top-ups stay as payments between people.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'End kitty', style: 'destructive', onPress: () => { editExtras((d) => { d.kitty = null; }); router.back(); } },
      ])} /> : null}
    </Sheet>;
  }
  const start = () => {
    if (!tools) { router.push('/trip-pass' as never); return; }
    if (!(value > 0)) { Alert.alert('How much each?', 'Enter what everyone puts in.'); return; }
    editExtras((d) => { d.kitty = { holder, each: Math.round(value * 100) / 100 }; });
    router.back();
  };
  return <Sheet title="Start a trip kitty" footer={<Button label={tools ? 'Start kitty' : `Start kitty · Trip Pass${pro.passPrice ? ` ${pro.passPrice}` : ''}`} icon="card" onPress={start} />}>
    <Note>Everyone puts the same amount in with one person, who pays shared costs (fuel, groceries, entry tickets) from it. No more splitting every small bill.</Note>
    <Field label={`Each person puts in (${trip.currency})`} value={each} onChangeText={setEach} kind="number" icon="card" placeholder="5000" />
    <Stack gap={8}><FieldLabel>Held by</FieldLabel>
      <Group>{everyone.map((p) => <Row key={p.id} leading={<Avatar initials={initials(p.name)} tint={tintFor(p.id)} size={40} />} title={p.name} trailing={<Radio on={holder === p.id} />} onPress={() => setHolder(p.id)} />)}</Group>
    </Stack>
  </Sheet>;
}

/* ------------------------------------------------------------------ Trip Pass */

export function TripPassSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const pro = usePro();
  const [busy, setBusy] = useState(false);
  if (!current) return <Sheet title="Trip Pass"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const { trip, editExtras } = current;
  const buy = async () => {
    setBusy(true);
    const ok = await pro.buyPass();
    setBusy(false);
    if (!ok) return;
    editExtras((d) => { d.pass = true; });
    track('purchase_completed', { plan: 'trip_pass' });
    Alert.alert('Organiser tools are on', `For ${trip.name}, for everyone organising it.`);
    router.back();
  };
  return <Sheet title="Organiser tools" footer={<Stack gap={10}>
    <Button label={busy ? 'Opening the App Store…' : `Unlock for this trip${pro.passPrice ? ` · ${pro.passPrice}` : ''}`} icon={busy ? undefined : 'check'} leading={busy ? <ActivityIndicator color="#FFFFFF" /> : undefined} onPress={() => void buy()} />
    <Button label="Or get Pro for every trip" kind="white" onPress={() => router.replace('/paywall' as never)} />
  </Stack>}>
    <Hero padding={18}>
      <HeroText v="title" style={{ fontSize: 22 }}>{trip.name}</HeroText>
      <HeroText faint style={{ fontSize: 14 }}>{dateRange(trip.start, trip.end)} · one payment, no subscription</HeroText>
    </Hero>
    <Group>
      <Row icon="share" title="Ready check nudges" meta="One friendly message to the group with who still has what to sort" trailing={null} />
      <Row icon="card" title="Trip kitty" meta="Everyone puts in once; shared costs come out of the pot" trailing={null} />
      <Row icon="doc" title="Unlimited documents" meta="Tickets, bookings and IDs for the whole trip" trailing={null} />
    </Group>
    <Card>
      <RowView gap={12}><IconTile icon="users" tint="mint" /><View style={{ flex: 1, gap: 2 }}>
        <T v="row" style={{ fontSize: 15 }}>Or bring {FRIENDS_FOR_FREE_TOOLS} friends</T>
        <T v="meta">{current.extras.live ? `${Math.max(0, current.extras.members.length - 1)} of ${FRIENDS_FOR_FREE_TOOLS} have joined. When ${FRIENDS_FOR_FREE_TOOLS} friends join this trip, organiser tools unlock free.` : `Share the trip: when ${FRIENDS_FOR_FREE_TOOLS} friends join, organiser tools unlock free.`}</T>
      </View></RowView>
      <Button label="Invite friends" icon="share" kind="mist" height={44} onPress={() => router.replace('/invite' as never)} />
    </Card>
    <Note>Everything else stays free for everyone on the trip: the shared plan, votes, splitting and settling up.</Note>
    {!pro.passPrice ? <Banner icon="cloud" tint="grey" title="Price shown at checkout" body="The App Store hasn’t answered yet." /> : null}
  </Sheet>;
}

/* ------------------------------------------------------------------ Sharing into the group chat */

/** Today's plan as a message for the group chat: meeting times, places and the trip link. */
export function dayMessage(trip: Trip, extras: TripExtras, date: string, myName: string, lang: Lang = 'en'): string {
  const plans = trip.activities.filter((a) => a.date === date).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const day = trip.days[date];
  const dayNo = Math.round((new Date(date).getTime() - new Date(trip.start).getTime()) / 86400000) + 1;
  const lines = [
    `${trip.name} · ${M.day(lang)} ${dayNo}${day?.title ? `: ${day.title}` : ''}`,
    ...plans.map((a) => `${a.time || M.anyTime(lang)}  ${a.title}${a.place ? ` (${a.place.split(',')[0]})` : ''}`),
    day?.stay ? `${M.staying(lang)}: ${day.stay}` : '',
    extras.live ? `${M.planLink(lang)}: ${tripLink(extras.live.code)}` : '',
    myName ? `– ${myName.split(' ')[0]}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/** The finished trip in numbers, for sharing. */
export function recapMessage(trip: Trip, extras: TripExtras, rates: Record<string, number> | null, lang: Lang = 'en'): string {
  const people = Math.max(1, extras.people.length + 1);
  const total = extras.expenses.reduce((a, e) => a + (e.currency === trip.currency ? e.amount : 0), 0);
  const days = Math.round((new Date(trip.end).getTime() - new Date(trip.start).getTime()) / 86400000) + 1;
  const places = new Set(trip.activities.map((a) => a.place.trim()).filter(Boolean)).size;
  void rates;
  return [
    `${trip.name} ✓`,
    `${people} ${people === 1 ? 'traveller' : 'people'} · ${days} days · ${trip.activities.length} plans${places ? ` · ${places} places` : ''}`,
    total ? M.recapEach(lang, money(total / people, trip.currency)) : '',
    extras.live ? tripLink(extras.live.code) : 'Planned with Tripsloom · tripsloom.com',
  ].filter(Boolean).join('\n');
}

/** Opens the share sheet with a message (and an image card when there is one) and records it. */
export async function shareText(message: string, event: 'day_sheet_shared' | 'recap_shared' | 'template_shared', card?: CardSpec) {
  const image = card ? await renderCard(card) : null;
  try {
    const r = await Share.share(image ? { url: image, message } : { message });
    if (r.action === Share.sharedAction) track(event, { image: !!image });
  } catch (e) { reportError(e, 'Couldn’t share'); }
}

/** The day's plan as an image card for the group chat. */
export function dayCard(trip: Trip, date: string, lang: Lang = 'en'): CardSpec {
  const plans = trip.activities.filter((a) => a.date === date).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const dayNo = Math.round((new Date(date).getTime() - new Date(trip.start).getTime()) / 86400000) + 1;
  const day = trip.days[date];
  return {
    eyebrow: `${trip.name} · ${M.day(lang)} ${dayNo}`,
    title: day?.title || new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`)),
    subtitle: day?.stay ? `${M.staying(lang)}: ${day.stay}` : trip.destination,
    lines: plans.map((a) => `${a.time || M.anyTime(lang)}   ${a.title}${placeOf(a) ? ` · ${placeOf(a).split(',')[0]}` : ''}`),
    footer: 'Planned together on Tripsloom',
  };
}

/** The finished trip as an image card. */
export function recapCard(trip: Trip, extras: TripExtras): CardSpec {
  const people = Math.max(1, extras.people.length + 1);
  const days = Math.round((new Date(trip.end).getTime() - new Date(trip.start).getTime()) / 86400000) + 1;
  const places = new Set(trip.activities.map((a) => a.place.trim()).filter(Boolean)).size;
  const total = extras.expenses.reduce((a, e) => a + (e.currency === trip.currency ? e.amount : 0), 0);
  return {
    eyebrow: dateRange(trip.start, trip.end),
    title: trip.name,
    subtitle: trip.destination,
    lines: [
      `${people} ${people === 1 ? 'traveller' : 'people'}`, `${days} days`, `${trip.activities.length} plans`, places ? `${places} places` : '',
      total ? `${money(total / people, trip.currency)} each, all settled` : '',
    ].filter(Boolean),
    footer: 'Our trip, on Tripsloom',
  };
}

