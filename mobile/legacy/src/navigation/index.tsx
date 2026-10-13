import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router, useNavigation } from 'expo-router';
import type { NativeStackNavigationOptions } from 'expo-router/build/react-navigation/native-stack/types';
import { useAuth, useWorkspace } from '../data';
import { useTheme } from '../design';
import type { Trip } from '../types';
import type { ScreenKey, WorkspaceScreenProps } from '../screens/shared';

/* ---------- Selected trip and day, shared by every tab ---------- */

type Selection = { trip?: Trip; setTripId: (id: string) => void; day: string; setDay: (day: string) => void };
const SelectionContext = createContext<Selection | null>(null);

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const { workspace } = useWorkspace();
  const [tripId, setTripId] = useState<string | null>(null);
  const [day, setDay] = useState(() => localDate(new Date()));
  const trip = useMemo(() => workspace?.trips.find((entry) => entry.id === tripId) || workspace?.trips[0], [workspace, tripId]);
  useEffect(() => {
    if (trip && (day < trip.start || day > trip.end)) setDay(trip.start);
  }, [trip?.id, trip?.start, trip?.end]);
  const value = useMemo(() => ({ trip, setTripId, day, setDay }), [trip, day]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error('useSelection must be used inside SelectionProvider');
  return value;
}

/* ---------- Route helpers ---------- */

const routes: Record<Exclude<ScreenKey, 'outfits' | 'settings'>, string> = {
  planner: '/calendar', wardrobe: '/wardrobe', essentials: '/essentials', packing: '/packing', trips: '/trips',
};

export function openProfile() {
  void Haptics.selectionAsync();
  router.push('/profile');
}

/** The props every screen component takes, backed by the router instead of local shell state. */
export function useScreenProps(overrides: Partial<WorkspaceScreenProps> = {}): WorkspaceScreenProps | null {
  const { workspace, change } = useWorkspace();
  const { trip, setTripId, day, setDay } = useSelection();
  if (!workspace) return null;
  return {
    workspace, trip, day, change,
    onSelectDay: setDay,
    onSelectTrip: (id: string) => {
      const selected = workspace.trips.find((entry) => entry.id === id);
      setTripId(id);
      if (selected) setDay(selected.start);
      router.navigate('/calendar');
    },
    onNavigate: (screen: ScreenKey) => {
      if (screen === 'settings') return openProfile();
      if (screen === 'outfits') return router.navigate({ pathname: '/wardrobe', params: { view: 'outfits' } });
      router.navigate(routes[screen]);
    },
    ...overrides,
  };
}

/* ---------- Native header ---------- */

export type HeaderOptions = {
  title?: string;
  /** One muted line under the centred title, e.g. "7 days · 23 – 29 Sep". */
  subtitle?: string;
  /** Adds the prominent `+` bar button (iOS 26 glass). */
  onAdd?: () => void;
  addLabel?: string;
  /** Replaces the left side, e.g. the trip switcher menu. */
  left?: NativeStackNavigationOptions['unstable_headerLeftItems'];
};

/**
 * Wires a screen's native navigation bar: large title, the prominent `+` button and the profile
 * button, both as native UIBarButtonItems with SF Symbols so iOS gives them its own glass.
 */
export function useNativeHeader({ title, subtitle, onAdd, addLabel = 'Add', left }: HeaderOptions) {
  const navigation = useNavigation();
  const { status } = useWorkspace();
  const auth = useAuth();
  const { colors } = useTheme();
  const needsAttention = status === 'conflict' || status === 'offline' || status === 'error';
  useLayoutEffect(() => {
    navigation.setOptions({
      ...(title ? { title, headerTitle: () => <HeaderTitle title={title} subtitle={subtitle} /> } : null),
      unstable_headerRightItems: () => [
        ...(onAdd ? [{ type: 'button' as const, label: addLabel, accessibilityLabel: addLabel, variant: 'prominent' as const, tintColor: colors.primary,
          icon: { type: 'sfSymbol' as const, name: 'plus' as const }, onPress: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onAdd(); } }] : []),
        { type: 'button' as const, label: 'Profile', accessibilityLabel: needsAttention ? 'Profile, sync needs attention' : 'Profile',
          icon: { type: 'sfSymbol' as const, name: auth.profile?.display_name ? 'person.crop.circle.fill' as const : 'person.crop.circle' as const },
          ...(needsAttention ? { badge: { value: '!', style: { backgroundColor: colors.warning, color: colors.onWarning } } } : null),
          onPress: openProfile },
      ],
      ...(left ? { unstable_headerLeftItems: left } : null),
    } as NativeStackNavigationOptions);
  }, [navigation, title, subtitle, onAdd, addLabel, left, needsAttention, auth.profile?.display_name, colors]);
}

/** Centred compact title with an optional muted line, as in the reference's "Paris, France / 46 results". */
function HeaderTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors, fonts } = useTheme();
  return <View style={{ alignItems: 'center', maxWidth: 240 }}>
    <Text accessibilityRole="header" numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 19, lineHeight: 24, letterSpacing: -0.2, color: colors.text }}>{title}</Text>
    {subtitle ? <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 17, color: colors.textMuted }}>{subtitle}</Text> : null}
  </View>;
}

/** Native stack options shared by every tab (compact centred titles over the scroll-edge glass), in the design system's type and colour. */
export function useStackOptions(): NativeStackNavigationOptions {
  const { colors, fonts } = useTheme();
  return {
    headerLargeTitle: false,
    headerTitleAlign: 'center',
    headerTransparent: true,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerTintColor: colors.primary,
    headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
    headerLargeTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
    headerBackButtonDisplayMode: 'minimal',
    headerStyle: { backgroundColor: 'transparent' },
    // Content scrolling under the bar gets a hard, opaque cutoff so the title stays readable over photos.
    scrollEdgeEffects: { top: 'hard' },
    contentStyle: { backgroundColor: colors.background },
  };
}

/**
 * Route background: the sand canvas, optionally with its peach glow. Native large titles only collapse
 * when the scroll view is the first view in the screen's chain, so scrolling tab routes use `glow={false}`
 * (the canvas colour comes from the stack's contentStyle) and keep the glow for static screens.
 */
export function RouteBackground({ children, glow = true }: { children: React.ReactNode; glow?: boolean }) {
  const { colors } = useTheme();
  if (!glow) return <View style={{ flex: 1, backgroundColor: colors.background }}>{children}</View>;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <LinearGradient pointerEvents="none" colors={[colors.canvasGlow, `${colors.background}00`]}
      start={{ x: 1, y: 0 }} end={{ x: 0.35, y: 0.45 }} style={[StyleSheet.absoluteFill, { opacity: 0.9 }]} />
    {children}
  </View>;
}
