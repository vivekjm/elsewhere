import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { suggest, type Place } from '../services/places';
import { Icon } from './graphics';
import { colors, fonts, radii, shadows } from './tokens';
import { Field } from './ui';

/** A destination field with place suggestions as you type (Open-Meteo gazetteer). Free text is always allowed. */
export function PlaceField({ label, value, onChange, onPlace, error, placeholder = 'City or region' }: {
  label: string; value: string; onChange: (text: string) => void; onPlace?: (place: Place) => void; error?: string; placeholder?: string;
}) {
  const [results, setResults] = useState<Place[]>([]);
  const [focused, setFocused] = useState(false);
  const picked = useRef(value);
  useEffect(() => {
    if (!focused || value.trim().length < 2 || value === picked.current) { setResults([]); return; }
    let active = true;
    const timer = setTimeout(() => { void suggest(value).then((r) => { if (active) setResults(r.slice(0, 5)); }); }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [value, focused]);
  return <View style={{ gap: 6 }}>
    <Field label={label} value={value} onChangeText={onChange} icon="pin" kind="place" placeholder={placeholder} error={error}
      onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 200)} />
    {results.length ? <View style={{ backgroundColor: colors.card, borderRadius: radii.field, boxShadow: shadows.lift, paddingHorizontal: 14 }}>
      {results.map((r, i) => <Pressable key={`${r.label}${i}`} accessibilityRole="button" accessibilityLabel={r.label}
        onPress={() => { picked.current = r.label; onChange(r.label); onPlace?.(r); setResults([]); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.rule }}>
        <Icon name="pin" size={16} color={colors.stone} />
        <Text maxFontSizeMultiplier={1.6} numberOfLines={1} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink }}>{r.label}</Text>
      </Pressable>)}
    </View> : null}
  </View>;
}
