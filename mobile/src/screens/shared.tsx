import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useOpenTripPage, useRouter } from '../core/nav';
import * as Clipboard from 'expo-clipboard';
import { reportError, useCurrentTrip, usePrefs, useSelection, useTrips } from '../core/state';
import { addDays, daysBetween, ME, uid, useExtras, type DateOption, type Poll, type Rsvp, type Trip, type TripExtras } from '../data';
import { dateRange, initials, money, plural, toDate, todayISO } from '../domain/format';
import { balances, coverOf, nameOf, perPersonEstimate, transfers, type PerPerson } from '../domain/trips';
import {
  Avatar, Button, Card, colors, CurrencyField, DateField, EmptyState, Field, FieldLabel, Group, Header, Icon, IconTile, Illustration, Note, Progress, Radio,
  radii, RoundButton, Row, RowView, Screen, Section, Sheet, Stack, T, tints,
  useDirty, PressScale, Banner, SheetActions, Selectable, CheckToggle, Tag, haptic,
} from '../loom';
import { useRates } from '../services/currency';
import { tripLink, useLive, type Preview } from '../core/live';
import { payWithUpi } from '../services/upi';
import { KittyCard, ReadyRow } from './organiser';
import { tintFor } from '../domain/people';
import { GroupSummaryCard, MyPrefs, ShortlistCard } from './shortlist';
import { longWeekends } from '../domain/holidays';
import { M } from '../domain/messages';
import { inIndia } from '../domain/ideas';
import { track } from '../core/analytics';
import { acceptInvite, decodeInvite, type Invite } from '../services/invite';

export { tintFor };

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
  const store = useExtras();
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
      <PressScale accessibilityRole="button" accessibilityLabel={`${trip.name}, people`} onPress={() => go('/people')}>
        <RowView gap={14}>
          <Illustration name={coverOf(trip)} width={56} height={56} radius={12} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="row" lines={1}>{trip.name}</T>
            <T v="meta" lines={1}>{['You', ...extras.people.map((p) => p.name)].join(', ')}</T>
          </View>
          <People extras={extras} me={prefs.name || 'You'} />
        </RowView>
      </PressScale>
    </Card>
    {extras.live ? <WhosComing trip={trip} extras={extras} /> : <Card>
      <RowView gap={12}><IconTile icon="link" tint="mint" /><View style={{ flex: 1, gap: 2 }}>
        <T v="row" style={{ fontSize: 15 }}>Make it one shared trip</T>
        <T v="meta">Send one link: everyone sees the same plan, says if they’re in and adds their own costs.</T>
      </View></RowView>
      <Button label="Get the link" icon="share" kind="mist" height={44} onPress={() => go('/invite')} />
    </Card>}
    <GroupSummaryCard trip={trip} extras={extras} myName={prefs.name} />
    <DatePollCard trip={trip} extras={extras} onCreate={() => go('/date-poll')} />
    <ShortlistCard trip={trip} extras={extras} onAdd={() => go('/plan')} onPlan={() => go('/plan')}
      editExtras={(fn) => { select(trip.id); store.change(trip.id, fn); }} />
    {extras.live && trip.end >= todayISO() ? <ReadyRow trip={trip} extras={extras} onOpen={() => go('/ready')} /> : null}
    <KittyCard trip={trip} extras={extras} onStart={() => go('/kitty')} onTopUp={() => go('/kitty')} />
    <Section title="Settle up" action={mine.length ? 'Record a payment' : undefined} onAction={() => go('/settle-up')}>
      {mine.length ? <Group>{mine.map((t, i) => {
        const incoming = t.to === ME;
        const other = incoming ? t.from : t.to;
        return <Row key={i} leading={<Avatar initials={initials(name(other))} tint={tintFor(other)} size={44} />}
          title={incoming ? `${name(other)} owes you` : `You owe ${name(other)}`}
          meta={incoming ? 'Tap when they’ve paid you' : trip.currency === 'INR' && extras.people.find((p) => p.id === other)?.upi ? 'Tap to pay with UPI' : 'Tap to record a payment'}
          onPress={() => go('/settle-up', { from: t.from, to: t.to, amount: String(t.amount) })}
          trailing={<T v="title" style={{ fontSize: 18 }} color={incoming ? tints.mint.fg : colors.danger}>{money(t.amount, trip.currency)}</T>} />;
      })}</Group> : null}
      {mine.some((t) => t.to === ME) && trip.currency === 'INR' && !prefs.native.upiId ? <Banner icon="card" tint="mint" title="Get paid back in one tap"
        body="Add your UPI ID and friends can pay you from GPay, PhonePe or Paytm." action="Add" onAction={() => router.push('/preferences' as never)} /> : null}
      {mine.length ? null : <Card><RowView gap={12}><IconTile icon="check" tint="mint" /><View style={{ flex: 1, gap: 2 }}>
        <T v="row" style={{ fontSize: 15 }}>All settled up</T>
        <T v="meta">Add an expense in Budget and split it to see who owes whom.</T>
      </View></RowView></Card>}
    </Section>
    <Section title="Votes" action="Start a vote" onAction={() => go('/start-vote')}>
      {open.length ? open.map((poll) => <VoteCard key={poll.id} poll={poll} extras={extras} tripId={trip.id} />)
        : <Card><T v="small">No open votes. Ask everyone where to eat or what to do on a free afternoon.</T></Card>}
    </Section>
    <Button label={extras.live ? 'Invite more people' : 'Share the trip'} icon="share" kind="white" onPress={() => go('/invite')} />
  </Stack>;
}

const RSVP_LABEL: Record<Rsvp, string> = { in: 'I’m in', maybe: 'Maybe', out: 'Can’t make it' };

/** Who's coming: your answer, everyone else's, and the cost each if the in-people go. */
function WhosComing({ trip, extras }: { trip: Trip; extras: TripExtras }) {
  const live = useLive();
  const rates = useRates(trip.currency);
  const mine = extras.members.find((m) => m.id === ME);
  const counts = { in: 0, maybe: 0, out: 0, none: 0 };
  for (const m of extras.members) counts[m.rsvp ?? 'none'] += 1;
  const estimate = perPersonEstimate(trip, extras, rates);
  return <Section title="Who’s coming">
    <Card>
      <RowView gap={8}>
        {(['in', 'maybe', 'out'] as const).map((r) => <PressScale key={r} accessibilityRole="radio" accessibilityState={{ checked: mine?.rsvp === r }} style={{ flex: 1 }}
          onPress={() => { haptic.select(); void live.setRsvp(trip.id, r); }}>
          <Selectable on={mine?.rsvp === r} render={(on) => <View style={{ minHeight: 44, borderRadius: radii.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
            backgroundColor: on ? (r === 'out' ? colors.danger : colors.inkButton) : colors.mist }}>
            <T v="small" color={on ? '#FFFFFF' : colors.ink} style={{ fontSize: 14 }} lines={1}>{RSVP_LABEL[r]}</T>
          </View>} />
        </PressScale>)}
      </RowView>
      <Stack gap={0}>{extras.members.map((m) => <RowView key={m.id} gap={12} style={{ paddingVertical: 8 }}>
        <Avatar initials={initials(m.name)} tint={tintFor(m.id)} size={36} />
        <T v="row" style={{ flex: 1, fontSize: 15 }} lines={1}>{m.id === ME ? `${m.name} (you)` : m.name}{m.role === 'organiser' ? ' · organiser' : ''}</T>
        <Tag text={m.rsvp ? RSVP_LABEL[m.rsvp] : 'Not yet'} tint={m.rsvp === 'in' ? 'mint' : m.rsvp === 'out' ? 'rose' : m.rsvp === 'maybe' ? 'peach' : 'grey'} />
      </RowView>)}
        {extras.people.filter((p) => p.id.startsWith('p-')).map((p) => <RowView key={p.id} gap={12} style={{ paddingVertical: 8 }}>
          <Avatar initials={initials(p.name)} tint={tintFor(p.id)} size={36} />
          <T v="row" style={{ flex: 1, fontSize: 15 }} lines={1}>{p.name}</T>
          <Tag text="Not joined" tint="grey" />
        </RowView>)}
      </Stack>
      <T v="meta">{counts.in} in · {counts.maybe} maybe{counts.none ? ` · ${counts.none} haven’t said` : ''}{estimate ? ` · ${estimateLabel(estimate, trip.currency)}` : ''}</T>
      {mine ? <MyPrefs value={mine.prefs} onChange={(p) => void live.setPrefs(trip.id, p)} /> : null}
    </Card>
  </Section>;
}

/* ------------------------------------------------------------------ Dates */

/** The date poll: which ranges work for whom, and the organiser locks one (which sets the trip's dates). */
function DatePollCard({ trip, extras, onCreate }: { trip: Trip; extras: TripExtras; onCreate: () => void }) {
  const current = useCurrentTrip();
  const { select } = useSelection();
  const poll = extras.datePoll;
  const organiser = !extras.live || extras.live.role === 'organiser';
  if (!poll) return organiser && trip.start > todayISO() ? <Button label="Ask when everyone can go" icon="calendar" kind="white" onPress={onCreate} /> : null;
  const everyone = Math.max(1, extras.members.filter((m) => m.rsvp !== 'out').length || extras.people.length + 1);
  const mine = poll.votes[ME] ?? [];
  const edit = (fn: (d: TripExtras) => void) => { select(trip.id); current?.editExtras(fn); };
  const toggle = (id: string) => {
    haptic.select();
    edit((d) => { if (!d.datePoll) return; const v = d.datePoll.votes[ME] ?? []; d.datePoll.votes[ME] = v.includes(id) ? v.filter((x) => x !== id) : [...v, id]; });
    track('vote_cast', { poll: 'dates' });
  };
  const lock = (id: string) => {
    const opt = poll.options.find((o) => o.id === id);
    if (!opt || !current) return;
    Alert.alert('Lock these dates?', `${dateRange(opt.start, opt.end)} becomes the trip’s dates for everyone. Plans move with the days.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Lock dates', onPress: () => {
        select(trip.id);
        current.editTrip((t) => moveTrip(t, opt.start, opt.end));
        current.editExtras((d) => { if (d.datePoll) d.datePoll.lockedId = id; });
        track('dates_locked', { options: poll.options.length });
      } },
    ]);
  };
  const best = Math.max(...poll.options.map((o) => Object.values(poll.votes).filter((v) => v.includes(o.id)).length));
  return <Section title={poll.lockedId ? 'Dates' : 'When can everyone go?'} action={organiser && !poll.lockedId ? 'Change' : undefined} onAction={onCreate}>
    <Card>
      {poll.options.map((o) => {
        const yes = Object.values(poll.votes).filter((v) => v.includes(o.id)).length;
        const locked = poll.lockedId === o.id;
        return <Stack key={o.id} gap={6}>
          <RowView gap={12}>
            {poll.lockedId ? <IconTile icon={locked ? 'check' : 'calendar'} tint={locked ? 'mint' : undefined} size={36} />
              : <CheckToggle checked={mine.includes(o.id)} label={`${dateRange(o.start, o.end)} works for me`} onChange={() => toggle(o.id)} />}
            <View style={{ flex: 1, gap: 2 }}>
              <T v="row" style={{ fontSize: 15 }}>{dateRange(o.start, o.end)}</T>
              <T v="meta">{yes} of {everyone} can go{locked ? ' · locked' : yes === best && yes > 0 && !poll.lockedId ? ' · most popular' : ''}</T>
            </View>
            {organiser && !poll.lockedId && yes > 0 ? <Button label="Lock" kind="mist" full={false} height={36} onPress={() => lock(o.id)} /> : null}
          </RowView>
          {!poll.lockedId ? <Progress pct={(yes / everyone) * 100} color={yes === best && yes > 0 ? colors.ember : colors.dashed} /> : null}
        </Stack>;
      })}
    </Card>
  </Section>;
}

/** Moves a trip to new dates: plans and day notes shift with the days; any past the new end are dropped. */
export function moveTrip(t: Trip, start: string, end: string) {
  const offset = daysBetween(t.start, start);
  t.activities = t.activities.map((a) => ({ ...a, date: addDays(a.date, offset) })).filter((a) => a.date >= start && a.date <= end);
  t.days = Object.fromEntries(Object.entries(t.days).map(([d, day]) => [addDays(d, offset), day] as const).filter(([d]) => d >= start && d <= end));
  t.start = start; t.end = end;
}

export function DatePollSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const existing = current?.extras.datePoll;
  const length = current ? daysBetween(current.trip.start, current.trip.end) : 2;
  const [options, setOptions] = useState<DateOption[]>(existing?.options ?? []);
  const dirty = useDirty([options]);
  if (!current) return <Sheet title="When can everyone go?"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  // The next few weekends with the trip's length, as quick picks (Friday start for trips of 2 or more nights).
  const quick: DateOption[] = [];
  for (let d = addDays(todayISO(), 1); quick.length < 6; d = addDays(d, 1)) {
    if (toDate(d).getDay() !== (length >= 2 ? 5 : 6)) continue;
    quick.push({ id: uid(), start: d, end: addDays(d, length) });
  }
  const prefs = usePrefs();
  const holidays = inIndia(prefs.homeBase, prefs.currency) ? longWeekends('IN', addDays(todayISO(), 1)).map((w) => ({ ...w, id: uid() })) : [];
  const has = (o: DateOption) => options.some((x) => x.start === o.start && x.end === o.end);
  const toggle = (o: DateOption) => setOptions((list) => has(o) ? list.filter((x) => !(x.start === o.start && x.end === o.end)) : [...list, o].slice(0, 6));
  const save = () => {
    if (options.length < 2) { Alert.alert('Add at least two options', 'Pick a few date ranges for everyone to choose from.'); return; }
    current.editExtras((d) => {
      const keep = new Set(options.map((o) => o.id));
      d.datePoll = { options: [...options].sort((a, b) => a.start.localeCompare(b.start)), lockedId: '', createdAt: d.datePoll?.createdAt || new Date().toISOString(),
        votes: Object.fromEntries(Object.entries(d.datePoll?.votes ?? {}).map(([k, v]) => [k, v.filter((x) => keep.has(x))])) };
    });
    track('date_poll_created', { options: options.length });
    router.back();
  };
  return <Sheet title="When can everyone go?" dirty={dirty} footer={<Button label="Ask everyone" icon="calendar" onPress={save} />}>
    <Note>Pick up to six options. Everyone ticks the ones that work, and you lock the winner, which moves the trip to those dates.</Note>
    <Stack gap={8}><FieldLabel>{`Coming weekends · ${plural(length + 1, 'day')}`}</FieldLabel>
      <Group>{quick.map((o) => <Row key={o.start} icon="calendar" title={dateRange(o.start, o.end)} trailing={<CheckToggle checked={has(o)} label={dateRange(o.start, o.end)} onChange={() => toggle(o)} />} onPress={() => toggle(o)} />)}</Group>
    </Stack>
    {holidays.length ? <Stack gap={8}><FieldLabel>Long weekends</FieldLabel>
      <Group>{holidays.map((w) => <Row key={w.start} icon="sun" tint="peach" title={dateRange(w.start, w.end)} meta={`${w.holiday}${w.leave ? ` · take ${w.leave} day off` : ' · no leave needed'}`}
        trailing={<CheckToggle checked={has(w)} label={dateRange(w.start, w.end)} onChange={() => toggle(w)} />} onPress={() => toggle(w)} />)}</Group>
    </Stack> : null}
    {options.filter((o) => !quick.some((q) => q.start === o.start && q.end === o.end) && !holidays.some((q) => q.start === o.start && q.end === o.end)).length ? <Stack gap={8}><FieldLabel>Your other options</FieldLabel>
      <Group>{options.filter((o) => !quick.some((q) => q.start === o.start && q.end === o.end) && !holidays.some((q) => q.start === o.start && q.end === o.end)).map((o) => <Row key={o.id} icon="calendar" title={dateRange(o.start, o.end)}
        trailing={<CheckToggle checked label={dateRange(o.start, o.end)} onChange={() => toggle(o)} />} />)}</Group>
    </Stack> : null}
    <OtherDates length={length} onAdd={(o) => setOptions((list) => [...list, o].slice(0, 6))} />
  </Sheet>;
}

function OtherDates({ length, onAdd }: { length: number; onAdd: (o: DateOption) => void }) {
  const [start, setStart] = useState('');
  if (!start) return <Button label="Add other dates" icon="plus" kind="white" height={48} onPress={() => setStart(addDays(todayISO(), 30))} />;
  return <Card>
    <DateField label="Starts" value={start} min={todayISO()} onChange={setStart} />
    <Button label={`Add ${dateRange(start, addDays(start, length))}`} icon="plus" kind="mist" height={44} onPress={() => { onAdd({ id: uid(), start, end: addDays(start, length) }); setStart(''); }} />
  </Card>;
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
    if (p.votes[ME] === optionId) delete p.votes[ME]; else { p.votes[ME] = optionId; track('vote_cast'); }
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
      <PressScale accessibilityRole="button" accessibilityLabel="Delete vote" hitSlop={10} onPress={remove}><Icon name="trash" size={18} color={colors.stone} /></PressScale>
    </RowView>
    {poll.options.map((o, i) => <PressScale key={o.id} accessibilityRole="radio" accessibilityState={{ checked: mine === o.id }} accessibilityLabel={`${o.label}, ${counts[i]} votes`} onPress={() => vote(o.id)} style={{ gap: 6, paddingVertical: 4 }}>
      <RowView style={{ justifyContent: 'space-between' }}>
        <RowView gap={8} style={{ flex: 1 }}><Radio on={mine === o.id} /><T v="row" style={{ fontSize: 14, flex: 1 }}>{o.label}</T></RowView>
        <T v="small">{counts[i]}</T>
      </RowView>
      <Progress pct={total ? (counts[i] / total) * 100 : 0} color={counts[i] && counts[i] === lead ? colors.ember : colors.dashed} />
    </PressScale>)}
  </Card>;
}

export function SharedScreen() {
  const router = useRouter();
  const { trips } = useTrips();
  const store = useExtras();
  const { select } = useSelection();
  const withPeople = trips.filter((t) => store.get(t.id).people.length > 0 || store.get(t.id).live).sort((a, b) => a.start.localeCompare(b.start));
  const [active, setActive] = useState<string | null>(null);
  const trip = withPeople.find((t) => t.id === active) ?? withPeople.find((t) => t.end >= todayISO()) ?? withPeople[0];
  return <Screen bar="tabs">
    <Header big title="Shared" right={<RoundButton icon="plus" dark label="Join a trip with an invite" href="/join-trip" />} />
    {trip ? <>
      {withPeople.length > 1 ? <RowView gap={8} style={{ flexWrap: 'wrap' }}>
        {withPeople.map((t) => <PressScale key={t.id} accessibilityRole="button" accessibilityState={{ selected: t.id === trip.id }} onPress={() => setActive(t.id)}
          style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.button, backgroundColor: t.id === trip.id ? colors.inkButton : colors.card }}>
          <T v="small" color={t.id === trip.id ? '#FFFFFF' : colors.ink} style={{ fontSize: 14 }}>{t.name}</T>
        </PressScale>)}
      </RowView> : null}
      <TripCosts trip={trip} extras={store.get(trip.id)} />
    </> : <EmptyState art="compass" title="Travel with friends" body="Send one link to the people on a trip. Everyone sees the same plan, says if they’re in, votes and splits costs, and settles up in one tap."
      action={<Stack gap={10}>
        {trips.length ? <Button label="Invite people to a trip" icon="share" onPress={() => { select((trips.find((t) => t.end >= todayISO()) ?? trips[0]).id); router.push('/invite' as never); }} />
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
    <Note>{extras.live ? `${trip.name} · Add friends who haven’t joined yet so you can split costs with them now. When they join from the link, they pick their name and the costs become theirs.` : `${trip.name} · Add everyone sharing costs, then share the trip: everyone who opens the link joins this same trip.`}</Note>
    <Group>
      <Row leading={prefs.name ? <Avatar initials={initials(prefs.name)} tint="peach" size={44} /> : <IconTile icon="profile" tint="peach" />} title={prefs.name ? `${prefs.name} (you)` : 'You'} meta={extras.live?.role === 'member' ? 'On this trip' : 'Trip organiser'} trailing={null} />
      {extras.people.map((p) => <Row key={p.id} leading={<Avatar initials={initials(p.name)} tint={tintFor(p.id)} size={44} />} title={p.name} meta={p.id.startsWith('u-') ? 'Joined the trip' : 'Added by name · not joined yet'}
        trailing={<PressScale accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} hitSlop={10} onPress={() => remove(p.id, p.name)}><Icon name="x" size={18} color={colors.stone} /></PressScale>} />)}
    </Group>
    <Field label="Add a person" value={name} onChangeText={setName} icon="profile" kind="name" placeholder="Their name" returnKeyType="done" onSubmitEditing={add}
      trailing={name.trim() ? <PressScale accessibilityRole="button" accessibilityLabel="Add" onPress={add} hitSlop={8}><Icon name="plus" size={20} color={colors.ember} /></PressScale> : null} />
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
        trailing={options.length > 2 ? <PressScale accessibilityRole="button" accessibilityLabel={`Remove choice ${i + 1}`} hitSlop={8} onPress={() => setOptions(options.filter((_, j) => j !== i))}><Icon name="x" size={16} color={colors.stone} /></PressScale> : null} />)}
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
    track('settlement_added');
    router.back();
  };
  const picker = (label: string, value: string, set: (id: string) => void, exclude: string) => <Stack gap={8}><FieldLabel>{label}</FieldLabel>
    <Group>{everyone.filter((p) => p.id !== exclude).map((p) => <Row key={p.id} leading={<Avatar initials={initials(p.name)} tint={tintFor(p.id)} size={40} />}
      title={p.name} trailing={<Radio on={value === p.id} />} onPress={() => set(p.id)} />)}</Group></Stack>;
  // Paying a friend who has a UPI ID: open the UPI app, then come back and save it as paid.
  const payee = current.extras.people.find((p) => p.id === to);
  const canUpi = from === ME && !!payee?.upi && currency === 'INR' && value > 0;
  const pay = async () => {
    if (!payee?.upi) return;
    track('upi_pay_opened');
    const opened = await payWithUpi({ upi: payee.upi, name: payee.name }, value, `${current.trip.name} · Tripsloom`);
    if (!opened) Alert.alert('No UPI app found', 'Install a UPI app such as GPay, PhonePe or Paytm, or pay another way and save it here.');
  };
  return <Sheet title={canUpi ? `Pay ${payee?.name ?? ''}` : 'Record a payment'} dirty={dirty} footer={canUpi ? <SheetActions
    primary={<Button label={`Pay ${money(value, 'INR')} with UPI`} icon="card" onPress={() => void pay()} />}
    actions={[{ icon: 'check', label: 'Save as paid', onPress: save }]} /> : <Button label="Save payment" icon="check" onPress={save} />}>
    {canUpi ? <Note>Pays {payee?.upi} from your UPI app. When it has gone through, tap ✓ to save it here so everyone’s balance updates.</Note> : null}
    {picker('Who paid', from, (id) => { setFrom(id); if (id === to) setTo(''); }, '')}
    {picker('Paid to', to, setTo, from)}
    <RowView align="flex-start">
      <Field flex label="Amount" value={amount} onChangeText={setAmount} kind="number" icon="card" placeholder="0" />
      <CurrencyField flex value={currency} onChange={setCurrency} />
    </RowView>
  </Sheet>;
}

/* ------------------------------------------------------------------ Invites */

/** "₹14k–17k each" from an estimate. */
export function estimateLabel(e: PerPerson, currency: string): string {
  const lo = money(e.low, currency, true), hi = money(e.high, currency, true);
  return lo === hi ? `about ${lo} each` : `${lo}–${hi} each`;
}

/**
 * Sharing a trip makes it live: one trip everyone on it sees and edits, opened from one link. Friends without
 * the app can see it on the web page at the same link (the web Trip Room).
 */
export function InviteSheet() {
  const current = useCurrentTrip();
  const prefs = usePrefs();
  const router = useRouter();
  const live = useLive();
  const rates = useRates(current?.trip.currency ?? 'EUR');
  const [code, setCode] = useState<string | null>(current?.extras.live?.code ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (current?.extras.live?.code) setCode(current.extras.live.code); }, [current?.extras.live?.code]);
  if (!current) return <Sheet title="Share trip"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const { trip, extras } = current;
  const organiser = !extras.live || extras.live.role === 'organiser';
  const estimate = perPersonEstimate(trip, extras, rates);
  const ensure = async (): Promise<string | null> => {
    if (code) return code;
    setBusy(true); setError('');
    try { const c = await live.share(trip.id); setCode(c); return c; } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t make the link. Check your connection.'); return null; } finally { setBusy(false); }
  };
  const message = (c: string) => M.invite(prefs.native.shareLanguage, trip.name, dateRange(trip.start, trip.end), trip.destination.split(',')[0] ?? '',
    estimate ? estimateLabel(estimate, trip.currency) : '', tripLink(c));
  const share = async () => {
    const c = await ensure();
    if (!c) return;
    try { const r = await Share.share({ message: message(c) }); if (r.action === Share.sharedAction) track('invite_sent', { live: true }); } catch (e) { reportError(e, 'Couldn’t share'); }
  };
  const copy = async () => { const c = await ensure(); if (!c) return; await Clipboard.setStringAsync(tripLink(c)); Alert.alert('Link copied', 'Paste it in your group chat.'); };
  const turnOff = () => Alert.alert('Make a new link?', 'The current link stops working. People already on the trip stay on it.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'New link', style: 'destructive', onPress: () => void live.rotate(trip.id).then(setCode).catch((e) => reportError(e)) },
  ]);
  const going = extras.members.filter((m) => m.rsvp === 'in').length;
  return <Sheet title="Share trip" footer={<Stack gap={10}>
    <Button label={busy ? 'Making the link…' : 'Send invite'} icon={busy ? undefined : 'share'} leading={busy ? <ActivityIndicator color="#FFFFFF" /> : undefined} onPress={() => void share()} />
    <Button label="Copy link" icon="copy" kind="white" onPress={() => void copy()} />
  </Stack>}>
    <RowView gap={14}>
      <Illustration name={coverOf(trip)} width={72} height={72} radius={radii.card} />
      <View style={{ flex: 1, gap: 4 }}><T v="title">{trip.name}</T><T v="small">{dateRange(trip.start, trip.end)}{trip.destination ? ` · ${trip.destination}` : ''}</T></View>
    </RowView>
    {error ? <Banner icon="cloud" tint="rose" title="Couldn’t make the link" body={error} /> : null}
    {code ? <Card>
      <RowView gap={12}><IconTile icon="link" tint="mint" /><View style={{ flex: 1, gap: 2 }}>
        <T v="row" style={{ fontSize: 15 }}>Live trip</T>
        <T v="meta" lines={1}>{tripLink(code)}</T>
      </View></RowView>
      <T v="small">{extras.members.length > 1 ? `${plural(extras.members.length, 'person', 'people')} on it · ${going} going. Changes anyone makes show for everyone.` : 'Everyone who opens the link joins this same trip. Changes anyone makes show for everyone.'}</T>
      {organiser ? <Button label="Turn off this link" icon="refresh" kind="mist" height={44} onPress={turnOff} /> : null}
    </Card> : <Card>
      <T v="row" style={{ fontSize: 15 }}>One link for everyone</T>
      <T v="small">Friends open it, say if they’re in, add the places they want and vote on the plan, and split costs, all on this same trip. Friends without the app can still open the link to see the plan and who’s coming.</T>
    </Card>}
    {code ? <Card>
      <RowView gap={12}><IconTile icon="home" tint="lavender" /><View style={{ flex: 1, gap: 2 }}>
        <T v="row" style={{ fontSize: 15 }}>For family at home</T>
        <T v="meta">A view-only link: the plan, the stays and who’s going. It can’t join or change anything.</T>
      </View></RowView>
      <Button label="Send the family link" icon="share" kind="mist" height={44} onPress={() => void live.familyLink(trip.id).then((link) => Share.share({
        message: `Here’s our plan for ${trip.name} (${dateRange(trip.start, trip.end)})${Object.values(trip.days).some((d) => d?.stay) ? ', with where we’re staying each night' : ''}: ${link}`,
      })).catch((e) => reportError(e, 'Couldn’t make the link'))} />
    </Card> : null}
    {estimate ? <Card>
      <RowView gap={12}><IconTile icon="card" tint="peach" /><View style={{ flex: 1, gap: 2 }}>
        <T v="row" style={{ fontSize: 15 }}>{estimateLabel(estimate, trip.currency)}</T>
        <T v="meta">{estimate.basis === 'budget' ? `From the trip budget, split ${estimate.people} ways` : `From costs planned so far, split ${estimate.people} ways; it may go up`}</T>
      </View></RowView>
    </Card> : <Note>Add a budget in Edit trip and the invite shows what it costs each person.</Note>}
    <Card>
      <T v="row" style={{ fontSize: 15 }}>What stays private</T>
      <T v="small">Your wardrobe, outfits, packing ticks, documents, check-ins and emergency contacts never leave your phone.</T>
    </Card>
    {prefs.native.upiId || trip.currency !== 'INR' ? null : <Banner icon="card" tint="mint" title="Add your UPI ID" body="Friends can pay you back in one tap." action="Add" onAction={() => router.push('/preferences' as never)} />}
  </Sheet>;
}

/** The code in a live trip link: `https://tripsloom.com/t/<code>`, `tripsloom://t/<code>`, or the code itself. */
export function liveCodeFrom(text: string): string | null {
  const t = text.trim();
  const m = t.match(/(?:^|\/)t\/([A-Za-z0-9]{10,16})(?:[/?#]|$)/) ?? t.match(/^([A-Za-z0-9]{12})$/);
  return m ? m[1] : null;
}

export function JoinTripSheet() {
  const params = useLocalSearchParams<{ d?: string; code?: string }>();
  const [text, setText] = useState(params.d ? `?d=${params.d}` : params.code ?? '');
  const code = liveCodeFrom(text);
  return code ? <LiveJoin code={code} onBack={() => setText('')} /> : <CopyJoin text={text} setText={setText} />;
}

/** Joining a live trip from its link: preview, then join, then (if the organiser added you by name) say which one is you. */
function LiveJoin({ code, onBack }: { code: string; onBack: () => void }) {
  const live = useLive();
  const router = useRouter();
  const openTrip = useOpenTripPage();
  const { select } = useSelection();
  const { trips } = useTrips();
  const store = useExtras();
  const [preview, setPreview] = useState<Preview | null | 'loading'>('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setPreview('loading'); setError('');
    void live.peek(code).then((p) => { if (active) setPreview(p); }).catch((e) => { if (active) { setPreview(null); setError(e instanceof Error ? e.message : 'Couldn’t open the invite.'); } });
    return () => { active = false; };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (id: string) => { select(id); openTrip('/trip'); };
  const join = async () => {
    setBusy(true);
    try {
      // Added by name before joining? The next screen asks which guest is you, so past costs and votes become yours.
      setJoined(await live.join(code));
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t join. Check your connection.'); } finally { setBusy(false); }
  };
  const claim = (guestId: string | null) => {
    if (!joined) return;
    if (guestId) store.change(joined, (d) => claimGuest(d, guestId));
    open(joined);
  };
  // Once the joined trip's people are on this phone: straight to the trip, unless there are guests to claim.
  const joinedExtras = joined ? store.get(joined) : null;
  const guests = joinedExtras ? joinedExtras.people.filter((p) => p.id.startsWith('p-')) : [];
  const arrived = !!joinedExtras?.members.length;
  useEffect(() => { if (joined && arrived && !guests.length) open(joined); }, [joined, arrived, guests.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (joined) {
    if (!arrived) return <Sheet title="Join a trip"><Card><RowView gap={12}><ActivityIndicator color={colors.ember} /><T v="small">Bringing the trip to your phone…</T></RowView></Card></Sheet>;
    return <Sheet title="Which one is you?" footer={<Button label="None of these" kind="white" onPress={() => claim(null)} />}>
      <Note>The organiser added some people by name. If one of them is you, their share of costs and votes becomes yours.</Note>
      <Group>{guests.map((p) => <Row key={p.id} leading={<Avatar initials={initials(p.name)} tint={tintFor(p.id)} size={44} />} title={p.name} meta="Added by name" onPress={() => claim(p.id)} />)}</Group>
    </Sheet>;
  }
  const already = preview && preview !== 'loading' && trips.some((t) => t.id === preview.id && store.get(t.id).live);
  return <Sheet title="Join a trip" footer={preview && preview !== 'loading'
    ? (already ? <Button label="Open trip" icon="chev" onPress={() => open(preview.id)} />
      : <Button label={busy ? 'Joining…' : 'Join trip'} icon={busy ? undefined : 'chev'} leading={busy ? <ActivityIndicator color="#FFFFFF" /> : undefined} onPress={() => void join()} />)
    : <Button label="Use a different invite" kind="white" onPress={onBack} />}>
    {preview === 'loading' ? <Card><RowView gap={12}><ActivityIndicator color={colors.ember} /><T v="small">Opening the invite…</T></RowView></Card>
      : preview ? <>
        <RowView gap={14}>
          <Illustration name={coverOf({ theme: (preview.theme ?? undefined) as Trip['theme'] })} width={72} height={72} radius={radii.card} />
          <View style={{ gap: 4, flex: 1 }}>
            <T v="eyebrow">{preview.organiser ? `${preview.organiser} invited you` : 'You’re invited'}</T>
            <T v="title">{preview.name}</T>
            <T v="small">{dateRange(preview.start, preview.end)}{preview.destination ? ` · ${preview.destination}` : ''}</T>
          </View>
        </RowView>
        <Card><T v="small">{plural(preview.members, 'person', 'people')} on this trip. Joining puts the same trip on your phone: say if you’re in, see the plan, vote and split costs together. Your wardrobe, packing and documents stay private.</T></Card>
      </> : <Banner icon="link" tint="rose" title="This invite doesn’t work" body={error || 'It may have been turned off. Ask for a new link.'} />}
    {error && preview && preview !== 'loading' ? <T v="meta" color={colors.danger}>{error}</T> : null}
  </Sheet>;
}

/** A guest (added by name) turns out to be you: their costs, payments and votes become yours. */
function claimGuest(d: TripExtras, guestId: string) {
  const swap = (id: string) => (id === guestId ? ME : id);
  d.people = d.people.filter((p) => p.id !== guestId);
  d.expenses = d.expenses.map((e) => ({ ...e, paidBy: swap(e.paidBy), splitWith: [...new Set(e.splitWith.map(swap))] }));
  d.settlements = d.settlements.map((x) => ({ ...x, from: swap(x.from), to: swap(x.to) })).filter((x) => x.from !== x.to);
  for (const p of d.polls) if (p.votes[guestId]) { p.votes[ME] = p.votes[guestId]; delete p.votes[guestId]; }
  if (d.datePoll?.votes[guestId]) { d.datePoll.votes[ME] = d.datePoll.votes[guestId]; delete d.datePoll.votes[guestId]; }
}

/** The earlier, copy-based invite (`tripsloom://join?d=…`): still opens, for links sent before live trips. */
function CopyJoin({ text, setText }: { text: string; setText: (t: string) => void }) {
  const router = useRouter();
  const openTrip = useOpenTripPage();
  const { trips, edit } = useTrips();
  const store = useExtras();
  const { select } = useSelection();
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
    openTrip('/trip');
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
    openTrip('/trip');
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
      <Field label="Invite link or code" value={text} onChangeText={setText} icon="link" multiline placeholder="https://tripsloom.com/t/…" error={error} />
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
