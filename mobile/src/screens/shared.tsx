import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useRouter } from '../core/nav';
import * as Clipboard from 'expo-clipboard';
import { reportError, useCurrentTrip, usePrefs, useSelection, useTrips } from '../core/state';
import { ME, uid, useExtras, type Poll, type Trip, type TripExtras } from '../data';
import { dateRange, initials, money, todayISO } from '../domain/format';
import { balances, coverOf, nameOf, transfers } from '../domain/trips';
import {
  Avatar, Button, Card, colors, CurrencyField, DateField, EmptyState, Field, FieldLabel, Group, Header, Icon, IconTile, Illustration, Note, Progress, Radio,
  radii, RoundButton, Row, RowView, Screen, Section, Sheet, Stack, T, tints, type Tint,
  useDirty,
} from '../loom';
import { useRates } from '../services/currency';
import { acceptInvite, decodeInvite, encodeInvite, inviteLink, makeInvite, MAX_LINK, type Invite } from '../services/invite';

const PERSON_TINTS: Tint[] = ['lavender', 'mint', 'peach', 'rose', 'grey'];
export const tintFor = (id: string): Tint => id === ME ? 'peach' : PERSON_TINTS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % PERSON_TINTS.length];

function People({ extras, me }: { extras: TripExtras; me: string }) {
  const everyone = [{ id: ME, name: me }, ...extras.people];
  return <View style={{ flexDirection: 'row' }}>
    {everyone.slice(0, 4).map((p, i) => <Avatar key={p.id} initials={initials(p.name)} tint={tintFor(p.id)} overlap={i > 0} />)}
    {everyone.length > 4 ? <Avatar initials={`+${everyone.length - 4}`} tint="grey" overlap /> : null}
  </View>;
}

/* ------------------------------------------------------------------ Shared tab */

function TripCosts({ trip, extras }: { trip: Trip; extras: TripExtras }) {
  const prefs = usePrefs();
  const router = useRouter();
  const { select } = useSelection();
  const rates = useRates(trip.currency);
  const owed = transfers(balances(trip, extras, rates, trip.currency));
  const mine = owed.filter((t) => t.from === ME || t.to === ME);
  const name = (id: string) => nameOf(extras.people, id, 'You');
  const go = (path: string, params?: Record<string, string>) => { select(trip.id); router.push({ pathname: path, params } as never); };
  const open = extras.polls.filter((p) => !p.closesAt || p.closesAt >= todayISO());
  return <Stack gap={12}>
    <Card>
      <Pressable accessibilityRole="button" accessibilityLabel={`${trip.name}, people`} onPress={() => go('/people')}>
        <RowView gap={14}>
          <Illustration name={coverOf(trip)} width={56} height={56} radius={12} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="row" lines={1}>{trip.name}</T>
            <T v="meta" lines={1}>{['You', ...extras.people.map((p) => p.name)].join(', ')}</T>
          </View>
          <People extras={extras} me={prefs.name || 'You'} />
        </RowView>
      </Pressable>
    </Card>
    <Section title="Settle up" action={mine.length ? 'Record a payment' : undefined} onAction={() => go('/settle-up')}>
      {mine.length ? <Group>{mine.map((t, i) => {
        const incoming = t.to === ME;
        const other = incoming ? t.from : t.to;
        return <Row key={i} leading={<Avatar initials={initials(name(other))} tint={tintFor(other)} size={44} />}
          title={incoming ? `${name(other)} owes you` : `You owe ${name(other)}`} meta="Tap to record a payment"
          onPress={() => go('/settle-up', { from: t.from, to: t.to, amount: String(t.amount) })}
          trailing={<T v="title" style={{ fontSize: 18 }} color={incoming ? tints.mint.fg : colors.danger}>{money(t.amount, trip.currency)}</T>} />;
      })}</Group> : <Card><RowView gap={12}><IconTile icon="check" tint="mint" /><View style={{ flex: 1, gap: 2 }}>
        <T v="row" style={{ fontSize: 15 }}>All settled up</T>
        <T v="meta">Add an expense in Budget and split it to see who owes whom.</T>
      </View></RowView></Card>}
    </Section>
    <Section title="Votes" action="Start a vote" onAction={() => go('/start-vote')}>
      {open.length ? open.map((poll) => <VoteCard key={poll.id} poll={poll} extras={extras} tripId={trip.id} />)
        : <Card><T v="small">No open votes. Ask everyone where to eat or what to do on a free afternoon.</T></Card>}
    </Section>
    <Button label="Share the latest with everyone" icon="share" kind="white" onPress={() => go('/invite')} />
  </Stack>;
}

function VoteCard({ poll, extras, tripId }: { poll: Poll; extras: TripExtras; tripId: string }) {
  const store = useExtras();
  const total = extras.people.length + 1;
  const counts = poll.options.map((o) => Object.values(poll.votes).filter((v) => v === o.id).length);
  const lead = Math.max(...counts);
  const voted = Object.keys(poll.votes).length;
  const mine = poll.votes[ME];
  const vote = (optionId: string) => store.change(tripId, (d) => {
    const p = d.polls.find((x) => x.id === poll.id);
    if (!p) return;
    if (p.votes[ME] === optionId) delete p.votes[ME]; else p.votes[ME] = optionId;
  });
  const remove = () => Alert.alert('Delete this vote?', poll.question, [{ text: 'Cancel', style: 'cancel' }, {
    text: 'Delete', style: 'destructive', onPress: () => store.change(tripId, (d) => { d.polls = d.polls.filter((x) => x.id !== poll.id); }),
  }]);
  return <Card>
    <RowView align="flex-start" style={{ justifyContent: 'space-between' }}>
      <View style={{ gap: 2, flex: 1 }}>
        <T v="row">{poll.question}</T>
        <T v="meta">{voted} of {total} voted{poll.closesAt ? ` · closes ${dateRange(poll.closesAt, poll.closesAt)}` : ''}</T>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Delete vote" hitSlop={10} onPress={remove}><Icon name="trash" size={18} color={colors.stone} /></Pressable>
    </RowView>
    {poll.options.map((o, i) => <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ checked: mine === o.id }} accessibilityLabel={`${o.label}, ${counts[i]} votes`} onPress={() => vote(o.id)} style={{ gap: 6, paddingVertical: 4 }}>
      <RowView style={{ justifyContent: 'space-between' }}>
        <RowView gap={8} style={{ flex: 1 }}><Radio on={mine === o.id} /><T v="row" style={{ fontSize: 14, flex: 1 }}>{o.label}</T></RowView>
        <T v="small">{counts[i]}</T>
      </RowView>
      <Progress pct={total ? (counts[i] / total) * 100 : 0} color={counts[i] && counts[i] === lead ? colors.ember : colors.dashed} />
    </Pressable>)}
  </Card>;
}

export function SharedScreen() {
  const prefs = usePrefs();
  const router = useRouter();
  const { trips } = useTrips();
  const store = useExtras();
  const { select } = useSelection();
  const withPeople = trips.filter((t) => store.get(t.id).people.length > 0).sort((a, b) => a.start.localeCompare(b.start));
  const [active, setActive] = useState<string | null>(null);
  const trip = withPeople.find((t) => t.id === active) ?? withPeople.find((t) => t.end >= todayISO()) ?? withPeople[0];
  return <Screen bar="tabs">
    <Header big title="Shared" right={<RoundButton icon="plus" dark label="Join a trip with an invite" href="/join-trip" />} />
    {trip ? <>
      {withPeople.length > 1 ? <RowView gap={8} style={{ flexWrap: 'wrap' }}>
        {withPeople.map((t) => <Pressable key={t.id} accessibilityRole="button" accessibilityState={{ selected: t.id === trip.id }} onPress={() => setActive(t.id)}
          style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.button, backgroundColor: t.id === trip.id ? colors.inkButton : colors.card }}>
          <T v="small" color={t.id === trip.id ? '#FFFFFF' : colors.ink} style={{ fontSize: 14 }}>{t.name}</T>
        </Pressable>)}
      </RowView> : null}
      <TripCosts trip={trip} extras={store.get(trip.id)} />
    </> : <EmptyState art="compass" title="Travel with friends" body={`Add the people on a trip to split costs, settle up and vote on plans. ${prefs.firstName ? 'Your' : 'Their'} copy stays in sync when you share again.`}
      action={<Stack gap={10}>
        {trips.length ? <Button label="Add people to a trip" icon="users" onPress={() => { select((trips.find((t) => t.end >= todayISO()) ?? trips[0]).id); router.push('/people' as never); }} />
          : <Button label="Plan a trip first" icon="plus" onPress={() => router.push('/new-trip' as never)} />}
        <Button label="I have an invite" kind="white" icon="link" onPress={() => router.push('/join-trip' as never)} />
      </Stack>} />}
  </Screen>;
}

/* ------------------------------------------------------------------ People */

export function PeopleSheet() {
  const current = useCurrentTrip();
  const prefs = usePrefs();
  const router = useRouter();
  const [name, setName] = useState('');
  if (!current) return <Sheet title="People"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const { trip, extras, editExtras, editTrip } = current;
  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (extras.people.some((p) => p.name.toLowerCase() === n.toLowerCase())) { Alert.alert('Already on this trip', `${n} is already added.`); return; }
    editExtras((d) => { d.people.push({ id: `p-${uid()}`, name: n.slice(0, 80) }); });
    if (trip.travellers < extras.people.length + 2) editTrip((t) => { t.travellers = Math.min(100, extras.people.length + 2); });
    setName('');
  };
  const remove = (id: string, who: string) => {
    const used = extras.expenses.some((e) => e.paidBy === id || e.splitWith.includes(id));
    Alert.alert(`Remove ${who}?`, used ? 'Their share of past expenses moves back to whoever paid.' : 'They won’t appear in costs or votes.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => editExtras((d) => {
        d.people = d.people.filter((p) => p.id !== id);
        d.expenses = d.expenses.filter((e) => e.paidBy !== id).map((e) => ({ ...e, splitWith: e.splitWith.filter((x) => x !== id) }));
        d.settlements = d.settlements.filter((s) => s.from !== id && s.to !== id);
        for (const p of d.polls) delete p.votes[id];
      }) },
    ]);
  };
  return <Sheet title="Travelling with" footer={<Button label="Share the trip with them" icon="share" onPress={() => router.replace('/invite' as never)} />}>
    <Note>{trip.name} · Add everyone sharing costs. They get their own copy when you send the invite.</Note>
    <Group>
      <Row leading={prefs.name ? <Avatar initials={initials(prefs.name)} tint="peach" size={44} /> : <IconTile icon="profile" tint="peach" />} title={prefs.name ? `${prefs.name} (you)` : 'You'} meta="Trip organiser" trailing={null} />
      {extras.people.map((p) => <Row key={p.id} leading={<Avatar initials={initials(p.name)} tint={tintFor(p.id)} size={44} />} title={p.name} meta="Shares costs and votes"
        trailing={<Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} hitSlop={10} onPress={() => remove(p.id, p.name)}><Icon name="x" size={18} color={colors.stone} /></Pressable>} />)}
    </Group>
    <Field label="Add a person" value={name} onChangeText={setName} icon="profile" kind="name" placeholder="Their name" returnKeyType="done" onSubmitEditing={add}
      trailing={name.trim() ? <Pressable accessibilityRole="button" accessibilityLabel="Add" onPress={add} hitSlop={8}><Icon name="plus" size={20} color={colors.ember} /></Pressable> : null} />
  </Sheet>;
}

/* ------------------------------------------------------------------ Votes */

export function StartVoteSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [closes, setCloses] = useState('');
  const [error, setError] = useState('');
  const dirty = useDirty([question, options, closes]);
  if (!current) return <Sheet title="Start a vote"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const save = () => {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) { setError('Ask a question.'); return; }
    if (opts.length < 2) { setError('Add at least two choices.'); return; }
    current.editExtras((d) => {
      d.polls.push({ id: uid(), question: question.trim().slice(0, 200), options: opts.slice(0, 12).map((label) => ({ id: uid(), label: label.slice(0, 120) })), votes: {}, closesAt: closes, createdAt: new Date().toISOString() });
    });
    router.back();
  };
  return <Sheet title="Start a vote" dirty={dirty} footer={<Button label="Start vote" icon="vote" onPress={save} />}>
    <Field label="Question" value={question} onChangeText={(t) => { setQuestion(t); setError(''); }} icon="help" placeholder="Where should we eat on Friday?" maxLength={200} />
    <Stack gap={8}><FieldLabel>Choices</FieldLabel>
      {options.map((o, i) => <Field key={i} label={`Choice ${i + 1}`} value={o} onChangeText={(t) => setOptions((list) => list.map((x, j) => j === i ? t : x))} maxLength={120}
        trailing={options.length > 2 ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove choice ${i + 1}`} hitSlop={8} onPress={() => setOptions(options.filter((_, j) => j !== i))}><Icon name="x" size={16} color={colors.stone} /></Pressable> : null} />)}
      {options.length < 12 ? <Button label="Add a choice" icon="plus" kind="white" height={48} onPress={() => setOptions((list) => [...list, ''])} /> : null}
    </Stack>
    {closes ? <DateField label="Closes" value={closes} onChange={setCloses} min={todayISO()} />
      : <Button label="Set a closing date" icon="calendar" kind="mist" height={48} onPress={() => setCloses(current.trip.start > todayISO() ? current.trip.start : todayISO())} />}
    {error ? <T v="meta" color={colors.danger}>{error}</T> : null}
  </Sheet>;
}

/* ------------------------------------------------------------------ Settle up */

export function SettleUpSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; to?: string; amount?: string }>();
  const [from, setFrom] = useState(params.from ?? ME);
  const [to, setTo] = useState(params.to ?? current?.extras.people[0]?.id ?? '');
  const [amount, setAmount] = useState(params.amount ?? '');
  const [currency, setCurrency] = useState<string>(current?.trip.currency ?? 'EUR');
  const dirty = useDirty([from, to, amount, currency]);
  if (!current) return <Sheet title="Record a payment"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const everyone = [{ id: ME, name: 'You' }, ...current.extras.people];
  const value = Number(amount.replace(',', '.'));
  const save = () => {
    if (!(value > 0)) { Alert.alert('Enter an amount', 'How much was paid back?'); return; }
    if (from === to || !to) { Alert.alert('Choose two people', 'Pick who paid and who received it.'); return; }
    current.editExtras((d) => { d.settlements.push({ id: uid(), from, to, amount: Math.round(value * 100) / 100, currency, date: todayISO() }); });
    router.back();
  };
  const picker = (label: string, value: string, set: (id: string) => void, exclude: string) => <Stack gap={8}><FieldLabel>{label}</FieldLabel>
    <Group>{everyone.filter((p) => p.id !== exclude).map((p) => <Row key={p.id} leading={<Avatar initials={initials(p.name)} tint={tintFor(p.id)} size={40} />}
      title={p.name} trailing={<Radio on={value === p.id} />} onPress={() => set(p.id)} />)}</Group></Stack>;
  return <Sheet title="Record a payment" dirty={dirty} footer={<Button label="Save payment" icon="check" onPress={save} />}>
    {picker('Who paid', from, (id) => { setFrom(id); if (id === to) setTo(''); }, '')}
    {picker('Paid to', to, setTo, from)}
    <RowView align="flex-start">
      <Field flex label="Amount" value={amount} onChangeText={setAmount} kind="number" icon="card" placeholder="0" />
      <CurrencyField flex value={currency} onChange={setCurrency} />
    </RowView>
  </Sheet>;
}

/* ------------------------------------------------------------------ Invites */

export function InviteSheet() {
  const current = useCurrentTrip();
  const prefs = usePrefs();
  const router = useRouter();
  const token = useMemo(() => current ? encodeInvite(makeInvite(current.trip, current.extras, prefs.name)) : '', [current, prefs.name]);
  if (!current) return <Sheet title="Share trip"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const link = inviteLink(token);
  const fits = link.length <= MAX_LINK;
  const message = fits
    ? `Join “${current.trip.name}” on Trips Loom (${dateRange(current.trip.start, current.trip.end)}): ${link}`
    : `Join “${current.trip.name}” on Trips Loom. Copy this whole message, then open Trips Loom › Shared › + and paste it.\n\n${token}`;
  const share = async () => {
    try { await Share.share({ message }); } catch (error) { reportError(error, 'Couldn’t share'); }
  };
  const copy = async () => { await Clipboard.setStringAsync(fits ? link : token); Alert.alert('Copied', 'Paste it to the people on this trip.'); };
  return <Sheet title="Share trip" footer={<Stack gap={10}>
    <Button label="Send invite" icon="share" onPress={() => void share()} />
    <Button label={fits ? 'Copy link' : 'Copy invite code'} icon="copy" kind="white" onPress={() => void copy()} />
  </Stack>}>
    <RowView gap={14}>
      <Illustration name={coverOf(current.trip)} width={72} height={72} radius={radii.card} />
      <View style={{ flex: 1, gap: 4 }}><T v="title">{current.trip.name}</T><T v="small">{dateRange(current.trip.start, current.trip.end)} · {current.trip.destination}</T></View>
    </RowView>
    <Card>
      <T v="row" style={{ fontSize: 15 }}>What they get</T>
      <T v="small">The days and plans, the people, shared costs and votes. Opening a newer invite updates their copy.</T>
      <T v="row" style={{ fontSize: 15 }}>What stays on your phone</T>
      <T v="small">Your wardrobe, outfits, packing ticks, documents, check-ins and emergency contacts.</T>
    </Card>
    {!current.extras.people.length ? <Button label="Add the people first" icon="users" kind="mist" onPress={() => router.replace('/people' as never)} /> : null}
  </Sheet>;
}

export function JoinTripSheet() {
  const params = useLocalSearchParams<{ d?: string }>();
  const router = useRouter();
  const { trips, edit } = useTrips();
  const store = useExtras();
  const { select } = useSelection();
  const [text, setText] = useState(params.d ? `?d=${params.d}` : '');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!text.trim()) { setInvite(null); setError(''); return; }
    const decoded = decodeInvite(text);
    setInvite(decoded);
    setError(decoded ? '' : 'That isn’t a Trips Loom invite. Paste the whole link or code.');
    // The sender appears first; the person opening it is one of the others.
    setMe(decoded?.extras.people[1]?.id ?? null);
  }, [text]);
  const paste = async () => setText(await Clipboard.getStringAsync());
  const existing = invite ? trips.find((t) => t.id === invite.trip.id) : undefined;
  // Your own trip (organised here, not received from someone): opening its invite must not turn it into a copy.
  const ownTrip = !!existing && !store.get(existing.id).invitedBy;
  const openOwn = () => {
    if (!existing) return;
    select(existing.id);
    if (router.canDismiss()) router.dismissAll();
    router.push('/trip' as never);
  };
  const join = (asNew: boolean) => {
    if (!invite || ownTrip) return;
    let meId = me;
    let source = invite;
    if (asNew) {
      meId = `p-${uid()}`;
      source = { ...invite, extras: { ...invite.extras, people: [...invite.extras.people, { id: meId, name: 'You' }] } };
    }
    if (!meId) { Alert.alert('Choose who you are', 'Pick your name so your share of costs is right.'); return; }
    const copy = acceptInvite(source, meId);
    const ok = edit((w) => {
      const index = w.trips.findIndex((t) => t.id === copy.trip.id);
      if (index >= 0) {
        // Keep your own packing ticks and outfits on an update.
        const mine = w.trips[index];
        w.trips[index] = { ...copy.trip, packed: mine.packed.filter((id) => w.items.some((i) => i.id === id)), days: Object.fromEntries(Object.entries(copy.trip.days).map(([d, day]) => [d, { ...day, outfitId: mine.days[d]?.outfitId ?? '', outfitIds: mine.days[d]?.outfitIds ?? [], gear: mine.days[d]?.gear ?? [] }])) };
      } else {
        w.trips.push(copy.trip);
      }
    });
    if (!ok) return;
    const previous = store.get(copy.trip.id);
    store.put(copy.trip.id, { ...copy.extras, documents: previous.documents, adventure: { ...copy.extras.adventure, checkIns: previous.adventure.checkIns, emergency: previous.adventure.emergency }, rating: previous.rating, recapNote: previous.recapNote, places: previous.places, journal: previous.journal });
    select(copy.trip.id);
    if (router.canDismiss()) router.dismissAll();
    router.push('/trip' as never);
  };
  if (invite && ownTrip) return <Sheet title="Join a trip" footer={<Button label="Open trip" icon="chev" onPress={openOwn} />}>
    <RowView gap={14}>
      <Illustration name={coverOf(invite.trip)} width={72} height={72} radius={radii.card} />
      <View style={{ gap: 4, flex: 1 }}>
        <T v="eyebrow">Your trip</T>
        <T v="title">{invite.trip.name}</T>
        <T v="small">{dateRange(invite.trip.start, invite.trip.end)} · {invite.trip.destination}</T>
      </View>
    </RowView>
    <Note>This is the invite for a trip you organise. Send it to the people travelling with you; opening it here changes nothing.</Note>
  </Sheet>;
  return <Sheet title="Join a trip" footer={invite ? <Button label={existing ? 'Update my copy' : 'Join trip'} icon="chev" onPress={() => join(false)} /> : <Button label="Paste invite" icon="copy" onPress={() => void paste()} />}>
    {!invite ? <>
      <Note>Open the link someone sent you, or copy their invite and paste it here.</Note>
      <Field label="Invite link or code" value={text} onChangeText={setText} icon="link" multiline placeholder="tripsloom://join?d=…" error={error} />
    </> : <>
      <RowView gap={14}>
        <Illustration name={coverOf(invite.trip)} width={72} height={72} radius={radii.card} />
        <View style={{ gap: 4, flex: 1 }}>
          <T v="eyebrow">{existing ? `Update from ${invite.from}` : `${invite.from} invited you`}</T>
          <T v="title">{invite.trip.name}</T>
          <T v="small">{dateRange(invite.trip.start, invite.trip.end)} · {invite.trip.destination}</T>
        </View>
      </RowView>
      <Stack gap={8}><T v="row" style={{ paddingHorizontal: 4 }}>Which one is you?</T><Note>So shared costs show what you owe and are owed.</Note></Stack>
      <Group>
        {invite.extras.people.slice(1).map((p) => <Row key={p.id} leading={<Avatar initials={initials(p.name)} tint={tintFor(p.id)} size={44} />}
          title={p.name} meta={`Added by ${invite.from}`} trailing={<Radio on={me === p.id} />} onPress={() => setMe(p.id)} />)}
        <Row leading={<Avatar initials="+" tint="peach" size={44} />} title="Someone new" meta="Add yourself to the trip" trailing={<Icon name="chev" size={18} color={colors.stone} />} onPress={() => join(true)} />
      </Group>
      <Button label="Use a different invite" kind="mist" height={44} onPress={() => setText('')} />
    </>}
  </Sheet>;
}
