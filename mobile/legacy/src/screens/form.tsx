import React from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { DatePicker as SwiftDatePicker, Host as SwiftHost, Picker as SwiftPicker, Text as SwiftText } from '@expo/ui/swift-ui';
import { datePickerStyle, labelsHidden, pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';
import { Chip, Icon, PressableScale, useTheme, type IconName } from '../design';
import { validDate } from './shared';

/**
 * Form building blocks for the editor sheets: iOS-style inset groups with inline rows, native
 * date, time and menu pickers, and icon chips. Every row is 52pt or taller with 16pt insets.
 */

export const categoryIcons: Record<string, IconName> = {
  Explore: 'compass', 'Food & drink': 'food', Travel: 'plane', Stay: 'stay', Event: 'event', Other: 'note',
  Tops: 'shirt', Bottoms: 'trousers', Layers: 'jacket', Shoes: 'shoe', Accessories: 'bag', Gear: 'camera',
  Essentials: 'shield', Documents: 'passport', Toiletries: 'toiletries', Electronics: 'plug', 'Health & care': 'health',
};

/** A titled group. `bare` renders its children without the card (for chip rows). */
export function FormSection({ title, footer, bare = false, children }: { title?: string; footer?: string; bare?: boolean; children: React.ReactNode }) {
  const { colors, fonts } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return <View style={{ gap: 8 }}>
    {title ? <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.textMuted, paddingHorizontal: 4 }}>{title}</Text> : null}
    {bare ? children : <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' }}>
      {rows.map((row, index) => <View key={index}>
        {index ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 }} /> : null}
        {row}
      </View>)}
    </View>}
    {footer ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, paddingHorizontal: 4 }}>{footer}</Text> : null}
  </View>;
}

function RowIcon({ name }: { name: IconName }) {
  const { colors, mode } = useTheme();
  return <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
    <Icon name={name} size={17} color={mode === 'dark' ? colors.text : colors.primary} />
  </View>;
}

/** A free-text row. `large` is the headline field (name or title) of a form. */
export function TextRow({ icon, value, onChangeText, placeholder, multiline, keyboardType, large, label, autoFocus }: {
  icon?: IconName; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean;
  keyboardType?: KeyboardTypeOptions; large?: boolean; label?: string; autoFocus?: boolean;
}) {
  const { colors, fonts } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 12, paddingHorizontal: 16, minHeight: large ? 60 : 52, paddingVertical: multiline ? 14 : 0 }}>
    {icon ? <RowIcon name={icon} /> : null}
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMuted}
      accessibilityLabel={label ?? placeholder} keyboardType={keyboardType} multiline={multiline} autoFocus={autoFocus}
      autoCapitalize={keyboardType === 'url' ? 'none' : 'sentences'} selectionColor={colors.accent}
      style={{ flex: 1, color: colors.text, fontFamily: large ? fonts.semibold : fonts.regular, fontSize: large ? 20 : 17,
        paddingVertical: multiline ? 4 : 14, minHeight: multiline ? 72 : undefined, textAlignVertical: multiline ? 'top' : 'center' }} />
  </View>;
}

/** Label on the left, a short editable value on the right (numbers, codes). */
export function ValueRow({ icon, label, value, onChangeText, keyboardType = 'numeric', suffix, placeholder = '0' }: {
  icon?: IconName; label: string; value: string; onChangeText: (value: string) => void; keyboardType?: KeyboardTypeOptions; suffix?: string; placeholder?: string;
}) {
  const { colors, fonts } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 52 }}>
    {icon ? <RowIcon name={icon} /> : null}
    <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 17 }}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor={colors.textMuted}
      accessibilityLabel={label} selectionColor={colors.accent} selectTextOnFocus autoCapitalize="none"
      style={{ minWidth: 60, textAlign: 'right', color: colors.text, fontFamily: fonts.medium, fontSize: 17, paddingVertical: 14 }} />
    {suffix ? <Text style={{ color: colors.textMuted, fontFamily: fonts.regular, fontSize: 17, marginLeft: -6 }}>{suffix}</Text> : null}
  </View>;
}

const toDate = (value: string) => new Date(`${validDate(value) ? value : new Date().toISOString().slice(0, 10)}T12:00:00`);
const fromDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const toTime = (value: string) => { const date = new Date(); const [h, m] = (value || '09:00').split(':').map(Number); date.setHours(h || 0, m || 0, 0, 0); return date; };
const fromTime = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/**
 * A date or time row with the native compact picker. Optional times show "Add" until set and can
 * be cleared. Android falls back to a typed value.
 */
export function PickerRow({ icon, label, mode, value, onChange, min, max, optional, defaultValue }: {
  icon?: IconName; label: string; mode: 'date' | 'time'; value: string; onChange: (value: string) => void;
  min?: string; max?: string; optional?: boolean; defaultValue?: string;
}) {
  const { colors, fonts, mode: scheme } = useTheme();
  if (Platform.OS !== 'ios') {
    return <ValueRow icon={icon} label={label} value={value} onChangeText={onChange} keyboardType="numbers-and-punctuation" placeholder={mode === 'date' ? 'YYYY-MM-DD' : 'HH:MM'} />;
  }
  const empty = optional && !value;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 52 }}>
    {icon ? <RowIcon name={icon} /> : null}
    <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 17 }}>{label}</Text>
    {empty ? <Pressable onPress={() => { void Haptics.selectionAsync(); onChange(defaultValue || '09:00'); }} accessibilityRole="button" accessibilityLabel={`Add ${label.toLowerCase()}`} hitSlop={10}
      style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
      <Text style={{ color: colors.primary, fontFamily: fonts.medium, fontSize: 15 }}>Add</Text>
    </Pressable> : <>
      <SwiftHost matchContents colorScheme={scheme}>
        {mode === 'date'
          ? <SwiftDatePicker selection={toDate(value)} displayedComponents={['date']} modifiers={[datePickerStyle('compact'), labelsHidden(), tint(colors.primary)]}
            range={{ start: min ? toDate(min) : undefined, end: max ? toDate(max) : undefined }} onDateChange={date => onChange(fromDate(date))} />
          : <SwiftDatePicker selection={toTime(value)} displayedComponents={['hourAndMinute']} modifiers={[datePickerStyle('compact'), labelsHidden(), tint(colors.primary)]}
            onDateChange={date => onChange(fromTime(date))} />}
      </SwiftHost>
      {optional ? <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel={`Clear ${label.toLowerCase()}`} hitSlop={10}>
        <Icon name="close" size={16} color={colors.textMuted} />
      </Pressable> : null}
    </>}
  </View>;
}

/** Label on the left, a native pop-up menu on the right (iOS); chips elsewhere. */
export function MenuRow<T extends string>({ icon, label, value, options, onChange }: { icon?: IconName; label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  const { colors, fonts, mode } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 52 }}>
    {icon ? <RowIcon name={icon} /> : null}
    <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 17 }}>{label}</Text>
    {Platform.OS === 'ios'
      ? <SwiftHost matchContents colorScheme={mode}>
        <SwiftPicker selection={value} onSelectionChange={(next: T) => onChange(next)} modifiers={[pickerStyle('menu'), labelsHidden(), tint(colors.primary)]}>
          {options.map(option => <SwiftText key={option} modifiers={[tag(option)]}>{option}</SwiftText>)}
        </SwiftPicker>
      </SwiftHost>
      : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ maxWidth: 200 }}>
        {options.map(option => <Chip key={option} label={option} selected={option === value} onPress={() => onChange(option)} />)}
      </ScrollView>}
  </View>;
}

/** Single choice as a scrolling row of icon chips. */
export function ChoiceChips({ options, value, onChange, label }: { options: readonly string[]; value: string; onChange: (value: string) => void; label: string }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={label}
    contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
    {options.map(option => <Chip key={option} icon={categoryIcons[option]} label={option} selected={option === value}
      onPress={() => { void Haptics.selectionAsync(); onChange(option); }} />)}
  </ScrollView>;
}

/** Multiple choice as wrapping chips: a check when picked, otherwise the item's own icon. */
export function PickChips({ options, selected, onToggle, empty }: { options: { id: string; name: string; icon?: IconName }[]; selected: string[]; onToggle: (id: string) => void; empty: string }) {
  const { colors, fonts } = useTheme();
  if (!options.length) return <Text style={{ color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15, paddingHorizontal: 4 }}>{empty}</Text>;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {options.map(option => { const on = selected.includes(option.id); return <Chip key={option.id} icon={on ? 'check' : option.icon} label={option.name} selected={on}
      onPress={() => { void Haptics.selectionAsync(); onToggle(option.id); }} />; })}
  </View>;
}

/** Trip cover picker: the landscape illustrations as tiles with a selection ring. */
export function CoverTiles<T extends string>({ options, value, onChange, image }: { options: readonly T[]; value: T; onChange: (value: T) => void; image: (value: T) => number }) {
  const { colors, fonts } = useTheme();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}
    accessibilityRole="radiogroup" accessibilityLabel="Trip cover">
    {options.map(option => { const on = option === value; return <PressableScale key={option} scaleTo={0.94} onPress={() => { void Haptics.selectionAsync(); onChange(option); }}
      accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={option} style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ width: 88, height: 64, borderRadius: 16, padding: 2, borderWidth: 2, borderColor: on ? colors.primary : 'transparent' }}>
        <Image source={image(option)} resizeMode="cover" style={{ flex: 1, borderRadius: 12 }} />
      </View>
      <Text style={{ fontFamily: on ? fonts.semibold : fonts.regular, fontSize: 13, color: on ? colors.text : colors.textMuted, textTransform: 'capitalize' }}>{option}</Text>
    </PressableScale>; })}
  </ScrollView>;
}

/** A single full-width action row inside a group (e.g. Delete). */
export function ActionRow({ label, onPress, destructive, icon }: { label: string; onPress: () => void; destructive?: boolean; icon?: IconName }) {
  const { colors, fonts } = useTheme();
  const color = destructive ? colors.danger : colors.primary;
  return <PressableScale onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={label}
    style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 }}>
    {icon ? <Icon name={icon} size={18} color={color} /> : null}
    <Text style={{ color, fontFamily: fonts.medium, fontSize: 17 }}>{label}</Text>
  </PressableScale>;
}
