/**
 * The "Next trip" home and Lock Screen widget (iOS). The layout below is serialised by the `'widget'`
 * directive and evaluated inside the widget extension, so it must be self-contained: no outside variables,
 * only @expo/ui SwiftUI views and modifiers, which the widget runtime provides as globals.
 */
import { Capsule, HStack, Image, ProgressView, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground, font, foregroundStyle, frame, lineLimit, minimumScaleFactor, monospacedDigit, padding, progressViewStyle, tint, widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { NextTripProps } from './snapshot';

const NextTrip = (props: NextTripProps, env: WidgetEnvironment) => {
  'widget';
  const INK = '#1E1E1E';
  const STONE = '#7A7A7A';
  const EMBER = '#FF6A2B';
  const CANVAS = '#F7F6F4';
  const family = env.widgetFamily;
  const p = props && props.state ? props : { state: 'empty', name: 'Trips Loom', place: '', headline: 'Plan your next trip', dateLabel: '', big: '+', bigLabel: 'new trip', progress: 0, packed: 0, packTotal: 0, plans: [], weather: '', weatherSymbol: '', url: 'tripsloom:///home' } as NextTripProps;
  const url = p.url || 'tripsloom:///home';

  if (family === 'accessoryInline') {
    return <Text modifiers={[widgetURL(url)]}>{p.state === 'empty' ? 'Plan a trip' : `${p.place || p.name} · ${p.headline}`}</Text>;
  }
  if (family === 'accessoryCircular') {
    return <ZStack modifiers={[widgetURL(url)]}>
      <ProgressView value={p.progress} modifiers={[progressViewStyle('circular')]} />
      <VStack spacing={0}>
        <Text modifiers={[font({ size: 18, weight: 'bold', design: 'rounded' }), monospacedDigit()]}>{p.big}</Text>
        <Text modifiers={[font({ size: 9, weight: 'medium' })]}>{p.state === 'active' ? 'day' : p.state === 'upcoming' ? 'days' : ''}</Text>
      </VStack>
    </ZStack>;
  }
  if (family === 'accessoryRectangular') {
    const first = p.plans[0];
    return <VStack alignment="leading" spacing={1} modifiers={[widgetURL(url), frame({ maxWidth: 10000, alignment: 'leading' })]}>
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>{p.state === 'empty' ? 'Trips Loom' : p.name}</Text>
      <Text modifiers={[font({ size: 13 }), lineLimit(1)]}>{p.headline}</Text>
      <Text modifiers={[font({ size: 12 }), lineLimit(1), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{first ? `${first.time} ${first.title}` : p.dateLabel}</Text>
    </VStack>;
  }

  const header = <HStack spacing={6}>
    <Image systemName="suitcase.rolling.fill" size={12} color={EMBER} />
    <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(EMBER), lineLimit(1)]}>{p.headline}</Text>
    <Spacer />
    {p.weatherSymbol ? <HStack spacing={3}>
      <Image systemName={p.weatherSymbol as never} size={12} color={STONE} />
      {family !== 'systemSmall' ? <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(STONE)]}>{p.weather}</Text> : null}
    </HStack> : null}
  </HStack>;

  const bar = <ZStack alignment="leading" modifiers={[frame({ height: 5 })]}>
    <Capsule modifiers={[foregroundStyle('#E6E5E2'), frame({ height: 5 })]} />
    <ProgressView value={Math.max(0.02, Math.min(1, p.progress))} modifiers={[progressViewStyle('linear'), tint(EMBER)]} />
  </ZStack>;

  const planRow = (plan: NextTripProps['plans'][number], i: number) => <HStack key={`${i}`} spacing={8}>
    <Image systemName={plan.symbol as never} size={12} color={EMBER} modifiers={[frame({ width: 16 })]} />
    <Text modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit(), foregroundStyle(INK), lineLimit(1)]}>{plan.time}</Text>
    <Text modifiers={[font({ size: 13 }), foregroundStyle(STONE), lineLimit(1)]}>{plan.title}</Text>
    <Spacer />
  </HStack>;

  if (family === 'systemSmall') {
    return <VStack alignment="leading" spacing={4} modifiers={[widgetURL(url), containerBackground(CANVAS, 'widget'), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
      {header}
      <Spacer />
      <Text modifiers={[font({ size: 40, weight: 'bold', design: 'rounded' }), monospacedDigit(), foregroundStyle(INK), minimumScaleFactor(0.6), lineLimit(1)]}>{p.big}</Text>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(STONE)]}>{p.bigLabel}</Text>
      <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(INK), lineLimit(2), minimumScaleFactor(0.8)]}>{p.state === 'empty' ? 'Plan your next trip' : p.place || p.name}</Text>
    </VStack>;
  }

  const plans = family === 'systemLarge' ? p.plans : p.plans.slice(0, 2);
  return <VStack alignment="leading" spacing={8} modifiers={[widgetURL(url), containerBackground(CANVAS, 'widget'), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
    {header}
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: family === 'systemLarge' ? 24 : 19, weight: 'bold' }), foregroundStyle(INK), lineLimit(1), minimumScaleFactor(0.75)]}>{p.state === 'empty' ? 'Plan your next trip' : p.name}</Text>
      <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(STONE), lineLimit(1)]}>{p.state === 'empty' ? 'Tap to start a trip in Trips Loom' : [p.place, p.dateLabel].filter(Boolean).join(' · ')}</Text>
    </VStack>
    {p.state !== 'empty' ? bar : null}
    {family === 'systemLarge' ? null : <Spacer />}
    {family === 'systemLarge' && plans.length ? <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(STONE), padding({ top: 6 })]}>Coming up</Text> : null}
    {plans.length ? <VStack alignment="leading" spacing={family === 'systemLarge' ? 10 : 6}>{plans.map(planRow)}</VStack>
      : <Text modifiers={[font({ size: 13 }), foregroundStyle(STONE)]}>{p.state === 'empty' ? '' : p.state === 'upcoming' && p.packTotal ? `Packed ${p.packed} of ${p.packTotal}` : 'No more plans'}</Text>}
    {family === 'systemLarge' && p.state === 'upcoming' && p.packTotal ? <HStack spacing={6} modifiers={[padding({ top: 6 })]}>
      <Image systemName="checklist" size={13} color={STONE} />
      <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(STONE)]}>{`Packed ${p.packed} of ${p.packTotal}`}</Text>
    </HStack> : null}
    {family === 'systemLarge' ? <Spacer /> : null}
  </VStack>;
};

export const nextTripWidget = createWidget<NextTripProps>('NextTrip', NextTrip);
