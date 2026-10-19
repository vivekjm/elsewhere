import React from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import { useEased } from './motion';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, SvgXml } from 'react-native-svg';
import { iconPaths, type IconName } from './iconPaths';
import { illustrations, type IllustrationName } from './illustrations';
import { colors } from './tokens';
import { GlassFill, PhotoTone } from './glass';

export type { IconName, IllustrationName };

export function Icon({ name, size = 18, color = colors.ink, strokeWidth = 1.7, filled = false }: {
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
  // Toned like the photos (sepia, a little darker) so the flat scenes sit quietly on the dark glass.
  return <View style={[{ width, height, borderRadius: radius, overflow: 'hidden', isolation: 'isolate' }, style]}>
    <SvgXml xml={xml} width="100%" height="100%" />
    <PhotoTone dim={0.5} />
  </View>;
}

/** The live fill behind a hero: khaki glass, as GymSync's live tile. (Named for the ember gradient it replaced.) */
export function EmberBackdrop({ variant = 'hero' }: { variant?: 'hero' | 'option' }) {
  return <GlassFill kind="khaki" radius={0} edge={variant === 'option'} />;
}

/** A progress ring. `inner` fills the centre so the label stays readable on any background. The arc sweeps to its value. */
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export function Ring({ pct, size = 64, thickness = 7, color = colors.ink, track = colors.track, inner = 'rgba(0, 0, 0, 0)', children }: {
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
