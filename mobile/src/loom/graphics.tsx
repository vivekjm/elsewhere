import React from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import { useEased } from './motion';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop, SvgXml } from 'react-native-svg';
import { iconPaths, type IconName } from './iconPaths';
import { illustrations, type IllustrationName } from './illustrations';
import { colors, ember } from './tokens';

export type { IconName, IllustrationName };

export function Icon({ name, size = 18, color = colors.ink, strokeWidth = 2, filled = false }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number; filled?: boolean;
}) {
  const fill = filled ? color : 'none';
  const sw = filled ? 1.2 : strokeWidth;
  const xml = `<svg viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}

/** A flat, smooth-edged scene in the chip tints. Fills its box (slice). */
const ALIGN = { top: 'xMidYMin', center: 'xMidYMid', bottom: 'xMidYMax' } as const;

/** `align` picks which part of the scene a wide crop keeps. */
export function Illustration({ name, width, height, radius = 0, style, align = 'center' }: {
  name: IllustrationName; width: number | `${number}%`; height: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle>; align?: keyof typeof ALIGN;
}) {
  const xml = align === 'center' ? illustrations[name] : illustrations[name].replace('xMidYMid slice', `${ALIGN[align]} slice`);
  return <View style={[{ width, height, borderRadius: radius, overflow: 'hidden' }, style]}>
    <SvgXml xml={xml} width="100%" height="100%" />
  </View>;
}

/** The ember gradient with soft glows, drawn behind hero content. Measures its box so it always fills it. */
export function EmberBackdrop({ variant = 'hero' }: { variant?: 'hero' | 'option' }) {
  const id = React.useId().replace(/:/g, '');
  // Percent sizing with preserveAspectRatio="none" fills the box without waiting for a layout measurement,
  // which some screens never re-delivered after their first pass.
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
    {<Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={`g${id}`} x1="0" y1="0" x2="0.75" y2="1">
          <Stop offset="0" stopColor={ember.from} />
          <Stop offset={variant === 'option' ? '0.55' : '0.45'} stopColor={ember.mid} />
          <Stop offset="1" stopColor={ember.to} />
        </LinearGradient>
        <RadialGradient id={`a${id}`} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={ember.glowLight} stopOpacity="0.55" /><Stop offset="1" stopColor={ember.glowLight} stopOpacity="0" /></RadialGradient>
        <RadialGradient id={`b${id}`} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={ember.glowHot} stopOpacity="0.55" /><Stop offset="1" stopColor={ember.glowHot} stopOpacity="0" /></RadialGradient>
        <RadialGradient id={`c${id}`} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={ember.glowSoft} stopOpacity="0.6" /><Stop offset="1" stopColor={ember.glowSoft} stopOpacity="0" /></RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#g${id})`} />
      <Ellipse cx="10" cy="5" rx="55" ry="45" fill={`url(#a${id})`} />
      <Ellipse cx="100" cy="45" rx="50" ry="50" fill={`url(#b${id})`} />
      <Ellipse cx="45" cy="105" rx="60" ry="35" fill={`url(#c${id})`} />
    </Svg>}
  </View>;
}

/** A progress ring. `inner` fills the centre so the label stays readable on any background. The arc sweeps to its value. */
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export function Ring({ pct, size = 64, thickness = 7, color = '#FFFFFF', track = 'rgba(255,255,255,0.35)', inner = 'rgba(255,106,43,0.92)', children }: {
  pct: number; size?: number; thickness?: number; color?: string; track?: string; inner?: string; children?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  // Complete on the first frame; eases only when the value changes.
  const shown = useEased(Math.max(0, Math.min(100, pct)));
  // At 0% a round cap would still draw a dot; hide the arc until there is some progress.
  const arc = useAnimatedProps(() => ({ strokeDasharray: [(c * shown.value) / 100, c], strokeOpacity: shown.value > 0.5 ? 1 : 0 }));
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={size} height={size} style={{ position: 'absolute' }}>
      <Circle cx={size / 2} cy={size / 2} r={r - thickness / 2} fill={inner} />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={thickness} fill="none" />
      <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={thickness} fill="none" strokeLinecap="round"
        animatedProps={arc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
    {children}
  </View>;
}
