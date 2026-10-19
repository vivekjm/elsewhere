/**
 * The planning screens' building blocks, in the 3.0 look: frosted glass over the trip's photo, tiles that touch
 * instead of floating cards, khaki for what's live (AI's panel, the next step), sand for the words AI suggested,
 * and orange only as a mark. One idea per screen, one primary action, and AI as one place to type at the bottom.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, LayoutAnimation, Platform, ScrollView, StyleSheet, Text, TextInput, UIManager, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedKeyboard, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors, fonts, GlassFill, haptic, Icon, PressScale, radii, StepMarks, T, tints, useAtEdge, type GlassKind, type IconName } from '../loom';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
const soft = () => LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));

/* ------------------------------------------------------------------ keys and links */

/** A square glass key with one icon (40pt, 44pt to touch). */
export function Key({ icon, label, onPress, kind = 'control', size = 40, color = colors.ink, disabled }: {
  icon: IconName; label: string; onPress?: () => void; kind?: GlassKind; size?: number; color?: string; disabled?: boolean;
}) {
  const radius = useAtEdge() ? size / 2 : radii.chip;
  return <PressScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} hitSlop={Math.max(0, (44 - size) / 2)} onPress={onPress}
    style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
    <GlassFill kind={kind} radius={radius} sheen={kind === 'khaki'} />
    <Icon name={icon} size={size >= 40 ? 19 : 16} color={color} />
  </PressScale>;
}

/** Words that act: underlined faintly (sand when it's an AI action). */
export function Link({ text, onPress, ai, hint }: { text: string; onPress?: () => void; ai?: boolean; hint?: string }) {
  return <PressScale accessibilityRole="button" accessibilityHint={hint} hitSlop={12} onPress={onPress}>
    <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.regular, fontSize: 13, color: ai ? colors.sand : colors.ink, textDecorationLine: 'underline', textDecorationColor: ai ? colors.sand : colors.hairlineStrong }}>{text}</Text>
  </PressScale>;
}

/** A word that matters inside a light sentence. */
export const Emph = ({ children }: { children: React.ReactNode }) => <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>{children}</Text>;

/* ------------------------------------------------------------------ the top of each step */

/** Back (or close) as a glass key, and where you are as step marks: done in ink, now long and orange. */
export function PlanTop({ step, total, title, onBack, close, right }: { step: number; total: number; title: string; onBack: () => void; close?: boolean; right?: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 12 }}>
    <Key icon={close ? 'x' : 'back'} label={close ? 'Close' : 'Back'} onPress={onBack} />
    <View style={{ flex: 1, alignItems: 'center' }}><StepMarks n={step + 1} total={total} label={title} /></View>
    <View style={{ width: 40, alignItems: 'center' }}>{right}</View>
  </View>;
}

/** A page's top: back and its name. */
export function PageTop({ title, onBack }: { title: string; onBack: () => void }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 12 }}>
    <Key icon="back" label="Back" onPress={onBack} />
    <T v="row" center lines={1} style={{ flex: 1 }}>{title}</T>
    <View style={{ width: 40 }} />
  </View>;
}

/** The screen's one big line, light and large, and what it's for. */
export function Heading({ title, sub, eyebrow }: { title: string; sub?: string; eyebrow?: string }) {
  return <View style={{ gap: 6 }}>
    {eyebrow ? <T v="small">{eyebrow}</T> : null}
    <T v="display">{title}</T>
    {sub ? <T v="small">{sub}</T> : null}
  </View>;
}

/** A section's name as GymSync writes it ("Your places: · 3"), and an optional action. */
export function Label({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  const [name, ...rest] = text.split(' · ');
  return <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
    <Text maxFontSizeMultiplier={1.4} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.inkMuted }}>
      {/[:?]$/.test(name) ? name : `${name}:`}{rest.length ? <Text style={{ color: colors.inkFaint }}>{` · ${rest.join(' · ')}`}</Text> : null}
    </Text>
    {action ? <Link text={action} onPress={onAction} /> : null}
  </View>;
}

export const Hair = ({ inset = 0 }: { inset?: number }) => <View style={{ height: 1, backgroundColor: colors.hairline, marginLeft: inset }} />;

/** Items one under another, with a hairline between. */
export function Lines({ children, inset = 0 }: { children: React.ReactNode; inset?: number }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return <View>{items.map((c, i) => <View key={React.isValidElement(c) && c.key !== null ? c.key : i}>{i ? <Hair inset={inset} /> : null}{c}</View>)}</View>;
}

/** A frosted tile: the panes that make up a screen. `kind="khaki"` is the one live thing. */
export function Tile({ children, kind = 'surface', style, label, action, onAction }: {
  children?: React.ReactNode; kind?: GlassKind; style?: StyleProp<ViewStyle>; label?: string; action?: string; onAction?: () => void;
}) {
  return <View style={[{ padding: 16, gap: 12, borderRadius: radii.card }, style]}>
    <GlassFill kind={kind} radius={radii.card} />
    {label ? <Label text={label} action={action} onAction={onAction} /> : null}
    {children}
  </View>;
}

/** A line from AI that matters (a correction, a warning): a small khaki square with its mark, then the words. */
export function AiLine({ text, tone = 'ai' }: { text: string; tone?: 'ai' | 'warn' }) {
  const warn = tone === 'warn';
  return <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
    <View style={{ width: 22, height: 22, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: warn ? 'rgba(255, 154, 168, 0.14)' : colors.khaki }}>
      <Icon name={warn ? 'shield' : 'sparkle'} size={13} color={warn ? colors.danger : colors.ink} />
    </View>
    <T v="small" color={warn ? colors.danger : colors.ink} style={{ flex: 1, lineHeight: 19, paddingTop: 1 }}>{text}</T>
  </View>;
}

/* ------------------------------------------------------------------ AI's panel */

/**
 * AI's live panel, in khaki glass like GymSync's live training: what it needs from you in one light sentence,
 * ideas to start from, and a way to add a reel or link.
 */
export function AssistPanel({ title = 'Live planning', children, ideas, onIdea, attach, onAttach }: {
  title?: string; children: React.ReactNode; ideas?: string[]; onIdea?: (s: string) => void; attach?: string; onAttach?: () => void;
}) {
  return <View style={{ padding: 16, gap: 16, borderRadius: radii.card, minHeight: 230 }}>
    <GlassFill kind="khaki" radius={radii.card} />
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 26, height: 26, borderRadius: radii.chip, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center' }}><Icon name="bolt" size={14} /></View>
      <T v="row" style={{ flex: 1 }}>{title}</T>
    </View>
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.light, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: colors.ink }}>{children}</Text>
    </View>
    {ideas?.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {ideas.map((s) => <PressScale key={s} accessibilityRole="button" accessibilityHint="Starts the sentence with this" onPress={() => { haptic.select(); onIdea?.(s); }}
        style={{ height: 32, paddingHorizontal: 11, borderRadius: radii.chip, borderWidth: 1, borderColor: colors.khakiRule, justifyContent: 'center' }}>
        <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.ink }}>{s}</Text>
      </PressScale>)}
    </View> : null}
    {attach ? <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.khakiRule }}>
      <PressScale accessibilityRole="button" onPress={onAttach} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' }}>
        <View style={{ width: 36, height: 36, borderRadius: radii.chip, backgroundColor: colors.khakiDeep, borderWidth: 1, borderColor: colors.khakiRule, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="link" size={17} />
        </View>
        <T v="small" color={colors.ink}>{attach}</T>
      </PressScale>
    </View> : null}
  </View>;
}

/* ------------------------------------------------------------------ inputs */

/** Example sentences typed out one after another, while the field is empty (still, with reduced motion). */
function useTypedExamples(lines: string[] | undefined, on: boolean): string {
  const still = useReducedMotion();
  const [text, setText] = useState(lines?.[0] ?? '');
  useEffect(() => {
    if (!lines?.length || !on || still) { setText(lines?.[0] ?? ''); return; }
    let line = 0, n = 0, wait = 0, back = false;
    const t = setInterval(() => {
      const full = lines[line % lines.length];
      if (wait > 0) { wait -= 1; return; }
      if (!back) { n += 1; if (n >= full.length) { back = true; wait = 34; } }
      else { n -= 3; if (n <= 0) { back = false; n = 0; line += 1; wait = 6; } }
      setText(full.slice(0, Math.max(0, n)));
    }, 50);
    return () => clearInterval(t);
  }, [lines, on, still]);
  return text;
}

/** The composer: a raised glass pane to write the trip in. While it's empty, examples type themselves out. */
export function BigInput({ value, onChangeText, placeholder, autoFocus, examples, bar }: {
  value: string; onChangeText: (t: string) => void; placeholder: string; autoFocus?: boolean; examples?: string[];
  /** Under the text, inside the pane: keys such as Send. */
  bar?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const typing = useTypedExamples(examples, !value && !focused);
  return <View style={{ padding: 12, gap: 8, borderRadius: radii.card }}>
    <GlassFill kind="raised" radius={radii.card} />
    {focused ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radii.card, borderWidth: 1, borderColor: colors.border }]} /> : null}
    <TextInput value={value} onChangeText={onChangeText} placeholder={examples && !focused ? `${typing}${typing ? '|' : ''}` : placeholder} placeholderTextColor={colors.inkFaint} multiline autoFocus={autoFocus}
      autoCorrect={false} spellCheck={false} maxLength={1500} accessibilityLabel="Where, and what you have in mind" accessibilityHint={placeholder} maxFontSizeMultiplier={1.5}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} selectionColor={colors.accent} keyboardAppearance="dark"
      style={{ fontFamily: fonts.light, fontSize: 20, lineHeight: 27, color: colors.ink, minHeight: 82, padding: 4, paddingTop: 4, textAlignVertical: 'top', letterSpacing: -0.2 }} />
    {bar}
  </View>;
}

/** A one-line field in dark glass, with an icon. */
export function LineInput({ value, onChangeText, placeholder, onSubmit, icon = 'plus', busy, label }: {
  value: string; onChangeText: (t: string) => void; placeholder: string; onSubmit: (t: string) => void; icon?: IconName; busy?: boolean; label: string;
}) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: radii.field }}>
    <GlassFill kind="control" radius={radii.field} sheen={false} />
    <Icon name={icon} size={18} color={colors.inkMuted} />
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.inkFaint} returnKeyType="done" autoCorrect={false} spellCheck={false}
      accessibilityLabel={label} maxFontSizeMultiplier={1.6} onSubmitEditing={(e) => onSubmit(e.nativeEvent.text)} selectionColor={colors.accent} keyboardAppearance="dark"
      style={{ flex: 1, fontFamily: fonts.light, fontSize: 15, color: colors.ink, paddingVertical: 12 }} />
    {busy ? <ActivityIndicator color={colors.ink} /> : null}
  </View>;
}

/** Choices as a segmented bar of dark glass: the chosen one raised. */
export function Choices<V extends string>({ options, value, onChange }: { options: [V, string][]; value: V; onChange: (v: V) => void }) {
  return <View style={{ flexDirection: 'row', padding: 3, gap: 2, borderRadius: radii.card }}>
    <GlassFill kind="control" radius={radii.card} sheen={false} />
    {options.map(([k, label]) => {
      const on = k === value;
      return <PressScale key={k} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { if (!on) haptic.select(); onChange(k); }}
        style={{ flex: 1, minHeight: 38, paddingHorizontal: 6, paddingVertical: 4, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center',
          backgroundColor: on ? colors.surfaceRaised : 'transparent', borderWidth: on ? 1 : 0, borderColor: colors.hairline }}>
        <Text maxFontSizeMultiplier={1.4} numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', color: on ? colors.ink : colors.inkFaint }}>{label}</Text>
      </PressScale>;
    })}
  </View>;
}

/** A number between − and + keys: a thin numeral with its unit. */
export function Count({ value, min, max, onChange, unit }: { value: number; min: number; max: number; onChange: (n: number) => void; unit: [string, string] }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
    <Key icon="minus" label={`Fewer ${unit[1]}`} disabled={value <= min} onPress={() => { haptic.select(); onChange(value - 1); }} />
    <View accessible accessibilityLiveRegion="polite" style={{ minWidth: 76, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5 }}>
      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.light, fontSize: 26, color: colors.ink, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkMuted }}>{value === 1 ? unit[0] : unit[1]}</Text>
    </View>
    <Key icon="plus" label={`More ${unit[1]}`} disabled={value >= max} onPress={() => { haptic.select(); onChange(value + 1); }} />
  </View>;
}

/* ------------------------------------------------------------------ the trip, as one sentence */

/**
 * A word in the trip's sentence you can tap to change: ink and underlined when you said it, sand and dotted when AI
 * suggested it, on raised glass while it's open. Used inside a <Text>.
 */
export function Blank({ text, source, active, onPress, label }: { text: string; source: 'you' | 'ai' | null; active: boolean; onPress?: () => void; label: string }) {
  const ai = source === 'ai';
  return <Text accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${label}: ${text}${ai ? ', suggested by AI' : ''}`} accessibilityState={{ expanded: active }}
    suppressHighlighting onPress={onPress ? () => { haptic.select(); soft(); onPress(); } : undefined}
    style={{ fontFamily: fonts.medium, color: ai ? colors.sand : colors.ink, textDecorationLine: onPress ? 'underline' : 'none', textDecorationStyle: ai ? 'dotted' : 'solid',
      textDecorationColor: ai ? colors.sand : colors.border, backgroundColor: active ? colors.surfaceRaised : 'transparent' }}>{text}</Text>;
}

/** What opens for the tapped word: a tile with its name, its controls, and why AI suggested it. */
export function BlankEditor({ title, why, onDone, children }: { title: string; why?: string; onDone: () => void; children?: React.ReactNode }) {
  return <Animated.View entering={FadeInDown.duration(220)}>
    <Tile label={title} action="Done" onAction={() => { soft(); onDone(); }} style={{ gap: 14 }}>
      {children}
      {why ? <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ paddingTop: 2 }}><Icon name="sparkle" size={13} color={colors.sand} /></View><T v="small" style={{ flex: 1 }}>{why}</T></View> : null}
    </Tile>
  </Animated.View>;
}

/* ------------------------------------------------------------------ places */

/** A small square with a place's icon in its kind's colour. */
export function Dot({ icon, tint, color }: { icon: IconName; tint: keyof typeof tints; color?: string }) {
  return <View style={{ width: 34, height: 34, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: tints[tint].bg }}>
    <Icon name={icon} size={16} color={color ?? tints[tint].fg} />
  </View>;
}

/** A suggestion to add: name, why, and an Add key. */
export function Suggestion({ title, meta, onAdd }: { title: string; meta: string; onAdd: () => void }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
    <View style={{ flex: 1, gap: 2 }}>
      <T v="row" style={{ fontSize: 15 }}>{title}</T>
      {meta ? <T v="meta" lines={2}>{meta}</T> : null}
    </View>
    <PressScale accessibilityRole="button" accessibilityLabel={`Add ${title}`} hitSlop={8} onPress={() => { haptic.select(); soft(); onAdd(); }}
      style={{ height: 32, paddingHorizontal: 11, borderRadius: radii.chip, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <GlassFill kind="control" radius={radii.chip} sheen={false} />
      <Icon name="plus" size={14} /><T v="small" color={colors.ink}>Add</T>
    </PressScale>
  </View>;
}

/** Places as chips, wrapping onto as many lines as they need. */
export function Chips({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>;
}

/**
 * A place as a chip. `must`: raised glass with its kind's mark; `maybe`: a dashed outline; `skip`: struck through;
 * `idea` (AI's pick, not added yet): dashed sand with a +, tap to add.
 */
export function PlaceChip({ title, icon, color, state, onPress, onLongPress, hint }: {
  title: string; icon: IconName; color: string; state: 'must' | 'maybe' | 'skip' | 'idea'; onPress: () => void; onLongPress?: () => void; hint?: string;
}) {
  const idea = state === 'idea', skip = state === 'skip', maybe = state === 'maybe';
  const label = { must: 'must-do', maybe: 'maybe', skip: 'skipped', idea: 'suggested by AI, tap to add' }[state];
  const ink = idea ? colors.sand : maybe ? colors.inkMuted : skip ? colors.inkFaint : colors.ink;
  return <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
    <PressScale accessibilityRole="button" accessibilityLabel={`${title}, ${label}`} accessibilityHint={hint} onPress={() => { haptic.select(); soft(); onPress(); }} onLongPress={onLongPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingLeft: 10, paddingRight: 12, borderRadius: radii.chip,
        borderWidth: idea || maybe ? 1 : 0, borderStyle: 'dashed', borderColor: idea ? colors.sand : colors.border }}>
      {state === 'must' ? <GlassFill kind="raised" radius={radii.chip} sheen={false} /> : null}
      <Icon name={idea ? 'plus' : icon} size={15} color={idea ? colors.sand : skip ? colors.inkFaint : color} />
      <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.regular, fontSize: 14, color: ink, textDecorationLine: skip ? 'line-through' : 'none' }}>{title}</Text>
    </PressScale>
  </Animated.View>;
}

/* ------------------------------------------------------------------ AI, as one place to type */

export type ChatTurn = { id: string; role: 'you' | 'ai' | 'quick'; text: string; changes?: string[]; canUndo?: boolean };

/** What AI is doing or just did, shown above the place to ask: what you asked, its reply, what changed, and Undo. */
export type Notice = { you?: string; text: string; changes?: string[]; canUndo?: boolean; busy?: boolean };

function NoticeView({ n, onUndo, onClose }: { n: Notice; onUndo?: () => void; onClose?: () => void }) {
  return <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(140)} accessibilityLiveRegion="polite"
    style={{ flexDirection: 'row', gap: 12, padding: 12, borderRadius: radii.card }}>
    <GlassFill kind="raised" radius={radii.card} />
    <View style={{ width: 26, height: 26, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: n.busy ? colors.controlGlass : colors.khaki }}>
      {n.busy ? <ActivityIndicator size="small" color={colors.sand} /> : <Icon name="sparkle" size={15} />}
    </View>
    <View style={{ flex: 1, gap: 4 }}>
      {n.you ? <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.light, fontSize: 12, color: colors.inkMuted }}>{`“${n.you}”`}</Text> : null}
      <Text numberOfLines={3} maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.ink }}>{n.text}</Text>
      {n.changes?.length ? <View style={{ gap: 2 }}>{n.changes.slice(0, 3).map((c) => <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="check" size={12} color={colors.success} strokeWidth={2} />
        <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={{ flex: 1, fontFamily: fonts.light, fontSize: 12, color: colors.inkMuted }}>{c}</Text>
      </View>)}</View> : null}
    </View>
    {n.busy ? null : <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
      <PressScale accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={() => { soft(); onClose?.(); }}><Icon name="x" size={15} color={colors.inkFaint} /></PressScale>
      {n.canUndo ? <Link text="Undo" ai hint="Puts the plan back as it was" onPress={() => { haptic.select(); onUndo?.(); }} /> : null}
    </View>}
  </Animated.View>;
}

/** Ideas to ask AI for, as sand chips you can tap. */
export function Asks({ items, onAsk }: { items: { label: string; message: string }[]; onAsk: (m: string) => void }) {
  if (!items.length) return null;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -16, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
    {items.map((s) => <PressScale key={s.label} accessibilityRole="button" accessibilityHint="Asks AI to change the plan" onPress={() => { haptic.select(); onAsk(s.message); }}
      style={{ height: 32, paddingHorizontal: 11, borderRadius: radii.chip, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.sand, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name="sparkle" size={13} color={colors.sand} /><T v="small" color={colors.sand}>{s.label}</T>
    </PressScale>)}
  </ScrollView>;
}

/**
 * The bottom of a planning step with AI: one place to ask for any change (with Send as a khaki key once there's
 * something to send), the next step beside it, and ideas or AI's notice above. Along the bottom edge both are
 * capsules, following the phone's rounded corners. It rides up with the keyboard.
 */
export function AskBar({ placeholder, onSend, busy, cta, asks, notice, onUndo, onClose }: {
  placeholder: string; onSend: (t: string) => void; busy: boolean; cta: { label: string; onPress: () => void }; asks?: { label: string; message: string }[];
  notice?: Notice | null; onUndo?: () => void; onClose?: () => void;
}) {
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const insets = useSafeAreaInsets();
  const kb = useAnimatedKeyboard();
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.max(0, kb.height.value - insets.bottom - 4) }] }));
  const send = () => { const t = text.trim(); if (!t || busy) return; haptic.select(); Keyboard.dismiss(); onSend(t); setText(''); };
  const ready = text.trim().length > 0 && !busy;
  return <Animated.View style={[{ gap: 10, marginHorizontal: -16, paddingHorizontal: 12, paddingTop: 10 }, lift]}>
    {/* The frost reaches down past the bar, so the page doesn't show under it when it rides up with the keyboard. */}
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: -160 }}>
      <GlassFill kind="sheet" radius={0} edge={false} sheen={false} />
      <View style={{ height: 1, backgroundColor: colors.hairline }} />
    </View>
    {notice ? <NoticeView n={notice} onUndo={onUndo} onClose={onClose} />
      : asks?.length && typing && !busy ? <Animated.View entering={FadeIn.duration(180)}><Asks items={asks} onAsk={(m) => { Keyboard.dismiss(); onSend(m); }} /></Animated.View> : null}
    <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 6 }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingLeft: 16, paddingRight: 4, borderRadius: 24 }}>
        <GlassFill kind="raised" radius={24} sheen={false} />
        <Icon name="sparkle" size={15} color={colors.sand} />
        <TextInput value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor={colors.inkFaint} editable={!busy} returnKeyType="send" onSubmitEditing={send}
          autoCorrect={false} spellCheck={false} accessibilityLabel="Ask AI to change the plan" maxFontSizeMultiplier={1.5} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)}
          selectionColor={colors.accent} keyboardAppearance="dark"
          style={{ flex: 1, fontFamily: fonts.light, fontSize: 15, color: colors.ink, paddingVertical: 10 }} />
        {busy ? <View style={{ width: 40, alignItems: 'center' }}><ActivityIndicator color={colors.sand} size="small" /></View>
          : <Key icon="arrowUp" label="Send" kind={ready ? 'khaki' : 'control'} color={ready ? colors.ink : colors.inkFaint} disabled={!ready} onPress={send} />}
      </View>
      <PressScale accessibilityRole="button" onPress={cta.onPress} style={{ minHeight: 48, paddingHorizontal: 20, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
        <GlassFill kind="khaki" radius={24} />
        <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.ink }}>{cta.label}</Text>
      </PressScale>
    </View>
  </Animated.View>;
}

/** The step's one action: a full-width khaki key. */
export function NextBar({ label, onPress, busy, disabled, note, icon }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; note?: string; icon?: IconName }) {
  // It sits along the bottom edge: a capsule that follows the phone's rounded corners.
  const radius = useAtEdge() ? 26 : radii.button;
  return <View style={{ gap: 10, paddingTop: 4 }}>
    {note ? <T v="meta" center color={colors.inkFaint}>{note}</T> : null}
    <PressScale accessibilityRole="button" accessibilityState={{ disabled: !!disabled, busy: !!busy }} disabled={disabled || busy} onPress={onPress}
      style={{ height: 52, borderRadius: radius, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: disabled ? 0.45 : 1 }}>
      <GlassFill kind="khaki" radius={radius} />
      {busy ? <ActivityIndicator color={colors.ink} /> : icon ? <Icon name={icon} size={17} /> : null}
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.ink }}>{label}</Text>
    </PressScale>
  </View>;
}

/* ------------------------------------------------------------------ days */

const shortDate = (iso: string) => new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

/**
 * The days as tiles that touch: the day's number thin and large, its date, and a 2pt bar for how full it is (orange
 * when it's too full). The chosen day is khaki; a sand square marks a day AI just changed.
 */
export function DayStrip({ days, value, onChange }: { days: { date: string; load: number; full?: boolean; changed?: boolean; stops: number }[]; value: number; onChange: (i: number) => void }) {
  const few = days.length <= 5;
  return <ScrollView horizontal scrollEnabled={!few} showsHorizontalScrollIndicator={false} style={few ? { flexGrow: 0 } : { flexGrow: 0, marginHorizontal: -16 }}
    contentContainerStyle={few ? { flexGrow: 1, gap: 2 } : { paddingHorizontal: 16, gap: 2 }}>
    {days.map((d, i) => {
      const on = i === value;
      return <PressScale key={i} accessibilityRole="tab" accessibilityState={{ selected: on }}
        accessibilityLabel={`Day ${i + 1}, ${shortDate(d.date)}, ${d.stops === 1 ? '1 place' : `${d.stops} places`}${d.full ? ', too full' : ''}${d.changed ? ', just changed' : ''}`}
        onPress={() => { if (!on) { haptic.select(); onChange(i); } }} style={[{ minWidth: 64, padding: 10, gap: 6, borderRadius: radii.chip }, few ? { flex: 1 } : null]}>
        <GlassFill kind={on ? 'khaki' : 'surface'} radius={radii.chip} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
          <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.light, fontSize: 22, lineHeight: 26, color: colors.ink, fontVariant: ['tabular-nums'] }}>{i + 1}</Text>
          {d.changed ? <View style={{ width: 6, height: 6, marginTop: 4, backgroundColor: colors.sand }} /> : null}
        </View>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={{ fontFamily: fonts.light, fontSize: 11, color: on ? colors.ink : colors.inkMuted }}>{shortDate(d.date)}</Text>
        <View style={{ height: 2, backgroundColor: on ? colors.khakiRule : colors.track, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(1, d.load) * 100}%`, height: 2, backgroundColor: d.full ? colors.accent : on ? colors.ink : colors.inkFaint }} />
        </View>
      </PressScale>;
    })}
  </ScrollView>;
}

/**
 * A stop on the day's line: time, a mark on the line (a numbered square in its kind's colour for a place, matching
 * its pin on the map; a small hollow square for meals and arrival), what and why. `travel`: how far it is from the
 * stop before, on the line above it. `badge`: what just happened to it ("New", "Moved here").
 */
export function TimelineStop({ time, title, meta, color, n, first, last, onPress, muted, travel, badge }: {
  time: string; title: string; meta?: string; color: string; n?: number; first?: boolean; last?: boolean; onPress?: () => void; muted?: boolean; travel?: string; badge?: string;
}) {
  const line = { position: 'absolute' as const, width: 1, backgroundColor: colors.hairlineStrong };
  const body = <View>
    {travel ? <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 42 }} />
      <View style={{ width: 24, alignItems: 'center' }}><View style={[line, { top: 0, bottom: 0 }]} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingBottom: 12 }}>
        <Icon name={/^Nearby|^[1-9] min|^1[0-5] min/.test(travel) ? 'walk' : 'clock'} size={12} color={colors.inkFaint} />
        <T v="meta" color={colors.inkFaint}>{travel}</T>
      </View>
    </View> : null}
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <T v="small" style={{ width: 42, paddingTop: n ? 3 : 1, fontVariant: ['tabular-nums'], color: muted ? colors.inkFaint : colors.ink }}>{time}</T>
      <View style={{ width: 24, alignItems: 'center' }}>
        <View style={[line, { top: first ? 11 : 0, bottom: last ? undefined : 0, height: last ? 11 : undefined }]} />
        {n ? <View style={{ width: 22, height: 22, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: color }}>
          <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.onLight }}>{n}</Text>
        </View> : <View style={{ marginTop: 6, width: 8, height: 8, backgroundColor: colors.ground, borderWidth: 1, borderColor: colors.inkFaint }} />}
      </View>
      {muted ? <View style={{ flex: 1, paddingBottom: last ? 0 : 16 }}>
        {/* Meals and arrival: one quiet line. */}
        <Text numberOfLines={2} maxFontSizeMultiplier={1.5} style={{ fontFamily: fonts.light, fontSize: 14, lineHeight: 19, color: colors.inkMuted }}>
          {title}{meta ? <Text style={{ color: colors.inkFaint }}>{`  ·  ${meta}`}</Text> : null}
        </Text>
      </View> : <View style={{ flex: 1, gap: 3, paddingBottom: last ? 0 : 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <T v="row">{title}</T>
          {badge ? <Animated.View entering={FadeIn.duration(260)} style={{ height: 20, paddingHorizontal: 6, borderRadius: radii.chip, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.controlGlass, borderWidth: 1, borderColor: colors.hairline }}>
            <View style={{ width: 5, height: 5, backgroundColor: colors.sand }} />
            <T v="meta" color={colors.sand} style={{ fontSize: 11 }}>{badge}</T></Animated.View> : null}
        </View>
        {meta ? <T v="small" style={{ lineHeight: 17 }}>{meta}</T> : null}
      </View>}
      {onPress ? <View style={{ paddingTop: 4 }}><Icon name="more" size={16} color={colors.inkFaint} /></View> : null}
    </View>
  </View>;
  return onPress ? <PressScale accessibilityRole="button" accessibilityLabel={`${time} ${title}${badge ? `, ${badge}` : ''}. Options`} onPress={onPress}>{body}</PressScale> : body;
}

/* ------------------------------------------------------------------ a trek's profile */

/**
 * The route's altitude, day by day, as a thin line you can touch: tap a camp to see that day. The chosen camp is the
 * orange mark; the highest point is labelled.
 */
export function ElevationProfile({ points, selected, onSelect, unit = 'metric', style }: {
  /** One per stage: where it ends (and the first one's start). */
  points: { start: number; end: number }[]; selected: number; onSelect: (i: number) => void; unit?: 'metric' | 'imperial'; style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const h = 128, padX = 14, top = 22, bottom = 22;
  const alts = [points[0]?.start || points[0]?.end || 0, ...points.map((p) => p.end || p.start)];
  const lo = Math.min(...alts), hi = Math.max(...alts);
  const range = Math.max(200, hi - lo);
  const X = (i: number) => padX + (i / Math.max(1, alts.length - 1)) * (w - padX * 2);
  const Y = (a: number) => top + (1 - (a - lo) / range) * (h - top - bottom);
  const line = alts.map((a, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(a).toFixed(1)}`).join(' ');
  const area = `${line} L${X(alts.length - 1).toFixed(1)},${h - bottom} L${X(0).toFixed(1)},${h - bottom} Z`;
  const peak = alts.indexOf(hi);
  const fmt = (m: number) => (unit === 'imperial' ? `${Math.round(m * 3.281).toLocaleString('en-US')} ft` : `${m.toLocaleString('en-US')} m`);
  return <View style={style} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityLabel={`Altitude profile, highest point ${fmt(hi)}`}>
    {w ? <View style={{ height: h }}>
      <Svg width={w} height={h}>
        <Defs><LinearGradient id="alt" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colors.ink} stopOpacity={0.14} /><Stop offset="1" stopColor={colors.ink} stopOpacity={0} /></LinearGradient></Defs>
        <Path d={area} fill="url(#alt)" />
        <Path d={line} stroke={colors.ink} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
        {alts.slice(1).map((a, i) => i === selected
          ? <Rect key={i} x={X(i + 1) - 5} y={Y(a) - 5} width={10} height={10} fill={colors.accent} />
          : <Rect key={i} x={X(i + 1) - 3} y={Y(a) - 3} width={6} height={6} fill={colors.ground} stroke={colors.ink} strokeWidth={1} />)}
      </Svg>
      <T v="meta" color={colors.ink} style={{ position: 'absolute', left: Math.min(Math.max(0, X(peak) - 30), w - 70), top: Math.max(0, Y(hi) - 20) }}>{fmt(hi)}</T>
      {/* Touch targets over each camp. */}
      {alts.slice(1).map((_, i) => <PressScale key={i} accessibilityRole="button" accessibilityLabel={`Day ${i + 1}`} onPress={() => { haptic.select(); onSelect(i); }}
        style={{ position: 'absolute', left: X(i + 1) - 18, top: 0, width: 36, height: h }} />)}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: padX - 4 }}>
        <T v="meta" color={colors.inkFaint}>Start</T><T v="meta" color={colors.inkFaint}>{`Day ${points.length}`}</T>
      </View>
    </View> : <View style={{ height: h }} />}
  </View>;
}

