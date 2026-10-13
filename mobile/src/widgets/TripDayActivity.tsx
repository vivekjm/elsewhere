/**
 * The trip-day Live Activity (iOS 16.2+): the next plan with a live countdown on a city day, or the stage,
 * climb and sleeping altitude on a trek day. Like the widget, the layout is serialised and must be self-contained.
 */
import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, font, foregroundStyle, frame, lineLimit, monospacedDigit, padding, progressViewStyle, tint, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { TripDayProps } from './snapshot';

const TripDay = (p: TripDayProps, env: LiveActivityEnvironment) => {
  'widget';
  const EMBER = '#FF6A2B';
  const dark = env.colorScheme === 'dark';
  const INK = dark ? '#FFFFFF' : '#1E1E1E';
  const STONE = dark ? '#B5B3AF' : '#6B6B6B';
  const stale = !!env.isStale;
  const hasTimer = p.nextAt > 0 && p.nextAt > Date.now() && !stale;

  const icon = (size: number) => <Image systemName={p.symbol as never} size={size} color={EMBER} />;
  // The live timer gets room for hours ("12:08:16"); a narrower frame clipped them. The compact island shows the plan's clock time.
  // (fixedSize and layoutPriority crash the widget extension's layout, so a fixed width is used.)
  const countdown = (size: number) => hasTimer
    ? <Text date={new Date(p.nextAt)} dateStyle="timer" modifiers={[font({ size, weight: 'semibold' }), monospacedDigit(), foregroundStyle(EMBER), frame({ width: 84, alignment: 'trailing' })]} />
    : <Text modifiers={[font({ size, weight: 'semibold' }), foregroundStyle(EMBER), lineLimit(1)]}>{p.compact}</Text>;
  const compactLabel = <Text modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit(), foregroundStyle(EMBER), lineLimit(1)]}>{p.compact}</Text>;
  const metrics = <HStack spacing={12}>
    {p.metrics.map((m, i) => <VStack key={`${i}`} alignment="leading" spacing={1}>
      <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(STONE)]}>{m.label}</Text>
      <Text modifiers={[font({ size: 15, weight: 'semibold' }), monospacedDigit(), foregroundStyle(INK), lineLimit(1)]}>{m.value}</Text>
    </VStack>)}
    <Spacer />
  </HStack>;
  const progress = <ProgressView value={Math.max(0, Math.min(1, p.progress))} modifiers={[progressViewStyle('linear'), tint(EMBER)]} />;

  return {
    banner: <VStack alignment="leading" spacing={10} modifiers={[padding({ all: 16 }), activityBackgroundTint(dark ? '#1E1E1E' : '#F7F6F4'), widgetURL(p.url)]}>
      <HStack spacing={8}>
        {icon(14)}
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(STONE), lineLimit(1)]}>{`${p.title} · ${p.status}`}</Text>
        <Spacer />
        {hasTimer ? countdown(14) : null}
      </HStack>
      <Text modifiers={[font({ size: 18, weight: 'bold' }), foregroundStyle(INK), lineLimit(1)]}>{p.next}</Text>
      {metrics}
      {progress}
    </VStack>,
    compactLeading: icon(13),
    compactTrailing: compactLabel,
    minimal: icon(13),
    expandedLeading: <HStack spacing={6} modifiers={[padding({ leading: 4 })]}>
      {icon(14)}
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>{p.status}</Text>
    </HStack>,
    expandedTrailing: <HStack modifiers={[padding({ trailing: 4 })]}>{countdown(14)}</HStack>,
    expandedBottom: <VStack alignment="leading" spacing={8} modifiers={[padding({ horizontal: 4 }), widgetURL(p.url)]}>
      <Text modifiers={[font({ size: 16, weight: 'semibold' }), lineLimit(1)]}>{p.next}</Text>
      {metrics}
      {progress}
    </VStack>,
  };
};

export const tripDayActivity = createLiveActivity<TripDayProps>('TripDay', TripDay);
