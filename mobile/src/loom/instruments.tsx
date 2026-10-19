/**
 * GymSync's instruments, mapped to trips: a big thin number with a small unit, a day as a barcode of ticks, a half
 * gauge with an orange needle, and stacked blocks for how full each day is. Orange only ever marks the one thing
 * that matters now.
 */
import React, { useEffect } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';
import { colors, fonts, shadows } from './tokens';

const AnimatedLine = Animated.createAnimatedComponent(Line);

/** A big light numeral with a small unit after it ("2340 kg", "₹ 42,300"). */
export function Numeral({ value, unit, prefix, size = 'md', color = colors.ink }: {
  value: string | number; unit?: string; prefix?: string; size?: 'sm' | 'md' | 'xl'; color?: string;
}) {
  const s = size === 'xl' ? { fontSize: 56, lineHeight: 58, fontFamily: fonts.light, letterSpacing: -1.6 }
    : size === 'md' ? { fontSize: 36, lineHeight: 40, fontFamily: fonts.light, letterSpacing: -0.7 }
    : { fontSize: 22, lineHeight: 26, fontFamily: fonts.light, letterSpacing: -0.2 };
  return <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
    {prefix ? <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted, alignSelf: 'flex-start', marginTop: size === 'sm' ? 3 : 8 }}>{prefix}</Text> : null}
    <Text maxFontSizeMultiplier={1.2} style={[s, { color, fontVariant: ['tabular-nums'] }]}>{value}</Text>
    {unit ? <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.inkMuted }}>{unit}</Text> : null}
  </View>;
}

/** A tile's name, as GymSync writes it: sentence case with a colon. */
export function TileLabel({ children, color = colors.inkMuted }: { children: string; color?: string }) {
  return <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color }}>{children}</Text>;
}

/**
 * A stretch of time as a track of ticks: thin ticks for the hours, a block for each thing in it, a faint block for
 * quiet things (meals), and one orange mark. `at` is 0–1 along the track.
 */
export function Barcode({ label, from, to, marks, ticks = 48, style }: {
  label?: string; from?: string; to?: string; marks: { at: number; kind?: 'block' | 'quiet' | 'accent' }[]; ticks?: number; style?: StyleProp<ViewStyle>;
}) {
  const slots: ('tick' | 'tall' | 'block' | 'quiet' | 'accent')[] = Array.from({ length: ticks }, (_, i) => (i % 6 === 0 ? 'tall' : 'tick'));
  for (const m of marks) {
    const i = Math.max(0, Math.min(ticks - 1, Math.round(m.at * (ticks - 1))));
    const kind = m.kind ?? 'block';
    // An orange mark wins its slot; a real stop wins over a quiet one.
    if (slots[i] === 'accent' || (slots[i] === 'block' && kind === 'quiet')) continue;
    slots[i] = kind;
  }
  return <View style={[{ gap: 8 }, style]} accessible accessibilityLabel={label ? `${label.replace(/:$/, '')}, ${marks.filter((m) => m.kind !== 'accent').length} things from ${from} to ${to}` : undefined}>
    {label ? <TileLabel>{label}</TileLabel> : null}
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 14 }}>
      {slots.map((k, i) => <View key={i} style={
        k === 'block' ? { width: 7, height: 9, backgroundColor: colors.ink }
          : k === 'quiet' ? { width: 7, height: 9, backgroundColor: colors.inkFaint }
          : k === 'accent' ? { width: 3, height: 13, backgroundColor: colors.accent, boxShadow: shadows.glow }
          : { width: 1, height: 9, backgroundColor: k === 'tall' ? colors.inkFaint : colors.hairlineStrong }} />)}
    </View>
    {from || to ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: fonts.light, fontSize: 11, color: colors.inkFaint }}>{from}</Text>
      <Text style={{ fontFamily: fonts.light, fontSize: 11, color: colors.inkFaint }}>{to}</Text>
    </View> : null}
  </View>;
}

/**
 * A half gauge: 24 ticks over a half arc, the reached part in ink, and an orange needle at the value (0–1). The
 * reading sits under the arc. `value` null: nothing to measure yet (no needle, all ticks faint).
 */
export function Gauge({ value, display, sub, size = 150 }: { value: number | null; display: string; sub?: string; size?: number }) {
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  const R = 70, cx = 90, cy = 86;
  const t = useSharedValue(v);
  useEffect(() => { t.value = withTiming(v, { duration: 500 }); }, [v, t]);
  const needle = useAnimatedProps(() => {
    const a = Math.PI * (1 - t.value);
    return { x1: cx + Math.cos(a) * (R - 22), y1: cy - Math.sin(a) * (R - 22), x2: cx + Math.cos(a) * (R + 4), y2: cy - Math.sin(a) * (R + 4) };
  });
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const f = i / 23, a = Math.PI * (1 - f);
    return { d: `M${(cx + Math.cos(a) * (R - 9)).toFixed(1)},${(cy - Math.sin(a) * (R - 9)).toFixed(1)} L${(cx + Math.cos(a) * R).toFixed(1)},${(cy - Math.sin(a) * R).toFixed(1)}`, on: value !== null && f <= v };
  });
  const h = (size * 92) / 180;
  return <View style={{ width: size, alignItems: 'center' }} accessible accessibilityLabel={`${display}${sub ? `, ${sub}` : ''}`}>
    <Svg width={size} height={h} viewBox="0 0 180 92">
      {ticks.map((k, i) => <Path key={i} d={k.d} stroke={k.on ? colors.ink : colors.hairlineStrong} strokeWidth={1.5} strokeLinecap="butt" />)}
      {value !== null ? <AnimatedLine animatedProps={needle} stroke={colors.accent} strokeWidth={2.5} strokeLinecap="butt" /> : null}
    </Svg>
    <View style={{ marginTop: -h * 0.36, alignItems: 'center', gap: 2 }}>
      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.light, fontSize: 19, color: colors.ink }}>{display}</Text>
      {sub ? <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.light, fontSize: 11, color: colors.inkMuted }}>{sub}</Text> : null}
    </View>
  </View>;
}

/** Columns of stacked 9pt squares (places a day). One column can be marked in orange. */
export function Blocks({ columns, max, style }: { columns: { value: number; tone?: 'accent' | 'faint' }[]; max?: number; style?: StyleProp<ViewStyle> }) {
  const top = Math.max(max ?? 0, ...columns.map((c) => c.value), 1);
  return <View style={[{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }, style]}>
    {columns.map((c, i) => <View key={i} style={{ gap: 2, height: top * 11 - 2, justifyContent: 'flex-end' }}>
      {Array.from({ length: c.value }, (_, j) => <View key={j} style={{ width: 9, height: 9, borderRadius: 1, backgroundColor: c.tone === 'accent' && j === c.value - 1 ? colors.accent : c.tone === 'faint' ? colors.inkFaint : colors.ink }} />)}
    </View>)}
  </View>;
}

/** Step marks for a flow: done ones in ink, the current one long and orange. */
export function StepMarks({ n, total, label }: { n: number; total: number; label?: string }) {
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={`Step ${n} of ${total}${label ? `: ${label}` : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
    {Array.from({ length: total }, (_, i) => <StepMark key={i} done={i < n} now={i === n - 1} />)}
  </View>;
}

function StepMark({ done, now }: { done: boolean; now: boolean }) {
  return <View style={{ width: now ? 20 : 8, height: 8, borderRadius: 1, backgroundColor: now ? colors.accent : done ? colors.ink : colors.track, boxShadow: now ? shadows.glow : undefined }} />;
}
