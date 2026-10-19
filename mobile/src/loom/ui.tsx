import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, InputAccessoryView, Keyboard, KeyboardAvoidingView, Platform, StatusBar as RNStatusBar, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type KeyboardTypeOptions, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import Animated, { Extrapolation, interpolate, interpolateColor, runOnJS, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { AnimatedFill, Arrive, BlockGapContext, ease, GrowBar, haptic, MotionSurface, ParallaxCover, PressScale, Reveal, useOn } from './motion';
import { closingOnPurpose, useRouter } from '../core/nav';
import { NavigationContext, useIsFocused, useNavigation, usePreventRemove } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Illustration, type IconName, type IllustrationName } from './graphics';
import { tabBarHeight } from './TabBar';
import { colors, fonts, radii, shadows, tints, type Tint } from './tokens';
import { Backdrop, GlassFill, type GlassKind } from './glass';
import type { ImageSourcePropType } from 'react-native';

/* ------------------------------------------------------------------ Text */

type Variant = 'hero' | 'display' | 'title' | 'section' | 'row' | 'body' | 'small' | 'meta' | 'label' | 'eyebrow';
export const VARIANTS: Record<Variant, TextStyle> = {
  hero: { fontFamily: fonts.light, fontSize: 36, lineHeight: 40, letterSpacing: -0.9 },
  display: { fontFamily: fonts.light, fontSize: 34, lineHeight: 38, letterSpacing: -0.85 },
  title: { fontFamily: fonts.regular, fontSize: 20, lineHeight: 24, letterSpacing: -0.2 },
  section: { fontFamily: fonts.regular, fontSize: 20, lineHeight: 24, letterSpacing: -0.2 },
  row: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 20 },
  body: { fontFamily: fonts.light, fontSize: 15, lineHeight: 22, color: colors.inkMuted },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.inkMuted },
  label: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.inkMuted },
  eyebrow: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkMuted },
};

/**
 * How far Dynamic Type may grow text of a given size. Body text can nearly double; display type grows
 * less so a headline never breaks mid-word on a phone.
 */
export const maxScale = (fontSize = 15) => (fontSize >= 34 ? 1.15 : fontSize >= 26 ? 1.25 : fontSize >= 18 ? 1.4 : fontSize >= 14 ? 1.7 : 1.9);

export function T({ v = 'body', color, style, children, lines, center }: {
  v?: Variant; color?: string; style?: StyleProp<TextStyle>; children: React.ReactNode; lines?: number; center?: boolean;
}) {
  const size = StyleSheet.flatten([VARIANTS[v], style])?.fontSize;
  return <Text numberOfLines={lines} maxFontSizeMultiplier={maxScale(size)}
    style={[{ color: colors.ink }, VARIANTS[v], color ? { color } : null, center ? { textAlign: 'center' } : null, style]}>{children}</Text>;
}

/* ------------------------------------------------------------------ The screen's edge */

/**
 * True inside a footer at the bottom of the screen. The phone's corners are deeply rounded there, so what sits along
 * that edge (the main button, the ask bar, the tab dock) is a capsule that follows them; tiles in the page stay square.
 */
const AtEdgeContext = createContext(false);
export const useAtEdge = () => useContext(AtEdgeContext);
export function AtEdge({ children }: { children: React.ReactNode }) {
  return <AtEdgeContext.Provider value>{children}</AtEdgeContext.Provider>;
}

/* ------------------------------------------------------------------ Press feedback */

export function Press({ onPress, href, style, children, label, disabled, haptics, hitSlop }: {
  onPress?: () => void; href?: string; style?: StyleProp<ViewStyle>; children: React.ReactNode; label?: string; disabled?: boolean; haptics?: 'select' | 'tap';
  /** Extra touch area around a small target (a text link), so it reaches 44 points without changing the layout. */
  hitSlop?: number;
}) {
  const router = useRouter();
  const handle = onPress ?? (href ? () => router.push(href as never) : undefined);
  return <PressScale accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={handle} haptics={haptics} style={style} hitSlop={hitSlop}>{children}</PressScale>;
}

/* ------------------------------------------------------------------ Layout */

type Bar = 'tabs' | 'none';

/** The scroll position of the screen a component sits in, for headers and parallax. Undefined outside a Screen. */
type StickyTitle = { title: string; back: boolean };
const ScrollContext = createContext<{ y: SharedValue<number>; setSticky: (s: StickyTitle | null) => void } | null>(null);
export const useScrollY = () => useContext(ScrollContext)?.y;

/** A cover that drifts and stretches with the scroll of the screen it is in. */
export function CoverParallax({ height, children }: { height: number; children: React.ReactNode }) {
  return <ParallaxCover y={useScrollY()} height={height}>{children}</ParallaxCover>;
}

/** The compact bar that fades in once the screen's own header has scrolled away: blurred canvas, centred title. */
function StickyBar({ y, title, back, top }: { y: SharedValue<number>; title: string; back: boolean; top: number }) {
  const goBack = useGoBack();
  const [live, setLive] = useState(false);
  const start = 34, end = 62;
  useAnimatedReaction(() => y.value > start + 10, (on, was) => { if (on !== was) runOnJS(setLive)(on); });
  // The blur only exists once the bar is showing: an iOS blur view draws black when the screen is snapshotted
  // (the zoom transition), even at opacity 0, which showed as a dark band at the top of the opening trip.
  const [blur, setBlur] = useState(false);
  useAnimatedReaction(() => y.value > start, (on, was) => { if (on !== was) runOnJS(setBlur)(on); });
  const bar = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [start, end], [0, 1], Extrapolation.CLAMP) }));
  const label = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(y.value, [start, end + 20], [8, 0], Extrapolation.CLAMP) }] }));
  return <Animated.View pointerEvents={live ? 'box-none' : 'none'} style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: top + 50, overflow: 'hidden', opacity: 0 }, bar]}>
    {blur ? <BlurView intensity={60} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20, 18, 15, 0.62)', borderBottomWidth: 1, borderBottomColor: colors.hairline }} />
    <View style={{ position: 'absolute', top, left: 0, right: 0, height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
      {back ? <PressScale accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={goBack}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={20} /></PressScale> : <View style={{ width: 40 }} />}
      <Animated.View style={[{ flex: 1, alignItems: 'center' }, label]}>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.regular, fontSize: 16, color: colors.ink }}>{title}</Text>
      </Animated.View>
      <View style={{ width: 40 }} />
    </View>
  </Animated.View>;
}

/** A frosted band behind the status bar that fades in as soon as content scrolls under it. */
function StatusScrim({ y, height }: { y: SharedValue<number>; height: number }) {
  const style = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 16], [0, 1], Extrapolation.CLAMP) }));
  // As in StickyBar: no blur view until content is under the status bar (a blur snapshots as black).
  const [blur, setBlur] = useState(false);
  useAnimatedReaction(() => y.value > 0, (on, was) => { if (on !== was) runOnJS(setBlur)(on); });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden', opacity: 0 }, style]}>
    {blur ? <BlurView intensity={60} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20, 18, 15, 0.62)' }} />
  </Animated.View>;
}

/**
 * A screen's content as separate blocks, fragments opened up, so each can rise in on its own. Keys stay stable
 * (React's own), so a block that appears later is new and the ones around it keep their place.
 */
function blocks(children: React.ReactNode): React.ReactElement[] {
  const out: React.ReactElement[] = [];
  const walk = (nodes: React.ReactNode, prefix: string) => {
    React.Children.toArray(nodes).forEach((child) => {
      // toArray already drops null, undefined and booleans; what's left that isn't an element is text.
      if (!React.isValidElement(child)) { out.push(<React.Fragment key={`${prefix}${out.length}`}>{child}</React.Fragment>); return; }
      if (child.type === React.Fragment) walk((child.props as { children?: React.ReactNode }).children, `${prefix}${String(child.key)}/`);
      else out.push(prefix ? React.cloneElement(child, { key: `${prefix}${String(child.key)}` }) : child);
    });
  };
  walk(children, '');
  return out;
}

/** A screen's content blocks, each rising in after the one above it; a header stays put (it is the frame). */
export function RevealBlocks({ children }: { children: React.ReactNode }) {
  return <>{blocks(children).map((child, i) => child.type === Header ? child : <Reveal key={child.key ?? i} index={i}>{child}</Reveal>)}</>;
}

/**
 * A scrolling screen on the near-black page. Pads for the notch and, when a tab bar floats over it, for the bar.
 * `backdrop` puts it on a photo instead (only where the photo says something). The footer sits at the bottom edge,
 * so what's in it follows the screen's rounded corners (see `useAtEdge`).
 */
export function Screen({ children, gap = 16, bar = 'none', footer, scroll = true, background, backdrop }: {
  children: React.ReactNode; gap?: number; bar?: Bar; footer?: React.ReactNode; scroll?: boolean; background?: string; backdrop?: ImageSourcePropType;
}) {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  const bottom = bar === 'tabs' ? tabBarHeight(insets.bottom) + 24 : (footer ? 16 : insets.bottom + 24);
  const content = { paddingTop: topInset + 10, paddingHorizontal: 16, paddingBottom: bottom, gap };
  const y = useSharedValue(0);
  const screenScroll = useRef<Animated.ScrollView>(null);
  useKeepFocusedVisible(screenScroll as never);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  const [sticky, setSticky] = useState<StickyTitle | null>(null);
  const ctx = React.useMemo(() => ({ y, setSticky }), [y]);
  const body = <BlockGapContext.Provider value={gap}><RevealBlocks>{children}</RevealBlocks></BlockGapContext.Provider>;
  return <MotionSurface enter><ScrollContext.Provider value={ctx}>
    <View style={{ flex: 1, backgroundColor: background ?? colors.ground }}>
      {backdrop ? <Backdrop source={backdrop} /> : null}
      {scroll
        ? <Animated.ScrollView ref={screenScroll} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={[content, { flexGrow: 1 }]} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>{body}</Animated.ScrollView>
        : <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[content, { flex: 1 }]}>{body}</KeyboardAvoidingView>}
      {scroll && sticky ? <StickyBar y={y} title={sticky.title} back={sticky.back} top={topInset} /> : null}
      {/* Screens without a sticky bar (Home, Discover) still need the status bar kept clear of scrolled content. */}
      {scroll && !sticky && topInset > 20 ? <StatusScrim y={y} height={topInset} /> : null}
      {/* The footer stays put while typing: the keyboard simply covers it, so nothing above it resizes. */}
      {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 12, gap: 8 }}><AtEdge>{footer}</AtEdge></View> : null}
    </View>
  </ScrollContext.Provider></MotionSurface>;
}

export function Stack({ gap = 10, children, style }: { gap?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function RowView({ gap = 10, children, style, align = 'center' }: { gap?: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; align?: ViewStyle['alignItems'] }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap }, style]}>{children}</View>;
}

export const Spacer = () => <View style={{ flex: 1 }} />;

/* ------------------------------------------------------------------ Back */

/**
 * The main pages of a tab bar that lives inside a pushed page (a trip's Trip, Days, Budget and Packing; an
 * adventure's tabs). Back on one of them leaves the whole page, rather than stepping back through the tabs you
 * happened to visit. Pages opened from a tab (Documents, Map, Stylist) aren't listed, so back returns to that tab.
 */
export const TabRootsContext = createContext<ReadonlySet<string> | null>(null);

/** What a back arrow does: leave the trip from a tab's main page, otherwise go back (or Home when there's nothing behind). */
export function useGoBack() {
  const router = useRouter();
  const roots = useContext(TabRootsContext);
  const navigation = useContext(NavigationContext);
  return () => {
    const state = roots ? navigation?.getState() : undefined;
    const current = state?.routes[state.index]?.name;
    const parent = navigation?.getParent();
    if (roots && current && roots.has(current) && parent) {
      if (parent.canGoBack()) parent.goBack();
      else router.replace('/home' as never);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/home' as never);
  };
}

/* ------------------------------------------------------------------ Buttons */

/** A square glass key with one icon. `dark` is the khaki key (the live action). */
export function RoundButton({ icon, onPress, href, dark, label, size = 40, back, danger }: {
  icon: IconName; onPress?: () => void; href?: string; dark?: boolean; label: string; size?: number; back?: boolean; danger?: boolean;
}) {
  const goBack = useGoBack();
  const action = back ? goBack : onPress;
  const radius = useAtEdge() ? size / 2 : radii.chip;
  return <Press onPress={action} href={href} label={label} hitSlop={size < 44 ? (44 - size) / 2 : undefined} style={{
    width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center',
  }}><GlassFill kind={dark ? 'khaki' : 'control'} radius={radius} /><Icon name={icon} size={20} color={danger ? colors.danger : colors.ink} /></Press>;
}

export function BackButton() {
  return <RoundButton icon="back" back label="Back" />;
}

/** `dark` is the primary action, in khaki glass like GymSync's Start Training; `mist` and `white` are dark glass keys. */
type ButtonKind = 'dark' | 'mist' | 'white';
const BUTTON_GLASS: Record<ButtonKind, GlassKind> = { dark: 'khaki', mist: 'control', white: 'raised' };
export function Button({ label, icon, leading, kind = 'dark', onPress, href, full = true, height = 52, style }: {
  label: string; icon?: IconName; leading?: React.ReactNode; kind?: ButtonKind; onPress?: () => void; href?: string; full?: boolean; height?: number; style?: StyleProp<ViewStyle>;
}) {
  const fg = colors.ink;
  const trailing = icon === 'chev';
  const glyph = icon ? <Icon name={icon} size={18} color={fg} /> : null;
  const radius = useAtEdge() ? height / 2 : radii.button;
  return <Press onPress={onPress} href={href} label={label} style={[{
    minHeight: height, paddingVertical: 8, borderRadius: radius, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: full ? 'stretch' : 'flex-start', paddingHorizontal: full ? 16 : 20,
  }, style]}>
    <GlassFill kind={BUTTON_GLASS[kind]} radius={radius} />
    {leading}
    {trailing ? null : glyph}
    <Text maxFontSizeMultiplier={maxScale(15)} style={{ fontFamily: fonts.medium, fontSize: 15, color: fg }}>{label}</Text>
    {trailing ? glyph : null}
  </Press>;
}

/**
 * A sheet's footer on one line: the main action fills the row, secondary actions (directions, delete…) sit beside
 * it as round icon buttons with spoken labels.
 */
export function SheetActions({ primary, actions = [] }: {
  primary: React.ReactElement; actions?: ({ icon: IconName; label: string; onPress: () => void; danger?: boolean } | null | false)[];
}) {
  const list = actions.filter((a): a is { icon: IconName; label: string; onPress: () => void; danger?: boolean } => !!a);
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <View style={{ flex: 1 }}>{primary}</View>
    {list.map((a) => <RoundButton key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} danger={a.danger} size={52} />)}
  </View>;
}

/** Filter chips and quick actions: square glass keys. Selecting one fades it to khaki and the last one back. */
export function Pill({ label, icon, active, onPress, href }: { label: string; icon?: IconName; active?: boolean; onPress?: () => void; href?: string }) {
  const t = useOn(!!active);
  const fill = useAnimatedStyle(() => ({ opacity: t.value }));
  const text = useAnimatedStyle(() => ({ color: interpolateColor(t.value, [0, 1], [colors.inkMuted, colors.ink]) }));
  return <Press onPress={onPress} href={href} label={label} style={{
    minHeight: 40, paddingVertical: 6, paddingHorizontal: 14, borderRadius: radii.chip, flexDirection: 'row', alignItems: 'center', gap: 7,
  }}>
    <GlassFill kind="control" radius={radii.chip} />
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fill]}><GlassFill kind="khaki" radius={radii.chip} blurred={false} /></Animated.View>
    {icon ? <Icon name={icon} size={15} color={colors.ink} /> : null}
    <Animated.Text maxFontSizeMultiplier={maxScale(14)} style={[{ fontFamily: fonts.regular, fontSize: 14 }, text]}>{label}</Animated.Text>
  </Press>;
}

/** A horizontal scroller that bleeds to the screen edge and leaves room for shadows. */
export function HScroll({ children, gap = 8 }: { children: React.ReactNode; gap?: number }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -16, marginVertical: -12 }}
    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap }}>{children}</ScrollView>;
}

/** Single-select filter chips. Pass `value`/`onChange` to control them, or let them keep their own state. */
export function Chips({ items, initial = 0, value, onChange }: {
  items: { label: string; icon?: IconName }[]; initial?: number; value?: number; onChange?: (index: number) => void;
}) {
  const [own, setOwn] = useState(initial);
  const active = value ?? own;
  return <HScroll>{items.map((item, i) => <Pill key={item.label} label={item.label} icon={item.icon} active={i === active}
    onPress={() => { if (i !== active) haptic.select(); setOwn(i); onChange?.(i); }} />)}</HScroll>;
}

/* ------------------------------------------------------------------ Labels */

export function Tag({ text, tint = 'peach' }: { text: string; tint?: Tint }) {
  return <View style={{ alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 7, borderRadius: radii.check, backgroundColor: tints[tint].bg }}>
    <Text maxFontSizeMultiplier={maxScale(11)} style={{ fontFamily: fonts.regular, fontSize: 11, color: tints[tint].fg }}>{text}</Text>
  </View>;
}

export function Header({ title, right, big, back = true }: { title: string; right?: React.ReactNode; big?: boolean; back?: boolean }) {
  const scroll = useContext(ScrollContext);
  const setSticky = scroll?.setSticky;
  useEffect(() => {
    setSticky?.({ title, back: !big && back });
    return () => setSticky?.(null);
  }, [setSticky, title, big, back]);
  if (big) return <RowView style={{ justifyContent: 'space-between' }}><T v="display">{title}</T>{right}</RowView>;
  return <RowView style={{ justifyContent: 'space-between' }}>
    {back ? <BackButton /> : <View style={{ width: 40 }} />}
    <T v="title" lines={1} style={{ flexShrink: 1 }}>{title}</T>
    {right ?? <View style={{ width: 40 }} />}
  </RowView>;
}

export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children?: React.ReactNode }) {
  return <Stack gap={12}>
    <RowView style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
      <T v="section">{title}</T>
      {action ? <Press onPress={onAction} label={action} hitSlop={14}><T v="small" color={colors.ink} style={{ fontSize: 14 }}>{action}</T></Press> : null}
    </RowView>
    {children}
  </Stack>;
}

export function Title({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return <Stack gap={8} style={{ paddingHorizontal: 4, marginTop: 8 }}>
    {eyebrow ? <T v="eyebrow">{eyebrow}</T> : null}
    <T v="display">{title}</T>
    {sub ? <T v="body">{sub}</T> : null}
  </Stack>;
}

export function Note({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return <T v="small" center={center} style={{ paddingHorizontal: 4 }}>{children}</T>;
}

export function FieldLabel({ children }: { children: string }) {
  return <T v="label" style={{ paddingLeft: 4 }}>{children}</T>;
}

/* ------------------------------------------------------------------ Surfaces */

/** A frosted tile. `lifted` is the live one: khaki glass. */
export function Card({ children, padding = 16, lifted, style, gap = 12 }: {
  children: React.ReactNode; padding?: number; lifted?: boolean; style?: StyleProp<ViewStyle>; gap?: number;
}) {
  return <Arrive><View style={[{ borderRadius: radii.card, padding, gap }, style]}>
    <GlassFill kind={lifted ? 'khaki' : 'surface'} radius={radii.card} />
    {children}
  </View></Arrive>;
}

/** The live tile: khaki glass, as GymSync's live training. One per screen; everything on it is ink. */
export function Hero({ children, padding = 18, gap = 14, style }: { children: React.ReactNode; padding?: number; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ borderRadius: radii.hero, overflow: 'hidden', padding, gap }, style]}>
    <GlassFill kind="khaki" radius={radii.hero} />
    {children}
  </View>;
}

export function HeroText({ v = 'body', children, style, faint, lines }: { v?: Variant; children: React.ReactNode; style?: StyleProp<TextStyle>; faint?: boolean; lines?: number }) {
  return <T v={v} color={colors.ink} lines={lines} style={[faint ? { opacity: 0.86 } : null, style]}>{children}</T>;
}

export function HeroRule() {
  return <View style={{ height: 1, backgroundColor: colors.khakiRule }} />;
}

export function IconTile({ icon, size = 40, tint, bg, color }: { icon: IconName; size?: number; tint?: Tint; bg?: string; color?: string }) {
  const c = color ?? (tint ? tints[tint].fg : colors.ink);
  return <View style={{ width: size, height: size, borderRadius: radii.iconTile, alignItems: 'center', justifyContent: 'center', backgroundColor: bg ?? (tint ? tints[tint].bg : undefined) }}>
    {bg || tint ? null : <GlassFill kind="control" radius={radii.iconTile} sheen={false} />}
    <Icon name={icon} size={Math.min(20, Math.round(size * 0.5))} color={c} />
  </View>;
}

/** Rows inside one frosted tile, separated by hairlines. */
export function Group({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return <View style={{ borderRadius: radii.card, paddingHorizontal: 16, paddingVertical: 2 }}>
    <GlassFill kind="surface" radius={radii.card} />
    {items.map((child, i) => <Arrive key={React.isValidElement(child) && child.key !== null ? child.key : i} style={i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.hairline } : null}>{child}</Arrive>)}
  </View>;
}

export function Row({ icon, title, meta, trailing = 'chev', tint, onPress, href, leading }: {
  icon?: IconName; title: string; meta?: string; trailing?: React.ReactNode | 'chev' | null; tint?: Tint; onPress?: () => void; href?: string; leading?: React.ReactNode;
}) {
  const body = <>
    {leading ?? (icon ? <IconTile icon={icon} tint={tint} /> : null)}
    <View style={{ flex: 1, gap: 2 }}>
      <T v="row" style={{ fontSize: 15 }}>{title}</T>
      {meta ? <T v="meta">{meta}</T> : null}
    </View>
    {trailing === 'chev' ? <Icon name="chev" size={16} color={colors.inkFaint} /> : trailing}
  </>;
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 12 };
  return onPress || href ? <Press onPress={onPress} href={href} label={title} style={style}>{body}</Press> : <View style={style}>{body}</View>;
}

export function MediaRow({ ill, eyebrow, tint, title, meta, trailing = 'chev', href, onPress, height = 92 }: {
  ill: IllustrationName; eyebrow: string; tint: Tint; title: string; meta: string; trailing?: React.ReactNode | 'chev'; href?: string; onPress?: () => void; height?: number;
}) {
  // The art is pinned to the left edge so the row's height comes only from its text (percent heights in an
  // auto-height row can resolve against the wrong box).
  return <Arrive><Press href={href} onPress={onPress} label={title} style={{
    flexDirection: 'row', alignItems: 'stretch', gap: 14, minHeight: height, paddingLeft: 92 + 14, paddingRight: 16,
    borderRadius: radii.card, overflow: 'hidden',
  }}>
    <GlassFill kind="surface" radius={radii.card} />
    <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 92 }}><Illustration name={ill} width={92} height="100%" /></View>
    <View style={{ flex: 1, gap: 3, justifyContent: 'center', paddingVertical: 12 }}>
      <Text maxFontSizeMultiplier={maxScale(12)} style={{ fontFamily: fonts.regular, fontSize: 12, color: tints[tint].fg }}>{eyebrow}</Text>
      <T v="row" lines={1}>{title}</T>
      <T v="meta" lines={1}>{meta}</T>
    </View>
    <View style={{ justifyContent: 'center' }}>{trailing === 'chev' ? <Icon name="chev" size={16} color={colors.inkFaint} /> : trailing}</View>
  </Press></Arrive>;
}

export function SwatchRow({ color, eyebrow, tint, title, meta, trailing }: {
  color: string; eyebrow: string; tint: Tint; title: string; meta: string; trailing?: React.ReactNode;
}) {
  return <Arrive><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 80, paddingRight: 16, borderRadius: radii.card, overflow: 'hidden' }}>
    <GlassFill kind="surface" radius={radii.card} />
    <View style={{ width: 80, alignSelf: 'stretch', minHeight: 80, backgroundColor: color }} />
    <View style={{ flex: 1, gap: 3, paddingVertical: 12 }}>
      <Text maxFontSizeMultiplier={maxScale(12)} style={{ fontFamily: fonts.regular, fontSize: 12, color: tints[tint].fg }}>{eyebrow}</Text>
      <T v="row">{title}</T>
      <T v="meta">{meta}</T>
    </View>
    {trailing}
  </View></Arrive>;
}

export function PhotoCard({ ill, image, label, title, meta, width = 236, height = 200, href, onPress }: {
  ill: IllustrationName; label: string; title: string; meta: string; width?: number; height?: number; href?: string; onPress?: () => void;
  /** Drawn instead of the illustration (a trip's own cover photo). */
  image?: React.ReactNode;
}) {
  return <Arrive><Press href={href} onPress={onPress} label={`${title}, ${label}, ${meta}`} style={{ width, height, borderRadius: radii.card, overflow: 'hidden', justifyContent: 'flex-end' }}>
    {image ? <View style={{ position: 'absolute', width, height }}>{image}</View> : <Illustration name={ill} width={width} height={height} style={{ position: 'absolute' }} />}
    <View style={{ position: 'absolute', top: 10, left: 10, paddingVertical: 5, paddingHorizontal: 9, borderRadius: radii.chip }}>
      <GlassFill kind="glass" radius={radii.chip} sheen={false} />
      <Text maxFontSizeMultiplier={maxScale(12)} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.ink }}>{label}</Text>
    </View>
    <View style={{ paddingVertical: 10, paddingHorizontal: 12, gap: 2 }}>
      <GlassFill kind="strong" radius={0} sheen={false} edge={false} />
      <T v="row" lines={1}>{title}</T>
      <T v="meta" lines={1}>{meta}</T>
    </View>
  </Press></Arrive>;
}

export function Dashed({ label, icon = 'plus', onPress }: { label: string; icon?: IconName; onPress?: () => void }) {
  return <Press onPress={onPress} label={label} style={{ height: 52, borderRadius: radii.card, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.dashed, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
    <Icon name={icon} size={18} color={colors.inkMuted} /><T v="body" style={{ fontSize: 15 }}>{label}</T>
  </Press>;
}

/* ------------------------------------------------------------------ Controls */

export function Toggle({ initial = true, value, onChange, label, disabled }: { initial?: boolean; value?: boolean; onChange?: (on: boolean) => void; label?: string; disabled?: boolean }) {
  const [own, setOwn] = useState(initial);
  const on = value ?? own;
  const setOn = (next: boolean) => { haptic.select(); setOwn(next); onChange?.(next); };
  // The knob slides and the track fades between colours instead of snapping.
  const t = useSharedValue(on ? 1 : 0);
  useEffect(() => { t.value = withTiming(on ? 1 : 0, ease); }, [on, t]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: 20 * t.value }], backgroundColor: interpolateColor(t.value, [0, 1], [colors.inkMuted, colors.ink]) }));
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(t.value, [0, 1], [colors.track, colors.inkButton]) }));
  return <PressScale accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on, disabled }} disabled={disabled} hitSlop={10} onPress={() => setOn(!on)}>
    <Animated.View style={[{ width: 46, height: 26, borderRadius: radii.chip, padding: 3, opacity: disabled ? 0.4 : 1 }, track]}>
      <Animated.View style={[{ width: 20, height: 20, borderRadius: radii.check }, knob]} />
    </Animated.View>
  </PressScale>;
}

export function Checkbox({ checked, accent = colors.inkButton }: { checked: boolean; accent?: string }) {
  // Ticking fills the box with a small overshoot; the tick scales in a beat later.
  const t = useSharedValue(checked ? 1 : 0);
  useEffect(() => { t.value = withTiming(checked ? 1 : 0, { ...ease, duration: 160 }); }, [checked, t]);
  const fill = useAnimatedStyle(() => ({ opacity: t.value }));
  const tick = useAnimatedStyle(() => ({ opacity: t.value }));
  return <View style={{ width: 24, height: 24, borderRadius: radii.check, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View style={[{ position: 'absolute', top: -1.5, left: -1.5, right: -1.5, bottom: -1.5, borderRadius: radii.check, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }, fill]}>
      <Animated.View style={tick}><Icon name="check" size={15} color={colors.ink} strokeWidth={2.4} /></Animated.View>
    </Animated.View>
  </View>;
}

export function CheckToggle({ initial = false, accent, checked, onChange, label }: {
  initial?: boolean; accent?: string; checked?: boolean; onChange?: (on: boolean) => void; label?: string;
}) {
  const [own, setOwn] = useState(initial);
  const on = checked ?? own;
  return <PressScale accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: on }} hitSlop={10}
    onPress={() => { if (!on) haptic.tap(); else haptic.select(); setOwn(!on); onChange?.(!on); }}><Checkbox checked={on} accent={accent} /></PressScale>;
}

export function Radio({ on }: { on: boolean }) {
  const t = useSharedValue(on ? 1 : 0);
  useEffect(() => { t.value = withTiming(on ? 1 : 0, ease); }, [on, t]);
  const ring = useAnimatedStyle(() => ({ borderColor: interpolateColor(t.value, [0, 1], [colors.border, colors.ink]) }));
  const dot = useAnimatedStyle(() => ({ opacity: t.value }));
  return <Animated.View style={[{ width: 22, height: 22, borderRadius: radii.round, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }, ring]}>
    <Animated.View style={[{ width: 10, height: 10, borderRadius: radii.round, backgroundColor: colors.ink }, dot]} />
  </Animated.View>;
}

type FieldKind = 'text' | 'name' | 'email' | 'password' | 'number' | 'count' | 'phone' | 'place' | 'spot';
const FIELD_KINDS: Record<FieldKind, Partial<TextInputProps> & { keyboardType?: KeyboardTypeOptions }> = {
  text: {},
  name: { autoCapitalize: 'words', textContentType: 'name', autoComplete: 'name' },
  email: { autoCapitalize: 'none', autoCorrect: false, keyboardType: 'email-address', textContentType: 'emailAddress', autoComplete: 'email' },
  password: { autoCapitalize: 'none', autoCorrect: false, secureTextEntry: true, textContentType: 'password', autoComplete: 'current-password' },
  number: { keyboardType: 'decimal-pad' },
  /** Whole numbers only (people, items, grams): no decimal key. */
  count: { keyboardType: 'number-pad' },
  phone: { keyboardType: 'phone-pad', textContentType: 'telephoneNumber', autoComplete: 'tel' },
  // Place names aren't dictionary words: autocorrect turns "Lumphini" into "Lymphoma".
  place: { autoCapitalize: 'words', autoCorrect: false, spellCheck: false, textContentType: 'addressCity' },
  /** A sight, café or beach by name (or a pasted link): no autocorrect, no city autofill. */
  spot: { autoCorrect: false, spellCheck: false },
};

/**
 * Text inside inputs. No vertical padding and no lineHeight: iOS centres single-line text itself, and a lineHeight
 * on a TextInput is applied to typed text but not to the placeholder, so the two sat at different heights.
 */
export const inputText: TextStyle = { fontFamily: fonts.light, fontSize: 15, color: colors.ink, paddingTop: 0, paddingBottom: 0, includeFontPadding: false };
/** A single-line input fills its row's height so the text is centred on the icon beside it. */
export const singleLine: TextStyle = { flex: 1, alignSelf: 'stretch' };

export function Field({ label, value, onChangeText, placeholder, icon, multiline, secure, flex, kind = 'text', error, hint, autoFocus, maxLength, onSubmitEditing, returnKeyType, trailing, editable = true, onFocus, onBlur }: {
  label: string; value?: string; onChangeText?: (text: string) => void; placeholder?: string; icon?: IconName; multiline?: boolean;
  secure?: boolean; flex?: boolean; kind?: FieldKind; error?: string; hint?: string; autoFocus?: boolean; maxLength?: number;
  onSubmitEditing?: (text: string) => void; returnKeyType?: TextInputProps['returnKeyType']; trailing?: React.ReactNode; editable?: boolean;
  onFocus?: () => void; onBlur?: () => void;
}) {
  const input = useRef<TextInput>(null);
  // Number and phone pads have no return key on iOS: give them a Done bar.
  const accessoryId = `done-${React.useId()}`;
  const pad = Platform.OS === 'ios' && (kind === 'number' || kind === 'count' || kind === 'phone');
  return <View style={[{ gap: 6 }, flex ? { flex: 1 } : null]}>
    <FieldLabel>{label}</FieldLabel>
    {pad ? <InputAccessoryView nativeID={accessoryId}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1d1a16', borderTopWidth: 1, borderTopColor: colors.hairline }}>
        <PressScale accessibilityRole="button" accessibilityLabel="Done" hitSlop={8} onPress={() => { input.current?.blur(); onSubmitEditing?.(value ?? ''); }} style={{ minHeight: 36, paddingHorizontal: 12, justifyContent: 'center' }}>
          <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.ink }}>Done</Text>
        </PressScale>
      </View>
    </InputAccessoryView> : null}
    {/* The whole box focuses the input, not just the text area. */}
    <Pressable accessible={false} onPress={() => input.current?.focus()} style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 10, minHeight: multiline ? 96 : 50, paddingHorizontal: 14, paddingVertical: multiline ? 14 : 0, borderRadius: radii.field }}>
      <GlassFill kind="control" radius={radii.field} sheen={false} />
      {error ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radii.field, borderWidth: 1, borderColor: colors.danger }]} /> : null}
      {icon ? <Icon name={icon} size={18} color={colors.inkMuted} /> : null}
      <TextInput ref={input} {...FIELD_KINDS[secure ? 'password' : kind]} maxFontSizeMultiplier={1.7}
        {...(onChangeText ? { value: value ?? '', onChangeText: kind === 'number' ? (t: string) => onChangeText(t.replace(/[^0-9.,]/g, '')) : kind === 'count' ? (t: string) => onChangeText(t.replace(/\D/g, '')) : kind === 'phone' ? (t: string) => onChangeText(t.replace(/[^0-9+()\-. ]/g, '')) : onChangeText } : { defaultValue: value })}
        placeholder={placeholder} placeholderTextColor={colors.placeholder} multiline={multiline} autoFocus={autoFocus} maxLength={maxLength}
        inputAccessoryViewID={pad ? accessoryId : undefined}
        editable={editable} onFocus={onFocus} onBlur={onBlur} onSubmitEditing={onSubmitEditing && ((e) => onSubmitEditing(e.nativeEvent.text ?? value ?? ''))} returnKeyType={returnKeyType} submitBehavior={multiline ? 'newline' : 'blurAndSubmit'}
        accessibilityLabel={label} accessibilityHint={error || hint}
        selectionColor={colors.ink} keyboardAppearance="dark"
        style={[inputText, { color: editable ? colors.ink : colors.inkMuted }, multiline ? { flex: 1, alignSelf: 'stretch', minHeight: 68, textAlignVertical: 'top' } : singleLine]} />
      {trailing}
    </Pressable>
    {error ? <T v="meta" color={colors.danger} style={{ paddingLeft: 4 }}>{error}</T> : hint ? <T v="meta" style={{ paddingLeft: 4 }}>{hint}</T> : null}
  </View>;
}

/** A tappable field that opens a picker or sheet (dates, currencies, places). */
export function PickerField({ label, value, placeholder, icon, onPress, flex, error, accessibilityHint }: {
  label: string; value: string; placeholder?: string; icon?: IconName; onPress: () => void; flex?: boolean; error?: string; accessibilityHint?: string;
}) {
  return <View style={[{ gap: 6 }, flex ? { flex: 1 } : null]}>
    <FieldLabel>{label}</FieldLabel>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || placeholder || ''}`} accessibilityHint={accessibilityHint} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14, borderRadius: radii.field, opacity: pressed ? 0.85 : 1 })}>
      <GlassFill kind="control" radius={radii.field} sheen={false} />
      {error ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radii.field, borderWidth: 1, borderColor: colors.danger }]} /> : null}
      {icon ? <Icon name={icon} size={18} color={colors.inkMuted} /> : null}
      <Text maxFontSizeMultiplier={1.7} numberOfLines={1} style={{ flex: 1, fontFamily: fonts.light, fontSize: 15, color: value ? colors.ink : colors.placeholder }}>{value || placeholder}</Text>
      <Icon name="chev" size={16} color={colors.inkFaint} />
    </Pressable>
    {error ? <T v="meta" color={colors.danger} style={{ paddingLeft: 4 }}>{error}</T> : null}
  </View>;
}

export function EmptyState({ art, title, body, action }: { art?: IllustrationName; title: string; body: string; action?: React.ReactNode }) {
  return <Arrive style={{ alignItems: 'center', gap: 12, paddingVertical: 28, paddingHorizontal: 12 }}>
    {art ? <Illustration name={art} width={120} height={120} radius={radii.card} /> : null}
    <T v="title" center>{title}</T>
    <T v="body" center>{body}</T>
    {action ? <View style={{ alignSelf: 'stretch', marginTop: 4 }}>{action}</View> : null}
  </Arrive>;
}

/** A quiet notice under a header: offline, saving problems, conflicts. */
export function Banner({ icon = 'cloud', tint = 'peach', title, body, action, onAction }: {
  icon?: IconName; tint?: Tint; title: string; body?: string; action?: string; onAction?: () => void;
}) {
  return <Arrive style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderRadius: radii.card }}>
    <GlassFill kind="control" radius={radii.card} />
    <Icon name={icon} size={20} color={tints[tint].fg} />
    <View style={{ flex: 1, gap: 2 }}>
      <T v="row" style={{ fontSize: 14 }}>{title}</T>
      {body ? <T v="meta">{body}</T> : null}
    </View>
    {action && onAction ? <Press onPress={onAction} label={action} hitSlop={10}><Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.medium, fontSize: 13, color: tints[tint].fg }}>{action}</Text></Press> : null}
  </Arrive>;
}

/** A spinner that only fades in if loading takes a moment, so quick loads never flash it. */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  const t = useSharedValue(0);
  useEffect(() => { t.value = withDelay(250, withTiming(1, ease)); }, [t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value }));
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ground }}>
    <Animated.View style={[{ alignItems: 'center', gap: 12 }, style]}>
      <ActivityIndicator color={colors.ink} />
      <T v="small">{label}</T>
    </Animated.View>
  </View>;
}

export function Segmented({ options, initial, value: controlled, onChange }: { options: string[]; initial?: string; value?: string; onChange?: (value: string) => void }) {
  const [own, setOwn] = useState(initial ?? options[0]);
  const value = controlled ?? own;
  const setValue = (v: string) => { if (v !== value) haptic.select(); setOwn(v); onChange?.(v); };
  // The ink marker slides to the chosen option instead of jumping.
  const [width, setWidth] = useState(0);
  const slot = width / options.length;
  const index = Math.max(0, options.indexOf(value));
  const x = useSharedValue(-1);
  useEffect(() => {
    if (!slot) return;
    x.value = x.value < 0 ? index * slot : withTiming(index * slot, ease);
  }, [index, slot, x]);
  const marker = useAnimatedStyle(() => ({ opacity: x.value < 0 ? 0 : 1, transform: [{ translateX: Math.max(0, x.value) }] }));
  return <View style={{ flexDirection: 'row', padding: 3, borderRadius: radii.card }}>
    <GlassFill kind="control" radius={radii.card} sheen={false} />
    <View pointerEvents="none" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ position: 'absolute', top: 3, bottom: 3, left: 3, right: 3 }}>
      <Animated.View style={[{ width: slot || 0, height: '100%', borderRadius: radii.chip, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline }, marker]} />
    </View>
    {options.map((o) => <SegmentOption key={o} label={o} on={o === value} onPress={() => setValue(o)} />)}
  </View>;
}

function SegmentOption({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const t = useOn(on);
  const text = useAnimatedStyle(() => ({ color: interpolateColor(t.value, [0, 1], [colors.inkFaint, colors.ink]) }));
  return <PressScale accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
    style={{ flex: 1, height: 36, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.Text maxFontSizeMultiplier={maxScale(14)} style={[{ fontFamily: fonts.regular, fontSize: 14 }, text]}>{label}</Animated.Text>
  </PressScale>;
}

/** A meter: a thin line on the track, filled in ink (or a status colour). */
export function Progress({ pct, color = colors.ink, track = colors.track, height = 3 }: { pct: number; color?: string; track?: string; height?: number }) {
  return <View style={{ height, borderRadius: 1, backgroundColor: track, overflow: 'hidden' }}><AnimatedFill pct={pct} color={color} radius={1} /></View>;
}

export function Steps({ n, total = 4, light }: { n: number; total?: number; light?: boolean }) {
  return <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${n} of ${total}`}>
    {Array.from({ length: total }, (_, i) => <Step key={i} current={i === n - 1} done={i < n} light={light} />)}
  </View>;
}

/** One step mark: the current one is longer, and marks fill in as steps are reached. */
function Step({ current, done, light }: { current: boolean; done: boolean; light?: boolean }) {
  const long = useOn(current);
  const fill = useOn(done);
  const on = colors.ink;
  const off = light ? colors.khakiRule : colors.track;
  const style = useAnimatedStyle(() => ({ width: 22 + 10 * long.value, backgroundColor: interpolateColor(fill.value, [0, 1], [off, on]) }));
  return <Animated.View style={[{ height: 2 }, style]} />;
}

export function DayChips({ days, initial }: { days: [string, string | number][]; initial?: string | number }) {
  const [active, setActive] = useState(initial ?? days[0][1]);
  return <HScroll>{days.map(([d, n]) => {
    const on = n === active;
    return <DayChip key={`${d}${n}`} top={d} bottom={String(n)} on={on} onPress={() => setActive(n)} />;
  })}</HScroll>;
}

/**
 * A day in a strip of days: weekday over date. The chosen one fills with ink (fading, not snapping); `today` rings
 * the current date; `below` is a small slot under the date (the day's weather).
 */
export function DayChip({ top, bottom, on, today, below, label, onPress }: {
  top: string; bottom: string; on: boolean; today?: boolean; below?: React.ReactNode; label?: string; onPress: () => void;
}) {
  const t = useOn(on);
  const fill = useAnimatedStyle(() => ({ opacity: t.value }));
  const small = useAnimatedStyle(() => ({ color: interpolateColor(t.value, [0, 1], [colors.inkFaint, colors.ink]) }));
  return <PressScale onPress={() => { if (!on) haptic.select(); onPress(); }} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}
    style={{ width: 54, paddingTop: 9, paddingBottom: 8, borderRadius: radii.tile, alignItems: 'center', gap: 1 }}>
    <GlassFill kind="surface" radius={radii.tile} />
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fill]}><GlassFill kind="khaki" radius={radii.tile} blurred={false} /></Animated.View>
    {today ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, width: 14, height: 2, backgroundColor: colors.accent, boxShadow: shadows.glow }} /> : null}
    <Animated.Text maxFontSizeMultiplier={1.3} style={[{ fontFamily: fonts.regular, fontSize: 11 }, small]}>{top}</Animated.Text>
    <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.light, fontSize: 20, color: colors.ink, fontVariant: ['tabular-nums'] }}>{bottom}</Text>
    {below}
  </PressScale>;
}

export function Avatar({ initials, tint = 'lavender', size = 36, overlap }: { initials: string; tint?: Tint; size?: number; overlap?: boolean }) {
  return <View style={[{ width: size, height: size, borderRadius: radii.round, backgroundColor: tints[tint].bg, alignItems: 'center', justifyContent: 'center' },
    overlap ? { marginLeft: -10, borderWidth: 2, borderColor: colors.ground } : null]}>
    {initials ? <Text maxFontSizeMultiplier={maxScale(15)} style={{ fontFamily: fonts.medium, fontSize: Math.round(size / 3) + 1, color: tints[tint].fg }}>{initials}</Text>
      : <Icon name="profile" size={Math.round(size * 0.45)} color={tints[tint].fg} />}
  </View>;
}

export function Swatches({ colors: list, size = 32 }: { colors: string[]; size?: number }) {
  return <View style={{ flexDirection: 'row' }}>
    {list.map((c, i) => <View key={i} style={{ width: size, height: size, borderRadius: radii.round, backgroundColor: c, marginLeft: i ? -10 : 0, borderWidth: i ? 2 : 0, borderColor: colors.ground }} />)}
  </View>;
}

export function Bars({ values, labels, active, color = colors.ink, faded = colors.track, height = 90 }: {
  values: number[]; labels: string[]; active?: number; color?: string; faded?: string; height?: number;
}) {
  const max = Math.max(...values, 1);
  return <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
    {values.map((v, i) => <View key={i} style={{ flex: 1, alignItems: 'center', gap: 8, justifyContent: 'flex-end', height: height + 26 }}>
      <GrowBar height={Math.max(4, (v / max) * height)} delay={i * 40} style={{ width: '100%', maxWidth: 22, borderRadius: radii.check, backgroundColor: active === undefined || active === i ? color : faded }} />
      <T v="meta" style={{ fontSize: 11 }}>{labels[i]}</T>
    </View>)}
  </View>;
}

/* ------------------------------------------------------------------ Sheets */

/**
 * When the keyboard opens, scrolls the whole focused field (not just its caret line) above it, with some room.
 * Multi-line fields (notes) were otherwise left mostly under the keyboard.
 */
export function useKeepFocusedVisible(scroll: React.RefObject<{ scrollResponderScrollNativeHandleToKeyboard?: (node: unknown, offset: number, preventNegative: boolean) => void } | null>) {
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      const input = TextInput.State.currentlyFocusedInput();
      if (input) scroll.current?.scrollResponderScrollNativeHandleToKeyboard?.(input, 24, true);
    });
    return () => sub.remove();
  }, [scroll, focused]);
}

/** True once any of `values` differs from what it was when the form opened. */
export function useDirty(values: unknown): boolean {
  const first = useRef(JSON.stringify(values));
  return JSON.stringify(values) !== first.current;
}

/** Content of a modal route: grabber, centred title and a close button, then scrolling content. */
/** True while the on-screen keyboard is up. Footers step aside so the field being typed in stays visible. */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // No LayoutAnimation here: on the new architecture it reorders native views mid-update and crashed the app
    // ("unmount a view which has a different index") when the keyboard switched type inside a sheet.
    const change = (next: boolean) => setOpen(next);
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => change(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => change(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return open;
}

export function Sheet({ title, children, footer, dirty }: {
  title: string; children: React.ReactNode; footer?: React.ReactNode;
  /** Unsaved changes: closing (swipe down, the X, back) asks before throwing them away. */
  dirty?: boolean;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  usePreventRemove(!!dirty, ({ data }) => {
    // Save and Delete close the sheet themselves; only a swipe down, the X or the back gesture can lose work.
    if (closingOnPurpose()) { navigation.dispatch(data.action); return; }
    Alert.alert('Discard changes?', 'What you typed here hasn’t been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  const insets = useSafeAreaInsets();
  // A page sheet already clears the status bar; only a full-screen open (no screen below it) needs the inset.
  const top = router.canGoBack() ? 0 : insets.top;
  const scrollRef = useRef<ScrollView>(null);
  useKeepFocusedVisible(scrollRef as never);
  // While a sheet is up, the status bar would sit over the dimmed screen behind it (clock over that screen's
  // header). Hide it for the sheet's lifetime; it comes back when the sheet closes.
  useEffect(() => {
    if (Platform.OS !== 'ios' || !router.canGoBack()) return;
    const entry = RNStatusBar.pushStackEntry({ hidden: true, animated: true });
    return () => RNStatusBar.popStackEntry(entry);
  }, [router]);
  return <MotionSurface enter={false}><View style={{ flex: 1, backgroundColor: colors.sheet }}>
    <View style={{ alignItems: 'center', paddingTop: top + 10 }}><View style={{ width: 36, height: 3, backgroundColor: colors.track }} /></View>
    <RowView style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10 }}>
      <View style={{ width: 40 }} />
      <T v="title" lines={1} style={{ flexShrink: 1 }}>{title}</T>
      <RoundButton icon="x" label="Close" onPress={() => (navigation.canGoBack() ? navigation.goBack() : router.replace('/home' as never))} />
    </RowView>
    {/* The scroll view keeps the focused field above the keyboard; the footer stays put under it (no resize). */}
    <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: footer ? 16 : insets.bottom + 24 }} showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>{children}</ScrollView>
    {footer ? <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 4 }}><AtEdge>{footer}</AtEdge></View> : null}
  </View></MotionSurface>;
}
