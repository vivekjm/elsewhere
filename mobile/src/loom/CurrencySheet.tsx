import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Text, TextInput, View } from 'react-native';
import { PressScale } from './motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CURRENCIES } from '../data/model';
import { COMMON_CURRENCIES, currencyName } from '../services/currency';
import { Icon } from './graphics';
import { colors, fonts, radii, shadows } from './tokens';
import { inputText, PickerField, Radio, RoundButton, singleLine, T } from './ui';

/** A searchable list of every currency the workspace accepts, common ones first. */
export function CurrencySheet({ visible, value, onPick, onClose }: { visible: boolean; value: string; onPick: (code: string) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const all = useMemo(() => {
    const rest = (CURRENCIES as readonly string[]).filter((c) => !COMMON_CURRENCIES.includes(c)).sort();
    return [...COMMON_CURRENCIES.filter((c) => (CURRENCIES as readonly string[]).includes(c)), ...rest].map((code) => ({ code, name: currencyName(code) }));
  }, []);
  const q = query.trim().toLowerCase();
  const list = q ? all.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) : all;
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
        <View style={{ width: 48 }} />
        <T v="title">Currency</T>
        <RoundButton icon="x" label="Close" onPress={onClose} />
      </View>
      <View style={{ margin: 16, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: radii.field, backgroundColor: colors.card, boxShadow: shadows.rest }}>
        <Icon name="search" size={18} color={colors.stone} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search currencies" placeholderTextColor={colors.placeholder} autoCorrect={false}
          accessibilityLabel="Search currencies" maxFontSizeMultiplier={1.6} style={[inputText, singleLine]} />
      </View>
      <FlatList data={list} keyExtractor={(c) => c.code} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        renderItem={({ item }) => <PressScale accessibilityRole="radio" accessibilityState={{ checked: item.code === value }} accessibilityLabel={`${item.name}, ${item.code}`}
          onPress={() => { onPick(item.code); onClose(); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
          <View style={{ width: 52, height: 40, borderRadius: radii.iconTile, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{item.code}</Text>
          </View>
          <Text maxFontSizeMultiplier={1.6} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink }}>{item.name}</Text>
          <Radio on={item.code === value} />
        </PressScale>} />
    </View>
  </Modal>;
}

/** A field showing a currency that opens the currency sheet. */
export function CurrencyField({ label = 'Currency', value, onChange, flex }: { label?: string; value: string; onChange: (code: string) => void; flex?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    {/* Half width only fits the code ("INR"); full width also names it. The spoken label always names it. */}
    <PickerField label={label} value={flex || currencyName(value) === value ? value : `${value} · ${currencyName(value)}`} icon="globe" onPress={() => setOpen(true)} flex={flex}
      accessibilityHint={currencyName(value)} />
    <CurrencySheet visible={open} value={value} onPick={onChange} onClose={() => setOpen(false)} />
  </>;
}
