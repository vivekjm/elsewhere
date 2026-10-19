/**
 * The 3.0 look, from GymSync: warm charcoal panes that touch on a near-black page, and photos (toned to sepia)
 * only where they say something: a trip's hero, its cover, the welcome screen.
 */
import React, { createContext, useContext } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { blur, colors, radii } from './tokens';

export const PHOTOS = {
  sikkim: require('../../assets/photos/sikkim.jpg') as ImageSourcePropType,
  coast: require('../../assets/photos/coast.jpg') as ImageSourcePropType,
};

/** The photo a hero falls back to when there's no picture of its own. */
export const BackdropContext = createContext<ImageSourcePropType>(PHOTOS.sikkim);
export const useBackdrop = () => useContext(BackdropContext);

const fill = StyleSheet.absoluteFill;

/**
 * GymSync's sepia: the photo half desaturated, warmed and a little darker. iOS has no CSS filters, so blend
 * layers do it (the parent isolates them so they only tint the photo).
 */
export function PhotoTone({ dim = 0.18 }: { dim?: number }) {
  return <>
    <View pointerEvents="none" style={[fill, { backgroundColor: '#808080', mixBlendMode: 'saturation', opacity: 0.5 }]} />
    <View pointerEvents="none" style={[fill, { backgroundColor: '#7a5a34', mixBlendMode: 'color', opacity: 0.22 }]} />
    {dim ? <View pointerEvents="none" style={[fill, { backgroundColor: `rgba(0, 0, 0, ${dim})` }]} /> : null}
  </>;
}

/** A photo shown the 3.0 way: toned, filling its box. */
export function Photo({ source, style }: { source: ImageSourcePropType; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ overflow: 'hidden', isolation: 'isolate', backgroundColor: colors.ground }, style]}>
    <Image source={source} resizeMode="cover" style={fill} accessibilityIgnoresInvertColors />
    <PhotoTone />
  </View>;
}

/** A photo filling its box as a hero's background: toned, veiled so white text and glass read on any picture. */
export function Backdrop({ source, onError }: { source?: ImageSourcePropType; onError?: () => void }) {
  const fallback = useBackdrop();
  return <View pointerEvents="none" style={[fill, { backgroundColor: colors.ground, overflow: 'hidden', isolation: 'isolate' }]}>
    <Image source={source ?? fallback} resizeMode="cover" style={fill} onError={onError} accessibilityIgnoresInvertColors />
    <PhotoTone />
    <LinearGradient colors={['rgba(13, 12, 9, 0.22)', colors.veil, colors.veil]} locations={[0, 0.26, 1]} style={fill} />
    <LinearGradient colors={['rgba(13, 12, 9, 0)', 'rgba(13, 12, 9, 0)', colors.scrim]} locations={[0, 0.55, 1]} style={fill} />
  </View>;
}

export type GlassKind = 'surface' | 'raised' | 'control' | 'pressed' | 'glass' | 'strong' | 'khaki' | 'sheet';
const FILL: Record<Exclude<GlassKind, 'khaki'>, string> = {
  surface: colors.surface, raised: colors.surfaceRaised, control: colors.controlGlass, pressed: colors.controlPressed,
  glass: colors.glass, strong: colors.glassStrong, sheet: colors.sheet,
};
/** See-through kinds, used over a photo or a map: they blur what's behind them. */
const SEE_THROUGH: GlassKind[] = ['glass', 'strong'];
/** Keys and fields carry a faint edge; tiles are told apart by the gaps between them. */
const EDGED: GlassKind[] = ['control', 'pressed', 'glass', 'strong'];

/**
 * A pane's fill, as layers filling its parent: its colour (khaki as a soft gradient), a faint sheen from the
 * top-left, and for keys a light edge. See-through glass over photos also blurs what's behind. Put it first inside
 * any box with a radius.
 */
export function GlassFill({ kind = 'surface', radius = radii.card, edge, sheen = true, blurred }: {
  kind?: GlassKind; radius?: number; edge?: boolean; sheen?: boolean;
  /** Blur what's behind (over a photo, a map, or content scrolling under a bar). On by default only for see-through glass. */
  blurred?: boolean;
}) {
  const khaki = kind === 'khaki';
  const frosted = blurred ?? SEE_THROUGH.includes(kind);
  return <View pointerEvents="none" style={[fill, { borderRadius: radius, overflow: 'hidden' }]}>
    {frosted ? <BlurView tint="dark" intensity={SEE_THROUGH.includes(kind) ? blur.glass : blur.heavy} style={fill} /> : null}
    {khaki
      ? <LinearGradient colors={[colors.khakiDeep, colors.khaki]} style={fill} />
      : <View style={[fill, { backgroundColor: FILL[kind] }]} />}
    {sheen ? <LinearGradient colors={[khaki ? 'rgba(251, 248, 241, 0.08)' : 'rgba(251, 248, 241, 0.045)', 'rgba(251, 248, 241, 0)']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} locations={[0, 0.55]} style={fill} /> : null}
    {edge ?? EDGED.includes(kind) ? <View style={[fill, { borderRadius: radius, borderWidth: 1, borderColor: colors.hairline }]} /> : null}
  </View>;
}

/** A pane. `style` lays out its content (padding, gap, direction); the fill sits behind it. */
export function Glass({ kind = 'surface', radius = radii.card, style, children, edge, sheen, accessible, accessibilityLabel }: {
  kind?: GlassKind; radius?: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode; edge?: boolean; sheen?: boolean;
  accessible?: boolean; accessibilityLabel?: string;
}) {
  return <View accessible={accessible} accessibilityLabel={accessibilityLabel} style={[{ borderRadius: radius }, style]}>
    <GlassFill kind={kind} radius={radius} edge={edge} sheen={sheen} />
    {children}
  </View>;
}

/** Tiles laid edge to edge with a 2pt gap, the photo showing through the seams. Square inside, 4pt at the outer corners. */
export function Mosaic({ children, style, row }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; row?: boolean }) {
  return <View style={[{ gap: 2, borderRadius: radii.card, overflow: 'hidden', flexDirection: row ? 'row' : 'column' }, style]}>{children}</View>;
}

/** One line of tiles inside a Mosaic. */
export function MosaicRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', gap: 2 }, style]}>{children}</View>;
}
