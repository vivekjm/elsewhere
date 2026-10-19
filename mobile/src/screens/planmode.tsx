/**
 * Plan mode: planning a trip with AI. Start from a sentence ("4 days in Goa with friends in December"); places,
 * Maps links and reels you've saved are extra context. Plans in progress are saved on the phone (the Plan tab).
 *
 *   1 Start   What you have in mind, plus any context: reels and posts (read from their words: caption, hashtags,
 *             tagged places, cover text; a hidden spot is asked for, not guessed), links and places.
 *   2 Places  Everything found, each with the line it came from and checked on the map inside the destination.
 *             You mark must-dos and maybes; AI (when available) adds what rules can't read, labelled as such.
 *   3 Trip    A few questions, each pre-answered with a suggestion and the reason for it (dates, length, who, pace,
 *             food, arrival). Change anything.
 *   4 Days    The engine lays it out: nearby places together, forts at the real sunset, temples in the morning,
 *             lunch near where you are. Move or drop any stop and the days rebuild around it. Then it becomes a
 *             trip, with maybes sent to the group to vote on. Along the way, "Plan with AI" changes anything you ask
             ("make day 2 lighter", "add a sunset spot"): quick changes on the phone, the rest by the AI as checked
             edits the engine lays out again (`domain/coplan.ts`).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useOpenTripPage, useRouter } from '../core/nav';
import { track } from '../core/analytics';
import { usePrefs, useSelection, useTrips } from '../core/state';
import { CURRENCIES, ME, uid, useAuth, useExtras, type Trip, type TripKind } from '../data';
import { inIndia } from '../domain/ideas';
import { longWeekends } from '../domain/holidays';
import { altitude, dateRange, plural, shortDay, todayISO } from '../domain/format';
import {
  baitIn, cuesIn, destinationHints, INTEREST_LABEL, isGenericTag, PLATFORM_LABEL, reelLink, SOURCE_LABEL, type Cues, type Reel,
} from '../domain/reels';
import {
  buildPlan, clock, defaultPick, isoAdd, kindOf, KIND_LABEL, suggestDays, suggestPace, sunTimes, toMin,
  type Answers, type Budget, type DayPart, type Food, type Kind, type Pace, type Party, type Priority, type PlanPlace, type Stop,
} from '../domain/planmode';
import { KIND_MOOD, upcomingTrips } from '../domain/trips';
import { findPlaces, placeIn, regionFor, type Region } from '../services/reels';
import { addToInbox, byDestination, removeFromInbox, updateReel, useInbox } from '../services/reelInbox';
import { alreadyIn, locateIdeas, type IdeaCandidate } from '../services/ideas';
import { aiAvailable, aiBrief, aiEdit, aiFailed, aiIdeas, aiRead, type AiInfo, type AiSource } from '../services/planai';
import { highPoint, monthsInWords, routeChanges, seasonStart, stageFacts, stageTitle, trekSuggestions, type Brief, type Trek } from '../domain/brief';

const monthName = (m: number) => new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, m - 1, 15)));
import { destinationCandidates } from '../domain/sentence';
import { draftById, removeDraft, saveDraft, type PlanDraft } from '../services/planDrafts';
import { applyEdits, cleanEdits, localEdits, suggestionsFor, type Found } from '../domain/coplan';
import { type ChatTurn as Turn } from './planui';
import { useCloudAi } from '../core/cloudAi';
import {
  Button, colors, DateField, Field, fonts, GlassFill, Icon, Note, PressScale, RowView, Screen, Stack, T, Tag, radii, tints, type IconName,
} from '../loom';
import { useCreateTrip } from './create';
import { parseDays, parseStart, parseTravellers } from '../domain/drafter';
import { fromMapsUrl } from '../domain/shortlist';
import { dayPins, DayView, KIND_COLOR, KIND_ICON, TrekView } from './planparts';
import { AiLine, AskBar, AssistPanel, BigInput, Blank, BlankEditor, Chips, Choices, Count, DayStrip, Dot, Emph, Heading, Label, LineInput, Lines, Link, NextBar, PlaceChip, PlanTop, Tile, type Notice } from './planui';
import { PlanMap, type MapPin } from './planmap';

/** Ways to start, for a blank page: tap one, then finish the sentence. */
export const STARTERS = ['A long weekend in', '4 days in Goa with friends', 'Solo week in', 'Family trip to', 'Honeymoon in'];
/** Typed out in the empty field, one after another. */
export const EXAMPLES = ['4 days in Goa with friends in December', 'A slow week in Kyoto for two in April', 'Kedarkantha trek with college friends', 'Weekend in Pondy, veg food, Auroville', 'Bali with the kids for 6 days'];

const PLATFORM_ICON: Record<Reel['platform'], IconName> = { instagram: 'camera', youtube: 'image', tiktok: 'image', facebook: 'shared', x: 'link', web: 'link' };

/* ------------------------------------------------------------------ small pieces */





const shortCaption = (r: Reel) => (r.caption || r.title).replace(/\s+/g, ' ').trim();
const whoOf = (r: Reel | undefined) => (r ? (r.handle ? `@${r.handle}` : r.author || PLATFORM_LABEL[r.platform]) : '');

/** One shared reel, as read: who, what it says, the tags that matter, and anything it hides. */
function ReelCard({ reel, reading, found, onRemove, onNotes, onCaption }: {
  reel: Reel; reading: boolean; found: number | null; onRemove: () => void; onNotes: (text: string) => void; onCaption: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(reel.notes);
  const [caption, setCaption] = useState('');
  const [writing, setWriting] = useState(false);
  // Saved as it's typed (a tap on "Find the places" doesn't blur the field first).
  useEffect(() => {
    if (notes === reel.notes) return;
    const t = setTimeout(() => onNotes(notes), 300);
    return () => clearTimeout(t);
  }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps
  const bait = baitIn(`${reel.caption}\n${reel.title}`);
  const caption1 = shortCaption(reel);
  // Tags that might name a place first; #travel and friends last.
  const tags = [...reel.hashtags].sort((a, b) => Number(isGenericTag(a)) - Number(isGenericTag(b))).slice(0, 8);
  return <View style={{ gap: 10, paddingVertical: 14 }}>
    <RowView gap={12}>
      <Dot icon={PLATFORM_ICON[reel.platform]} tint={reel.status === 'unreachable' ? 'grey' : 'lavender'} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="row" style={{ fontSize: 15 }} lines={1}>{reading && !reel.caption ? 'Reading the post…' : whoOf(reel) || PLATFORM_LABEL[reel.platform]}</T>
        <T v="meta" lines={1}>{[PLATFORM_LABEL[reel.platform], reel.postedAt ? shortDay(reel.postedAt) : '', reel.likes !== null ? `${reel.likes.toLocaleString()} likes` : '', found !== null ? plural(found, 'place') : ''].filter(Boolean).join(' · ')}</T>
      </View>
      {reading ? <ActivityIndicator color={colors.sand} /> : <PressScale accessibilityRole="button" accessibilityLabel="Remove this reel" hitSlop={8} onPress={onRemove}><Icon name="x" size={18} color={colors.inkFaint} /></PressScale>}
    </RowView>
    {caption1 ? <PressScale accessibilityRole="button" accessibilityLabel={open ? 'Show less of the caption' : 'Show the whole caption'} onPress={() => setOpen(!open)}>
      <T v="small" lines={open ? undefined : 3}>{caption1}</T>
    </PressScale> : null}
    {tags.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{tags.map((t) => <Tag key={t} text={`#${t}`} tint="grey" />)}</View> : null}
    {reel.coverText ? <T v="meta">{`On the cover: ${reel.coverText.split('\n').slice(0, 2).join(' · ')}`}</T> : null}
    {reel.status === 'unreachable' && !reading ? <Stack gap={8}>
      <Note>Couldn’t open this post: it may be private or removed. Paste its caption and it’s read the same way.</Note>
      <Field label="Caption" value={caption} onChangeText={setCaption} multiline placeholder="Paste the caption here" maxLength={3000} />
      {caption.trim() ? <Button label="Read this caption" icon="check" kind="mist" height={44} onPress={() => onCaption(caption)} /> : null}
    </Stack> : null}
    {bait ? <View style={{ gap: 6, padding: 12, borderRadius: radii.card, backgroundColor: tints.peach.bg }}>
      <RowView gap={8}><Icon name="lock" size={16} color={tints.peach.fg} /><T v="row" color={tints.peach.fg} style={{ fontSize: 14, flex: 1 }}>{/\b(list|places|spots|guide|itinerary)\b/i.test(`${bait.keyword} ${bait.quote}`) ? 'The creator hides the full list' : 'The creator hides the exact spot'}</T></RowView>
      <T v="small" color={tints.peach.fg}>{bait.kind === 'comment' ? `They send it if you comment “${bait.keyword}”.` : bait.kind === 'dm' ? 'They send it by DM.' : bait.kind === 'pinned' ? 'It’s in a pinned comment.' : 'It’s behind the link in their bio.'} The hashtags often give it away; if you got the reply, paste it below and it counts first.</T>
    </View> : null}
    {bait || notes || writing ? <Field label={bait ? 'The reply, or a comment that names it' : 'From the comments'} value={notes} onChangeText={setNotes} multiline autoFocus={writing && !bait}
      placeholder={'“It’s Chapora Fort, go before 5pm”'} maxLength={1000} />
      : <PressScale accessibilityRole="button" onPress={() => setWriting(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Icon name="plus" size={14} color={colors.inkMuted} /><T v="small">Add something from the comments</T></PressScale>}
  </View>;
}

/* ------------------------------------------------------------------ the screen */

type Dest = { name: string; region: Region | null };
type Session = { found: number | null; ai: { source: AiSource; model: string; label: string; added: number } | null | 'none' };

function suggestStart(cues: Cues, india: boolean): { date: string; why: string } {
  const today = todayISO();
  // A month the reels name ("Goa in October"): the first Friday of it.
  for (const m of cues.months) {
    for (let y = Number(today.slice(0, 4)); y <= Number(today.slice(0, 4)) + 1; y++) {
      let d = `${y}-${String(m).padStart(2, '0')}-01`;
      while (new Date(`${d}T12:00:00Z`).getUTCDay() !== 5) d = isoAdd(d, 1);
      if (d > isoAdd(today, 6)) return { date: d, why: `The reels say ${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(`${d}T12:00:00Z`))}.` };
    }
  }
  if (india) {
    const w = longWeekends('IN', isoAdd(today, 10), 4)[0];
    if (w) return { date: w.start, why: `${w.holiday} makes it a long weekend${w.leave ? ` (take ${plural(w.leave, 'day')} off)` : ''}.` };
  }
  let d = isoAdd(today, 21);
  while (new Date(`${d}T12:00:00Z`).getUTCDay() !== 5) d = isoAdd(d, 1);
  return { date: d, why: 'Three weeks out: time to book without rushing.' };
}

const PARTY_FROM_PREFS: Record<string, Party> = { solo: 'solo', partner: 'couple', family: 'family', friends: 'friends' };

export function PlanModeScreen() {
  const params = useLocalSearchParams<{ reel?: string; reels?: string; link?: string; prompt?: string; draft?: string; go?: string }>();
  const router = useRouter();
  const prefs = usePrefs();
  const auth = useAuth();
  const token = auth.session?.access_token ?? null;
  const cloudAi = useCloudAi();
  const create = useCreateTrip();
  const { reels: inbox, reading } = useInbox();
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(params.prompt ?? '');
  const { trips } = useTrips();
  const { select } = useSelection();
  const extrasStore = useExtras();
  const openTrip = useOpenTripPage();
  const [ids, setIds] = useState<string[]>(() => [...new Set([...(params.reels?.split(',') ?? []), ...(params.reel ? [params.reel] : [])].filter(Boolean))]);
  const [dest, setDest] = useState<Dest | null>(null);
  const [destInput, setDestInput] = useState('');
  const [changing, setChanging] = useState(false);
  const [places, setPlaces] = useState<PlanPlace[]>([]);
  const [busy, setBusy] = useState<'' | 'finding' | 'adding' | 'ideas' | 'editing'>('');
  const [progress, setProgress] = useState('');
  const [session, setSession] = useState<Session>({ found: null, ai: null });
  const [ideas, setIdeas] = useState<IdeaCandidate[] | null>(null);
  const [adding, setAdding] = useState('');
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [touched, setTouched] = useState<Set<keyof Answers>>(new Set());
  const [whenMode, setWhenMode] = useState<'pick' | 'group'>('pick');
  const [why, setWhy] = useState<Partial<Record<keyof Answers, string>>>({});
  const started = useRef(false);
  /** Places whose must/maybe/skip the person set themselves: kept when the reels are read again. */
  const decided = useRef(new Set<string>());
  /** Planning with AI: the conversation, and the plan before the latest change (for Undo). */
  const [turns, setTurns] = useState<Turn[]>([]);
  /** What AI understood from the sentence, a trek's route, and a question when it couldn't tell where. */
  const [brief, setBrief] = useState<Brief | null>(null);
  const [trek, setTrek] = useState<Trek | null>(null);
  const [question, setQuestion] = useState('');
  const trekBefore = useRef<Trek | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  /** Which trip setting is open (one at a time), which day is shown, which trek day is chosen. */
  const [openSetting, setOpenSetting] = useState<string | null>(null);
  const [dayShown, setDayShown] = useState(0);
  const [stageShown, setStageShown] = useState(0);
  /** What the latest change did to each place ("New", "Moved here"), and whether its notice is showing. */
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [noticeOpen, setNoticeOpen] = useState(false);
  /** Set by a change: once the days are laid out again, show the first day it touched. */
  const showChanged = useRef(false);
  const before = useRef<{ places: PlanPlace[]; answers: Answers } | null>(null);
  const [aiInfo, setAiInfo] = useState<AiInfo | null>(null);
  useEffect(() => { void aiAvailable(token, cloudAi.allowed).then(setAiInfo); }, [token, cloudAi.allowed]);

  /* ---------------- saved as a plan in progress (the Plan tab), and picked up again */

  const draftId = useRef(params.draft || uid());
  const [restored, setRestored] = useState(!params.draft);
  const finished = useRef(false);
  useEffect(() => {
    if (!params.draft) return;
    void draftById(params.draft).then((d) => {
      if (d) {
        setTyped(d.typed); setIds(d.reelIds); setDest(d.dest); setPlaces(d.places); setAnswers(d.answers); setWhy(d.why);
        setBrief(d.brief ?? null); setTrek(d.brief?.trek ? d.trek ?? d.brief.trek : null);
        setTouched(new Set(d.touched)); setWhenMode(d.whenMode); setStep(d.answers ? d.step : Math.min(d.step, 1));
        setSession({ found: d.places.length, ai: null });
        setTurns(d.turns.map((t) => ({ id: uid(), role: t.role, text: t.text, changes: t.changes })));
        for (const p of d.places) decided.current.add(p.id);
      }
      setRestored(true);
    });
  }, [params.draft]);
  useEffect(() => {
    if (!restored || finished.current || (!typed.trim() && !places.length && !ids.length)) return;
    const timer = setTimeout(() => {
      const where = dest?.name.split(',')[0];
      const draft: PlanDraft = {
        id: draftId.current, updatedAt: new Date().toISOString(), step, typed, reelIds: ids, dest, places, answers, why, touched: [...touched], whenMode, brief, trek,
        title: trek && brief ? `${brief.title} · ${plural(trek.stages.length, 'day')}` : where ? `${where}${answers ? ` · ${plural(answers.days, 'day')}` : ''}` : typed.trim().split('\n')[0].slice(0, 48) || 'New plan',
        turns: turns.slice(-12).map((t) => ({ role: t.role, text: t.text, changes: t.changes })),
      };
      saveDraft(draft);
    }, 700);
    return () => clearTimeout(timer);
  }, [restored, typed, ids, dest, places, answers, why, touched, whenMode, step, turns, brief, trek]);

  // Another reel shared while plan mode is open joins this plan.
  useEffect(() => { if (params.reel) setIds((list) => (list.includes(params.reel!) ? list : [...list, params.reel!])); }, [params.reel]);
  // A link handed in (shared from another app, or pasted on Home) is saved and read, then used.
  useEffect(() => {
    if (!params.link) return;
    void addToInbox(params.link).then((id) => { if (id) setIds((list) => (list.includes(id) ? list : [...list, id])); });
  }, [params.link]);
  useEffect(() => { if (!started.current) { started.current = true; track('plan_mode_started', { from: params.reel || params.link ? 'share' : 'home' }); } }, [params.reel, params.link]);

  const chosen = ids.map((id) => inbox.find((r) => r.id === id)).filter((r): r is Reel => !!r);
  // What the person typed ("4 days in Goa with friends: Fontainhas, Chapora Fort") is read like a reel's caption.
  const typedReel: Reel | null = typed.trim() ? {
    id: 'typed', url: '', platform: 'web', author: '', handle: '', postedAt: '', likes: null, comments: null, title: '', caption: '', hashtags: [], mentions: [], keywords: [],
    thumbnail: '', coverText: '', notes: typed.trim().slice(0, 1500), status: 'ok', savedAt: '',
  } : null;
  const sources = typedReel ? [...chosen, typedReel] : chosen;
  const busyReading = chosen.some((r) => reading.includes(r.id));
  const others = inbox.filter((r) => !ids.includes(r.id));
  const cues = useMemo(() => cuesIn([...chosen.flatMap((r) => [r.caption, r.title, r.notes, r.hashtags.map((t) => `#${t}`).join(' ')]), typed]), [chosen, typed]);
  const india = inIndia(prefs.homeBase, prefs.currency) || dest?.region?.countryCode === 'IN';

  const addLink = async (text: string) => {
    // A Google Maps link names a place: it joins the places typed below.
    const maps = fromMapsUrl(text.match(/https?:\/\/\S+/i)?.[0] ?? '');
    if (maps) { setTyped((t) => `${t.trim()}${t.trim() ? '\n' : ''}${maps.title}`); return; }
    const link = reelLink(text);
    if (!link) { Alert.alert('That isn’t a link', 'Copy the reel’s link from Instagram, YouTube or TikTok (Share → Copy link), then paste it here.'); return; }
    setBusy('adding');
    try { const id = await addToInbox(text); if (id) setIds((list) => (list.includes(id) ? list : [...list, id])); } finally { setBusy(''); }
  };
  const paste = async () => {
    const clip = (await Clipboard.getStringAsync()).slice(0, 4000);
    if (!clip.trim()) { Alert.alert('Nothing to paste', 'In Instagram or YouTube, tap Share → Copy link on the reel, then come back and paste.'); return; }
    await addLink(clip);
  };

  /* ---------------- step 1 → 2: find the places */

  const locate = async (name: string): Promise<Dest | null> => {
    const region = await regionFor(name).catch(() => null);
    return region ? { name: region.name, region } : null;
  };

  /**
   * Finds the places. `forced`: the destination the person chose ("Change"), or the one the AI read when the first
   * guess found nothing on the map; otherwise it's worked out again from what they wrote and shared. `cloudKnown`:
   * the answer to "use the cloud AI?" when it's already been asked in this search.
   */
  /** The destination AI read, on the map, in the country it said ("Treko, Indonesia" is never a trek in Sikkim). */
  const locateBrief = async (b: Brief): Promise<Dest | null> => {
    for (const q of [`${b.destination}, ${b.region}`, b.destination, b.region]) {
      if (q.replace(/[ ,]/g, '').length < 2) continue;
      const d = await locate(q);
      if (d && (!b.country_code || !d.region?.countryCode || d.region.countryCode === b.country_code)) return d;
    }
    return null;
  };

  const find = async (forced?: Dest | null, cloudKnown?: boolean) => {
    if (!sources.length || busy) return;
    // The first time, ask before anything goes to the cloud AI. Without it, the rules read what was written.
    const info = cloudKnown === undefined ? await aiAvailable(token, cloudAi.allowed) : null;
    const cloud = cloudKnown ?? (info?.source === 'cloud' ? await cloudAi.confirm(info.label) : false);
    setBusy('finding');
    // A new search starts the trip's questions over: what they wrote may now say different dates or people.
    setAnswers(null);
    setTouched(new Set());
    setIdeas(null);
    setQuestion('');
    let seed: { where: Dest; have: string[] } | null = null;
    try {
      // 1. AI reads what they wrote first: where (spelling and wrong facts fixed), what kind of trip, the facts.
      let b: Brief | null = forced ? brief : null;
      if (!forced && typed.trim() && cloud) {
        setProgress('Understanding your trip…');
        const r = await aiBrief({ text: typed.trim() }, token, cloud);
        if (!aiFailed(r)) b = r;
      }
      if (b && !b.understood) { setQuestion(b.question || 'Where would you like to go?'); return; }
      setBrief(b);
      setTrek(b?.trek ?? null);
      setTurns([]);
      let where = forced ?? null;
      if (!where && b) where = await locateBrief(b);
      if (!where && !b) {
        // Without AI: places named in the sentence, then what the reels are about.
        const said = typed.trim() ? destinationCandidates(typed.trim()) : [];
        for (const name of [...said, ...destinationHints(sources).slice(0, 3).map((h) => h.name)]) { where = await locate(name); if (where) break; }
      }
      setDest(where);
      // A trek: the route is the plan.
      if (b?.kind === 'trek' && b.trek) {
        setPlaces([]);
        setSession({ found: 0, ai: { source: 'cloud', model: '', label: info?.label ?? aiInfo?.label ?? 'AI', added: 0 } });
        setStep(1);
        track('plan_mode_step', { step: 'route', days: b.trek.stages.length, reels: chosen.length, typed: true });
        return;
      }
      // 2. The places: the ones they named (read by AI, spelling fixed), and what the rules find in any reels.
      setProgress('Checking places on the map…');
      const ruleSources = b ? chosen : sources;
      const found = ruleSources.length ? await findPlaces(ruleSources, where?.name ?? '', where?.region ?? null, [], (done, total) => setProgress(total ? `Checking places on the map · ${done} of ${total}` : '')) : [];
      const named: PlanPlace[] = b ? await Promise.all(b.places.map(async (p): Promise<PlanPlace> => {
        const at = await placeIn(p.title, where?.region ?? null).catch(() => null);
        return { id: `you-${p.title.toLowerCase()}`, title: p.title, lat: at?.lat, lng: at?.lng, area: at?.area ?? '', kind: at && at.kind !== 'other' ? at.kind : kindOf(p.title, at?.osm),
          pick: 'must', evidence: [{ reelId: '', quote: p.quote, source: 'you' }] };
      })) : [];
      // A reel that names a single place was shared for that place: it's a must.
      const single = new Set(chosen.map((r) => found.filter((f) => f.located && f.quotes.some((q) => q.reelId === r.id))).filter((list) => list.length === 1).map((list) => list[0].key));
      const fromRules: PlanPlace[] = found.map((f) => ({
        id: f.key, title: f.title, lat: f.located?.lat, lng: f.located?.lng, area: f.located?.area ?? '',
        kind: f.located?.kind && f.located.kind !== 'other' ? f.located.kind : kindOf(f.title, f.located?.osm),
        // Places typed in are what the person wants: musts, labelled as theirs.
        pick: single.has(f.key) || f.quotes.every((q) => q.reelId === 'typed') ? 'must' : defaultPick(f.confidence, !!f.located, f.reels), slot: f.slot,
        evidence: f.quotes.map((q) => (q.reelId === 'typed' ? { ...q, reelId: '', quote: '', source: 'you' as const } : q)), note: f.note,
      }));
      const next = [...named, ...fromRules.filter((f) => !named.some((n) => alreadyIn([n], f)))];
      // Keep what the person decided (not the old defaults) when places are found again.
      setPlaces((prev) => {
        const keep = new Map(prev.map((p) => [p.id, p]));
        const merged = next.map((p) => (keep.has(p.id) ? { ...p, pick: decided.current.has(p.id) ? keep.get(p.id)!.pick : p.pick, day: keep.get(p.id)!.day } : p));
        // Places added by hand on this step stay; the rest come from this search (and the AI's reading of it).
        return [...merged, ...prev.filter((p) => !merged.some((m) => m.id === p.id) && p.id.startsWith('you-') && !b)];
      });
      setSession({ found: next.length, ai: b ? { source: 'cloud', model: '', label: info?.label ?? aiInfo?.label ?? 'AI', added: 0 } : null });
      setStep(1);
      track('plan_mode_step', { step: 'places', places: next.length, reels: chosen.length, typed: !!typedReel, understood: !!b });
      // Without AI's reading of the sentence, a guess that finds nothing on the map may be wrong: the AI's reading of
      // the reels can correct it. With it, only reels are left to read.
      const lost = !b && !forced && next.length > 0 && next.every((p) => p.lat === undefined);
      if (!b || chosen.length) void readWithAi(where, cloud, lost, b ? chosen : sources);
      // Only a destination, or a place or two: AI offers its picks straight away, to add or ignore.
      if (where && !lost && next.filter((p) => p.lat !== undefined).length < 3) seed = { where, have: next.map((p) => p.title) };
    } finally { setBusy(''); setProgress(''); }
    if (seed) void fetchIdeas(seed.where, cloud, seed.have, true);
  };

  /** The model's reading, merged in when it answers: only places the map finds in the destination, as maybes. */
  const readWithAi = async (where: Dest | null, cloud: boolean, lost = false, list: Reel[] = sources) => {
    const ai = await aiRead(list, where?.name ?? '', token, cloud);
    if (!ai) { setSession((s) => ({ ...s, ai: 'none' })); return; }
    let place = where;
    const aiPlace = ai.destination.trim();
    // The rules' guess found nothing there and the AI reads somewhere else ("Sunset, Arkansas" vs "Goa"): go with the AI's.
    if (lost && aiPlace && (!where || !where.name.toLowerCase().includes(aiPlace.toLowerCase()))) {
      const other = await locate(aiPlace);
      if (other) { void find(other, cloud); return; }
    }
    if (!place && aiPlace) { place = await locate(aiPlace); if (place) setDest(place); }
    const located = await Promise.all(ai.places.map((p) => placeIn(p.title, place?.region ?? null).catch(() => null)));
    let added = 0;
    setPlaces((list) => {
      const out = [...list];
      ai.places.forEach((p, i) => {
        const at = located[i];
        if (!at) return;
        // A rule's guess the map couldn't find, made from the words the AI read as this place ("Dil Chahta Hai" in "the
        // Dil Chahta Hai fort", which the AI reads as Chapora Fort), gives way to it, keeping the person's pick.
        const quote = p.quote.toLowerCase();
        const guess = out.findIndex((x) => x.lat === undefined && x.title.length >= 3 && quote.includes(x.title.toLowerCase()));
        const replaced = guess >= 0 ? out.splice(guess, 1)[0] : null;
        const same = (t: string) => t.toLowerCase().includes(p.title.toLowerCase()) || p.title.toLowerCase().includes(t.toLowerCase());
        if (out.some((x) => same(x.title) || (x.lat !== undefined && Math.abs(x.lat - at.lat) < 0.002 && Math.abs((x.lng ?? 0) - at.lng) < 0.002))) return;
        added += 1;
        out.push({ id: `ai-${p.title.toLowerCase()}`, title: p.title, lat: at.lat, lng: at.lng, area: at.area, kind: at.kind !== 'other' ? at.kind : kindOf(p.title, at.osm), pick: replaced?.pick ?? 'maybe', slot: p.slot,
          evidence: [{ reelId: p.reelId, quote: p.quote || p.why || '', source: 'ai' }] });
      });
      return out;
    });
    setSession((s) => ({ ...s, ai: { source: ai.source, model: ai.model, label: ai.label, added } }));
  };

  /** An AI idea, already checked on the map: added as a must, labelled as the AI's suggestion. */
  const addIdea = (c: IdeaCandidate) => {
    setIdeas((list) => list?.filter((x) => x !== c) ?? null);
    const id = `you-${c.title.toLowerCase()}`;
    setPlaces((list) => [...list.filter((p) => p.id !== id), {
      id, title: c.title, lat: c.lat, lng: c.lng, area: c.area, kind: (c.kind as Kind) || kindOf(c.title), pick: 'must',
      evidence: [{ reelId: '', quote: c.quote, source: 'ai' }],
    }]);
  };

  const addPlace = async (name: string) => {
    const title = name.trim();
    if (title.length < 3) return;
    setBusy('adding');
    try {
      const at = await placeIn(title, dest?.region ?? null).catch(() => null);
      const id = `you-${title.toLowerCase()}`;
      setPlaces((list) => [...list.filter((p) => p.id !== id), {
        id, title: at && at.title.length <= title.length + 12 ? at.title : title, lat: at?.lat, lng: at?.lng, area: at?.area ?? '', kind: at && at.kind !== 'other' ? at.kind : kindOf(title, at?.osm),
        pick: 'must', evidence: [{ reelId: '', quote: '', source: 'you' }],
      }]);
      setAdding('');
      if (!at) Alert.alert('Added, but not found on the map', `“${title}” isn’t on the map${dest ? ` in ${dest.name}` : ''} under that name. It still gets a day; check the spelling if it should be on the map.`);
    } finally { setBusy(''); }
  };

  const moreIdeas = async () => {
    if (!dest || busy) return;
    const info = await aiAvailable(token, cloudAi.allowed);
    const cloud = info?.source === 'cloud' ? await cloudAi.confirm(info.label) : false;
    await fetchIdeas(dest, cloud, places.filter((p) => p.pick !== 'skip').map((p) => p.title));
  };
  /** AI's picks for the destination, each checked on the map. `quiet`: offered unasked, so a failure isn't announced. */
  const fetchIdeas = async (where: Dest, cloud: boolean, have: string[], quiet = false) => {
    setBusy('ideas');
    try {
      const said = typed.trim().toLowerCase();
      const ask = said ? `They wrote: ${typed.trim().slice(0, 180)}` : undefined;
      const list = await aiIdeas({ destination: where.name, have, interests: cues.interests.map((i) => INTEREST_LABEL[i]), party: answers?.party ?? cues.party ?? 'friends', food: answers?.food ?? (cues.veg ? 'veg' : 'any'), budget: answers?.budget ?? cues.budget ?? 'comfortable', ask }, token, cloud);
      if (aiFailed(list)) { if (!quiet) Alert.alert('No ideas this time', list.message); setIdeas(quiet ? null : []); return; }
      // Each checked on the map in the destination; ones it can't find are still offered, last, and say so.
      const located = await locateIdeas(list, where.region);
      setIdeas(located.filter((c) => !have.some((h) => alreadyIn([{ title: h }], c))));
    } finally { setBusy(''); }
  };

  const setPick = (id: string, pick: Priority) => { decided.current.add(id); return setPlaces((list) => list.map((p) => (p.id === id ? { ...p, pick, ...(pick === 'skip' ? { day: undefined } : {}) } : p))); };

  /* ---------------- step 2 → 3: suggestions with reasons */

  const toTrip = () => {
    const musts = places.filter((p) => p.pick === 'must').length;
    const maybes = places.filter((p) => p.pick === 'maybe').length;
    if (!musts && !maybes && !dest && !trek) { Alert.alert('Where to?', 'Say where the trip is, or add a place.'); return; }
    if (!answers) {
      // Facts said in the sentence win over suggestions: "4 days", "with 3 friends", "from 12 Dec".
      const said = typed.trim().toLowerCase();
      // What AI read from the sentence fills in what the rules didn't ("my wife" → a couple, "december" → December).
      const b = brief;
      const saidPeople = (said ? parseTravellers(said) : null) ?? (b?.people || (b?.party === 'solo' ? 1 : b?.party === 'couple' ? 2 : null));
      const party: Party = b?.party || (saidPeople === 1 ? 'solo' : saidPeople && saidPeople > 2 ? 'friends' : cues.party ?? PARTY_FROM_PREFS[prefs.native.party] ?? 'friends');
      const people = saidPeople ?? (party === 'solo' ? 1 : party === 'couple' ? 2 : 4);
      const pace = suggestPace(party, people);
      const saidStart = (said ? parseStart(said) : null) ?? (b?.start || null);
      // A trek (or anywhere with a season): its best months decide, unless they gave a date.
      const inSeason = b?.best_months.length ? seasonStart(b.best_months, todayISO(), b.month) : null;
      const offSeason = b?.month && b.best_months.length && !b.best_months.includes(b.month);
      const start = saidStart && saidStart > todayISO() ? { date: saidStart, why: 'The date you gave.' }
        : b?.month ? { ...suggestStart({ ...cues, months: [b.month] }, india), why: offSeason ? `The month you gave. ${monthName(b.month)} is out of season: it’s usually best in ${monthsInWords(b.best_months)}.` : 'The month you gave.' }
        : inSeason && trek ? inSeason
        : (() => { const s0 = suggestStart(cues, india); const m = s0.why.match(/^The reels say (\w+)\./)?.[1]; return m && said.includes(m.toLowerCase().slice(0, 3)) ? { ...s0, why: 'The month you gave.' } : s0; })();
      // A trek lasts as long as its route.
      const saidDays = trek ? trek.stages.length : (said ? parseDays(said) : null) ?? (b?.days || null);
      // A long weekend that was suggested sets a floor on the length (no point using half of it).
      const weekend = india ? longWeekends('IN', isoAdd(todayISO(), 10), 4).find((w) => w.start === start.date) : undefined;
      const days = saidDays ?? Math.max(suggestDays(musts + Math.ceil(maybes / 2), pace), weekend ? Math.round((Date.parse(weekend.end) - Date.parse(weekend.start)) / 86400000) + 1 : 0);
      setAnswers({ destination: dest?.name ?? '', start: start.date, days, party, people, pace, food: b?.food || (cues.veg ? 'veg' : 'any'), budget: b?.budget || cues.budget || 'comfortable', arrive: 'afternoon', leave: 'afternoon', maybes: party === 'friends' || party === 'family' ? 'group' : 'fit' });
      setWhy({
        start: start.why,
        days: trek ? 'The route’s length: change the route to change it.' : saidDays ? 'The length you gave.' : weekend && days === Math.round((Date.parse(weekend.end) - Date.parse(weekend.start)) / 86400000) + 1 ? `The whole ${weekend.holiday} long weekend.` : `${plural(musts, 'must-do')}${maybes ? ` and ${plural(maybes, 'maybe')}` : ''} at a ${pace} pace.`,
        party: saidPeople || b?.party ? 'From what you wrote.' : cues.party ? 'The reels look like a trip with ' + (cues.party === 'couple' ? 'a partner' : cues.party === 'solo' ? 'just you' : `${cues.party}`) + '.' : 'From who you usually travel with.',
        pace: pace === 'relaxed' ? 'Couples and families enjoy fewer stops a day.' : 'Room for the must-dos without rushing.',
        food: b?.food ? 'From what you wrote.' : cues.veg ? 'The reels mention veg food.' : undefined,
        budget: b?.budget ? 'From what you wrote.' : cues.budget === 'backpacker' ? 'The reels are about saving money.' : cues.budget === 'treat' ? 'The reels are about treating yourselves.' : undefined,
      });
    }
    setStep(2);
    track('plan_mode_step', { step: 'trip', musts, maybes });
  };

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((a) => (a ? { ...a, [key]: value } : a));
    setTouched((t) => new Set(t).add(key));
  };

  /* ---------------- step 4: the days */

  const tz = dest?.region?.tzMinutes ?? -new Date().getTimezoneOffset();
  const plan = useMemo(() => (answers ? buildPlan(places, { ...answers, destination: dest?.name ?? answers.destination }, { sun: (lat, lng, iso) => sunTimes(lat, lng, iso, tz) }) : null), [answers, places, dest, tz]);

  useEffect(() => {
    if (!showChanged.current || !plan) return;
    showChanged.current = false;
    const i = plan.days.findIndex((d) => d.stops.some((s) => s.placeId && marks[s.placeId]));
    if (i >= 0) setDayShown(i);
  }, [plan, marks]);

  const stopActions = (s: Stop, dayIndex: number) => {
    if (!s.placeId || !plan || !answers) return;
    const p = places.find((x) => x.id === s.placeId);
    if (!p) return;
    const moves = plan.days.map((d, i) => ({ d, i })).filter(({ i }) => i !== dayIndex).slice(0, 6);
    Alert.alert(p.title, p.evidence[0] ? `${SOURCE_LABEL[p.evidence[0].source]}${p.evidence[0].quote ? `: “${p.evidence[0].quote.slice(0, 120)}”` : ''}` : undefined, [
      ...moves.map(({ d, i }) => ({ text: `Move to day ${i + 1} · ${shortDay(d.date)}`, onPress: () => setPlaces((list) => list.map((x) => (x.id === p.id ? { ...x, day: i } : x))) })),
      ...(p.pick === 'must' ? [{ text: 'Make it a maybe', onPress: () => setPick(p.id, 'maybe') }] : []),
      { text: 'Remove from the trip', style: 'destructive' as const, onPress: () => setPick(p.id, 'skip') },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  /* ---------------- planning with AI: say what to change */

  /** The new plan inputs from a change, the turn that says what changed, and the plan before it (for Undo). */
  const commit = (r: { places: PlanPlace[]; answers: Answers; changes: string[] }, role: Turn['role'], text: string, fields: (keyof Answers)[]) => {
    if (r.changes.length && answers) {
      before.current = { places, answers };
      const was = new Map(places.map((p) => [p.id, p]));
      const m: Record<string, string> = {};
      for (const p of r.places) {
        const old = was.get(p.id);
        if (p.pick === 'skip') continue;
        if (!old || old.pick === 'skip') m[p.id] = 'New';
        else if (p.day !== undefined && old.day !== p.day) m[p.id] = 'Moved here';
      }
      setMarks(m);
      showChanged.current = Object.keys(m).length > 0;
      setPlaces(r.places);
      setAnswers(r.answers);
      if (fields.length) setTouched((t) => new Set([...t, ...fields]));
      for (const p of r.places) decided.current.add(p.id);
    }
    setTurns((t) => [...t.map((x) => ({ ...x, canUndo: false })), { id: uid(), role, text, changes: r.changes, canUndo: r.changes.length > 0 }]);
  };

  /** A trek's route, changed as asked ("add a rest day at Dzongri", "make it 9 days"): AI re-plans it, safely. */
  const askRoute = async (text: string) => {
    if (!trek || busy) return;
    setTurns((t) => [...t, { id: uid(), role: 'you', text }]);
    setNoticeOpen(true);
    const info = await aiAvailable(token, cloudAi.allowed);
    const cloud = info?.source === 'cloud' ? await cloudAi.confirm(info.label) : false;
    setBusy('editing');
    try {
      const r = await aiBrief({ text: typed.trim() || brief?.title || '', current_route: trek.stages, history: turns.slice(-6).map((t) => ({ role: t.role === 'you' ? 'you' as const : 'ai' as const, text: t.text })), message: text }, token, cloud);
      if (aiFailed(r)) { setTurns((t) => [...t, { id: uid(), role: 'ai', text: r.message }]); return; }
      if (!r.trek) { setTurns((t) => [...t, { id: uid(), role: 'ai', text: r.question || r.note || 'I couldn’t change the route that way. Try saying it another way.' }]); return; }
      const changes = routeChanges(trek, r.trek);
      if (changes.length) {
        trekBefore.current = trek;
        before.current = null;
        setTrek(r.trek);
        setBrief((b) => (b ? { ...b, note: r.note || b.note } : b));
        setAnswers((a) => (a ? { ...a, days: r.trek!.stages.length } : a));
      }
      const reply = r.reply || (changes.length ? 'Here’s the new route.' : 'The route already does that.');
      setTurns((t) => [...t.map((x) => ({ ...x, canUndo: false })), { id: uid(), role: 'ai', text: reply, changes, canUndo: changes.length > 0 }]);
      track('plan_edit', { via: 'ai', kind: 'trek', applied: changes.length });
    } finally { setBusy(''); }
  };

  const ask = async (text: string) => {
    if (trek) { await askRoute(text); return; }
    if (!answers || !plan || busy) return;
    setTurns((t) => [...t, { id: uid(), role: 'you', text }]);
    setNoticeOpen(true);
    setMarks({});
    // Plain requests ("more relaxed", "add a day", "remove the fort") are done here, instantly.
    const local = localEdits(text, places, answers);
    if (local) {
      const r = applyEdits(places, answers, local, {}, todayISO());
      const moved = local.find((e) => e.type === 'move_place');
      if (moved && moved.type === 'move_place' && moved.day > 0) setDayShown(moved.day - 1);
      commit(r, 'quick', r.changes.length ? 'Done.' : 'The plan is already like that.', local.flatMap((e) => (e.type === 'set' ? [e.field as keyof Answers] : [])));
      track('plan_edit', { via: 'phone', edits: local.length });
      return;
    }
    const info = await aiAvailable(token, cloudAi.allowed);
    const cloud = info?.source === 'cloud' ? await cloudAi.confirm(info.label) : false;
    setBusy('editing');
    try {
      const res = await aiEdit({
        trip: { destination: dest?.name ?? answers.destination, start: answers.start, days: answers.days, party: answers.party, people: answers.people, pace: answers.pace, food: answers.food, budget: answers.budget, arrive: answers.arrive, leave: answers.leave },
        places: places.map((p) => ({ id: p.id, title: p.title, area: p.area, kind: p.kind, pick: p.pick, day: p.day !== undefined ? p.day + 1 : 0 })),
        schedule: plan.days.map((d) => ({ title: d.title, stops: d.stops.map((x) => `${x.time} ${x.title}`) })),
        history: turns.slice(-6).map((t) => ({ role: t.role === 'you' ? 'you' as const : 'ai' as const, text: t.text })),
        message: text,
      }, token, cloud);
      if (aiFailed(res)) { setTurns((t) => [...t, { id: uid(), role: 'ai', text: res.message }]); return; }
      const edits = cleanEdits(res.actions, places, answers.days);
      // New places are checked on the map first (inside the destination), so the days can group them by what's near.
      const adds = edits.flatMap((e) => (e.type === 'add_place' ? [e.title] : []));
      const located = await Promise.all(adds.map((t) => placeIn(t, dest?.region ?? null).catch(() => null)));
      const found: Record<string, Found> = Object.fromEntries(adds.map((t, i) => [t, located[i]]));
      const r = applyEdits(places, answers, edits, found, todayISO());
      // Show the day that changed.
      const day = edits.find((e) => (e.type === 'add_place' || e.type === 'move_place') && e.day > 0);
      if (day && (day.type === 'add_place' || day.type === 'move_place')) setDayShown(day.day - 1);
      commit(r, 'ai', res.reply || (r.changes.length ? 'Done.' : 'Nothing to change there.'), edits.flatMap((e) => (e.type === 'set' ? [e.field as keyof Answers] : [])));
      track('plan_edit', { via: 'ai', edits: edits.length, applied: r.changes.length });
    } finally { setBusy(''); }
  };

  const undo = () => {
    if (trekBefore.current) {
      const was = trekBefore.current;
      trekBefore.current = null;
      setTrek(was);
      setAnswers((a) => (a ? { ...a, days: was.stages.length } : a));
      setTurns((t) => [...t.map((x) => (x.canUndo ? { ...x, canUndo: false, changes: undefined, text: `${x.text} (Undone.)` } : x))]);
      return;
    }
    const b = before.current;
    if (!b) return;
    setMarks({});
    setPlaces(b.places);
    setAnswers(b.answers);
    before.current = null;
    setTurns((t) => [...t.map((x) => (x.canUndo ? { ...x, canUndo: false, changes: undefined, text: `${x.text} (Undone.)` } : x))]);
  };

  /** A trek becomes a trek trip: its stages (dated) in the adventure view, one plan a day in the itinerary, permits to do. */
  const saveTrek = () => {
    if (!answers || !trek) return;
    const where = dest?.region?.label ?? brief?.region ?? answers.destination;
    const end = isoAdd(answers.start, trek.stages.length - 1);
    const stages = trek.stages.map((st, i) => ({
      id: uid(), date: isoAdd(answers.start, i), title: stageTitle(st), from: st.from, to: st.to,
      startAltitude: st.start_altitude, endAltitude: st.end_altitude, distanceKm: st.distance_km, hours: st.hours, done: false,
    }));
    const activities = trek.stages.map((st, i) => ({
      id: uid(), date: isoAdd(answers.start, i), time: st.from.toLowerCase() === st.to.toLowerCase() ? '09:00' : '07:30', endTime: '', title: stageTitle(st).slice(0, 200), place: st.to.slice(0, 200),
      category: 'Explore' as const, cost: 0, link: '', completed: false, outfitId: '', gear: [],
      notes: [st.note, stageFacts(st, prefs.unit === 'imperial' ? 'imperial' : 'metric'), 'Suggested by AI: check with your trek organiser.'].filter(Boolean).join('\n').slice(0, 5000),
    }));
    const days = Object.fromEntries(trek.stages.map((st, i) => [isoAdd(answers.start, i), { outfitId: '', outfitIds: [], title: stageTitle(st).slice(0, 200), stay: st.to.slice(0, 200), notes: '', gear: [] }]));
    const trip: Trip = {
      id: uid(), name: (brief?.title || `${where.split(',')[0]} trek`).slice(0, 200), destination: where.slice(0, 200), start: answers.start, end, travellers: answers.people, budget: 0,
      currency: ((CURRENCIES as readonly string[]).includes(prefs.currency) ? prefs.currency : 'INR') as Trip['currency'], weightLimit: 0, activities, days, extras: [], packed: [],
      theme: KIND_MOOD.trek, notes: (brief?.note ?? '').slice(0, 5000),
    };
    const group = answers.party === 'friends' || answers.party === 'family';
    const ok = create(trip, 'trek', '', group && whenMode !== 'group', (extras) => {
      extras.adventure = { ...extras.adventure, summitName: (trek.summit || '').slice(0, 120), summitAltitude: highPoint(trek), stages,
        permits: trek.permits.map((name) => ({ id: uid(), name: name.slice(0, 200), reference: '', done: false })) };
    }, group && whenMode === 'group' ? '/date-poll' : undefined);
    if (!ok) return;
    finished.current = true;
    removeDraft(draftId.current);
    track('plan_mode_saved', { kind: 'trek', days: trek.stages.length, group, edits: turns.filter((t) => t.role === 'you').length });
  };

  const save = () => {
    if (trek) { saveTrek(); return; }
    if (!answers || !plan) return;
    const where = dest?.region?.label ?? dest?.name ?? answers.destination;
    if (!where.trim()) { Alert.alert('Where is this trip?', 'Add the destination in the places step first.'); return; }
    const month = new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(`${answers.start}T12:00:00Z`));
    const name = `${(dest?.name ?? where).split(',')[0]} in ${month}`;
    const end = isoAdd(answers.start, answers.days - 1);
    const reelOf = (id: string) => chosen.find((r) => r.id === id);
    const activities = plan.days.flatMap((d) => d.stops.map((s) => {
      const p = s.placeId ? places.find((x) => x.id === s.placeId) : undefined;
      const ev = p?.evidence.find((e) => e.reelId);
      const reel = ev ? reelOf(ev.reelId) : undefined;
      const endMin = toMin(s.time) + s.minutes;
      return {
        id: uid(), date: d.date, time: s.time, endTime: endMin < 24 * 60 ? clock(endMin) : '', title: s.title.slice(0, 200), place: (s.place && s.place !== s.title ? s.place : '').slice(0, 200),
        category: s.category, cost: 0, link: reel?.url ?? '', completed: false, outfitId: '', gear: [],
        notes: [p?.note, ev ? `${SOURCE_LABEL[ev.source]}${reel ? ` (${whoOf(reel)})` : ''}${ev.quote ? `: “${ev.quote.slice(0, 200)}”` : ''}` : s.kind === 'meal' ? s.why : ''].filter(Boolean).join('\n').slice(0, 5000),
      };
    }));
    const days = Object.fromEntries(plan.days.map((d) => [d.date, { outfitId: '', outfitIds: [], title: d.title.slice(0, 200), stay: '', notes: '', gear: [] }]));
    const beaches = places.filter((p) => p.pick !== 'skip' && p.kind === 'beach').length;
    const kind: TripKind = beaches >= 2 ? 'beach' : 'city';
    const trip: Trip = {
      id: uid(), name: name.slice(0, 200), destination: where.slice(0, 200), start: answers.start, end, travellers: answers.people, budget: 0,
      currency: ((CURRENCIES as readonly string[]).includes(prefs.currency) ? prefs.currency : 'INR') as Trip['currency'], weightLimit: 0, activities, days, extras: [], packed: [],
      theme: KIND_MOOD[kind], notes: (chosen.length ? `Planned from ${plural(chosen.length, 'reel')}: ${chosen.map((r) => `${whoOf(r)} ${r.url}`).join(' · ')}` : '').slice(0, 5000),
    };
    const placedOn = new Map(plan.days.flatMap((d) => d.stops.filter((s) => s.placeId).map((s) => [s.placeId!, d.date] as const)));
    const group = answers.party === 'friends' || answers.party === 'family';
    const ok = create(trip, kind, '', group && whenMode !== 'group', (extras) => {
      // Every place goes on the shared shortlist with where it came from; maybes not on a day are for the group to vote on.
      // Kept with where each came from, so the planning board (and friends) can keep shaping the trip.
      extras.shortlist = places.filter((p) => p.pick !== 'skip').map((p) => {
        const ev = p.evidence.find((e) => e.reelId) ?? p.evidence[0];
        const url = ev?.reelId ? reelOf(ev.reelId)?.url : undefined;
        return { id: uid(), title: p.title.slice(0, 160), place: (p.area || '').slice(0, 200), ...(p.lat !== undefined && p.lng !== undefined ? { lat: p.lat, lng: p.lng } : {}),
          ...(url ? { url } : {}), note: '', addedBy: ME, votes: [ME], planned: placedOn.get(p.id) ?? '', createdAt: new Date().toISOString(),
          via: ev?.source === 'ai' ? 'ai' as const : ev?.source === 'you' || !ev ? 'typed' as const : 'reel' as const, ...(ev?.quote ? { quote: ev.quote.slice(0, 220) } : {}),
          kind: p.kind, ...(p.slot ? { slot: p.slot } : {}), ...(p.day !== undefined ? { pinned: isoAdd(answers.start, p.day) } : {}) };
      });
      extras.plan = { pace: answers.pace, food: answers.food === 'nonveg' ? 'any' : answers.food, arrive: answers.arrive, leave: answers.leave,
        drafted: activities.map((a) => a.id), draftedAt: new Date().toISOString(), draftedBy: ME };
    }, group && whenMode === 'group' ? '/date-poll' : undefined);
    if (!ok) return;
    finished.current = true;
    removeDraft(draftId.current);
    track('plan_mode_saved', { days: answers.days, places: placedOn.size, reels: chosen.length, group, ai: session.ai && session.ai !== 'none' ? session.ai.source : 'none', edits: turns.filter((t) => t.role === 'you').length });
    removeFromInbox(chosen.map((r) => r.id));
  };

  // Started from the Plan tab with what you have in mind: find the places straight away (once any reels are loaded).
  const autoGo = useRef(params.go === '1' && !params.draft);
  // Opened again with a new sentence (from the Plan tab, or a link) while plan mode is already up: start over with it.
  const lastPrompt = useRef(params.prompt);
  useEffect(() => {
    if (!params.prompt || params.prompt === lastPrompt.current) return;
    lastPrompt.current = params.prompt;
    setTyped(params.prompt);
    setStep(0);
    setDest(null); setBrief(null); setTrek(null); setPlaces([]); setTurns([]); setIdeas(null); setQuestion('');
    if (params.go === '1') autoGo.current = true;
  }, [params.prompt, params.go]);
  useEffect(() => {
    if (!autoGo.current || !sources.length || busyReading || step !== 0) return;
    const ready = chosen.length >= ids.length;
    const timer = setTimeout(() => { if (autoGo.current) { autoGo.current = false; void find(); } }, ready ? 50 : 1500);
    return () => clearTimeout(timer);
  });

  /* ---------------- render */

  const back = () => (step > 0 ? setStep(step - 1) : router.back());
  const unit = prefs.unit === 'imperial' ? 'imperial' : 'metric';
  const top = (title: string) => <PlanTop step={step} total={4} title={title} onBack={back} close={step === 0} />;
  const city = (dest?.name ?? answers?.destination ?? '').split(',')[0];

  // What AI is doing, or just did, shown above the place to ask (not as a conversation down the page).
  const lastYou = turns.map((t) => t.role).lastIndexOf('you');
  const reply = lastYou >= 0 ? turns.slice(lastYou + 1).find((t) => t.role !== 'you') : undefined;
  const replyText = (t: Turn) => (/\(Undone\.\)$/.test(t.text) ? 'Undone: the plan is back as it was.' : t.role === 'quick' && t.text === 'Done.' ? 'Done, right here on your phone.' : t.text);
  const notice: Notice | null = !noticeOpen || lastYou < 0 ? null
    : busy === 'editing' ? { you: turns[lastYou].text, text: `${aiInfo?.label ?? 'AI'} is changing the plan…`, busy: true }
    : reply ? { you: turns[lastYou].text, text: replyText(reply), changes: reply.changes, canUndo: reply.canUndo } : null;
  const noticeProps = { notice, onUndo: undo, onClose: () => setNoticeOpen(false) };

  if (step === 0) {
    // Saved reels that couldn't be read add nothing: only readable ones are offered as context.
    const groups = byDestination(others).filter((g) => g.name !== 'Couldn’t read');
    const ready = !!sources.length;
    return <Screen key="step-0" gap={20} footer={<NextBar label={busy === 'finding' ? progress || 'Reading…' : busyReading ? 'Reading the reels…' : 'Plan it with AI'} icon="sparkle"
      busy={busy === 'finding' || busyReading} disabled={!ready} onPress={() => { if (ready && !busy && !busyReading) void find(); }} />}>
      {top('Plan a trip')}
      <T v="display">Where to?</T>
      {/* AI's live panel and the composer, touching: one pane to talk to it. */}
      <View style={{ gap: 2 }}>
        <AssistPanel ideas={!typed.trim() && !chosen.length ? STARTERS : undefined} onIdea={(t) => setTyped(`${t} `)}
          attach={busy === 'adding' ? 'Adding…' : 'Paste a reel, post or Maps link'} onAttach={() => void paste()}>
          {'Tell me '}<Emph>where</Emph>{', '}<Emph>when</Emph>{' and '}<Emph>who</Emph>{', or paste a reel. I’ll draft the days.'}
        </AssistPanel>
        <BigInput value={typed} onChangeText={(t) => { setTyped(t); setQuestion(''); }} placeholder="e.g. 4 days in Goa with friends in December" examples={EXAMPLES} />
      </View>
      {question ? <AiLine text={question} /> : null}
      {chosen.length || groups.length ? <View style={{ gap: 10 }}>
        <Label text="Context, if you like" />
        <Tile style={{ paddingVertical: 0 }}>
          <Lines>
            {chosen.map((r) => <ReelCard key={r.id} reel={r} reading={reading.includes(r.id)} found={null}
              onRemove={() => setIds((list) => list.filter((x) => x !== r.id))}
              onNotes={(notes) => updateReel(r.id, { notes })} onCaption={(caption) => updateReel(r.id, { caption })} />)}
            {groups.slice(0, showSaved ? 8 : 3).map((g) => {
              const on = g.reels.every((r) => ids.includes(r.id));
              return <PressScale key={g.name} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setIds((list) => (on ? list.filter((x) => !g.reels.some((r) => r.id === x)) : [...new Set([...list, ...g.reels.map((r) => r.id)])]))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
                <Dot icon="camera" tint="grey" />
                <View style={{ flex: 1, gap: 2 }}><T v="row" style={{ fontSize: 15 }}>{`Saved: ${g.name}`}</T>
                  <T v="meta" lines={1}>{`${plural(g.reels.length, 'reel')} · ${g.reels.slice(0, 2).map(whoOf).filter(Boolean).join(', ')}`}</T></View>
                <T v="small" color={on ? colors.success : colors.ink}>{on ? 'Added' : 'Use'}</T>
              </PressScale>;
            })}
          </Lines>
        </Tile>
        {groups.length > 3 && !showSaved ? <View style={{ alignSelf: 'flex-start' }}><Link text={`All saved reels (${others.length})`} onPress={() => setShowSaved(true)} /></View> : null}
      </View> : <T v="meta" color={colors.inkFaint}>AI reads a reel’s words (caption, hashtags, cover), never the video.</T>}
    </Screen>;
  }

  /** Where the trip is: the place in big type, the rest of its name under it, and a way to change it. */
  const label = trek && brief ? '' : dest ? (dest.region?.label ?? dest.name) : '';
  const whereTitle = <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Heading eyebrow={trek && brief ? brief.region || dest?.region?.label : undefined} title={trek && brief ? brief.title : label ? label.split(',')[0] : 'Not sure yet'}
          sub={trek && brief ? `Starts in ${brief.destination}` : label.split(',').slice(1).join(',').trim() || undefined} />
      </View>
      {dest && !changing ? <View style={{ paddingTop: trek ? 26 : 14 }}><Link text="Change" onPress={() => (trek ? setStep(0) : setChanging(true))} /></View> : null}
    </View>;
  const whereField = !dest || changing ? <LineInput value={destInput} onChangeText={setDestInput} icon="pin" label="Where is this trip?" placeholder="Goa, Bangkok, Bali…"
      onSubmit={(t) => { if (t.trim()) void locate(t).then((d) => { if (!d) { Alert.alert('Couldn’t find that place', 'Try the city, state or country name.'); return; } setDestInput(''); setChanging(false); void find(d); }); }} /> : null;
  const where = <View style={{ gap: 10 }}>{whereTitle}{whereField}</View>;

  if (step === 1 && trek) {
    return <Screen key="step-route" gap={22} footer={<AskBar placeholder="Add a rest day, make it 9 days…" asks={trekSuggestions(trek)} busy={busy === 'editing'}
      onSend={(t) => void ask(t)} cta={{ label: 'Next', onPress: toTrip }} {...noticeProps} />}>
      {top('The route')}
      {where}
      {brief?.note ? <AiLine text={brief.note} /> : null}
      <TrekView trek={trek} selected={stageShown} onSelect={setStageShown} unit={unit} />
    </Screen>;
  }

  if (step === 1) {
    const order = { must: 0, maybe: 1, skip: 2 };
    const shown = [...places].sort((a, b) => order[a.pick] - order[b.pick]);
    const ai = session.ai;
    const kept = places.filter((p) => p.pick !== 'skip').length;
    // Already planning a trip there? These places can join its board instead, for the group to vote on.
    const there = dest ? upcomingTrips(trips).find((t) => t.destination.toLowerCase().includes(dest.name.toLowerCase())) : undefined;
    const addToTrip = () => {
      if (!there) return;
      const keep = places.filter((p) => p.pick !== 'skip');
      extrasStore.change(there.id, (d) => {
        for (const p of keep) {
          // Already on the board (by name or the same spot): you want it too, so it gets your heart.
          const had = d.shortlist.find((x) => alreadyIn([x], p));
          if (had) { if (!had.votes.includes(ME)) had.votes.push(ME); continue; }
          const ev = p.evidence.find((e) => e.reelId) ?? p.evidence[0];
          const url = ev?.reelId ? chosen.find((r) => r.id === ev.reelId)?.url : undefined;
          d.shortlist.push({ id: uid(), title: p.title.slice(0, 160), place: (p.area || '').slice(0, 200), ...(p.lat !== undefined && p.lng !== undefined ? { lat: p.lat, lng: p.lng } : {}),
            ...(url ? { url } : {}), note: '', addedBy: ME, votes: [ME], planned: '', createdAt: new Date().toISOString(),
            via: ev?.source === 'ai' ? 'ai' : ev?.source === 'you' || !ev ? 'typed' : 'reel', ...(ev?.quote ? { quote: ev.quote.slice(0, 220) } : {}), kind: p.kind, ...(p.slot ? { slot: p.slot } : {}) });
        }
      });
      track('plan_mode_saved', { to: 'board', places: keep.length, reels: chosen.length });
      finished.current = true;
      removeDraft(draftId.current);
      removeFromInbox(chosen.map((r) => r.id));
      select(there.id);
      openTrip('/trip', '/plan');
    };
    /** A place's story (where it is, where it came from) and what to do with it. */
    const placeMenu = (p: PlanPlace) => {
      const ev = p.evidence[0];
      const reel = ev ? chosen.find((r) => r.id === ev.reelId) : undefined;
      const at = p.lat !== undefined ? [KIND_LABEL[p.kind] !== 'Place' ? KIND_LABEL[p.kind] : '', p.area].filter(Boolean).join(' · ') : 'Not found on the map';
      const from = ev ? `${SOURCE_LABEL[ev.source]}${reel && ev.source !== 'you' ? ` (${whoOf(reel)})` : ''}${ev.quote ? `: “${ev.quote.slice(0, 160)}”` : ''}` : '';
      Alert.alert(p.title, [at, from].filter(Boolean).join('\n\n'), [
        ...(p.pick !== 'must' ? [{ text: 'Must-do', onPress: () => setPick(p.id, 'must') }] : []),
        ...(p.pick !== 'maybe' ? [{ text: 'Maybe', onPress: () => setPick(p.id, 'maybe') }] : []),
        ...(p.pick !== 'skip' ? [{ text: 'Leave it out', style: 'destructive' as const, onPress: () => setPick(p.id, 'skip') }] : []),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    };
    const pins: MapPin[] = [
      ...places.filter((p) => p.pick !== 'skip' && p.lat !== undefined && p.lng !== undefined).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, color: KIND_COLOR[p.kind], hollow: p.pick === 'maybe' })),
      ...(ideas ?? []).filter((x) => x.lat !== undefined && x.lng !== undefined).map((x) => ({ id: `idea-${x.title}`, lat: x.lat!, lng: x.lng!, color: colors.sand, hollow: true })),
    ];
    const centre: MapPin[] = dest?.region ? [{ id: 'centre', lat: dest.region.lat, lng: dest.region.lng, color: colors.ink }] : [];
    const read = ai && ai !== 'none' ? `Read with ${ai.source === 'on-device' ? 'Apple Intelligence' : ai.label}` : chosen.length ? 'Found in what you wrote and the reels' : 'Found in what you wrote';
    return <Screen key="step-1" gap={22} footer={<NextBar label={kept ? `Next · ${plural(kept, 'place')}` : 'Next'} onPress={toTrip} />}>
      {top('The places')}
      <PlanMap pins={pins.length ? pins : centre} height={220} label={`Map of the places in ${city}`}>{whereTitle}</PlanMap>
      {whereField}
      {brief?.note ? <AiLine text={brief.note} /> : null}
      {there && kept ? <PressScale accessibilityRole="button" accessibilityHint={`Puts ${kept === 1 ? 'this place' : `these ${kept} places`} on that trip's board${extrasStore.get(there.id).live ? ' for everyone to vote on' : ''}`}
        onPress={addToTrip} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radii.card }}>
        <GlassFill kind="control" radius={radii.card} />
        <Icon name="shared" size={15} color={colors.ink} />
        <T v="small" style={{ flex: 1 }}>{'Already planning '}<Text style={{ fontFamily: fonts.medium, color: colors.ink }}>{there.name}</Text>{'. '}
          <Text style={{ color: colors.ink, textDecorationLine: 'underline', textDecorationColor: colors.hairlineStrong }}>Add these there</Text></T>
      </PressScale> : null}
      <View style={{ gap: 10 }}>
        <Label text={kept ? `Your places · ${kept}` : 'Your places'} />
        {shown.length ? <Chips>{shown.map((p) => <PlaceChip key={p.id} title={p.title} icon={KIND_ICON[p.kind]} color={p.lat !== undefined ? KIND_COLOR[p.kind] : colors.inkFaint}
          state={p.pick} onPress={() => placeMenu(p)} hint="Shows where it came from, and must-do, maybe or leave it out" />)}</Chips>
          : <T v="small">{chosen.length ? 'The reels don’t name places in words. Add the ones you remember, or tap AI’s picks below.' : 'Add places you already know, or tap AI’s picks below.'}</T>}
        <LineInput value={adding} onChangeText={setAdding} label="Add a place" placeholder={dest ? `Add a place in ${city}` : 'Add a place'} busy={busy === 'adding'} onSubmit={(t) => void addPlace(t)} />
      </View>
      {dest && ((ai && ai !== 'none') || ideas !== null || busy === 'ideas') ? <View style={{ gap: 10 }}>
        <Label text={`AI’s picks for ${city}`} action={busy === 'ideas' ? undefined : ideas && ideas.length > 1 ? 'Add all' : 'Ask again'}
          onAction={() => { if (ideas && ideas.length > 1) { for (const x of ideas) addIdea(x); } else void moreIdeas(); }} />
        {ideas === null || busy === 'ideas'
          ? <PressScale accessibilityRole="button" disabled={busy === 'ideas'} onPress={() => void moreIdeas()} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            {busy === 'ideas' ? <ActivityIndicator color={colors.sand} size="small" /> : <Icon name="sparkle" size={16} color={colors.sand} />}
            <T v="small" color={colors.sand}>{busy === 'ideas' ? 'Finding places that fit…' : `Suggest places for ${city}`}</T>
          </PressScale>
          : ideas.length ? <>
            <Chips>{ideas.map((x) => <PlaceChip key={x.title} title={x.title} icon="plus" color={colors.sand} state="idea" onPress={() => addIdea(x)} hint="Adds it to your places. Touch and hold to see why."
              onLongPress={() => Alert.alert(x.title, [x.located ? x.area : 'Not found on the map', x.quote].filter(Boolean).join('\n\n'), [{ text: 'Add it', onPress: () => addIdea(x) }, { text: 'Close', style: 'cancel' }])} />)}</Chips>
            <T v="meta" color={colors.inkFaint}>Tap one to add it. Touch and hold to see why AI picked it.</T>
          </>
          : <T v="small">Nothing new right now. Ask again later.</T>}
      </View> : null}
      <T v="meta" color={colors.inkFaint}>{`${read}. Every place is checked on the map.`}</T>
    </Screen>;
  }

  if (!answers) return null;

  if (step === 2) {
    const sug = (k: keyof Answers) => !touched.has(k) && !!why[k];
    // Yours when you said it or changed it; anything else (a suggestion with a reason, or a default) is AI's.
    const src = (k: keyof Answers): 'you' | 'ai' => (touched.has(k) || /^(The date you gave|The month you gave|The length you gave|From what you wrote)\./.test(why[k] ?? '') ? 'you' : 'ai');
    // Long weekends don't fit a week-long trek (and may be out of its season).
    const weekends = india && !trek ? longWeekends('IN', isoAdd(todayISO(), 7), 5).slice(0, 4) : [];
    const group = answers.party === 'friends' || answers.party === 'family';
    const days = trek ? trek.stages.length : answers.days;
    const toggle = (k: string) => setOpenSetting((o) => (o === k ? null : k));
    const done = () => setOpenSetting(null);
    const PACE: Record<Pace, string> = { relaxed: 'relaxed', balanced: 'balanced', packed: 'see-it-all' };
    const FOOD: Record<Food, string> = { any: 'any', veg: 'veg', jain: 'Jain', nonveg: 'non-veg' };
    const BUDGET: Record<Budget, string> = { backpacker: 'backpacker', comfortable: 'comfortable', treat: 'treat-ourselves' };
    const who = answers.party === 'solo' ? 'just you' : answers.party === 'couple' ? 'the two of you' : answers.party === 'friends' ? `you and ${plural(Math.max(1, answers.people - 1), 'friend')}` : `a family of ${answers.people}`;
    const first = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${answers.start}T12:00:00Z`));
    const going = places.filter((p) => p.pick === 'must').map((p) => p.title);
    const seeing = going.length > 2 ? `${going.slice(0, 2).join(', ')} and ${going.length - 2} more` : going.join(' and ');
    const maybes = group && !trek && places.some((p) => p.pick === 'maybe');
    const b = (k: string, text: string, source: 'you' | 'ai', name: string) => <Blank text={text} source={source} active={openSetting === k} onPress={() => toggle(k)} label={name} />;
    const ink = { color: colors.ink, fontFamily: fonts.semibold };
    const sentence = <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.light, fontSize: 26, lineHeight: 40, letterSpacing: -0.5, color: colors.inkMuted }}>
      {trek ? <>A {b('days', `${days}-day`, 'ai', 'How long')} trek from <Text style={ink}>{brief?.destination ?? city}</Text>, </>
        : <>{b('days', plural(days, 'day'), src('days'), 'How long')} in <Text style={ink}>{city}</Text>, </>}
      {whenMode === 'group' ? <>on {b('when', 'dates the group picks', 'you', 'When')}</> : <>starting {b('when', first, src('start'), 'When')}</>}
      {', for '}{b('party', who, src('party'), 'Who’s going')}{'. '}
      {trek ? null : <>A {b('pace', PACE[answers.pace], src('pace'), 'Pace')} pace, {b('food', FOOD[answers.food], src('food'), 'Food')} food, and a {b('budget', BUDGET[answers.budget], src('budget'), 'Budget')} budget.
        {' '}Arriving in the {b('arrive', answers.arrive, src('arrive'), 'Arriving')}, leaving in the {b('leave', answers.leave, src('leave'), 'Leaving')}.</>}
      {maybes ? <>{' '}Maybes: {b('maybes', answers.maybes === 'group' ? 'the group votes' : 'fit them in', src('maybes'), 'The maybes')}.</> : null}
      {trek?.summit ? <>{' '}Up to <Blank text={`${trek.summit}${highPoint(trek) ? ` at ${altitude(highPoint(trek), unit)}` : ''}`} source="ai" active={false} onPress={() => setStep(1)} label="The route, opens the route step" />.</> : null}
      {seeing && !trek ? <>{' '}Seeing <Blank text={seeing} source="you" active={false} onPress={() => setStep(1)} label="Places, opens the places step" />.</> : null}
    </Text>;
    const parts: [DayPart, string][] = [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']];
    const editor = (() => {
      switch (openSetting) {
        case 'when': return <BlankEditor title="When" onDone={done} why={whenMode === 'group' ? 'You’ll start a date poll in the trip: friends pick from a few options.' : touched.has('start') ? undefined : why.start}>
          {group ? <Choices<'pick' | 'group'> options={[['pick', 'We know the dates'], ['group', 'Ask the group']]} value={whenMode} onChange={setWhenMode} /> : null}
          {weekends.length && whenMode === 'pick' ? <Chips>{weekends.map((w) => {
            const on = answers.start === w.start;
            // A long weekend sets the length too (unless the person already chose one).
            return <PressScale key={w.start} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { set('start', w.start); if (!touched.has('days')) { setAnswers((a) => (a ? { ...a, days: Math.max(a.days, Math.round((Date.parse(w.end) - Date.parse(w.start)) / 86400000) + 1) } : a)); setWhy((y) => ({ ...y, days: `The whole ${w.holiday} long weekend.` })); } }}
              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.chip, gap: 1 }}>
              <GlassFill kind={on ? 'khaki' : 'control'} radius={radii.chip} sheen={on} />
              <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.ink }}>{dateRange(w.start, w.end)}</Text>
              <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.light, fontSize: 12, color: on ? colors.ink : colors.inkMuted }}>{w.holiday}</Text>
            </PressScale>;
          })}</Chips> : null}
          <DateField label={whenMode === 'group' ? 'Placeholder dates (the poll decides)' : 'First day'} value={answers.start} min={todayISO()} onChange={(d) => set('start', d)} />
        </BlankEditor>;
        case 'days': return <BlankEditor title="How long" onDone={done} why={trek ? 'Set by the route. To change it, go back and ask AI (“make it 9 days”).' : sug('days') ? (/^The (whole|length)/.test(why.days ?? '') ? why.days : `${why.days} ${plural(answers.days, 'day')} fits them without rushing.`) : undefined}>
          {trek ? null : <Count value={answers.days} min={1} max={21} unit={['day', 'days']} onChange={(n) => set('days', n)} />}
        </BlankEditor>;
        case 'party': return <BlankEditor title="Who’s going" onDone={done} why={sug('party') ? why.party : undefined}>
          <Choices<Party> options={[['solo', 'Just me'], ['couple', 'Couple'], ['friends', 'Friends'], ['family', 'Family']]} value={answers.party}
            onChange={(v) => { set('party', v); set('people', v === 'solo' ? 1 : v === 'couple' ? 2 : Math.max(answers.people, 3)); set('maybes', v === 'friends' || v === 'family' ? 'group' : 'fit'); }} />
          {group ? <Count value={answers.people} min={2} max={20} unit={['person', 'people']} onChange={(n) => set('people', n)} /> : null}
        </BlankEditor>;
        case 'pace': return <BlankEditor title="Pace" onDone={done} why={sug('pace') ? why.pace : `${answers.pace === 'relaxed' ? 'About 3' : answers.pace === 'balanced' ? 'About 4' : 'Up to 6'} places a day, plus meals.`}>
          <Choices<Pace> options={[['relaxed', 'Relaxed'], ['balanced', 'Balanced'], ['packed', 'See it all']]} value={answers.pace} onChange={(v) => set('pace', v)} />
        </BlankEditor>;
        case 'food': return <BlankEditor title="Food" onDone={done} why={sug('food') ? why.food : undefined}>
          <Choices<Food> options={[['any', 'Anything'], ['veg', 'Veg'], ['jain', 'Jain'], ['nonveg', 'Non-veg']]} value={answers.food} onChange={(v) => set('food', v)} />
        </BlankEditor>;
        case 'budget': return <BlankEditor title="Budget" onDone={done} why={sug('budget') ? why.budget : undefined}>
          <Choices<Budget> options={[['backpacker', 'Backpacker'], ['comfortable', 'Comfortable'], ['treat', 'Treat ourselves']]} value={answers.budget} onChange={(v) => set('budget', v)} />
        </BlankEditor>;
        case 'arrive': return <BlankEditor title="Arriving" onDone={done} why="The first day stays light.">
          <Choices<DayPart> options={parts} value={answers.arrive} onChange={(v) => set('arrive', v)} />
        </BlankEditor>;
        case 'leave': return <BlankEditor title="Leaving" onDone={done} why="The last day stays light.">
          <Choices<DayPart> options={parts} value={answers.leave} onChange={(v) => set('leave', v)} />
        </BlankEditor>;
        case 'maybes': return <BlankEditor title="The maybes" onDone={done} why={answers.maybes === 'group' ? 'They go on the trip’s shortlist; the most-voted get a day.' : 'Maybes fill any room left after the must-dos.'}>
          <Choices<'fit' | 'group'> options={[['group', 'Let the group vote'], ['fit', 'Fit them in']]} value={answers.maybes} onChange={(v) => set('maybes', v)} />
        </BlankEditor>;
        default: return null;
      }
    })();
    return <Screen key="step-2" gap={22} footer={<NextBar label={trek ? 'Review the trek' : 'Draft my days'} icon="sparkle" note="Nothing is booked or shared until you create the trip."
      onPress={() => { setOpenSetting(null); setStep(3); track('plan_mode_step', { step: 'days', days: answers.days, pace: answers.pace }); }} />}>
      {top('The trip')}
      <View style={{ gap: 14 }}>
        <Label text="Your trip" />
        {sentence}
        <T v="meta" color={colors.inkFaint}>
          <Text style={{ color: colors.sand, textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: colors.sand }}>Dotted</Text>{' words were suggested by AI; the rest came from you. Tap any word to change it.'}
        </T>
      </View>
      {editor}
    </Screen>;
  }

  // step 3: the days
  if (trek) {
    return <Screen key="step-trek-days" gap={22} footer={<AskBar placeholder="Add a rest day, make it 9 days…" asks={trekSuggestions(trek)} busy={busy === 'editing'}
      onSend={(t) => void ask(t)} cta={{ label: 'Create', onPress: save }} {...noticeProps} />}>
      {top('Your trek')}
      <Heading eyebrow={brief?.region || dest?.region?.label} title={brief?.title ?? 'Your trek'}
        sub={`${dateRange(answers.start, isoAdd(answers.start, trek.stages.length - 1))} · ${plural(trek.stages.length, 'day')} · from ${brief?.destination ?? city}`} />
      {brief?.note ? <AiLine text={brief.note} /> : null}
      <TrekView trek={trek} selected={stageShown} onSelect={setStageShown} start={answers.start} unit={unit} />
      <T v="meta">The trek opens in its own view, with stages, gear, safety and altitude check-ins.</T>
    </Screen>;
  }
  if (!plan) return null;
  const placedCount = plan.days.reduce((n, d) => n + d.stops.filter((s) => s.placeId).length, 0);
  const group = answers.party === 'friends' || answers.party === 'family';
  const di = Math.min(dayShown, plan.days.length - 1);
  const day = plan.days[di];
  const sourceOf = (s: Stop) => {
    const p = s.placeId ? places.find((x) => x.id === s.placeId) : undefined;
    const ev = p?.evidence[0];
    const reel = ev ? chosen.find((r) => r.id === ev.reelId) : undefined;
    // Where it came from ("From a reel · @handle"), or "you moved it here" when the person chose the day. AI's own
    // picks aren't labelled on every stop: plan mode is planning with AI.
    const moved = p?.day !== undefined && ev?.source !== 'ai';
    return [moved ? 'You moved it here' : ev && ev.source !== 'ai' && ev.source !== 'you' ? `${SOURCE_LABEL[ev.source]}${reel ? ` · ${whoOf(reel)}` : ''}` : '', p?.note].filter(Boolean).join(' · ');
  };
  // How full each day is, against the places a day holds at this pace.
  const room = answers.pace === 'relaxed' ? 3 : answers.pace === 'balanced' ? 4 : 6;
  const changed = new Set(plan.days.flatMap((d, i) => (d.stops.some((s) => s.placeId && marks[s.placeId]) ? [i] : [])));
  // A day with nowhere to go (the last morning) still shows the trip's places, quietly, so the map stays put.
  const pins = dayPins(day, marks);
  const mapPins = pins.length ? pins : plan.days.flatMap((d) => dayPins(d)).map((p) => ({ ...p, label: undefined, color: colors.inkFaint }));
  const voting = group && answers.maybes === 'group';
  return <Screen key="step-3" gap={20} footer={<AskBar placeholder="Ask AI to change anything…" asks={suggestionsFor(plan, answers)} busy={busy === 'editing'}
    onSend={(t) => void ask(t)} cta={{ label: 'Create', onPress: save }} {...noticeProps} />}>
    {top('Your days')}
    <Heading title={`${plural(answers.days, 'day')} in ${city}`}
      sub={`${dateRange(answers.start, isoAdd(answers.start, answers.days - 1))} · ${plural(placedCount, 'place')} · ${answers.pace === 'packed' ? 'see it all' : answers.pace}${answers.food === 'veg' || answers.food === 'jain' ? ` · ${answers.food === 'jain' ? 'Jain' : 'veg'} food` : ''}`} />
    {/* The map and the days as one mosaic: tap a day, the map glides to it. */}
    <View style={{ gap: 2 }}>
      <PlanMap pins={mapPins} route={pins.length > 1} height={220} flush label={`Map of day ${di + 1}`} />
      <DayStrip value={di} onChange={setDayShown} days={plan.days.map((d, i) => {
        const n = d.stops.filter((s) => s.placeId).length;
        return { date: d.date, stops: n, load: n / room, full: plan.overfull.includes(i), changed: changed.has(i) };
      })} />
    </View>
    <DayView day={day} index={di} tz={tz} city={answers.destination} sourceOf={sourceOf} onStop={stopActions} marks={marks}
      extra={plan.overfull.includes(di) ? <PressScale accessibilityRole="button" accessibilityHint="Asks AI to make this day lighter" disabled={!!busy} onPress={() => void ask(`Make day ${di + 1} lighter`)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
        <View style={{ width: 3, height: 11, backgroundColor: colors.accent }} />
        <T v="small" color={colors.ink}>A packed day.</T>
        <T v="small" color={colors.sand} style={{ textDecorationLine: 'underline', textDecorationColor: colors.sand }}>Lighten it</T>
      </PressScale> : undefined} />
    {plan.unplaced.length ? <View style={{ gap: 12, paddingTop: 6 }}>
      <Label text={voting ? `For the group to vote on · ${plan.unplaced.length}` : `Didn’t fit · ${plan.unplaced.length}`}
        action={voting ? undefined : 'Add a day'} onAction={() => set('days', Math.min(21, answers.days + 1))} />
      <Chips>{plan.unplaced.map((p) => <PlaceChip key={p.id} title={p.title} icon={KIND_ICON[p.kind]} color={colors.inkMuted} state="maybe"
        onPress={() => Alert.alert(p.title, p.pick === 'maybe' && voting ? 'On the shortlist: the group votes on it.' : 'There’s no room for it at this pace.', [
          ...(p.pick !== 'must' ? [{ text: 'Make it a must-do', onPress: () => setPick(p.id, 'must') }] : []),
          { text: 'Leave it out', style: 'destructive' as const, onPress: () => setPick(p.id, 'skip') },
          { text: 'Cancel', style: 'cancel' as const },
        ])} />)}</Chips>
    </View> : null}
    {chosen.length ? <Chips>{chosen.map((r) => <PressScale key={r.id} accessibilityRole="link" onPress={() => void Linking.openURL(r.url)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 9, borderRadius: radii.check }}>
      <GlassFill kind="control" radius={radii.check} sheen={false} />
      <Icon name={PLATFORM_ICON[r.platform]} size={13} color={colors.inkMuted} /><T v="meta">{whoOf(r) || PLATFORM_LABEL[r.platform]}</T></PressScale>)}</Chips> : null}
  </Screen>;
}
