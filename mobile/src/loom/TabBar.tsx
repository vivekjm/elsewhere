import React from 'react';
import { Pressable, Text, View } from 'react-native';
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
    return <View style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: tabBarHeight(insets.bottom), backgroundColor: colors.card,
      borderTopLeftRadius: 20, borderTopRightRadius: 20, boxShadow: shadows.tabBar,
      flexDirection: 'row', paddingTop: 14, paddingHorizontal: 8,
    }}>
      {items.map((item) => {
        const on = item.route === activeRoute;
        const route = state.routes.find((r) => r.name === item.route);
        return <Pressable key={item.route} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={item.label}
          onPress={() => {
            if (!route) return;
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!event.defaultPrevented) navigation.navigate(item.route as never);
          }}
          style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <View style={{ position: 'absolute', top: -14, width: 18, height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: on ? colors.ember : 'transparent' }} />
          <Icon name={item.icon} size={24} color={on ? colors.ink : colors.stone} strokeWidth={on ? 2.2 : 1.8} />
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 11, color: on ? colors.ink : colors.stone }}>{item.label}</Text>
        </Pressable>;
      })}
    </View>;
  };
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
