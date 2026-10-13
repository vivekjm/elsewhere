import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet } from 'react-native';
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';

/**
 * Motion for Trips Loom. Everything springs rather than snapping or easing linearly, so glass and
 * controls feel physical. Every animation collapses to an instant change under Reduce Motion.
 */
export const springs = {
  /** Press-in: quick and firm. */
  press: { speed: 40, bounciness: 0 },
  /** Release: a small overshoot so the control settles back like a soft object. */
  release: { speed: 16, bounciness: 8 },
  /** Sliding selection pills (tab bar, segmented control). */
  slide: { damping: 18, stiffness: 210, mass: 0.9 },
} as const;

/** Live Reduce Motion setting. */
export function useReduceMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return reduced;
}

const OUTER_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'maxWidth', 'margin', 'marginTop', 'marginBottom',
  'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'position', 'top', 'bottom', 'left', 'right', 'zIndex'] as const;

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Buttons 0.97, round buttons 0.92, cards 0.98. */
  scaleTo?: number;
  pressedOpacity?: number;
  disabledOpacity?: number;
  children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
};

/** A Pressable that springs down on touch and springs back with a slight overshoot on release. */
export function PressableScale({
  style, scaleTo = 0.97, pressedOpacity = 1, disabledOpacity = 0.48, disabled, children, onPressIn, onPressOut, ...props
}: PressableScaleProps) {
  const reduced = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  // Layout that positions the control in its parent (flex, alignSelf, margins) belongs on the
  // outer Pressable; everything else (size, fill, radius, padding) stays on the animated view.
  const flat = (StyleSheet.flatten(style) || {}) as ViewStyle;
  const outer: ViewStyle = {};
  const inner: ViewStyle = { ...flat };
  for (const key of OUTER_KEYS) {
    if (key in inner) { (outer as Record<string, unknown>)[key] = (inner as Record<string, unknown>)[key]; delete (inner as Record<string, unknown>)[key]; }
  }
  if (outer.flex !== undefined && inner.width === undefined) inner.flex = 1;
  const to = (value: number, config: typeof springs.press | typeof springs.release) => {
    if (reduced) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue: value, useNativeDriver: true, ...config }).start();
  };
  return (
    <Pressable
      {...props}
      style={outer}
      disabled={disabled}
      onPressIn={(event: GestureResponderEvent) => { setPressed(true); to(scaleTo, springs.press); onPressIn?.(event); }}
      onPressOut={(event: GestureResponderEvent) => { setPressed(false); to(1, springs.release); onPressOut?.(event); }}
    >
      <Animated.View style={[inner, {
        transform: [{ scale }],
        opacity: disabled ? disabledOpacity : pressed ? pressedOpacity : 1,
      }]}>
        {typeof children === 'function' ? children({ pressed }) : children}
      </Animated.View>
    </Pressable>
  );
}

/** Fades and lifts its content in when `id` changes: used for switching between tabs. */
export function FadeSwap({ id, children, style }: { id: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReduceMotion();
  const progress = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [id, reduced, progress]);
  return (
    <Animated.View style={[{ flex: 1, opacity: progress,
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}
