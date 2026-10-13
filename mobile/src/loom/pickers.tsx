import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fromDate, shortDay, toDate } from '../domain/format';
import { Icon, type IconName } from './graphics';
import { colors, fonts, radii, shadows } from './tokens';
import { FieldLabel } from './ui';

function Shell({ label, icon, flex, children, onPress, a11y }: { label: string; icon: IconName; flex?: boolean; children: React.ReactNode; onPress?: () => void; a11y: string }) {
  const body = <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 16, paddingRight: Platform.OS === 'ios' ? 8 : 16, borderRadius: radii.field, backgroundColor: colors.card, boxShadow: shadows.rest }}>
    <Icon name={icon} size={18} color={colors.stone} />
    {children}
  </View>;
  return <View style={[{ gap: 6 }, flex ? { flex: 1 } : null]}>
    <FieldLabel>{label}</FieldLabel>
    {onPress ? <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress}>{body}</Pressable> : body}
  </View>;
}

const asTime = (hhmm: string) => { const [h, m] = (hhmm || '09:00').split(':').map(Number); const d = new Date(); d.setHours(h || 0, m || 0, 0, 0); return d; };
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** A calendar date (`YYYY-MM-DD`), limited to `min`/`max` when given. */
export function DateField({ label, value, onChange, min, max, flex }: { label: string; value: string; onChange: (iso: string) => void; min?: string; max?: string; flex?: boolean }) {
  const date = toDate(value || fromDate(new Date()));
  const handle = (_: unknown, picked?: Date) => { if (picked) onChange(fromDate(picked)); };
  if (Platform.OS === 'ios') {
    return <Shell label={label} icon="calendar" flex={flex} a11y={`${label}: ${shortDay(value)}`}>
      <View style={{ flex: 1 }} />
      <DateTimePicker value={date} mode="date" display="compact" onValueChange={handle} accentColor={colors.ember}
        minimumDate={min ? toDate(min) : undefined} maximumDate={max ? toDate(max) : undefined} accessibilityLabel={label} />
    </Shell>;
  }
  return <Shell label={label} icon="calendar" flex={flex} a11y={`${label}: ${shortDay(value)}`}
    onPress={() => DateTimePickerAndroid.open({ value: date, mode: 'date', onValueChange: handle, minimumDate: min ? toDate(min) : undefined, maximumDate: max ? toDate(max) : undefined })}>
    <Text maxFontSizeMultiplier={1.7} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink }}>{shortDay(value)}</Text>
  </Shell>;
}

/** A 24-hour time (`HH:mm`); empty means "any time". */
export function TimeField({ label, value, onChange, flex, optional }: { label: string; value: string; onChange: (time: string) => void; flex?: boolean; optional?: boolean }) {
  const handle = (_: unknown, picked?: Date) => { if (picked) onChange(hhmm(picked)); };
  const clear = optional && value ? <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} hitSlop={10} onPress={() => onChange('')}><Icon name="x" size={16} color={colors.stone} /></Pressable> : null;
  if (Platform.OS === 'ios') {
    return <Shell label={label} icon="clock" flex={flex} a11y={`${label}: ${value || 'any time'}`}>
      {value ? <>
        <View style={{ flex: 1 }} />
        <DateTimePicker value={asTime(value)} mode="time" display="compact" onValueChange={handle} accentColor={colors.ember} accessibilityLabel={label} />
        {clear}
      </> : <Pressable accessibilityRole="button" onPress={() => onChange('09:00')} style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
        <Text maxFontSizeMultiplier={1.7} style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.placeholder }}>Any time · tap to set</Text>
      </Pressable>}
    </Shell>;
  }
  return <Shell label={label} icon="clock" flex={flex} a11y={`${label}: ${value || 'any time'}`}
    onPress={() => DateTimePickerAndroid.open({ value: asTime(value), mode: 'time', is24Hour: true, onValueChange: handle })}>
    <Text maxFontSizeMultiplier={1.7} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: value ? colors.ink : colors.placeholder }}>{value || 'Any time'}</Text>
    {clear}
  </Shell>;
}
