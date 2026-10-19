/**
 * The planning board: one place where a trip is planned together, by you, your friends and AI.
 *
 * Everyone adds ideas (a reel or post, a Maps link, a place typed in, or something AI suggested), and everyone says
 * which they want. Each person's preferences (pace, food, budget) and a few shared settings decide how the days are
 * paced. "Draft the days" turns it all into a day-by-day plan with the same engine as the trip planner (nearby
 * places together, sunsets at sunset, meals near where you are), says why each stop is there, and replaces only
 * what the last draft made: plans people added by hand stay. On a shared trip every change syncs to everyone.
 * Works alone too: then it's just you and AI.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Text, View } from 'react-native';
import { track } from '../core/analytics';
import { useCloudAi } from '../core/cloudAi';
import { useLive } from '../core/live';
import { useOpenTripPage, useRouter } from '../core/nav';
import { useCurrentTrip, usePrefs } from '../core/state';
import { ME, uid, useAuth, type PlanState, type ShortlistItem } from '../data';
import { dateRange, initials, plural, shortDay } from '../domain/format';
import { tintFor } from '../domain/people';
import { buildPlan, clock, isoAdd, isTheCity, KIND_LABEL, kindOf, sunTimes, toMin, type Kind, type Stop } from '../domain/planmode';
import { applyDraft, draftInput, ideaStatus, tripLength } from '../domain/together';
import { nameOf } from '../domain/trips';
import { Avatar, colors, fonts, GlassFill, Icon, PressScale, radii, Screen, T, tints, useGoBack } from '../loom';
import { aiAvailable, aiFailed, aiIdeas, type AiInfo } from '../services/planai';
import { alreadyIn, ideasFrom, locateIdeas, toShortlistItem, type IdeaCandidate } from '../services/ideas';
import { placeIn, regionFor, type Region } from '../services/reels';
import { dayPins, DayView, KIND_COLOR, KIND_ICON, KIND_TINT, type KeptPlan } from './planparts';
import { Asks, Blank, BlankEditor, Chips, Choices, DayStrip, Dot, Heading, Label, LineInput, Lines, Link, NextBar, PageTop, PlaceChip, Suggestion, Tile } from './planui';
import { PlanMap } from './planmap';
import { MyPrefs } from './shortlist';

const VIA_LABEL: Partial<Record<NonNullable<ShortlistItem['via']>, string>> = { reel: 'from a reel', link: 'from a link', shot: 'from a screenshot' };
const PRIORITY_LABEL = { must: 'In the plan', maybe: 'If there’s room', skip: 'Nobody yet' } as const;
const ASKS = ['Fill the gaps', 'Food we can all eat', 'Something offbeat', 'Evenings out', 'A rainy-day plan'];
const defaults = (p: PlanState | null): PlanState => p ?? { pace: '', food: '', arrive: 'afternoon', leave: 'afternoon', drafted: [], draftedAt: '', draftedBy: '' };

/** One idea on the board: what it is, who added it and how, and the group's say. Tap the heart to want it. */
function IdeaRow({ item, city, votes, of, priority, planned, who, mine, onVote, onOpen }: {
  item: ShortlistItem; city: string; votes: number; of: number; priority: 'must' | 'maybe' | 'skip'; planned?: string; who: string; mine: boolean; onVote: () => void; onOpen: () => void;
}) {
  const kind = (item.kind as Kind | undefined) ?? kindOf(item.title);
  // The neighbourhood, when it says more than the place's own name or the city the whole trip is in.
  const area = item.place && item.place.toLowerCase() !== item.title.toLowerCase() && !isTheCity(item.place, city) ? item.place : '';
  const located = item.lat !== undefined;
  const status = planned ? `Planned for ${shortDay(planned)}` : item.pinned ? `On ${shortDay(item.pinned)}` : PRIORITY_LABEL[priority];
  const statusColor = planned || priority === 'must' ? colors.success : item.pinned ? tints.lavender.fg : priority === 'maybe' ? colors.inkMuted : colors.inkFaint;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
    <PressScale accessibilityRole="button" accessibilityLabel={`${item.title}, options`} onPress={onOpen} style={{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <Dot icon={KIND_ICON[kind] ?? 'pin'} tint={located ? KIND_TINT[kind] ?? 'grey' : 'grey'} color={located ? KIND_COLOR[kind] : colors.inkFaint} />
      <View style={{ flex: 1, gap: 3 }}>
        <T v="row" style={{ fontSize: 15 }}>{item.title}</T>
        <T v="meta" lines={1}>{[KIND_LABEL[kind] !== 'Place' ? KIND_LABEL[kind] : '', located ? area : 'Not found on the map', who].filter(Boolean).join(' · ')}</T>
        <T v="meta" color={statusColor}>{`${status}${of > 1 ? ` · ${votes} of ${of} want it` : ''}`}</T>
      </View>
    </PressScale>
    <PressScale accessibilityRole="button" accessibilityState={{ selected: mine }} accessibilityLabel={mine ? `Don’t want ${item.title}` : `Want ${item.title}`} hitSlop={10} onPress={onVote}
      style={{ width: 40, height: 40, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center' }}>
      <GlassFill kind={mine ? 'khaki' : 'control'} radius={radii.chip} sheen={mine} />
      <Icon name="heart" size={17} color={mine ? colors.ink : colors.inkMuted} filled={mine} />
    </PressScale>
  </View>;
}

/** Ideas found from a link, text or AI, to pick from before they go on the board. */
function Candidates({ list, have, onAdd, onDone }: { list: IdeaCandidate[]; have: ShortlistItem[]; onAdd: (c: IdeaCandidate[]) => void; onDone: () => void }) {
  const fresh = list.filter((c) => !alreadyIn(have, c));
  return <View>
    <Label text={fresh.length ? `Found ${plural(fresh.length, 'place')}` : 'Already on the board'} action={fresh.length > 1 ? `Add all ${fresh.length}` : 'Done'}
      onAction={() => (fresh.length > 1 ? onAdd(fresh) : onDone())} />
    <Lines>{fresh.map((c) => <Suggestion key={`${c.title}${c.lat}`} title={c.title}
      meta={[c.area || (c.located ? '' : 'Not found on the map'), c.quote ? (c.via === 'ai' ? c.quote : `“${c.quote}”`) : ''].filter(Boolean).join(' · ')} onAdd={() => onAdd([c])} />)}</Lines>
  </View>;
}

export function PlanBoardScreen() {
  const current = useCurrentTrip();
  const prefs = usePrefs();
  const auth = useAuth();
  const live = useLive();
  const router = useRouter();
  const openTrip = useOpenTripPage();
  const token = auth.session?.access_token ?? null;
  const [region, setRegion] = useState<Region | null>(null);
  const [ai, setAi] = useState<AiInfo | null | 'checking'>('checking');
  const [text, setText] = useState('');
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState<'' | 'adding' | 'asking'>('');
  const [openSetting, setOpenSetting] = useState<string | null>(null);
  const [dayShown, setDayShown] = useState(0);
  const goBack = useGoBack();
  const [progress, setProgress] = useState('');
  const [found, setFound] = useState<IdeaCandidate[] | null>(null);
  // Where the picker shows: under the add field, or under Ask AI (where the question was asked).
  const [foundBy, setFoundBy] = useState<'add' | 'ai'>('add');
  const [added, setAdded] = useState('');
  const [preview, setPreview] = useState(false);
  const destination = current?.trip.destination ?? '';
  useEffect(() => { if (destination) void regionFor(destination).then(setRegion).catch(() => setRegion(null)); }, [destination]);
  const cloudAi = useCloudAi();
  useEffect(() => { void aiAvailable(token, cloudAi.allowed).then(setAi); }, [token, cloudAi.allowed]);
  // Ideas added without a pin (older ones, or a name the map missed then) are looked up once, inside the
  // destination, so the draft can group them by what's nearby. Nothing is renamed or removed.
  const tried = useRef(new Set<string>());
  const unpinned = (current?.extras.shortlist ?? []).filter((x) => x.lat === undefined && !tried.current.has(x.id)).slice(0, 6);
  useEffect(() => {
    if (!region || !unpinned.length || !current) return;
    const list = unpinned.map((x) => ({ id: x.id, title: x.title }));
    for (const x of list) tried.current.add(x.id);
    void Promise.all(list.map((x) => placeIn(x.title, region).catch(() => null))).then((found) => {
      const hits = list.flatMap((x, i) => (found[i] ? [{ id: x.id, at: found[i]! }] : []));
      if (!hits.length) return;
      current.editExtras((d) => {
        for (const h of hits) {
          const y = d.shortlist.find((z) => z.id === h.id);
          if (!y || y.lat !== undefined) continue;
          y.lat = h.at.lat; y.lng = h.at.lng;
          if (!y.place || y.place.toLowerCase() === y.title.toLowerCase()) y.place = h.at.area.slice(0, 200);
          if (!y.kind && h.at.kind !== 'other' && /^[a-z]{2,15}$/.test(h.at.kind)) y.kind = h.at.kind;
        }
      });
    });
  }, [region, unpinned.map((x) => x.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { track('plan_board_opened', { live: !!current?.extras.live }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const input = useMemo(() => (current ? draftInput(current.trip, current.extras, ME) : null), [current]);
  const tz = region?.tzMinutes ?? -new Date().getTimezoneOffset();
  const plan = useMemo(() => (input ? buildPlan(input.places, input.answers, { busy: input.busy, sun: (lat, lng, iso) => sunTimes(lat, lng, iso, tz) }) : null), [input, tz]);
  if (!current || !input || !plan) return <Screen><PageTop title="Plan" onBack={goBack} /><T v="small">Open a trip first.</T></Screen>;
  const { trip, extras, editTrip, editExtras } = current;
  const voters = input.voters;
  const together = voters.length > 1;
  // The pace and food controls' first option: what everyone's preferences add up to (yours, on your own).
  const auto = together ? 'Group' : 'Mine';
  const statuses = ideaStatus(extras.shortlist, voters);
  // Plans on the trip that aren't from the last draft: they stay, and the draft shows them on their days.
  const lastDraft = new Set(extras.plan?.drafted ?? []);
  const keptPlans: Record<string, KeptPlan[]> = {};
  for (const a of trip.activities) if (!lastDraft.has(a.id)) (keptPlans[a.date] ??= []).push({ id: a.id, time: a.time ?? '', title: a.title });
  const settings = defaults(extras.plan);
  const nameFor = (id: string) => (id === ME ? 'You' : extras.members.find((m) => m.id === id)?.name ?? nameOf(extras.people, id, 'You'));
  // "Rohan · from a reel", "You asked AI", "Added by Asha".
  const addedLine = (item: ShortlistItem) => {
    const by = nameFor(item.addedBy);
    if (item.via === 'ai') return `${by} asked AI`;
    const via = item.via ? VIA_LABEL[item.via] : undefined;
    return via ? `${by} · ${via}` : `Added by ${item.addedBy === ME ? 'you' : by}`;
  };
  const city = destination.split(',')[0];

  const setPlan = (patch: Partial<PlanState>) => editExtras((d) => { d.plan = { ...defaults(d.plan), ...patch }; });
  const vote = (id: string) => {
    editExtras((d) => { const x = d.shortlist.find((s) => s.id === id); if (x) x.votes = x.votes.includes(ME) ? x.votes.filter((v) => v !== ME) : [...x.votes, ME]; });
    track('vote_cast', { poll: 'board' });
  };
  const addIdeas = (list: IdeaCandidate[]) => {
    editExtras((d) => { for (const c of list) if (!alreadyIn(d.shortlist, c)) d.shortlist.push(toShortlistItem(c)); });
    setFound((f) => f?.filter((c) => !list.includes(c)) ?? null);
    setAdded(list.length === 1 ? list[0].title : plural(list.length, 'place'));
    track('shortlist_added', { count: list.length, via: list[0]?.via ?? '' });
  };
  const add = async (value: string) => {
    if (value.trim().length < 3) return;
    setBusy('adding');
    try {
      const r = await ideasFrom(value, city, region, (done, total) => setProgress(total > 1 ? `Checking ${done} of ${total}` : ''));
      if (r.status === 'unreachable') { Alert.alert('Couldn’t open that post', 'It may be private. Paste its caption instead, or type the place.'); return; }
      if (!r.ideas.length) { Alert.alert('No places found', 'Try the place’s name, a Google Maps link, or a reel whose caption names it.'); return; }
      // One place typed by name and found on the map goes straight on; anything else is picked from (and says when
      // the map couldn't find it, so a typo isn't added unseen).
      if (r.ideas.length === 1 && r.ideas[0].via === 'typed' && r.ideas[0].located) addIdeas(r.ideas); else { setFound(r.ideas); setFoundBy('add'); }
      setText('');
    } finally { setBusy(''); setProgress(''); }
  };
  const askAi = async (question: string) => {
    if (busy || !ai || ai === 'checking') return;
    // The first time, ask before anything goes to the cloud provider; without permission, only the phone's own model.
    const cloud = ai.source === 'cloud' && await cloudAi.confirm(ai.label);
    if (ai.source === 'cloud' && !cloud) {
      const local = await aiAvailable(token, false);
      setAi(local);
      if (!local) return;
    }
    setBusy('asking');
    try {
      const gaps = plan.days.map((d, i) => ({ i, free: d.stops.filter((s) => s.placeId).length })).filter((d) => d.free < 2).length;
      const q = question === 'Fill the gaps' ? `We have ${plural(gaps, 'day')} with little planned. Suggest places to fill them.` : question;
      const areas = [...new Set(extras.shortlist.map((x) => x.place).filter(Boolean))].slice(0, 6);
      const ideas = await aiIdeas({
        destination: region?.label ?? destination, have: extras.shortlist.map((x) => x.title), interests: [], party: together ? `${voters.length} friends` : 'solo',
        food: input.answers.food, budget: input.answers.budget, ask: q, near: areas,
      }, token, cloud);
      if (aiFailed(ideas)) { Alert.alert('No ideas this time', ideas.message); return; }
      if (!ideas.length) { Alert.alert('Nothing to suggest', 'The AI had nothing new for that. Try asking differently.'); return; }
      const located = await locateIdeas(ideas, region);
      if (!located.length) { Alert.alert('Nothing new', 'The AI’s ideas weren’t found on the map here. Try asking differently.'); return; }
      setFound(located);
      setFoundBy('ai');
      setAsk('');
      track('ai_ideas', { asked: question.length, found: located.length });
    } finally { setBusy(''); }
  };
  const openIdea = (s: (typeof statuses)[number]) => {
    const x = s.item;
    const days = Array.from({ length: tripLength(trip) }, (_, i) => isoAdd(trip.start, i)).filter((d) => d !== x.pinned).slice(0, 5);
    const canRemove = x.addedBy === ME || extras.live?.role === 'organiser' || !extras.live;
    const by = (id: string) => (id === ME ? 'you' : nameFor(id));
    Alert.alert(x.title, [x.quote ? `${x.via === 'ai' ? 'AI says' : 'From'}: “${x.quote}”` : '', `Added by ${by(x.addedBy)}`, x.votes.length ? `Wanted by ${x.votes.map(by).join(', ')}` : '',
      x.lat === undefined ? 'Not found on the map, so the draft can’t tell what’s near it. If the name has a typo, remove it and add it again.' : ''].filter(Boolean).join('\n\n'), [
      ...days.map((d) => ({ text: `Put it on ${shortDay(d)}`, onPress: () => editExtras((e) => { const y = e.shortlist.find((z) => z.id === x.id); if (y) { y.pinned = d; if (!y.votes.includes(ME)) y.votes.push(ME); } }) })),
      ...(x.pinned ? [{ text: 'Let the plan decide the day', onPress: () => editExtras((e) => { const y = e.shortlist.find((z) => z.id === x.id); if (y) delete y.pinned; }) }] : []),
      ...(x.url ? [{ text: 'Open where it came from', onPress: () => void Linking.openURL(x.url!) }] : []),
      ...(canRemove ? [{ text: 'Remove from the board', style: 'destructive' as const, onPress: () => { setAdded(''); editExtras((e) => { e.shortlist = e.shortlist.filter((z) => z.id !== x.id); }); } }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const sourceOf = (s: Stop) => {
    const x = s.placeId ? extras.shortlist.find((y) => y.id === s.placeId) : undefined;
    if (!x) return '';
    const n = x.votes.length;
    return [x.pinned ? `${nameFor(x.addedBy)} put it on this day` : together ? `${n} of ${voters.length} want it` : '', x.via === 'ai' ? 'Suggested by AI' : ''].filter(Boolean).join(' · ');
  };
  const stopActions = (s: Stop, dayIndex: number) => {
    const x = s.placeId ? extras.shortlist.find((y) => y.id === s.placeId) : undefined;
    if (!x) return;
    Alert.alert(x.title, undefined, [
      ...plan.days.map((d, i) => ({ d, i })).filter(({ i }) => i !== dayIndex).slice(0, 5).map(({ d, i }) => ({ text: `Move to day ${i + 1} · ${shortDay(d.date)}`,
        onPress: () => editExtras((e) => { const y = e.shortlist.find((z) => z.id === x.id); if (y) y.pinned = d.date; }) })),
      ...(x.pinned ? [{ text: 'Let the plan decide the day', onPress: () => editExtras((e) => { const y = e.shortlist.find((z) => z.id === x.id); if (y) delete y.pinned; }) }] : []),
      ...(x.votes.includes(ME) ? [{ text: 'I don’t want this', onPress: () => vote(x.id) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };
  const apply = () => {
    const placedOn = new Map<string, string>();
    const next = plan.days.flatMap((d) => d.stops.map((s) => {
      const x = s.placeId ? extras.shortlist.find((y) => y.id === s.placeId) : undefined;
      if (x) placedOn.set(x.id, d.date);
      const endMin = toMin(s.time) + s.minutes;
      return {
        id: uid(), date: d.date, time: s.time, endTime: endMin < 24 * 60 ? clock(endMin) : '', title: s.title.slice(0, 200), place: (s.place && s.place !== s.title ? s.place : '').slice(0, 200),
        category: s.category, cost: 0, link: x?.url ?? '', completed: false, outfitId: '', gear: [] as string[], kind: s.kind,
        // Notes are read by everyone on the trip, so they name people ("Added by Vivek"), never "You".
        notes: [x?.quote ? `${x.via === 'ai' ? 'Suggested by AI' : `From ${x.via === 'reel' ? 'a reel' : 'the board'}`}: “${x.quote}”` : '', x ? `Added by ${x.addedBy === ME ? prefs.name || extras.members.find((m) => m.id === ME)?.name || 'someone on the trip' : nameFor(x.addedBy)}` : s.kind === 'meal' ? s.why : ''].filter(Boolean).join('\n').slice(0, 5000),
      };
    }));
    let drafted: string[] = [];
    const ok = editTrip((t) => {
      const r = applyDraft(t.activities, extras.plan?.drafted ?? [], next);
      t.activities = r.activities;
      drafted = r.drafted;
      // A day title from the draft only where the draft placed something: a day planned by hand keeps its own.
      for (const d of plan.days.filter((x) => x.stops.some((s) => s.placeId))) {
        const day = t.days[d.date] ?? { outfitId: '', outfitIds: [], title: '', stay: '', notes: '', gear: [] };
        if (!day.title) t.days[d.date] = { ...day, title: d.title.slice(0, 200) };
      }
    });
    if (!ok) return;
    editExtras((d) => {
      d.plan = { ...defaults(d.plan), drafted, draftedAt: new Date().toISOString(), draftedBy: ME };
      for (const x of d.shortlist) x.planned = placedOn.get(x.id) ?? input.byHand.get(x.id) ?? '';
    });
    track('plan_board_applied', { places: placedOn.size, people: voters.length, ai: extras.shortlist.some((x) => x.via === 'ai') });
    openTrip('/trip/days');
  };

  const musts = statuses.filter((s) => s.priority === 'must').length;
  const placed = plan.days.reduce((n, d) => n + d.stops.filter((s) => s.placeId).length, 0);

  if (preview) {
    const di = Math.min(dayShown, plan.days.length - 1);
    const pins = dayPins(plan.days[di]);
    const room = input.answers.pace === 'relaxed' ? 3 : input.answers.pace === 'balanced' ? 4 : 6;
    // Keyed apart from the board, so the draft opens at its top rather than at the board's scroll position.
    return <Screen key="draft" gap={20} footer={<NextBar label="Use this plan" onPress={apply}
      note={`Plans added by hand stay${extras.plan?.drafted.length ? '; this replaces the last draft' : ''}.`} />}>
      <PageTop title="The draft" onBack={() => setPreview(false)} />
      <Heading eyebrow={trip.name} title={dateRange(trip.start, trip.end)}
        sub={`${plural(tripLength(trip), 'day')} · ${plural(placed, 'place')}${together ? ` from ${plural(voters.length, 'person', 'people')}’s ideas` : ''} · ${input.answers.pace === 'packed' ? 'see it all' : input.answers.pace}${input.answers.food === 'veg' || input.answers.food === 'jain' ? ` · ${input.answers.food === 'jain' ? 'Jain' : 'veg'} food` : ''}`} />
      <View style={{ gap: 2 }}>
        <PlanMap pins={pins.length ? pins : plan.days.flatMap((d) => dayPins(d)).map((p) => ({ ...p, label: undefined, color: colors.inkFaint }))} route={pins.length > 1} height={220} flush label={`Map of day ${di + 1}`} />
        <DayStrip value={di} onChange={setDayShown} days={plan.days.map((d, i) => {
          const n = d.stops.filter((s) => s.placeId).length;
          return { date: d.date, stops: n, load: n / room, full: plan.overfull.includes(i) };
        })} />
      </View>
      <DayView day={plan.days[di]} index={di} tz={tz} city={trip.destination} sourceOf={sourceOf} onStop={stopActions} kept={keptPlans[plan.days[di].date]} />
      {plan.unplaced.length ? <View style={{ gap: 12, paddingTop: 6 }}>
        <Label text={`Didn’t fit · ${plan.unplaced.length}`} />
        <Chips>{plan.unplaced.map((p) => <PlaceChip key={p.id} title={p.title} icon={KIND_ICON[p.kind]} color={colors.inkMuted} state="maybe"
          onPress={() => Alert.alert(p.title, 'There’s no room for it at this pace. Add a day to the trip, or a slower day for something else.')} />)}</Chips>
      </View> : null}
      <T v="meta" color={colors.inkFaint}>{`Places most of ${together ? 'the group' : 'you'} want are in; the rest fill any room. Tap a stop to move it.`}</T>
    </Screen>;
  }

  const myMember = extras.members.find((m) => m.id === ME);
  const others = voters.filter((v) => v.id !== ME).map((v) => v.name.split(' ')[0]);
  const toggle = (k: string) => setOpenSetting((o) => (o === k ? null : k));
  const blank = (k: string, text: string, source: 'you' | 'ai', name: string) => <Blank text={text} source={source} active={openSetting === k} onPress={() => toggle(k)} label={name} />;
  const PACE = { relaxed: 'Relaxed', balanced: 'Balanced', packed: 'See it all' } as const;
  const FOOD = { any: 'Anything', veg: 'Veg', jain: 'Jain', nonveg: 'Non-veg' } as const;
  const PART = { morning: 'morning', afternoon: 'afternoon', evening: 'evening' } as const;
  return <Screen key="board" gap={24} footer={<NextBar label={musts || statuses.some((s) => s.priority === 'maybe') ? `Draft the days · ${plural(placed, 'place')}` : 'Add ideas to draft the days'}
    disabled={!statuses.some((s) => s.priority !== 'skip')}
    onPress={() => { if (!statuses.some((s) => s.priority !== 'skip')) { Alert.alert('Nothing to plan yet', 'Add a few places, or want one of the ideas on the board.'); return; } setPreview(true); track('plan_board_drafted', { places: placed }); }} />}>
    <PageTop title={together ? 'Plan together' : 'Plan'} onBack={goBack} />
    <View style={{ gap: 12 }}>
      <Heading eyebrow={dateRange(trip.start, trip.end)} title={trip.name} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flexDirection: 'row' }}>
          {voters.slice(0, 4).map((v, i) => <Avatar key={v.id} initials={initials(v.id === ME ? prefs.name || 'You' : v.name)} tint={tintFor(v.id)} size={30} overlap={i > 0} />)}
          <View style={{ marginLeft: 4, width: 30, height: 30, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: ai && ai !== 'checking' ? colors.khaki : colors.controlGlass }}>
            <Icon name="sparkle" size={13} color={ai && ai !== 'checking' ? colors.ink : colors.inkFaint} />
          </View>
        </View>
        <T v="small" style={{ flex: 1 }}>{together ? `You, ${others.slice(0, 3).join(', ')}${others.length > 3 ? ` and ${others.length - 3} more` : ''}${ai && ai !== 'checking' ? ' and AI' : ''}` : `You${ai && ai !== 'checking' ? ' and AI' : ''}`}</T>
        {!together ? <Link text="Invite friends" onPress={() => router.push('/invite' as never)} /> : null}
      </View>
      <T v="small">{together ? 'Everyone adds ideas and hearts the ones they want. The days are drafted from what most of you want.' : 'Add the places you want; AI can suggest more. The days are drafted around them.'}</T>
    </View>

    <View style={{ gap: 10 }}>
      <Label text={`Ideas${extras.shortlist.length ? ` · ${extras.shortlist.length}` : ''}`} />
      <LineInput value={text} onChangeText={(t) => { setText(t); setAdded(''); }} label="Add a place, or paste a reel or Maps link" placeholder="Add a place, or paste a reel or Maps link"
        busy={busy === 'adding'} onSubmit={(t) => void add(t)} />
      {busy === 'adding' && progress ? <T v="meta">{progress}</T> : null}
      {added && !found && foundBy === 'add' ? <View style={{ flexDirection: 'row', gap: 8, paddingTop: 4 }}><Icon name="check" size={15} color={colors.success} /><T v="small" style={{ flex: 1 }}>{`Added ${added}, with your heart on it.${together ? ' Everyone sees it now.' : ''}`}</T></View> : null}
      {found && foundBy === 'add' ? <Candidates list={found} have={extras.shortlist} onAdd={addIdeas} onDone={() => setFound(null)} /> : null}
      {statuses.length ? <Tile style={{ paddingVertical: 0 }}><Lines inset={46}>{statuses.map((s) => <IdeaRow key={s.item.id} item={s.item} city={trip.destination} votes={s.votes} of={s.of} priority={s.priority} planned={input.byHand.get(s.item.id)}
        who={addedLine(s.item)} mine={s.item.votes.includes(ME)} onVote={() => vote(s.item.id)} onOpen={() => openIdea(s)} />)}</Lines></Tile>
        : <T v="small" style={{ paddingVertical: 10 }}>{`No ideas yet. Type a place, paste a reel someone sent, or ask AI below.${together ? ' Friends can add theirs from their phones.' : ''}`}</T>}
    </View>

    <View style={{ gap: 10 }}>
      <Label text="Ask AI" />
      {ai === 'checking' ? <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><ActivityIndicator color={colors.sand} size="small" /><T v="small">Checking for AI…</T></View>
        : ai ? <>
          <Asks items={ASKS.map((q) => ({ label: q, message: q }))} onAsk={(q) => void askAi(q)} />
          <LineInput value={ask} onChangeText={setAsk} icon="sparkle" label="Ask AI for ideas" placeholder="A sunset spot, a veg lunch near the market…" busy={busy === 'asking'}
            onSubmit={(t) => { if (t.trim()) void askAi(t.trim()); }} />
          {busy === 'asking' ? <T v="small">{`Asking ${ai.label}, then checking each place on the map…`}</T> : null}
          {found && foundBy === 'ai' ? <Candidates list={found} have={extras.shortlist} onAdd={addIdeas} onDone={() => setFound(null)} /> : null}
          <T v="meta" color={colors.inkFaint}>{ai.source === 'on-device' ? `Runs with Apple Intelligence on this phone: nothing leaves it.${cloudAi.choice === 'off' ? ' Cloud AI is off (Profile → Data & privacy).' : ''}` : `Ideas come from ${ai.label}. Only the destination, the board’s places, the group’s size, food and budget, and your question are sent.`}</T>
        </>
          : <View style={{ gap: 8 }}>
            <T v="small">{cloudAi.choice === 'off' ? 'Cloud AI is off (Profile → Data & privacy). Everything else works: add places, read reels, and draft the days.' : 'AI isn’t switched on here. Everything else works: add places, read reels, and draft the days.'}</T>
            {cloudAi.choice === 'off' ? <View style={{ alignSelf: 'flex-start' }}><Link text="Turn cloud AI on" onPress={() => void cloudAi.set(true)} /></View> : null}
          </View>}
    </View>

    <View>
      <Label text="How the days go" />
      {/* The days' settings as one sentence: orange when worked out from everyone's say, dark when set for everyone. */}
      <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.light, fontSize: 24, lineHeight: 37, letterSpacing: -0.4, color: colors.inkMuted, paddingTop: 10 }}>
        {blank('when', `${dateRange(trip.start, trip.end)}`, 'you', 'When')}{`, ${plural(tripLength(trip), 'day')}. A `}
        {blank('pace', PACE[input.answers.pace].toLowerCase(), settings.pace ? 'you' : 'ai', 'Pace')}{' pace and '}
        {blank('food', FOOD[input.answers.food].toLowerCase(), settings.food ? 'you' : 'ai', 'Food')}{' food. Arriving in the '}
        {blank('arrive', PART[settings.arrive], 'you', 'Arriving')}{', leaving in the '}
        {blank('leave', PART[settings.leave], 'you', 'Leaving')}{'.'}
        {extras.live && myMember ? <>{' '}{blank('mine', 'How you like to travel', 'you', 'Your own pace, food and budget')}{'.'}</> : null}
      </Text>
      <T v="meta" color={colors.inkFaint} style={{ paddingTop: 10 }}>{`Dotted words are worked out from ${together ? 'what everyone wants' : 'what you like'}; the rest are set. Tap any word to change it.`}</T>
      {openSetting ? <View style={{ paddingTop: 16 }}>{(() => {
        const done = () => setOpenSetting(null);
        const parts: [PlanState['arrive'], string][] = [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']];
        switch (openSetting) {
          case 'when': return <BlankEditor title="When" onDone={done}>
            {extras.datePoll && !extras.datePoll.lockedId ? <View style={{ alignSelf: 'flex-start' }}><Link text="Dates aren’t settled: see the poll" onPress={() => router.push('/date-poll' as never)} /></View>
              : <T v="small">Change the dates in the trip’s details.</T>}
          </BlankEditor>;
          case 'pace': return <BlankEditor title={settings.pace ? 'Pace · set for everyone' : 'Pace · from everyone’s say'} onDone={done} why={input.why.pace}>
            <Choices<string> options={[['', auto], ['relaxed', 'Relaxed'], ['balanced', 'Balanced'], ['packed', 'See it all']]} value={settings.pace} onChange={(v) => setPlan({ pace: v as PlanState['pace'] })} />
          </BlankEditor>;
          case 'food': return <BlankEditor title={settings.food ? 'Food · set for everyone' : 'Food · from everyone’s say'} onDone={done} why={input.why.food}>
            <Choices<string> options={[['', auto], ['veg', 'Veg'], ['jain', 'Jain'], ['any', 'Anything']]} value={settings.food} onChange={(v) => setPlan({ food: v as PlanState['food'] })} />
          </BlankEditor>;
          case 'arrive': return <BlankEditor title="Arriving" onDone={done} why="The first day stays light.">
            <Choices<PlanState['arrive']> options={parts} value={settings.arrive} onChange={(v) => setPlan({ arrive: v })} />
          </BlankEditor>;
          case 'leave': return <BlankEditor title="Leaving" onDone={done} why="The last day stays light.">
            <Choices<PlanState['leave']> options={parts} value={settings.leave} onChange={(v) => setPlan({ leave: v })} />
          </BlankEditor>;
          case 'mine': return extras.live && myMember ? <BlankEditor title="How you like to travel" onDone={done}>
            <MyPrefs value={myMember.prefs} onChange={(p) => void live.setPrefs(trip.id, p)} />
          </BlankEditor> : null;
          default: return null;
        }
      })()}</View> : null}
    </View>
    {extras.plan?.draftedAt ? <T v="meta" color={colors.inkFaint}>{`Last drafted by ${(extras.plan.draftedBy || ME) === ME ? 'you' : nameFor(extras.plan.draftedBy)} on ${shortDay(extras.plan.draftedAt.slice(0, 10))}. Drafting again replaces those stops; plans added by hand stay.`}</T> : null}
  </Screen>;
}
