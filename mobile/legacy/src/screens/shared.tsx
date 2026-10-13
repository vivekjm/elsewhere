import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Trip, Workspace } from '../types';
import * as Haptics from 'expo-haptics';
import { AppButton, Chip as DesignChip, EmptyState, Icon, moodForLandscape, PressableScale, useTheme, type IconName, type Mood } from '../design';
import { useNativeHeader } from '../navigation';

export type ScreenKey = 'trips' | 'planner' | 'wardrobe' | 'outfits' | 'essentials' | 'packing' | 'settings';
export type WorkspaceScreenProps = {
  workspace: Workspace;
  trip?: Trip;
  day: string;
  onSelectDay: (day: string) => void;
  onSelectTrip: (id: string) => void;
  onNavigate: (screen: ScreenKey) => void;
  change: (fn: (draft: Workspace) => void) => void;
};
export type EditTarget = { kind: 'trip' | 'activity' | 'item' | 'outfit' | 'day' | 'extra'; id?: string; date?: string; draft?: Record<string, unknown> };
const landscapes = {
  mountains: require('../../assets/landscapes/mountains.png'), coast: require('../../assets/landscapes/coast.png'),
  city: require('../../assets/landscapes/city.png'), forest: require('../../assets/landscapes/forest.png'),
  lake: require('../../assets/landscapes/lake.png'), desert: require('../../assets/landscapes/desert.png'),
  island: require('../../assets/landscapes/island.png'), aurora: require('../../assets/landscapes/aurora.png'),
};
export const landscapeImage = (mood?: Trip['theme']) => landscapes[mood || 'mountains'];

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}
export function monthGrid(month: string) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(first.getTime() + (index - offset) * 86400000).toISOString().slice(0, 10));
}
export function shiftMonth(month: string, count: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + count);
  return date.toISOString().slice(0, 7);
}
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
/** Sets the route's native navigation bar: centred title with `detail` as its muted second line, `+` and Profile. */
export function ScreenTitle({ title, detail, action, actionLabel, onAction }: { title: string; detail?: string; action?: IconName; actionLabel?: string; onAction?: () => void }) {
  useNativeHeader({ title, subtitle: detail, onAdd: action && onAction ? onAction : undefined, addLabel: actionLabel });
  return null;
}
/** Section header, as the reference's "Near Paris": semibold title, muted line, optional text or round icon action. */
export function GroupLabel({ children, subtitle, action, onAction, icon }: { children: string; subtitle?: string; action?: string; onAction?: () => void; icon?: IconName }) {
  const { colors, typography, shadows } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 4, marginBottom: -8 }}>
    <View style={{ flex: 1 }}>
      <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>{children}</Text>
      {subtitle ? <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>{subtitle}</Text> : null}
    </View>
    {onAction && icon ? <PressableScale onPress={onAction} scaleTo={0.9} accessibilityRole="button" accessibilityLabel={action ?? children}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, ...shadows.float, shadowOpacity: 0.08, shadowColor: colors.shadow }}>
      <Icon name={icon} size={20} color={colors.text} />
    </PressableScale>
      : action && onAction ? <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={action} hitSlop={12}><Text style={[typography.bodyStrong, { color: colors.primary, fontSize: 15 }]}>{action}</Text></Pressable> : null}
  </View>;
}
/** One card holding rows separated by hairlines, instead of a card per row. */
export function Group({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, overflow: 'hidden' }}>
    {rows.map((row, index) => <View key={index} style={index ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border } : undefined}>{row}</View>)}
  </View>;
}
/** A row inside a Group: optional leading slot, title, quiet detail, optional trailing slot. */
export function Row({ leading, title, detail, trailing, onPress, done = false, accessibilityLabel }: {
  leading?: React.ReactNode; title: string; detail?: string; trailing?: React.ReactNode; onPress?: () => void; done?: boolean; accessibilityLabel?: string;
}) {
  const { colors, typography } = useTheme();
  const body = <>
    {leading}
    <View style={{ flex: 1, gap: 1 }}>
      <Text numberOfLines={1} style={[typography.body, { color: done ? colors.textMuted : colors.text, textDecorationLine: done ? 'line-through' : 'none' }]}>{title}</Text>
      {detail ? <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted, fontSize: 13 }]}>{detail}</Text> : null}
    </View>
    {trailing ?? (onPress ? <Icon name="right" size={18} color={colors.textMuted} /> : null)}
  </>;
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, minHeight: 60, paddingVertical: 10 };
  if (!onPress) return <View style={style}>{body}</View>;
  return <PressableScale onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} style={style}>{body}</PressableScale>;
}

/** Eyebrow + title + muted subtitle at the top of a route. */
export function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  const { colors, typography } = useTheme();
  return <View style={{ gap: 4, paddingTop: 4 }}>
    <Text style={[typography.eyebrow, { color: colors.textMuted }]}>{eyebrow.toUpperCase()}</Text>
    <Text accessibilityRole="header" style={[typography.display, { color: colors.text, fontSize: 30, lineHeight: 36 }]}>{title}</Text>
    {subtitle ? <Text style={[typography.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
  </View>;
}
/** Evenly spaced column for list headers (FlatList headers don't inherit the list's gap). */
export function Stack({ children, gap = 12 }: { children: React.ReactNode; gap?: number }) {
  return <View style={{ gap }}>{children}</View>;
}
/** Reminders-style circular check with a spring and a light haptic. */
export function Checkbox({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <PressableScale accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} scaleTo={0.8} hitSlop={12}
    onPress={() => { void (checked ? Haptics.selectionAsync() : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)); onPress(); }}
    style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
      borderColor: checked ? colors.primary : colors.textMuted, backgroundColor: checked ? colors.primary : 'transparent' }}>
    {checked ? <Icon name="check" size={15} color={colors.onPrimary} strokeWidth={2.4} /> : null}
  </PressableScale>;
}
/** A tappable settings-style row: icon disc, label, optional detail, chevron. Group rows inside a Surface. */
export function ListRow({ icon, label, detail, onPress, disabled = false, last = false }: { icon: IconName; label: string; detail?: string; onPress: () => void; disabled?: boolean; last?: boolean }) {
  const { colors, mode, typography } = useTheme();
  return <PressableScale onPress={onPress} disabled={disabled} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderColor: colors.border }}>
    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
      <Icon name={icon} size={18} color={mode === 'dark' ? colors.text : colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[typography.bodyStrong, { color: colors.text }]}>{label}</Text>
      {detail ? <Text style={[typography.caption, { color: colors.textMuted }]}>{detail}</Text> : null}
    </View>
    <Icon name="right" size={18} color={colors.textMuted} />
  </PressableScale>;
}
/** Empty list state with one next step. */
export function ListEmpty({ icon, title, description, action, onAction }: { icon: IconName; title: string; description: string; action?: string; onAction?: () => void }) {
  return <EmptyState icon={icon} title={title} description={description} action={action && onAction ? <AppButton label={action} icon={action.startsWith('Clear') ? undefined : 'plus'} variant={action.startsWith('Clear') ? 'secondary' : 'primary'} onPress={onAction} /> : undefined} />;
}
export function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors, typography } = useTheme();
  return <View style={styles.heading}><Text accessibilityRole="header" style={[typography.heading, { color: colors.text, flexShrink: 1 }]}>{title}</Text>{action && onAction ? <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={action} style={styles.headingAction}><Text style={[typography.bodyStrong, { color: colors.primary }]}>{action}</Text></Pressable> : null}</View>;
}
export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName }) {
  return <DesignChip label={label} selected={selected} onPress={onPress} icon={icon} />;
}
export function ChipRow({ children }: { children: React.ReactNode }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{children}</ScrollView>; }
export function Action({ label, onPress, primary = false, danger = false, disabled = false, icon }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; icon?: IconName }) {
  const { colors } = useTheme();
  return <AppButton label={label} onPress={onPress} disabled={disabled} icon={icon} variant={primary ? 'primary' : 'secondary'}
    style={danger ? { borderColor: colors.danger } : undefined} labelStyle={danger ? { color: colors.danger } : undefined} />;
}
export function SearchInput({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  const { colors, typography } = useTheme();
  return <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}><Icon name="search" size={18} color={colors.textMuted} /><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMuted} accessibilityLabel={placeholder} autoCapitalize="none" style={[typography.body, { flex: 1, color: colors.text, paddingVertical: 12 }]} /></View>;
}
export function Surface({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: object }) {
  const { colors, opacity } = useTheme();
  if (onPress) return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.surface, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? opacity.pressed : 1 }, style]}>{children}</Pressable>;
  return <View style={[styles.surface, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}
export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors, typography } = useTheme();
  return <Text style={[typography.caption, { color: colors.textMuted }, style]}>{children}</Text>;
}
export function Title({ children, size = 26 }: { children: React.ReactNode; size?: number }) {
  const { colors, typography } = useTheme();
  return <Text accessibilityRole="header" style={[typography.title, { color: colors.text, fontSize: size, lineHeight: Math.round(size * 1.22), letterSpacing: -size * 0.015 }]}>{children}</Text>;
}
export function Page({ children }: { children: React.ReactNode }) {
  return <ScrollView style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}
/** Card scrim colour for a trip, taken from its landscape. */
export const moodFor = (trip?: Pick<Trip, 'theme'>): Mood => moodForLandscape[trip?.theme || 'mountains'] || 'coast';
export const styles = StyleSheet.create({
  page: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40, gap: 24 },
  surface: { borderWidth: 1, borderRadius: 24, padding: 20, gap: 14 },
  heading: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headingAction: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  chipRow: { gap: 8, alignItems: 'center', paddingRight: 16 },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
