import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  ImageSourcePropType,
  PressableProps,
  StyleProp,
  TextInputProps,
  TextProps,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Host as SwiftHost, Picker as SwiftPicker, Text as SwiftText } from '@expo/ui/swift-ui';
import { pickerStyle, tag, tint as swiftTint } from '@expo/ui/swift-ui/modifiers';
import { Icon, type IconName } from './icons';
import { PressableScale, springs, useReduceMotion } from './motion';
import { useTheme } from './theme';
import type { Mood, TextVariant, ThemeColors } from './tokens';

type TextTone = 'default' | 'muted' | 'accent' | 'danger' | 'success' | 'inverse' | 'onImage';

export function AppText({
  variant = 'body', tone = 'default', style, children, ...props
}: TextProps & { variant?: TextVariant; tone?: TextTone }) {
  const { colors, typography } = useTheme();
  const textColor = tone === 'muted' ? colors.textMuted
    : tone === 'accent' ? colors.accent
      : tone === 'danger' ? colors.danger
        : tone === 'success' ? colors.success
          : tone === 'inverse' ? colors.onPrimary
            : tone === 'onImage' ? colors.onImage : colors.text;
  return <Text {...props} style={[typography[variant], { color: textColor }, style]}>{children}</Text>;
}

/** The italic serif name with an accent full stop. */
export function Wordmark({ size = 36 }: { size?: number }) {
  const { colors, typography } = useTheme();
  return (
    <Text accessibilityRole="header" accessibilityLabel="trips loom"
      style={[typography.wordmark, { color: colors.text, fontSize: size, lineHeight: Math.round(size * 1.1), letterSpacing: -size * 0.05 }]}>
      trips loom<Text style={{ color: colors.accent }}>.</Text>
    </Text>
  );
}

/** Live Reduce Transparency setting; glass falls back to solid surfaces when it is on. */
export function useReduceTransparency() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((value) => { if (mounted) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return reduced;
}

export function liquidGlassAvailable() {
  if (Platform.OS !== 'ios') return false;
  try { return isGlassEffectAPIAvailable() && isLiquidGlassAvailable(); } catch { return false; }
}

/**
 * Floating glass chrome. iOS 26+ renders native Liquid Glass (`interactive` adds the system's own
 * touch response: it swells and shimmers under the finger); older iOS blurs; Android and
 * Reduce Transparency use the translucent `glass` colour or solid `surface`.
 */
export function GlassSurface({ children, style, tone = 'chrome', intensity = 40, interactive = false, ...props }: ViewProps & {
  tone?: 'chrome' | 'onImage'; intensity?: number; interactive?: boolean;
}) {
  const { colors, mode } = useTheme();
  const reduced = useReduceTransparency();
  const onImage = tone === 'onImage';
  const fill = onImage ? colors.glassOnImage : colors.glass;
  const edge = onImage ? colors.glassOnImageEdge : colors.glassEdge;
  const frame: ViewStyle = { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: edge };
  if (reduced) {
    return <View {...props} style={[frame, { backgroundColor: onImage ? 'rgba(0, 0, 0, 0.55)' : colors.surface }, style]}>{children}</View>;
  }
  // Native Liquid Glass for chrome only: on photos it turns clear and white text loses its backing,
  // so pills over imagery keep the dark tinted blur below, which holds contrast on any image.
  if (!onImage && liquidGlassAvailable()) {
    return <GlassView {...props} glassEffectStyle="regular" isInteractive={interactive} colorScheme={mode}
      tintColor={fill} style={[frame, style]}>{children}</GlassView>;
  }
  if (Platform.OS === 'ios') {
    return (
      <BlurView {...props} intensity={intensity} tint={onImage ? 'dark' : mode === 'dark' ? 'dark' : 'light'}
        style={[frame, { backgroundColor: fill }, style]}>
        {children}
      </BlurView>
    );
  }
  return <View {...props} style={[frame, { backgroundColor: onImage ? 'rgba(30, 30, 30, 0.42)' : colors.glass }, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'tonal' | 'secondary' | 'ghost' | 'danger' | 'glass';

function buttonColors(variant: ButtonVariant, colors: ThemeColors, mode: 'light' | 'dark') {
  switch (variant) {
    case 'primary': return { backgroundColor: colors.primary, color: colors.onPrimary, borderColor: colors.primary };
    case 'tonal': return { backgroundColor: colors.accentSoft, color: mode === 'dark' ? colors.text : colors.primary, borderColor: colors.accentSoft };
    case 'danger': return { backgroundColor: colors.danger, color: colors.onDanger, borderColor: colors.danger };
    case 'ghost': return { backgroundColor: 'transparent', color: colors.text, borderColor: 'transparent' };
    case 'glass': return { backgroundColor: colors.glass, color: colors.text, borderColor: colors.glassEdge };
    default: return { backgroundColor: colors.surface, color: colors.text, borderColor: colors.textMuted };
  }
}

/** Pill action, 48pt minimum. One `primary` per screen; `secondary` is the outline variant. */
export function AppButton({
  label, variant = 'primary', icon, trailingIcon, size = 'md', loading = false, disabled = false,
  style, labelStyle, accessibilityLabel, ...props
}: Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  icon?: IconName | React.ReactNode;
  trailingIcon?: IconName;
  size?: 'md' | 'sm';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}) {
  const { colors, mode, spacing, radii, typography, touch, opacity, shadows } = useTheme();
  const tint = buttonColors(variant, colors, mode);
  const inactive = disabled || loading;
  const small = size === 'sm';
  const leading = typeof icon === 'string' ? <Icon name={icon as IconName} size={18} color={tint.color} /> : icon;
  return (
    <PressableScale
      {...props}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      scaleTo={0.97}
      pressedOpacity={variant === 'ghost' ? opacity.pressed : 0.92}
      disabledOpacity={opacity.disabled}
      style={[
        styles.button,
        { minHeight: small ? 40 : touch.min, backgroundColor: tint.backgroundColor, borderColor: tint.borderColor,
          borderRadius: radii.pill, paddingHorizontal: small ? spacing.md : spacing.lg },
        variant === 'primary' || variant === 'glass' ? { ...shadows.float, shadowColor: colors.shadow } : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={tint.color} size="small" /> : leading}
      <Text style={[small ? typography.chip : typography.bodyStrong, { color: tint.color }, small && { fontFamily: typography.bodyStrong.fontFamily }, labelStyle]}>{label}</Text>
      {trailingIcon && !loading ? <Icon name={trailingIcon} size={18} color={tint.color} /> : null}
    </PressableScale>
  );
}

type IconButtonVariant = 'ghost' | 'glass' | 'onImage' | 'solid' | 'tonal' | 'raised';

/** Round icon-only button. `label` is required for screen readers. */
export function IconButton({
  icon, label, variant = 'ghost', size = 'md', selected, iconColor, style, disabled = false, ...props
}: Omit<PressableProps, 'children' | 'style'> & {
  icon: IconName | React.ReactNode;
  label: string;
  variant?: IconButtonVariant;
  size?: 'md' | 'sm' | 'lg';
  selected?: boolean;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, mode, opacity, shadows } = useTheme();
  const dimension = size === 'lg' ? 56 : size === 'sm' ? 36 : 48;
  const color = iconColor ?? (variant === 'onImage' ? (selected ? colors.primary : colors.onImage)
    : variant === 'solid' ? colors.onPrimary
      : variant === 'tonal' ? (mode === 'dark' ? colors.text : colors.primary) : colors.text);
  const glyph = typeof icon === 'string' ? <Icon name={icon as IconName} size={size === 'sm' ? 18 : 22} color={color} /> : icon;
  const shape: ViewStyle = { width: dimension, height: dimension, borderRadius: dimension / 2, alignItems: 'center', justifyContent: 'center' };
  // Glass chrome gets the `glass` fill underneath the native material so it keeps a visible body and can cast its float shadow.
  const floating = variant === 'glass' ? { ...shadows.float, shadowColor: colors.shadow, backgroundColor: colors.glass }
    : variant === 'raised' ? { ...shadows.float, shadowColor: colors.shadow } : null;
  const glass = variant === 'glass' || (variant === 'onImage' && !selected);
  return (
    <PressableScale
      {...props}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected }}
      disabled={disabled}
      hitSlop={dimension < 48 ? (48 - dimension) / 2 : 4}
      scaleTo={0.9}
      disabledOpacity={opacity.disabled}
      style={[shape, floating, style]}
    >
      {({ pressed }) => {
        if (glass) {
          return <GlassSurface interactive tone={variant === 'onImage' ? 'onImage' : 'chrome'} style={[shape, { position: 'absolute' }]}>{glyph}</GlassSurface>;
        }
        const backgroundColor = variant === 'solid' ? colors.primary
          : variant === 'tonal' ? colors.accentSoft
            : variant === 'raised' ? colors.surface
              : variant === 'onImage' ? colors.onImage
                : pressed ? colors.surfaceAlt : 'transparent';
        return <View style={[shape, { position: 'absolute', backgroundColor }]}>{glyph}</View>;
      }}
    </PressableScale>
  );
}

type ChipVariant = 'solid' | 'outline' | 'glass' | 'onImage';

/** Label or toggle pill. Selected solid/outline chips fill with `primary`. */
export function Chip({ label, icon, variant = 'solid', selected, onPress, style }: {
  label: string; icon?: IconName; variant?: ChipVariant; selected?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const { colors, radii, spacing, typography } = useTheme();
  const onImage = variant === 'onImage';
  const glass = variant === 'glass';
  const color = onImage ? colors.onImage : selected ? colors.onPrimary : colors.text;
  const base: ViewStyle = {
    flexDirection: 'row', alignItems: 'center', borderRadius: radii.pill,
    minHeight: onImage ? 30 : glass ? 48 : onPress ? 40 : 36, gap: onImage ? 5 : spacing.xs,
    paddingHorizontal: onImage ? 10 : glass ? 20 : spacing.md,
  };
  const content = <>
    {icon ? <Icon name={icon} size={onImage ? 14 : 16} color={color} /> : null}
    <Text numberOfLines={1} style={[typography.chip, { color }, onImage && { fontSize: 13 }, glass && typography.bodyStrong]}>{label}</Text>
  </>;
  if (onImage || glass) {
    const surface = <GlassSurface interactive={!!onPress} tone={onImage ? 'onImage' : 'chrome'} style={[base, !onPress && style]}>{content}</GlassSurface>;
    if (!onPress) return surface;
    return (
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.95}
        style={[{ borderRadius: radii.pill }, style]}>
        {surface}
      </PressableScale>
    );
  }
  const fill: ViewStyle = selected
    ? { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary }
    : variant === 'outline' ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }
      : { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.surfaceAlt };
  if (!onPress) return <View style={[base, fill, style]}>{content}</View>;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!selected }}
      scaleTo={0.95} style={[base, fill, style]}>
      {content}
    </PressableScale>
  );
}

/** Opaque reading surface. `elevated` lifts it with shadow-card; `tone="alt"` recesses it. */
export function Card({ children, style, elevated = false, tone = 'default', ...props }: ViewProps & { elevated?: boolean; tone?: 'default' | 'alt' }) {
  const { colors, radii, spacing, shadows } = useTheme();
  return <View {...props} style={[{
    backgroundColor: tone === 'alt' ? colors.surfaceAlt : colors.surface,
    borderColor: elevated || tone === 'alt' ? 'transparent' : colors.border, borderWidth: 1,
    borderRadius: radii.xl, padding: spacing.md,
  }, elevated && { ...shadows.card, shadowColor: colors.shadow }, style]}>{children}</View>;
}

/** Photo-first trip card: the image melts into its mood colour, with glass facts on top. */
export function TripCard({
  title, meta, metaIcon = 'location', image, mood = 'coast', badge, chips, action, actionLabel,
  actionSelected, onAction, onPress, onLongPress, accessibilityLabel, height = 240, style,
}: {
  title: string;
  meta?: string;
  metaIcon?: IconName;
  image: ImageSourcePropType;
  mood?: Mood;
  badge?: string;
  chips?: { icon?: IconName; label: string }[];
  action?: IconName;
  actionLabel?: string;
  actionSelected?: boolean;
  onAction?: () => void;
  onPress?: () => void;
  /** Long-press opens the card's actions (native action sheet), like a context menu. */
  onLongPress?: () => void;
  accessibilityLabel?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radii, typography, shadows } = useTheme();
  const moodColor = colors.moods[mood];
  return (
    <PressableScale onPress={onPress} onLongPress={onLongPress} delayLongPress={350} disabled={!onPress} disabledOpacity={1} scaleTo={0.975} accessibilityRole={onPress ? 'button' : undefined}
      accessibilityActions={onLongPress ? [{ name: 'longpress', label: 'More actions' }] : undefined} onAccessibilityAction={onLongPress ? () => onLongPress() : undefined}
      accessibilityLabel={accessibilityLabel ?? [title, meta, badge, ...(chips || []).map((chip) => chip.label)].filter(Boolean).join(', ')}
      style={[{ height, borderRadius: radii.xxl, ...shadows.photo, shadowOpacity: 0.14, shadowColor: colors.shadow }, style]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radii.xxl, overflow: 'hidden', backgroundColor: moodColor }]}>
        {/* Full-bleed photo; the lower half frosts and melts into the card's own colour. */}
        <Image source={image} resizeMode="cover" accessibilityIgnoresInvertColors style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '84%', width: '100%' }} />
        {Platform.OS === 'ios' ? <BlurView intensity={14} tint="dark" pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: '62%', bottom: 0 }} /> : null}
        <LinearGradient colors={[`${moodColor}00`, `${moodColor}00`, `${moodColor}B8`, moodColor]} locations={[0, 0.48, 0.7, 0.9]}
          style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingBottom: 12 }}>
          <Text numberOfLines={1} style={[typography.cardTitle, { color: colors.onImage }]}>{title}</Text>
          {meta ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <Icon name={metaIcon} size={13} color={colors.onImage} />
            <Text numberOfLines={1} style={[typography.cardMeta, { color: colors.onImage, opacity: 0.85, flexShrink: 1 }]}>{meta}</Text>
          </View> : null}
          {chips?.length ? <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
            {chips.slice(0, 2).map((chip) => <FrostChip key={chip.label} icon={chip.icon} label={chip.label} />)}
          </View> : null}
        </View>
      </View>
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 12, left: 12, right: 12,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {badge ? <GlassSurface tone="onImage" style={{ height: 36, paddingHorizontal: 14, borderRadius: radii.pill, justifyContent: 'center' }}>
          <Text style={[typography.bodyStrong, { color: colors.onImage, fontSize: 15, lineHeight: 20, fontFamily: typography.chip.fontFamily }]}>{badge}</Text>
        </GlassSurface> : <View />}
        {action && onAction ? <IconButton variant="onImage" size="sm" icon={action} label={actionLabel ?? action}
          selected={actionSelected} onPress={onAction} /> : null}
      </View>
    </PressableScale>
  );
}

/** A light frosted pill for facts sitting on a card's scrim (rating, days, dates). */
function FrostChip({ icon, label }: { icon?: IconName; label: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 11, borderRadius: 15,
      backgroundColor: 'rgba(255, 255, 255, 0.16)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.24)' }}>
      {icon ? <Icon name={icon} size={13} color={colors.onImage} /> : null}
      <Text numberOfLines={1} style={[typography.chip, { fontSize: 13, color: colors.onImage, opacity: 0.95 }]}>{label}</Text>
    </View>
  );
}

/** Centred route header: glass back button, title and subtitle, trailing glass chip, optional faded backdrop image. */
export function ScreenHeader({ title, subtitle, onBack, backLabel = 'Back', trailing, backdrop }: {
  title: string; subtitle?: string; onBack?: () => void; backLabel?: string; trailing?: React.ReactNode; backdrop?: ImageSourcePropType;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ paddingTop: spacing.xs, paddingBottom: backdrop ? spacing.md : spacing.xs }}>
      {backdrop ? <FadedBackdrop source={backdrop} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 56, alignItems: 'flex-start' }}>
          {onBack ? <IconButton variant="glass" size="lg" icon="undo" label={backLabel} onPress={onBack} /> : null}
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text accessibilityRole="header" numberOfLines={1} style={[typography.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={[typography.subtitle, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text> : null}
        </View>
        <View style={{ minWidth: 56, alignItems: 'flex-end' }}>{trailing}</View>
      </View>
    </View>
  );
}

const BACKDROP_SLICES = 16;

/**
 * The destination image behind a ScreenHeader, fading out toward the bottom. The fade is built from
 * stacked slices of decreasing opacity (no mask view needed) so the canvas glow shows through.
 */
function FadedBackdrop({ source }: { source: ImageSourcePropType }) {
  const { spacing, mode } = useTheme();
  const [height, setHeight] = useState(0);
  const peak = mode === 'dark' ? 0.14 : 0.24;
  // Slices meet on whole pixels so no seam doubles its opacity; the first few ramp in to avoid a hard top edge.
  const edge = (index: number) => PixelRatio.roundToNearestPixel((index * height) / BACKDROP_SLICES);
  const alpha = (index: number) => peak * Math.min(1, (index + 1) / 4) * Math.pow(1 - index / BACKDROP_SLICES, 1.6);
  return (
    <View pointerEvents="none" onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      style={{ position: 'absolute', top: -spacing.xs, bottom: 0, left: -spacing.md, right: -spacing.md }}>
      {height > 0 ? Array.from({ length: BACKDROP_SLICES }, (_, index) => (
        <View key={index} style={{ position: 'absolute', left: 0, right: 0, top: edge(index), height: edge(index + 1) - edge(index),
          overflow: 'hidden', opacity: alpha(index) }}>
          <Image source={source} resizeMode="cover" style={{ position: 'absolute', left: 0, right: 0, top: -edge(index), height, width: '100%' }} />
        </View>
      )) : null}
    </View>
  );
}

/** Section title + muted subtitle with an optional raised round action. */
export function SectionHeader({ title, subtitle, action, actionLabel, onAction, style }: {
  title: string; subtitle?: string; action?: IconName; actionLabel?: string; onAction?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.xxs }, style]}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={[typography.section, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[typography.subtitle, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? <IconButton variant="raised" icon={action} label={actionLabel ?? action} onPress={onAction} /> : null}
    </View>
  );
}

/** Two to four mutually exclusive options. iOS renders the system segmented control (SwiftUI Picker). */
export function SegmentedControl<T extends string>(props: {
  options: { value: T; label: string; icon?: IconName }[]; value: T; onChange: (value: T) => void; label: string; stretch?: boolean;
}) {
  const { mode, colors } = useTheme();
  if (Platform.OS === 'ios') {
    return (
      <SwiftHost matchContents={{ vertical: true }} colorScheme={mode} style={{ alignSelf: 'stretch' }}>
        <SwiftPicker selection={props.value} modifiers={[pickerStyle('segmented'), swiftTint(colors.primary)]}
          onSelectionChange={(next: T) => { void Haptics.selectionAsync(); props.onChange(next); }}>
          {props.options.map((option) => <SwiftText key={option.value} modifiers={[tag(option.value)]}>{option.label}</SwiftText>)}
        </SwiftPicker>
      </SwiftHost>
    );
  }
  return <PillSegmentedControl {...props} />;
}

/** Pill radiogroup fallback (Android): the selection pill springs between options. */
function PillSegmentedControl<T extends string>({ options, value, onChange, label, stretch = false }: {
  options: { value: T; label: string; icon?: IconName }[]; value: T; onChange: (value: T) => void; label: string; stretch?: boolean;
}) {
  const { colors, spacing, radii, typography, shadows, mode } = useTheme();
  const [frames, setFrames] = useState<Record<string, { x: number; width: number }>>({});
  const reduced = useReduceMotion();
  const x = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;
  const target = frames[value];
  const placed = useRef(false);
  useEffect(() => {
    if (!target) return;
    if (!placed.current || reduced) { x.setValue(target.x); width.setValue(target.width); placed.current = true; return; }
    Animated.parallel([
      Animated.spring(x, { toValue: target.x, useNativeDriver: false, ...springs.slide }),
      Animated.spring(width, { toValue: target.width, useNativeDriver: false, ...springs.slide }),
    ]).start();
  }, [target?.x, target?.width, reduced]);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label}
      style={{ flexDirection: 'row', alignSelf: stretch ? 'stretch' : 'flex-start', gap: 2, padding: 4, borderRadius: radii.pill, backgroundColor: colors.surfaceAlt }}>
      {target ? <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 4, bottom: 4, left: x, width, borderRadius: radii.pill,
        backgroundColor: mode === 'dark' ? colors.accentSoft : colors.surface, ...shadows.float, shadowOpacity: 0.08, shadowColor: colors.shadow }} /> : null}
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            onLayout={(event) => { const { x: left, width: w } = event.nativeEvent.layout; setFrames((all) => ({ ...all, [option.value]: { x: left, width: w } })); }}
            style={{ flex: stretch ? 1 : undefined, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40,
              paddingHorizontal: spacing.md, borderRadius: radii.pill }}>
            {option.icon ? <Icon name={option.icon} size={16} color={on ? colors.text : colors.textMuted} /> : null}
            <Text style={[typography.chip, { color: on ? colors.text : colors.textMuted }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TextField({
  label, hint, error, icon, optional = false, containerStyle, style, onFocus, onBlur, multiline, ...props
}: TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  icon?: IconName;
  optional?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const { colors, radii, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      <Text style={[typography.bodyStrong, { color: colors.text }]}>
        {label}{optional ? <Text style={[typography.body, { color: colors.textMuted }]}> (optional)</Text> : null}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: spacing.sm, minHeight: 52,
        borderWidth: focused ? 2 : 1, borderColor: error ? colors.danger : focused ? colors.accent : colors.textMuted,
        borderRadius: radii.lg, paddingHorizontal: focused ? spacing.md - 1 : spacing.md, backgroundColor: colors.field,
      }}>
        {icon ? <View style={{ paddingTop: multiline ? 15 : 0 }}><Icon name={icon} size={18} color={colors.textMuted} /></View> : null}
        <TextInput
          {...props}
          multiline={multiline}
          accessibilityLabel={props.accessibilityLabel ?? label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          style={[typography.body, { flex: 1, color: colors.text, paddingVertical: 13, minHeight: multiline ? 96 : undefined,
            textAlignVertical: multiline ? 'top' : 'center' }, style]}
        />
      </View>
      {error ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="warning" size={14} color={colors.danger} />
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ flex: 1 }}>{error}</AppText>
      </View>
        : hint ? <AppText variant="caption" tone="muted">{hint}</AppText> : null}
    </View>
  );
}

/** A route surface on `canvas`, with the phone gutter. The app shell handles safe areas and the tab bar. */
export function Screen({ children, padded = true, style, ...props }: ViewProps & { padded?: boolean }) {
  const { colors, spacing } = useTheme();
  return <View {...props} style={[{
    flex: 1, backgroundColor: colors.background, paddingHorizontal: padded ? spacing.md : 0,
  }, style]}>{children}</View>;
}

export function EmptyState({
  title, description, action, icon = 'compass',
}: { title: string; description: string; action?: React.ReactNode; icon?: IconName | React.ReactNode }) {
  const { colors, mode, spacing } = useTheme();
  const glyph = typeof icon === 'string'
    ? <Icon name={icon as IconName} size={28} color={mode === 'dark' ? colors.text : colors.primary} /> : icon;
  return (
    <View style={[styles.empty, { gap: spacing.sm, padding: spacing.lg }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>{glyph}</View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>{title}</AppText>
      <AppText tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>{description}</AppText>
      {action ? <View style={{ marginTop: spacing.xs }}>{action}</View> : null}
    </View>
  );
}

/** Round profile button for the top bar: initials (or a person glyph) on glass, with an optional attention dot. */
export function AvatarButton({ initials, onPress, label = 'Profile', active = false, alert = false }: {
  initials?: string; onPress: () => void; label?: string; active?: boolean; alert?: boolean;
}) {
  const { colors, mode, radii, typography, shadows } = useTheme();
  const ink = active ? colors.onPrimary : mode === 'dark' ? colors.text : colors.primary;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={alert ? `${label}, needs attention` : label}
      accessibilityState={{ selected: active }} scaleTo={0.9} style={{ borderRadius: radii.pill, ...shadows.float, shadowColor: colors.shadow, backgroundColor: colors.glass }}>
      <GlassSurface interactive style={{ width: 48, height: 48, borderRadius: 24, padding: 3 }}>
        <View style={{ flex: 1, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.primary : colors.accentSoft }}>
          {active ? <Icon name="close" size={20} color={ink} strokeWidth={1.8} /> : initials ? <Text style={[typography.bodyStrong, { fontSize: 15, color: ink }]}>{initials}</Text> : <Icon name="people" size={20} color={ink} />}
        </View>
      </GlassSurface>
      {alert ? <View style={{ position: 'absolute', top: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.warning, borderWidth: 2, borderColor: colors.background }} /> : null}
    </PressableScale>
  );
}

export type TabItem<K extends string> = { key: K; label: string; icon: IconName };

/** One tab: its icon springs on press. */
function TabButton({ label, icon, on, onPress }: { label: string; icon: IconName; on: boolean; onPress: () => void }) {
  const { colors, radii, typography } = useTheme();
  return (
    <PressableScale accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress}
      scaleTo={0.88} style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: radii.pill }}>
      <Icon name={icon} size={20} color={on ? colors.text : colors.textMuted} strokeWidth={on ? 1.8 : 1.5} />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
        style={[typography.tab, { fontSize: 11, color: on ? colors.text : colors.textMuted }, on && { fontFamily: typography.bodyStrong.fontFamily }]}>{label}</Text>
    </PressableScale>
  );
}

/**
 * Floating glass tab bar with an optional docked round avatar button (Profile and Settings).
 * The selection pill springs between tabs with a slight stretch in flight; on iOS 26 the bar and
 * the avatar are separate interactive glass pieces that respond to touch natively.
 */
export function TabBar<K extends string>({ items, active, onChange, onAvatar, avatarLabel = 'Profile and settings', avatarInitials, avatarActive }: {
  items: TabItem<K>[]; active: K; onChange: (key: K) => void;
  onAvatar?: () => void; avatarLabel?: string; avatarInitials?: string; avatarActive?: boolean;
}) {
  const { colors, mode, spacing, radii, typography, shadows } = useTheme();
  const reduced = useReduceMotion();
  const [barWidth, setBarWidth] = useState(0);
  const index = Math.max(0, items.findIndex((item) => item.key === active));
  const hasActive = items.some((item) => item.key === active);
  const position = useRef(new Animated.Value(index)).current;
  const presence = useRef(new Animated.Value(hasActive ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { position.setValue(index); return; }
    Animated.spring(position, { toValue: index, useNativeDriver: true, ...springs.slide }).start();
  }, [index, reduced]);
  useEffect(() => {
    Animated.timing(presence, { toValue: hasActive ? 1 : 0, duration: reduced ? 0 : 180, useNativeDriver: true }).start();
  }, [hasActive, reduced]);
  const inner = barWidth - 10;
  const tabWidth = inner > 0 ? inner / items.length : 0;
  // The pill stretches a little mid-flight (velocity feel) and settles back to a tab's width.
  const stretch = position.interpolate({
    inputRange: items.flatMap((_, i) => (i < items.length - 1 ? [i, i + 0.5] : [i])),
    outputRange: items.flatMap((_, i) => (i < items.length - 1 ? [1, 1.12] : [1])),
  });
  const onAccent = mode === 'dark' ? colors.text : colors.primary;
  const bar = (
    <GlassSurface accessibilityRole="tablist" intensity={60} onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      style={{ flex: 1, flexDirection: 'row', padding: 5, borderRadius: radii.pill, ...shadows.float, shadowColor: colors.shadow }}>
      {tabWidth > 0 ? (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', top: 5, bottom: 5, left: 5, width: tabWidth, borderRadius: radii.pill,
          backgroundColor: mode === 'dark' ? colors.accentSoft : colors.surface,
          ...shadows.float, shadowOpacity: mode === 'dark' ? 0.3 : 0.1, shadowColor: colors.shadow,
          opacity: presence,
          transform: [{ translateX: Animated.multiply(position, tabWidth) }, { scaleX: stretch }],
        }} />
      ) : null}
      {items.map((item) => (
        <TabButton key={item.key} label={item.label} icon={item.icon} on={item.key === active} onPress={() => onChange(item.key)} />
      ))}
    </GlassSurface>
  );
  const avatar = onAvatar ? (
    <PressableScale onPress={onAvatar} accessibilityRole="button" accessibilityLabel={avatarLabel} accessibilityState={{ selected: !!avatarActive }}
      scaleTo={0.9} style={{ borderRadius: radii.pill, ...shadows.float, shadowColor: colors.shadow }}>
      <GlassSurface interactive intensity={60} style={{ width: 66, height: 66, borderRadius: 33, padding: 4 }}>
        <View style={{ flex: 1, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center',
          backgroundColor: avatarActive ? colors.primary : colors.accentSoft }}>
          {avatarInitials
            ? <Text style={[typography.bodyStrong, { fontSize: 18, color: avatarActive ? colors.onPrimary : onAccent }]}>{avatarInitials}</Text>
            : <Icon name="settings" size={22} color={avatarActive ? colors.onPrimary : onAccent} />}
        </View>
      </GlassSurface>
    </PressableScale>
  ) : null;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>{bar}{avatar}</View>;
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderWidth: 1 },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
