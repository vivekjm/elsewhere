/**
 * Motion for Trips Loom. Calm, quick and physical: things rise into place, cards give under a finger, numbers and
 * bars fill instead of appearing. Everything runs on the UI thread (Reanimated) and holds still when the person has
 * Reduce Motion on.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated as RNAnimated, Easing as RNEasing, Pressable, Text, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing, FadeInDown, LinearTransition, ReduceMotion, runOnJS, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

/** Springs used across the app: `snappy` for presses, `soft` for things settling into place. */
export const springs = {
  snappy: { damping: 18, stiffness: 420, mass: 0.6 },
  soft: { damping: 20, stiffness: 180, mass: 0.9 },
} as const;

/** Light haptics for choices and confirmations. Never for scrolling or plain navigation. */
export const haptic = {
  select: () => { void Haptics.selectionAsync().catch(() => {}); },
  tap: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  success: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
};

/** List items move to their new place instead of jumping when something above them changes. */
export const listLayout = LinearTransition.springify().damping(22).stiffness(220).reduceMotion(ReduceMotion.System);

/** Entering animation for the n-th item of a list: a short rise, staggered and capped so long lists stay quick. */
export const enterItem = (index: number) =>
  FadeInDown.duration(380).delay(Math.min(index, 8) * 45).easing(Easing.out(Easing.cubic)).withInitialValues({ transform: [{ translateY: 12 }] }).reduceMotion(ReduceMotion.System);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A pressable that gives under the finger (scales to 97%) and springs back. Haptic only when asked for. */
export function PressScale({ style, children, scaleTo = 0.97, haptics, onPressIn, onPressOut, onPress, ...rest }: PressableProps & {
  style?: StyleProp<ViewStyle>; children?: React.ReactNode; scaleTo?: number; haptics?: 'select' | 'tap';
}) {
  const pressed = useSharedValue(0);
  const reduce = useReducedMotion();
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: reduce ? 1 : 1 - (1 - scaleTo) * pressed.value }],
    opacity: 1 - 0.08 * pressed.value,
  }));
  return <AnimatedPressable {...rest} style={[style, animated]}
    onPressIn={(e) => { pressed.value = withSpring(1, springs.snappy); onPressIn?.(e); }}
    onPressOut={(e) => { pressed.value = withSpring(0, springs.snappy); onPressOut?.(e); }}
    onPress={onPress ? (e) => { if (haptics) haptic[haptics](); onPress(e); } : undefined}>
    {children}
  </AnimatedPressable>;
}

/** Fades in and rises when it mounts. Stagger siblings with `delay`. */
export function Reveal({ children, delay = 0, distance = 14, style }: { children: React.ReactNode; delay?: number; distance?: number; style?: StyleProp<ViewStyle> }) {
  return <Animated.View style={style}
    entering={FadeInDown.duration(420).delay(delay).easing(Easing.out(Easing.cubic)).withInitialValues({ transform: [{ translateY: distance }] }).reduceMotion(ReduceMotion.System)}>
    {children}
  </Animated.View>;
}

/** A progress fill that grows to its value, and glides when the value changes. */
export function AnimatedFill({ pct, color, height, radius }: { pct: number; color: string; height: number | `${number}%`; radius: number }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withDelay(120, withTiming(Math.max(0, Math.min(100, pct)), { duration: 700, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [pct, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return <Animated.View style={[{ height, borderRadius: radius, backgroundColor: color }, style]} />;
}

/** A bar of a chart that grows up from the baseline. */
export function GrowBar({ height, style, delay = 0 }: { height: number; style?: StyleProp<ViewStyle>; delay?: number }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(delay, withSpring(height, { ...springs.soft, reduceMotion: ReduceMotion.System }));
  }, [height, delay, h]);
  const animated = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[style, animated]} />;
}

/**
 * Counts up to a number when it first shows, and rolls to new values after. `format` turns the running value
 * into text (currency, "3 of 24"); the screen reader always gets the final value.
 */
export function CountUp({ value, format = (n) => String(Math.round(n)), style, duration = 700, maxFontSizeMultiplier, numberOfLines }: {
  value: number; format?: (n: number) => string; style?: StyleProp<TextStyle>; duration?: number; maxFontSizeMultiplier?: number; numberOfLines?: number;
}) {
  const reduce = useReducedMotion();
  const shown = useSharedValue(reduce ? value : 0);
  const [text, setText] = useState(format(reduce ? value : 0));
  useEffect(() => {
    shown.value = reduce ? value : withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
  }, [value, reduce, duration, shown]);
  // The running value comes from the UI thread; it is formatted back on the JS thread, at most once a frame.
  const formatRef = useRef(format);
  formatRef.current = format;
  const show = useCallback((n: number) => setText(formatRef.current(n)), []);
  useAnimatedReaction(() => Math.round(shown.value * 100) / 100, (now, before) => { if (now !== before) runOnJS(show)(now); });
  return <Text style={style} accessibilityLabel={format(value)} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={numberOfLines}>{text}</Text>;
}

/* ------------------------------------------------------------------ core Animated (no worklets needed) */

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Drifts up and down a few points, forever, with a slight tilt: for illustrations, never for text. */
export function Float({ children, range = 6, period = 3200, tilt = 2, style }: { children: React.ReactNode; range?: number; period?: number; tilt?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const t = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.timing(t, { toValue: 1, duration: period / 2, easing: RNEasing.inOut(RNEasing.sin), useNativeDriver: true }),
      RNAnimated.timing(t, { toValue: 0, duration: period / 2, easing: RNEasing.inOut(RNEasing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t, period, reduce]);
  return <RNAnimated.View style={[style, {
    transform: [
      { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [range, -range] }) },
      { rotate: t.interpolate({ inputRange: [0, 1], outputRange: [`${-tilt}deg`, `${tilt}deg`] }) },
    ],
  }]}>{children}</RNAnimated.View>;
}

/** Springs to a slightly larger size while `on`, for cards that are chosen. */
export function Pop({ on, children, style }: { on: boolean; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(on ? 1 : 0);
  useEffect(() => { s.value = withSpring(on ? 1 : 0, springs.snappy); }, [on, s]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.02 * s.value }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** Slides in along a thread from the left when it mounts, then breathes very slightly. */
export function ThreadBead({ children, size = 44 }: { children: React.ReactNode; size?: number }) {
  const reduce = useReduceMotion();
  const enter = useRef(new RNAnimated.Value(reduce ? 1 : 0)).current;
  const breathe = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (reduce) { enter.setValue(1); return; }
    const intro = RNAnimated.timing(enter, { toValue: 1, duration: 650, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: true });
    const loop = RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.timing(breathe, { toValue: 1, duration: 1800, easing: RNEasing.inOut(RNEasing.sin), useNativeDriver: true }),
      RNAnimated.timing(breathe, { toValue: 0, duration: 1800, easing: RNEasing.inOut(RNEasing.sin), useNativeDriver: true }),
    ]));
    intro.start(() => loop.start());
    return () => { intro.stop(); loop.stop(); };
  }, [enter, breathe, reduce]);
  return <RNAnimated.View style={{
    width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    opacity: enter,
    transform: [
      { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) },
      { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
    ],
  }}>{children}</RNAnimated.View>;
}

/**
 * A cover image that moves with the scroll: it drifts at a third of the scroll speed going down, and stretches
 * when pulled past the top. Pass the screen's scroll position (useScrollY) and the cover's height.
 */
export function ParallaxCover({ y, height, children }: { y?: import('react-native-reanimated').SharedValue<number>; height: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const v = y?.value ?? 0;
    if (reduce) return {};
    return v < 0
      ? { transform: [{ translateY: v / 2 }, { scale: 1 + -v / height }] }
      : { transform: [{ translateY: v * 0.3 }] };
  });
  return <Animated.View style={[{ height, overflow: 'hidden' }]}><Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View></Animated.View>;
}
