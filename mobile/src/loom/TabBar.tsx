import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ease, haptic , PressScale } from './motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Icon, type IconName } from './graphics';
import { colors, fonts, shadows } from './tokens';
import { GlassFill } from './glass';

export type TabItem = { route: string; label: string; icon: IconName };

/**
 * The dock: a capsule floating as far from the sides as from the bottom, so its ends sit evenly inside the phone's
 * rounded corners (as iOS's own tab bar does). On home-button phones, with square corners, it sits closer.
 */
const DOCK = 62;
const dockInset = (bottomInset: number) => (bottomInset > 0 ? 20 : 12);
/** Everything the dock covers at the bottom of the screen, for content padding. */
export const tabBarHeight = (bottomInset: number) => DOCK + dockInset(bottomInset);

const dockStyle = (bottomInset: number) => ({
  position: 'absolute' as const, left: dockInset(bottomInset), right: dockInset(bottomInset), bottom: dockInset(bottomInset), height: DOCK, borderRadius: DOCK / 2,
  boxShadow: shadows.lift, flexDirection: 'row' as const, padding: 4, gap: 2,
});
/** The chosen tab's pane, concentric with the dock. */
const PANE = (DOCK - 8) / 2;

/**
 * The tab dock. Routes not listed in `items` are hidden tabs (Budget, Stylist…);
 * `parentOf` says which visible tab stays highlighted while one of them is open.
 */
export function makeTabBar(items: TabItem[], parentOf: Record<string, string> = {}) {
  return function LoomTabBar({ state, navigation }: BottomTabBarProps) {
    const current = state.routes[state.index]?.name ?? '';
    const activeRoute = parentOf[current] ?? current;
    const insets = useSafeAreaInsets();
    const index = Math.max(0, items.findIndex((i) => i.route === activeRoute));
    // The raised pane and its orange tick slide between tabs instead of blinking from one to the next.
    const [width, setWidth] = useState(0);
    const slot = (width + 2) / items.length;
    const x = useSharedValue(-1);
    useEffect(() => {
      if (!slot) return;
      const target = index * slot;
      x.value = x.value < 0 ? target : withTiming(target, ease);
    }, [index, slot, x]);
    const marker = useAnimatedStyle(() => ({ opacity: x.value < 0 ? 0 : 1, transform: [{ translateX: Math.max(0, x.value) }] }));
    return <View style={dockStyle(insets.bottom)}>
      <GlassFill kind="control" radius={DOCK / 2} />
      <View pointerEvents="none" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ position: 'absolute', left: 4, right: 4, top: 4, bottom: 4 }}>
        <Animated.View style={[{ width: Math.max(0, slot - 2), height: '100%', borderRadius: PANE, backgroundColor: colors.surfaceRaised, alignItems: 'center' }, marker]}>
          <View style={{ width: 14, height: 2, backgroundColor: colors.accent, boxShadow: shadows.glow }} />
        </Animated.View>
      </View>
      {items.map((item) => {
        const on = item.route === activeRoute;
        const route = state.routes.find((r) => r.name === item.route);
        return <TabButton key={item.route} item={item} on={on} onPress={() => {
          if (!route) return;
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!on) haptic.select();
          if (!event.defaultPrevented) navigation.navigate(item.route as never);
        }} />;
      })}
    </View>;
  };
}

/** The bar as a picture, with `active` highlighted: drawn by the shared transition before the page's own bar exists. */
export function StaticTabBar({ items, active = 0 }: { items: TabItem[]; active?: number }) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const slot = (width + 2) / items.length;
  return <View pointerEvents="none" style={dockStyle(insets.bottom)}>
    <GlassFill kind="control" radius={DOCK / 2} />
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ position: 'absolute', left: 4, right: 4, top: 4, bottom: 4 }}>
      {slot ? <View style={{ width: slot - 2, height: '100%', borderRadius: PANE, backgroundColor: colors.surfaceRaised, alignItems: 'center', marginLeft: active * slot }}>
        <View style={{ width: 14, height: 2, backgroundColor: colors.accent }} />
      </View> : null}
    </View>
    {items.map((item, i) => <TabButton key={item.route} item={item} on={i === active} onPress={() => {}} />)}
  </View>;
}

/** One tab: icon and label; the marker above is drawn by the bar. */
function TabButton({ item, on, onPress }: { item: TabItem; on: boolean; onPress: () => void }) {
  return <PressScale accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={item.label} onPress={onPress}
    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
    <Icon name={item.icon} size={22} color={on ? colors.ink : colors.inkFaint} strokeWidth={1.7} />
    <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: on ? colors.ink : colors.inkFaint }}>{item.label}</Text>
  </PressScale>;
}

export const APP_TABS: TabItem[] = [
  { route: 'home', label: 'Trips', icon: 'trips' },
  { route: 'planning', label: 'Plan', icon: 'sparkle' },
  { route: 'discover', label: 'Discover', icon: 'discover' },
  { route: 'shared', label: 'Shared', icon: 'shared' },
  { route: 'profile', label: 'Profile', icon: 'profile' },
];

export const TRIP_TABS: TabItem[] = [
  { route: 'index', label: 'Trip', icon: 'trip' },
  { route: 'days', label: 'Days', icon: 'days' },
  { route: 'wardrobe', label: 'Wardrobe', icon: 'wardrobe' },
  { route: 'packing', label: 'Packing', icon: 'packing' },
];

export const ADVENTURE_TABS: TabItem[] = [
  { route: 'index', label: 'Trip', icon: 'mountain' },
  { route: 'prepare', label: 'Prepare', icon: 'flag' },
  { route: 'climb', label: 'Climb', icon: 'activity' },
  { route: 'gear', label: 'Gear', icon: 'trips' },
  { route: 'safety', label: 'Safety', icon: 'shield' },
];
