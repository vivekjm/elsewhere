/**
 * The Plan tab: where trips are planned, with AI. Say where, when and who (and anything you already want to do),
 * and plan mode takes it from there: AI finds the places with you, drafts the days, and changes anything you ask.
 * Plans in progress pick up where they were; trips you already have keep being planned on their board (with
 * friends); reels and posts you've saved are extra context, not the starting point.
 */
import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { track } from '../core/analytics';
import { useRouter } from '../core/nav';
import { useSelection, useTrips } from '../core/state';
import { useExtras } from '../data';
import { dateRange, plural } from '../domain/format';
import { reelLink, type Reel } from '../domain/reels';
import { upcomingTrips } from '../domain/trips';
import { addToInbox, byDestination, useInbox } from '../services/reelInbox';
import { removeDraft, useDrafts, type PlanDraft } from '../services/planDrafts';
import { colors, GlassFill, Icon, PressScale, radii, Screen, T } from '../loom';
import { AssistPanel, BigInput, Dot, Emph, Label, Lines, Tile } from './planui';
import { EXAMPLES, STARTERS } from './planmode';

const STEP_LABEL = ['Started', 'Picking places', 'Shaping the trip', 'Days drafted'];

/** "2 min ago", "yesterday", "12 Oct". */
function ago(iso: string, now = Date.now()): string {
  const min = Math.round((now - Date.parse(iso)) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  if (h < 48) return 'yesterday';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

const who = (r: Reel) => (r.handle ? `@${r.handle}` : r.author || r.platform);

export function PlanHubScreen() {
  const router = useRouter();
  const drafts = useDrafts();
  const { reels } = useInbox();
  const { trips } = useTrips();
  const { select } = useSelection();
  const store = useExtras();
  const [text, setText] = useState('');
  const [context, setContext] = useState<string[]>([]);
  const [pasting, setPasting] = useState(false);
  useEffect(() => { track('plan_hub_opened', { drafts: drafts.length, reels: reels.length }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saved = byDestination(reels).filter((g) => g.name !== 'Couldn’t read');
  const picked = context.map((id) => reels.find((r) => r.id === id)).filter((r): r is Reel => !!r);
  const upcoming = upcomingTrips(trips).slice(0, 4);

  const start = () => {
    if (!text.trim() && !picked.length) { Alert.alert('Where to?', 'Say where you’re going (and anything you have in mind), or add a reel for context.'); return; }
    const q = [`go=1`, text.trim() ? `prompt=${encodeURIComponent(text.trim())}` : '', picked.length ? `reels=${picked.map((r) => r.id).join(',')}` : ''].filter(Boolean).join('&');
    router.push(`/plan-mode?${q}` as never);
    setText('');
    setContext([]);
  };
  const paste = async () => {
    const clip = (await Clipboard.getStringAsync()).slice(0, 4000);
    if (!reelLink(clip)) { Alert.alert('Nothing to add', 'Copy a reel, post or Google Maps link first (Share → Copy link), then tap here.'); return; }
    setPasting(true);
    try { const id = await addToInbox(clip); if (id) setContext((c) => (c.includes(id) ? c : [...c, id])); } finally { setPasting(false); }
  };
  const discard = (d: PlanDraft) => Alert.alert(`Discard “${d.title}”?`, 'This plan in progress is deleted from this phone.', [
    { text: 'Keep', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => removeDraft(d.id) },
  ]);

  return <Screen bar="tabs" gap={20}>
    <T v="display" style={{ paddingTop: 8 }}>Plan</T>

    {/* AI's live panel and the composer, touching: one pane to start a trip from. */}
    <View style={{ gap: 2 }}>
      <AssistPanel ideas={!text.trim() && !picked.length ? STARTERS : undefined} onIdea={(s) => setText(`${s} `)}
        attach={pasting ? 'Adding…' : 'Add a reel or link'} onAttach={() => void paste()}>
        {'Tell me '}<Emph>where</Emph>{', '}<Emph>when</Emph>{' and '}<Emph>who</Emph>{'. I’ll find the places with you and draft the days.'}
      </AssistPanel>
      <BigInput value={text} onChangeText={setText} placeholder="e.g. 4 days in Goa with friends in December" examples={EXAMPLES}
        bar={<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <T v="meta" color={colors.inkFaint} style={{ flex: 1, paddingLeft: 4 }}>{picked.length ? `With ${picked.length === 1 ? '1 reel' : `${picked.length} reels`} for context` : 'Reels and links are optional'}</T>
          <PressScale accessibilityRole="button" onPress={start} style={{ height: 40, paddingHorizontal: 16, borderRadius: radii.chip, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <GlassFill kind="khaki" radius={radii.chip} />
            <Icon name="sparkle" size={15} /><T v="row" style={{ fontSize: 15 }}>Plan it</T>
          </PressScale>
        </View>} />
    </View>
    {picked.length ? <Tile style={{ paddingVertical: 0 }}><Lines>{picked.map((r) => <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
      <Icon name={r.platform === 'web' ? 'link' : 'camera'} size={15} color={colors.inkMuted} />
      <T v="small" lines={1} style={{ flex: 1 }}>{`${who(r)}${r.caption || r.title ? ` · ${(r.caption || r.title).slice(0, 60)}` : ''}`}</T>
      <PressScale accessibilityRole="button" accessibilityLabel={`Remove ${who(r)}’s post`} hitSlop={10} onPress={() => setContext((c) => c.filter((x) => x !== r.id))}>
        <Icon name="x" size={15} color={colors.inkFaint} /></PressScale>
    </View>)}</Lines></Tile> : null}

    {drafts.length ? <View style={{ gap: 10 }}>
      <Label text="Plans in progress" />
      <Tile style={{ paddingVertical: 0 }}><Lines inset={46}>{drafts.slice(0, 6).map((d) => <PressScale key={d.id} accessibilityRole="button" onPress={() => router.push(`/plan-mode?draft=${d.id}` as never)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
        <Dot icon={d.trek ? 'mountain' : 'sparkle'} tint="grey" color={d.trek ? colors.ink : colors.sand} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="row" style={{ fontSize: 15 }}>{d.title}</T>
          <T v="meta">{[d.trek ? (d.step >= 3 ? 'Trek drafted' : 'Route drafted') : STEP_LABEL[d.step] ?? 'Started', !d.trek && d.places.filter((p) => p.pick !== 'skip').length ? plural(d.places.filter((p) => p.pick !== 'skip').length, 'place') : '', ago(d.updatedAt)].filter(Boolean).join(' · ')}</T>
        </View>
        <PressScale accessibilityRole="button" accessibilityLabel={`Discard ${d.title}`} hitSlop={10} onPress={() => discard(d)}><Icon name="x" size={16} color={colors.inkFaint} /></PressScale>
      </PressScale>)}</Lines></Tile>
    </View> : null}

    {upcoming.length ? <View style={{ gap: 10 }}>
      <Label text="Keep planning your trips" />
      <Tile style={{ paddingVertical: 0 }}><Lines inset={46}>{upcoming.map((t) => {
        const x = store.get(t.id);
        const together = x.members.length > 1 || x.people.length > 0;
        return <PressScale key={t.id} accessibilityRole="button" onPress={() => { select(t.id); router.push('/plan' as never); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
          <Dot icon={together ? 'shared' : 'trips'} tint="grey" color={colors.ink} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="row" style={{ fontSize: 15 }}>{t.name}</T>
            <T v="meta">{[dateRange(t.start, t.end), x.shortlist.length ? plural(x.shortlist.length, 'idea') : '', together ? 'with friends' : ''].filter(Boolean).join(' · ')}</T>
          </View>
          <Icon name="chev" size={16} color={colors.inkFaint} />
        </PressScale>;
      })}</Lines></Tile>
    </View> : null}

    {saved.length ? <View style={{ gap: 10 }}>
      <Label text="Saved reels" />
      <Tile style={{ paddingVertical: 0 }}><Lines inset={46}>{saved.slice(0, 5).map((g) => {
        const on = g.reels.every((r) => context.includes(r.id));
        return <PressScale key={g.name} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}
          onPress={() => {
            setContext((c) => (on ? c.filter((id) => !g.reels.some((r) => r.id === id)) : [...new Set([...c, ...g.reels.map((r) => r.id)])]));
            if (!on && !text.trim()) setText(`${g.name} `);
          }}>
          <Dot icon="camera" tint="grey" color={colors.ink} />
          <View style={{ flex: 1, gap: 2 }}><T v="row" style={{ fontSize: 15 }}>{g.name}</T><T v="meta">{plural(g.reels.length, 'reel')}</T></View>
          <T v="small" color={on ? colors.success : colors.ink}>{on ? 'Added' : 'Use'}</T>
        </PressScale>;
      })}</Lines></Tile>
      <T v="meta" color={colors.inkFaint}>Share a reel from Instagram, YouTube or TikTok to Trips Loom and it waits here.</T>
    </View> : null}
  </Screen>;
}
