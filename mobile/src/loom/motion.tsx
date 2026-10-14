/**
 * Motion for Trips Loom. Quiet and even: short eased timings, no springs, no bounce.
 *
 * Rules that keep screens stable (each one fixed a real problem):
 * - Content never starts hidden. No entering animations on screens or lists: if one is skipped (a tab mounted in
 *   the background, a fast navigation) the content stays invisible and the screen looks empty.
 * - Nothing animates while a screen is opening. Bars, rings and fills show their value at once and only animate
 *   when the value changes, so a push or tab switch never competes with a dozen animations.
 * - No layout-reflow animations on lists (they read as rubbery) and no per-frame JS work (count-ups re-rendered
 *   text every frame and stuttered).
 * Everything holds still when the person has Reduce Motion on.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated as RNAnimated, Easing as RNEasing, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

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

/**
 * A value that starts where it is and eases to new values. Fills, bars and rings render complete on the first
 * frame and only move when the data changes.
 */
export function useEased(target: number): SharedValue<number> {
  const v = useSharedValue(target);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    v.value = withTiming(target, ease);
  }, [target, v]);
  return v;
}

/** A progress fill (0–100). Absolutely positioned inside its track so a change never lays out anything else. */
export function AnimatedFill({ pct, color, radius }: { pct: number; color: string; radius: number }) {
  const width = useEased(Math.max(0, Math.min(100, pct)));
  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius, backgroundColor: color }, style]} />;
}

/** A bar of a chart; shows its height at once and eases when the value changes. */
export function GrowBar({ height, style }: { height: number; style?: StyleProp<ViewStyle> }) {
  const h = useEased(height);
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
    width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
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
