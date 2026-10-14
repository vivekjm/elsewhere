import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ease, haptic } from './motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Icon, type IconName } from './graphics';
import { colors, fonts, shadows, TAB_BAR_HEIGHT } from './tokens';

export type TabItem = { route: string; label: string; icon: IconName };

/** 64pt of bar plus the home-indicator area (24 on Face ID phones, 0 on home-button phones). */
export const tabBarHeight = (bottomInset: number) => TAB_BAR_HEIGHT - 24 + Math.min(bottomInset, 24);

/**
 * The white bar with 20pt top corners. Routes not listed in `items` are hidden tabs (Budget, Stylist…);
 * `parentOf` says which visible tab stays highlighted while one of them is open.
 */
export function makeTabBar(items: TabItem[], parentOf: Record<string, string> = {}) {
  return function LoomTabBar({ state, navigation }: BottomTabBarProps) {
    const current = state.routes[state.index]?.name ?? '';
    const activeRoute = parentOf[current] ?? current;
    const insets = useSafeAreaInsets();
    const index = Math.max(0, items.findIndex((i) => i.route === activeRoute));
    // The ember marker slides between tabs instead of blinking from one to the next.
    const [width, setWidth] = useState(0);
    const slot = width / items.length;
    const x = useSharedValue(-1);
    useEffect(() => {
      if (!slot) return;
      const target = index * slot + slot / 2 - 9;
      x.value = x.value < 0 ? target : withTiming(target, ease);
    }, [index, slot, x]);
    const marker = useAnimatedStyle(() => ({ opacity: x.value < 0 ? 0 : 1, transform: [{ translateX: Math.max(0, x.value) }] }));
    return <View style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: tabBarHeight(insets.bottom), backgroundColor: colors.card,
      borderTopLeftRadius: 20, borderTopRightRadius: 20, boxShadow: shadows.tabBar,
      flexDirection: 'row', paddingTop: 14, paddingHorizontal: 8,
    }}>
      <View pointerEvents="none" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ position: 'absolute', left: 8, right: 8, top: 0, height: 3 }}>
        <Animated.View style={[{ width: 18, height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: colors.ember }, marker]} />
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

/** One tab: icon and label; the marker above is drawn by the bar. */
function TabButton({ item, on, onPress }: { item: TabItem; on: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={item.label} onPress={onPress}
    style={{ flex: 1, alignItems: 'center', gap: 6 }}>
    <Icon name={item.icon} size={24} color={on ? colors.ink : colors.stone} strokeWidth={on ? 2.2 : 1.8} />
    <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 11, color: on ? colors.ink : colors.stone }}>{item.label}</Text>
  </Pressable>;
}

export const APP_TABS: TabItem[] = [
  { route: 'home', label: 'Trips', icon: 'trips' },
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
