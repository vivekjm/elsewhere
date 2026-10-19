/**
 * Motion for Trips Loom. Quiet and even: short eased timings, no springs, no bounce.
 *
 * What moves, all of it built into the shared components so every screen gets it:
 * - A screen's content rises in, block by block, the first time it appears (`Reveal`, used by `Screen`).
 * - Rows, cards and sections that arrive later (added, loaded, filtered in) fade up into place (`useArrival`).
 * - Graphs grow to their value when they first appear, then ease between values (`useEased`).
 * - Content that swaps in place (a filter, another day) cross-fades (`Swap`); selections slide or fade.
 *
 * Rules that keep screens stable (each one fixed a real problem):
 * - Nothing can be left hidden. Only the Reanimated value on the UI thread hides content, it starts its timing in
 *   the same effect that hid it, and a timer shows it regardless. (Layout `entering` animations were removed: when
 *   one was skipped, a tab mounted in the background or a fast navigation, the content stayed invisible.)
 * - A screen only animates in when it is the one on screen; a tab mounted in the background shows at rest.
 * - No layout-reflow animations on lists (they read as rubbery) and no per-frame JS work (count-ups re-rendered
 *   text every frame and stuttered). No LayoutAnimation (it crashed the new architecture).
 * Everything holds still when the person has Reduce Motion on.
 */
import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated as RNAnimated, Easing as RNEasing, Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, type SharedValue, type WithTimingConfig } from 'react-native-reanimated';
import { NavigationContext } from 'expo-router/react-navigation';
import * as Haptics from 'expo-haptics';
import { colors, radii } from './tokens';

/** The one timing used for state changes (toggles, fills, markers). */
export const ease = { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System } as const;
/** Press feedback: quick in, quick out. */
const press = { duration: 110, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System } as const;

/** Light haptics for choices and confirmations. Never for scrolling or plain navigation. */
export const haptic = {
  select: () => { void Haptics.selectionAsync().catch(() => {}); },
  tap: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  success: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A pressable that dims and gives slightly (98%) under the finger. */
export function PressScale({ style, children, scaleTo = 0.98, haptics, onPressIn, onPressOut, onPress, ...rest }: PressableProps & {
  style?: StyleProp<ViewStyle>; children?: React.ReactNode; scaleTo?: number; haptics?: 'select' | 'tap';
}) {
  const pressed = useSharedValue(0);
  const reduce = useReducedMotion();
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: reduce ? 1 : 1 - (1 - scaleTo) * pressed.value }],
    opacity: 1 - 0.1 * pressed.value,
  }));
  return <AnimatedPressable {...rest} style={[style, animated]}
    onPressIn={(e) => { pressed.value = withTiming(1, press); onPressIn?.(e); }}
    onPressOut={(e) => { pressed.value = withTiming(0, press); onPressOut?.(e); }}
    onPress={onPress ? (e) => { if (haptics) haptic[haptics](); onPress(e); } : undefined}>
    {children}
  </AnimatedPressable>;
}

/* ------------------------------------------------------------------ surfaces: screens and sheets */

/** A rise: content that appears moves up into place while it fades in. */
const rise = { duration: 320, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System } as const;
/** How a graph grows to its value the first time it is shown. */
const grow = { duration: 700, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System } as const;

/**
 * The screen or sheet a component sits in. `entering` is true while that surface plays its first appearance;
 * anything that mounts after `settledAt` arrived later (added, loaded or filtered in) and fades up on its own.
 */
type Surface = { entering: boolean; settledAt: number };
const SurfaceContext = createContext<Surface | null>(null);

/** A card opened its page with the shared transition: that page shows at rest (the card already brought it in). */
let openingByCard = false;
export function setOpeningByCard(on: boolean) { openingByCard = on; }

/**
 * Whether the screen this renders in is the one showing, read once. Safe outside a screen (the card transition
 * draws page cards above the navigator), where it is false.
 */
function useShowing(): boolean {
  const navigation = useContext(NavigationContext);
  return !!navigation?.isFocused();
}

/** Provides motion for a screen or sheet. `enter`: play the content's first appearance (screens, not sheets). */
export function MotionSurface({ enter, children }: { enter: boolean; children: React.ReactNode }) {
  const focused = useShowing();
  const reduce = useReducedMotion();
  // Decided once, on the first render: a surface mounted in the background, or by the card transition, holds still.
  const [surface] = useState<Surface>(() => {
    const entering = enter && focused && !reduce && !openingByCard;
    return { entering, settledAt: Date.now() + (entering ? 700 : 300) };
  });
  return <SurfaceContext.Provider value={surface}>{children}</SurfaceContext.Provider>;
}

/**
 * Runs a 0 → 1 appearance on the UI thread when `play`, or rests at 1. The value is hidden and its timing started
 * in the same effect, and a timer shows it regardless, so content can never be left invisible.
 */
function useAppear(play: boolean, delay: number, timing: WithTimingConfig & { duration: number } = rise): SharedValue<number> {
  const v = useSharedValue(play ? 0 : 1);
  useEffect(() => {
    if (!play) return;
    v.value = withDelay(delay, withTiming(1, timing));
    const safety = setTimeout(() => { v.value = 1; }, delay + timing.duration + 400);
    return () => clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

/** True when a component mounting now arrived after its surface settled (added, loaded or filtered in). */
function useArrived(): boolean {
  const surface = useContext(SurfaceContext);
  const focused = useShowing();
  const reduce = useReducedMotion();
  const [later] = useState(() => !!surface && focused && !reduce && Date.now() > surface.settledAt);
  return later;
}

/** The gap between a screen's blocks, so a block that draws nothing can give its gap back. */
export const BlockGapContext = createContext(0);

/**
 * One block of a screen's content: rises in with the screen, a beat after the block above it; or, added later, on
 * its own. A block whose component draws nothing (a banner with nothing to say) takes no space: the wrapper would
 * otherwise add an empty gap. Its height is read before the first paint and again whenever it lays out.
 */
export function Reveal({ index, children }: { index: number; children: React.ReactNode }) {
  const surface = useContext(SurfaceContext);
  const gap = useContext(BlockGapContext);
  const arrived = useArrived();
  const entering = !!surface?.entering && Date.now() < surface.settledAt;
  const v = useAppear(entering || arrived, entering ? Math.min(index, 7) * 45 : 0);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 14 }] }));
  const inner = useRef<View>(null);
  const [empty, setEmpty] = useState(false);
  useLayoutEffect(() => {
    const node = inner.current as unknown as { getBoundingClientRect?: () => { height: number } } | null;
    const h = node?.getBoundingClientRect?.().height;
    if (h !== undefined) setEmpty(h === 0);
  }, []);
  return <Animated.View style={[style, empty && gap ? { marginBottom: -gap } : null]}>
    <View ref={inner} collapsable={false} onLayout={(e) => setEmpty(e.nativeEvent.layout.height === 0)}>{children}</View>
  </Animated.View>;
}

/** A row, card or tile that fades up into place when it is added after its screen settled. At rest otherwise. */
export function Arrive({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useAppear(useArrived(), 0, { ...rise, duration: 260 });
  const animated = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 8 }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * Content that changes in place (another filter, another day): the new content fades up from a slight dip instead
 * of snapping. `k` is what it shows; when it changes, the swap plays.
 */
export function Swap({ k, children, style }: { k: string | number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useSharedValue(1);
  const first = useRef(true);
  const reduce = useReducedMotion();
  const outer = useContext(SurfaceContext);
  // Rows that mount because of the swap are part of it, not additions: they don't also fade up on their own.
  const last = useRef(k);
  const surface = useRef<Surface>({ entering: false, settledAt: outer?.settledAt ?? 0 });
  if (last.current !== k) { last.current = k; surface.current = { entering: false, settledAt: Date.now() + 300 }; }
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduce) return;
    v.value = 0;
    v.value = withTiming(1, { ...rise, duration: 240 });
    const safety = setTimeout(() => { v.value = 1; }, 700);
    return () => clearTimeout(safety);
  }, [k, v, reduce]);
  const animated = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * v.value, transform: [{ translateY: (1 - v.value) * 6 }] }));
  return <SurfaceContext.Provider value={surface.current}><Animated.View style={[style, animated]}>{children}</Animated.View></SurfaceContext.Provider>;
}

/** 0 → 1 as `on` turns on, eased: for selections that fade between states instead of snapping. */
export function useOn(on: boolean): SharedValue<number> {
  const t = useSharedValue(on ? 1 : 0);
  useEffect(() => { t.value = withTiming(on ? 1 : 0, ease); }, [on, t]);
  return t;
}

/**
 * A control whose chosen look is different all over (a filled card, white text): draws the plain look, and fades
 * the chosen look in over it as `on` turns on, so the whole thing cross-fades instead of snapping.
 */
export function Selectable({ on, render, style }: { on: boolean; render: (on: boolean) => React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useOn(on);
  const chosen = useAnimatedStyle(() => ({ opacity: t.value }));
  return <View style={style}>
    {render(false)}
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, chosen]}>{render(true)}</Animated.View>
  </View>;
}

/** A line chart that draws itself in from the left when it first appears on screen (at rest in the background). */
export function DrawIn({ height, children }: { height: number; children: React.ReactNode }) {
  const surface = useContext(SurfaceContext);
  const focused = useShowing();
  const reduce = useReducedMotion();
  const [play] = useState(() => !!surface && focused && !reduce);
  const v = useAppear(play, 120, grow);
  const [width, setWidth] = useState(0);
  const clip = useAnimatedStyle(() => ({ width: width * v.value }));
  return <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
    {width ? <Animated.View style={[{ height, overflow: 'hidden' }, clip]}><View style={{ width, height }}>{children}</View></Animated.View> : null}
  </View>;
}

/**
 * A graph's value. It grows from zero the first time it is shown on screen (after the screen's own rise, `delay`
 * staggers bars), then eases between values. Shown at rest when its screen is in the background.
 */
export function useEased(target: number, delay = 0): SharedValue<number> {
  const surface = useContext(SurfaceContext);
  const focused = useShowing();
  const reduce = useReducedMotion();
  const [intro] = useState(() => !!surface && focused && !reduce && target > 0);
  const v = useSharedValue(intro ? 0 : target);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (!intro) return;
      v.value = withDelay(220 + delay, withTiming(target, grow));
      const safety = setTimeout(() => { v.value = target; }, 220 + delay + grow.duration + 400);
      return () => clearTimeout(safety);
    }
    v.value = withTiming(target, ease);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return v;
}

/** A progress fill (0–100). Absolutely positioned inside its track so a change never lays out anything else. */
export function AnimatedFill({ pct, color, radius }: { pct: number; color: string; radius: number }) {
  const width = useEased(Math.max(0, Math.min(100, pct)));
  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius, backgroundColor: color }, style]} />;
}

/** A bar of a chart; shows its height at once and eases when the value changes. */
export function GrowBar({ height, style, delay = 0 }: { height: number; style?: StyleProp<ViewStyle>; delay?: number }) {
  const h = useEased(height, delay);
  const animated = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[style, animated]} />;
}

/* ------------------------------------------------------------------ onboarding and covers */

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Slides in along a thread when it mounts, then breathes very slightly. Decorative only (never holds content). */
export function ThreadBead({ children, size = 44 }: { children: React.ReactNode; size?: number }) {
  const reduce = useReduceMotion();
  const enter = useRef(new RNAnimated.Value(reduce ? 1 : 0)).current;
  const breathe = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (reduce) { enter.setValue(1); return; }
    const intro = RNAnimated.timing(enter, { toValue: 1, duration: 500, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: true });
    const loop = RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.timing(breathe, { toValue: 1, duration: 1800, easing: RNEasing.inOut(RNEasing.sin), useNativeDriver: true }),
      RNAnimated.timing(breathe, { toValue: 0, duration: 1800, easing: RNEasing.inOut(RNEasing.sin), useNativeDriver: true }),
    ]));
    intro.start(() => loop.start());
    return () => { intro.stop(); loop.stop(); };
  }, [enter, breathe, reduce]);
  return <RNAnimated.View style={{
    width: size, height: size, borderRadius: radii.chip, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center',
    opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
    transform: [
      { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) },
      { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
    ],
  }}>{children}</RNAnimated.View>;
}

/** A cover that drifts at a third of the scroll speed going down and stretches when pulled past the top. */
export function ParallaxCover({ y, height, children }: { y?: SharedValue<number>; height: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const v = y?.value ?? 0;
    if (reduce) return {};
    return v < 0 ? { transform: [{ translateY: v / 2 }, { scale: 1 + -v / height }] } : { transform: [{ translateY: v * 0.3 }] };
  });
  return <Animated.View style={{ height, overflow: 'hidden' }}><Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View></Animated.View>;
}
