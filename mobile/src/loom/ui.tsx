import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type KeyboardTypeOptions, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useRouter } from '../core/nav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmberBackdrop, Icon, Illustration, type IconName, type IllustrationName } from './graphics';
import { tabBarHeight } from './TabBar';
import { colors, fonts, radii, shadows, tints, type Tint } from './tokens';

/* ------------------------------------------------------------------ Text */

type Variant = 'hero' | 'display' | 'title' | 'section' | 'row' | 'body' | 'small' | 'meta' | 'label' | 'eyebrow';
const VARIANTS: Record<Variant, TextStyle> = {
  hero: { fontFamily: fonts.semibold, fontSize: 36, lineHeight: 42, letterSpacing: -0.8 },
  display: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  title: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  section: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  row: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.stone },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.stone },
  meta: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.stone },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.stone },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: colors.ember },
};

/**
 * How far Dynamic Type may grow text of a given size. Body text can nearly double; display type grows
 * less so a headline never breaks mid-word on a phone.
 */
export const maxScale = (fontSize = 15) => (fontSize >= 34 ? 1.15 : fontSize >= 26 ? 1.25 : fontSize >= 18 ? 1.4 : fontSize >= 14 ? 1.7 : 1.9);

export function T({ v = 'body', color, style, children, lines, center }: {
  v?: Variant; color?: string; style?: StyleProp<TextStyle>; children: React.ReactNode; lines?: number; center?: boolean;
}) {
  const size = StyleSheet.flatten([VARIANTS[v], style])?.fontSize;
  return <Text numberOfLines={lines} maxFontSizeMultiplier={maxScale(size)}
    style={[{ color: colors.ink }, VARIANTS[v], color ? { color } : null, center ? { textAlign: 'center' } : null, style]}>{children}</Text>;
}

/* ------------------------------------------------------------------ Press feedback */

export function Press({ onPress, href, style, children, label, disabled }: {
  onPress?: () => void; href?: string; style?: StyleProp<ViewStyle>; children: React.ReactNode; label?: string; disabled?: boolean;
}) {
  const router = useRouter();
  const handle = onPress ?? (href ? () => router.push(href as never) : undefined);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={handle}
    style={({ pressed }) => [style, pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : null]}>{children}</Pressable>;
}

/* ------------------------------------------------------------------ Layout */

type Bar = 'tabs' | 'none';

/** A scrolling screen on the canvas. Pads for the notch and, when a tab bar floats over it, for the bar. */
/** `modal`: the screen is presented as a page sheet, which already clears the status bar unless it was opened full screen. */
export function Screen({ children, gap = 16, bar = 'none', footer, scroll = true, background = colors.canvas, modal }: {
  children: React.ReactNode; gap?: number; bar?: Bar; footer?: React.ReactNode; scroll?: boolean; background?: string; modal?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topInset = modal && router.canGoBack() ? 6 : insets.top;
  const bottom = bar === 'tabs' ? tabBarHeight(insets.bottom) + 24 : (footer ? 16 : insets.bottom + 24);
  const content = { paddingTop: topInset + 10, paddingHorizontal: 16, paddingBottom: bottom, gap };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: background }}>
    {scroll
      ? <ScrollView contentContainerStyle={[content, { flexGrow: 1 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">{children}</ScrollView>
      : <View style={[content, { flex: 1 }]}>{children}</View>}
    {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 12, gap: 8 }}>{footer}</View> : null}
  </KeyboardAvoidingView>;
}

export function Stack({ gap = 10, children, style }: { gap?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function RowView({ gap = 10, children, style, align = 'center' }: { gap?: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; align?: ViewStyle['alignItems'] }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap }, style]}>{children}</View>;
}

export const Spacer = () => <View style={{ flex: 1 }} />;

/* ------------------------------------------------------------------ Buttons */

export function RoundButton({ icon, onPress, href, dark, label, size = 48, back }: {
  icon: IconName; onPress?: () => void; href?: string; dark?: boolean; label: string; size?: number; back?: boolean;
}) {
  const router = useRouter();
  const action = back ? () => (router.canGoBack() ? router.back() : router.replace('/home' as never)) : onPress;
  return <Press onPress={action} href={href} label={label} style={{
    width: size, height: size, borderRadius: radii.button, alignItems: 'center', justifyContent: 'center',
    backgroundColor: dark ? colors.inkButton : colors.card, boxShadow: dark ? shadows.dark : shadows.button,
  }}><Icon name={icon} size={20} color={dark ? '#FFFFFF' : colors.ink} /></Press>;
}

export function BackButton() {
  return <RoundButton icon="back" back label="Back" />;
}

type ButtonKind = 'dark' | 'mist' | 'white';
export function Button({ label, icon, leading, kind = 'dark', onPress, href, full = true, height = 56, style }: {
  label: string; icon?: IconName; leading?: React.ReactNode; kind?: ButtonKind; onPress?: () => void; href?: string; full?: boolean; height?: number; style?: StyleProp<ViewStyle>;
}) {
  const bg = kind === 'dark' ? colors.inkButton : kind === 'mist' ? colors.mist : colors.card;
  const fg = kind === 'dark' ? '#FFFFFF' : colors.ink;
  const trailing = icon === 'chev';
  const glyph = icon ? <Icon name={icon} size={18} color={fg} strokeWidth={2.2} /> : null;
  return <Press onPress={onPress} href={href} label={label} style={[{
    minHeight: height, paddingVertical: 8, borderRadius: radii.button, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: kind === 'dark' ? shadows.dark : kind === 'white' ? shadows.button : undefined,
    alignSelf: full ? 'stretch' : 'flex-start', paddingHorizontal: full ? 0 : 20,
  }, style]}>
    {leading}
    {trailing ? null : glyph}
    <Text maxFontSizeMultiplier={maxScale(15)} style={{ fontFamily: fonts.semibold, fontSize: 15, color: fg }}>{label}</Text>
    {trailing ? glyph : null}
  </Press>;
}

/** Filter chips and quick actions: 42 high, squared-off. */
export function Pill({ label, icon, active, onPress, href }: { label: string; icon?: IconName; active?: boolean; onPress?: () => void; href?: string }) {
  return <Press onPress={onPress} href={href} label={label} style={{
    minHeight: 42, paddingVertical: 6, paddingHorizontal: 16, borderRadius: radii.button, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: active ? colors.inkButton : colors.card, boxShadow: active ? undefined : shadows.button,
  }}>
    {icon ? <Icon name={icon} size={16} color={active ? '#FFFFFF' : colors.ink} /> : null}
    <Text maxFontSizeMultiplier={maxScale(14)} style={{ fontFamily: fonts.semibold, fontSize: 14, color: active ? '#FFFFFF' : colors.ink }}>{label}</Text>
  </Press>;
}

/** A horizontal scroller that bleeds to the screen edge and leaves room for shadows. */
export function HScroll({ children, gap = 8 }: { children: React.ReactNode; gap?: number }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -16, marginVertical: -12 }}
    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap }}>{children}</ScrollView>;
}

/** Single-select filter chips. Pass `value`/`onChange` to control them, or let them keep their own state. */
export function Chips({ items, initial = 0, value, onChange }: {
  items: { label: string; icon?: IconName }[]; initial?: number; value?: number; onChange?: (index: number) => void;
}) {
  const [own, setOwn] = useState(initial);
  const active = value ?? own;
  return <HScroll>{items.map((item, i) => <Pill key={item.label} label={item.label} icon={item.icon} active={i === active}
    onPress={() => { setOwn(i); onChange?.(i); }} />)}</HScroll>;
}

/* ------------------------------------------------------------------ Labels */

export function Tag({ text, tint = 'peach' }: { text: string; tint?: Tint }) {
  return <View style={{ alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: radii.chip, backgroundColor: tints[tint].bg }}>
    <Text maxFontSizeMultiplier={maxScale(11)} style={{ fontFamily: fonts.semibold, fontSize: 11, color: tints[tint].fg }}>{text}</Text>
  </View>;
}

export function Header({ title, right, big, back = true }: { title: string; right?: React.ReactNode; big?: boolean; back?: boolean }) {
  if (big) return <RowView style={{ justifyContent: 'space-between' }}><T v="display">{title}</T>{right}</RowView>;
  return <RowView style={{ justifyContent: 'space-between' }}>
    {back ? <BackButton /> : <View style={{ width: 48 }} />}
    <T v="title">{title}</T>
    {right ?? <View style={{ width: 48 }} />}
  </RowView>;
}

export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children?: React.ReactNode }) {
  return <Stack gap={12}>
    <RowView style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
      <T v="section">{title}</T>
      {action ? <Press onPress={onAction} label={action}><T v="small" style={{ fontFamily: fonts.semibold, fontSize: 14 }}>{action}</T></Press> : null}
    </RowView>
    {children}
  </Stack>;
}

export function Title({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return <Stack gap={8} style={{ paddingHorizontal: 4, marginTop: 8 }}>
    {eyebrow ? <T v="eyebrow">{eyebrow}</T> : null}
    <T v="display">{title}</T>
    {sub ? <T v="body">{sub}</T> : null}
  </Stack>;
}

export function Note({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return <T v="small" center={center} style={{ paddingHorizontal: 4 }}>{children}</T>;
}

export function FieldLabel({ children }: { children: string }) {
  return <T v="label" style={{ paddingLeft: 4 }}>{children}</T>;
}

/* ------------------------------------------------------------------ Surfaces */

export function Card({ children, padding = 16, lifted, style, gap = 12 }: {
  children: React.ReactNode; padding?: number; lifted?: boolean; style?: StyleProp<ViewStyle>; gap?: number;
}) {
  return <View style={[{ backgroundColor: colors.card, borderRadius: radii.card, padding, gap, boxShadow: lifted ? shadows.lift : shadows.rest }, style]}>{children}</View>;
}

/** The ember hero. Its content sits straight on the gradient: never a white card inside it. */
export function Hero({ children, padding = 20, gap = 14, style }: { children: React.ReactNode; padding?: number; gap?: number; style?: StyleProp<ViewStyle> }) {
  // The solid ember base keeps white text readable even before (or without) the gradient's first layout.
  return <View style={[{ borderRadius: radii.hero, overflow: 'hidden', padding, gap, boxShadow: shadows.lift, backgroundColor: colors.ember }, style]}>
    <EmberBackdrop />
    {children}
  </View>;
}

export function HeroText({ v = 'body', children, style, faint, lines }: { v?: Variant; children: React.ReactNode; style?: StyleProp<TextStyle>; faint?: boolean; lines?: number }) {
  return <T v={v} color="#FFFFFF" lines={lines} style={[faint ? { opacity: 0.9 } : null, style]}>{children}</T>;
}

export function HeroRule() {
  return <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.4)' }} />;
}

export function IconTile({ icon, size = 44, tint, bg, color }: { icon: IconName; size?: number; tint?: Tint; bg?: string; color?: string }) {
  const b = bg ?? (tint ? tints[tint].bg : colors.canvas);
  const c = color ?? (tint ? tints[tint].fg : colors.ink);
  return <View style={{ width: size, height: size, borderRadius: radii.iconTile, backgroundColor: b, alignItems: 'center', justifyContent: 'center' }}>
    <Icon name={icon} size={20} color={c} />
  </View>;
}

/** Rows inside one white card, separated by hairlines. */
export function Group({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return <View style={{ backgroundColor: colors.card, borderRadius: radii.card, paddingHorizontal: 16, paddingVertical: 4, boxShadow: shadows.rest }}>
    {items.map((child, i) => <View key={i} style={i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.rule } : null}>{child}</View>)}
  </View>;
}

export function Row({ icon, title, meta, trailing = 'chev', tint, onPress, href, leading }: {
  icon?: IconName; title: string; meta?: string; trailing?: React.ReactNode | 'chev' | null; tint?: Tint; onPress?: () => void; href?: string; leading?: React.ReactNode;
}) {
  const body = <>
    {leading ?? (icon ? <IconTile icon={icon} tint={tint} /> : null)}
    <View style={{ flex: 1, gap: 2 }}>
      <T v="row" style={{ fontSize: 15 }}>{title}</T>
      {meta ? <T v="meta">{meta}</T> : null}
    </View>
    {trailing === 'chev' ? <Icon name="chev" size={18} color={colors.stone} /> : trailing}
  </>;
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, paddingVertical: 12 };
  return onPress || href ? <Press onPress={onPress} href={href} label={title} style={style}>{body}</Press> : <View style={style}>{body}</View>;
}

export function MediaRow({ ill, eyebrow, tint, title, meta, trailing = 'chev', href, onPress, height = 92 }: {
  ill: IllustrationName; eyebrow: string; tint: Tint; title: string; meta: string; trailing?: React.ReactNode | 'chev'; href?: string; onPress?: () => void; height?: number;
}) {
  // The art is pinned to the left edge so the row's height comes only from its text (percent heights in an
  // auto-height row can resolve against the wrong box).
  return <Press href={href} onPress={onPress} label={title} style={{
    flexDirection: 'row', alignItems: 'stretch', gap: 14, minHeight: height, paddingLeft: 92 + 14, paddingRight: 16,
    backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden', boxShadow: shadows.rest,
  }}>
    <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 92 }}><Illustration name={ill} width={92} height="100%" /></View>
    <View style={{ flex: 1, gap: 3, justifyContent: 'center', paddingVertical: 12 }}>
      <Text maxFontSizeMultiplier={maxScale(12)} style={{ fontFamily: fonts.semibold, fontSize: 12, color: tints[tint].fg }}>{eyebrow}</Text>
      <T v="row" lines={1}>{title}</T>
      <T v="meta" lines={1}>{meta}</T>
    </View>
    <View style={{ justifyContent: 'center' }}>{trailing === 'chev' ? <Icon name="chev" size={18} color={colors.stone} /> : trailing}</View>
  </Press>;
}

export function SwatchRow({ color, eyebrow, tint, title, meta, trailing }: {
  color: string; eyebrow: string; tint: Tint; title: string; meta: string; trailing?: React.ReactNode;
}) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 80, paddingRight: 16, backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden', boxShadow: shadows.rest }}>
    <View style={{ width: 80, alignSelf: 'stretch', minHeight: 80, backgroundColor: color }} />
    <View style={{ flex: 1, gap: 3, paddingVertical: 12 }}>
      <Text maxFontSizeMultiplier={maxScale(12)} style={{ fontFamily: fonts.semibold, fontSize: 12, color: tints[tint].fg }}>{eyebrow}</Text>
      <T v="row">{title}</T>
      <T v="meta">{meta}</T>
    </View>
    {trailing}
  </View>;
}

export function PhotoCard({ ill, label, title, meta, width = 236, height = 200, href, onPress }: {
  ill: IllustrationName; label: string; title: string; meta: string; width?: number; height?: number; href?: string; onPress?: () => void;
}) {
  return <Press href={href} onPress={onPress} label={`${title}, ${label}, ${meta}`} style={{ width, height, borderRadius: radii.card, overflow: 'hidden', justifyContent: 'flex-end' }}>
    <Illustration name={ill} width={width} height={height} style={{ position: 'absolute' }} />
    <View style={{ position: 'absolute', top: 12, left: 12, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radii.chip, backgroundColor: 'rgba(255,255,255,0.92)' }}>
      <Text maxFontSizeMultiplier={maxScale(12)} style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.ink }}>{label}</Text>
    </View>
    <View style={{ margin: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.92)', gap: 2 }}>
      <T v="row" lines={1}>{title}</T>
      <T v="meta" lines={1}>{meta}</T>
    </View>
  </Press>;
}

export function Dashed({ label, icon = 'plus', onPress }: { label: string; icon?: IconName; onPress?: () => void }) {
  return <Press onPress={onPress} label={label} style={{ height: 56, borderRadius: radii.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.dashed, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
    <Icon name={icon} size={18} color={colors.stone} /><T v="body" style={{ fontSize: 15 }}>{label}</T>
  </Press>;
}

/* ------------------------------------------------------------------ Controls */

export function Toggle({ initial = true, value, onChange, label, disabled }: { initial?: boolean; value?: boolean; onChange?: (on: boolean) => void; label?: string; disabled?: boolean }) {
  const [own, setOwn] = useState(initial);
  const on = value ?? own;
  const setOn = (next: boolean) => { setOwn(next); onChange?.(next); };
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on, disabled }} disabled={disabled} hitSlop={8} onPress={() => setOn(!on)}
    style={{ width: 50, height: 30, borderRadius: radii.round, backgroundColor: on ? colors.inkButton : colors.track, padding: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
    <View style={{ width: 24, height: 24, borderRadius: radii.round, backgroundColor: '#FFFFFF' }} />
  </Pressable>;
}

export function Checkbox({ checked, accent = colors.inkButton }: { checked: boolean; accent?: string }) {
  return checked
    ? <View style={{ width: 28, height: 28, borderRadius: radii.check, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={16} color="#FFFFFF" strokeWidth={3} /></View>
    : <View style={{ width: 28, height: 28, borderRadius: radii.check, borderWidth: 2, borderColor: colors.control }} />;
}

export function CheckToggle({ initial = false, accent, checked, onChange, label }: {
  initial?: boolean; accent?: string; checked?: boolean; onChange?: (on: boolean) => void; label?: string;
}) {
  const [own, setOwn] = useState(initial);
  const on = checked ?? own;
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: on }} hitSlop={10}
    onPress={() => { setOwn(!on); onChange?.(!on); }}><Checkbox checked={on} accent={accent} /></Pressable>;
}

export function Radio({ on }: { on: boolean }) {
  return on
    ? <View style={{ width: 24, height: 24, borderRadius: radii.round, backgroundColor: '#FFFFFF', boxShadow: '0px 2px 8px rgba(30,30,30,0.12)', alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 10, height: 10, borderRadius: radii.round, backgroundColor: colors.ember }} /></View>
    : <View style={{ width: 24, height: 24, borderRadius: radii.round, borderWidth: 2, borderColor: colors.control }} />;
}

type FieldKind = 'text' | 'name' | 'email' | 'password' | 'number' | 'phone' | 'place';
const FIELD_KINDS: Record<FieldKind, Partial<TextInputProps> & { keyboardType?: KeyboardTypeOptions }> = {
  text: {},
  name: { autoCapitalize: 'words', textContentType: 'name', autoComplete: 'name' },
  email: { autoCapitalize: 'none', autoCorrect: false, keyboardType: 'email-address', textContentType: 'emailAddress', autoComplete: 'email' },
  password: { autoCapitalize: 'none', autoCorrect: false, secureTextEntry: true, textContentType: 'password', autoComplete: 'current-password' },
  number: { keyboardType: 'decimal-pad' },
  phone: { keyboardType: 'phone-pad', textContentType: 'telephoneNumber', autoComplete: 'tel' },
  place: { autoCapitalize: 'words', textContentType: 'addressCity' },
};

export function Field({ label, value, onChangeText, placeholder, icon, multiline, secure, flex, kind = 'text', error, hint, autoFocus, maxLength, onSubmitEditing, returnKeyType, trailing, editable = true, onFocus, onBlur }: {
  label: string; value?: string; onChangeText?: (text: string) => void; placeholder?: string; icon?: IconName; multiline?: boolean;
  secure?: boolean; flex?: boolean; kind?: FieldKind; error?: string; hint?: string; autoFocus?: boolean; maxLength?: number;
  onSubmitEditing?: () => void; returnKeyType?: TextInputProps['returnKeyType']; trailing?: React.ReactNode; editable?: boolean;
  onFocus?: () => void; onBlur?: () => void;
}) {
  const input = useRef<TextInput>(null);
  return <View style={[{ gap: 6 }, flex ? { flex: 1 } : null]}>
    <FieldLabel>{label}</FieldLabel>
    {/* The whole box focuses the input, not just the text area. */}
    <Pressable accessible={false} onPress={() => input.current?.focus()} style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 10, minHeight: multiline ? 96 : 56, paddingHorizontal: 16, paddingVertical: multiline ? 14 : 0, borderRadius: radii.field, backgroundColor: colors.card, boxShadow: shadows.rest, borderWidth: error ? 1.5 : 0, borderColor: colors.danger }}>
      {icon ? <Icon name={icon} size={18} color={colors.stone} /> : null}
      <TextInput ref={input} {...FIELD_KINDS[secure ? 'password' : kind]} maxFontSizeMultiplier={1.7}
        {...(onChangeText ? { value: value ?? '', onChangeText: kind === 'number' ? (t: string) => onChangeText(t.replace(/[^0-9.,]/g, '')) : kind === 'phone' ? (t: string) => onChangeText(t.replace(/[^0-9+()\-. ]/g, '')) : onChangeText } : { defaultValue: value })}
        placeholder={placeholder} placeholderTextColor={colors.placeholder} multiline={multiline} autoFocus={autoFocus} maxLength={maxLength}
        editable={editable} onFocus={onFocus} onBlur={onBlur} onSubmitEditing={onSubmitEditing} returnKeyType={returnKeyType} submitBehavior={multiline ? 'newline' : 'blurAndSubmit'}
        accessibilityLabel={label} accessibilityHint={error || hint}
        style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: editable ? colors.ink : colors.stone, paddingVertical: multiline ? 0 : 12, minHeight: multiline ? 68 : undefined, textAlignVertical: multiline ? 'top' : 'center' }} />
      {trailing}
    </Pressable>
    {error ? <T v="meta" color={colors.danger} style={{ paddingLeft: 4 }}>{error}</T> : hint ? <T v="meta" style={{ paddingLeft: 4 }}>{hint}</T> : null}
  </View>;
}

/** A tappable field that opens a picker or sheet (dates, currencies, places). */
export function PickerField({ label, value, placeholder, icon, onPress, flex, error, accessibilityHint }: {
  label: string; value: string; placeholder?: string; icon?: IconName; onPress: () => void; flex?: boolean; error?: string; accessibilityHint?: string;
}) {
  return <View style={[{ gap: 6 }, flex ? { flex: 1 } : null]}>
    <FieldLabel>{label}</FieldLabel>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || placeholder || ''}`} accessibilityHint={accessibilityHint} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 16, borderRadius: radii.field, backgroundColor: colors.card, boxShadow: shadows.rest, opacity: pressed ? 0.85 : 1, borderWidth: error ? 1.5 : 0, borderColor: colors.danger })}>
      {icon ? <Icon name={icon} size={18} color={colors.stone} /> : null}
      <Text maxFontSizeMultiplier={1.7} numberOfLines={1} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: value ? colors.ink : colors.placeholder }}>{value || placeholder}</Text>
      <Icon name="chev" size={16} color={colors.stone} />
    </Pressable>
    {error ? <T v="meta" color={colors.danger} style={{ paddingLeft: 4 }}>{error}</T> : null}
  </View>;
}

export function EmptyState({ art, title, body, action }: { art?: IllustrationName; title: string; body: string; action?: React.ReactNode }) {
  return <View style={{ alignItems: 'center', gap: 12, paddingVertical: 28, paddingHorizontal: 12 }}>
    {art ? <Illustration name={art} width={120} height={120} radius={radii.card} /> : null}
    <T v="title" center>{title}</T>
    <T v="body" center>{body}</T>
    {action ? <View style={{ alignSelf: 'stretch', marginTop: 4 }}>{action}</View> : null}
  </View>;
}

/** A quiet notice under a header: offline, saving problems, conflicts. */
export function Banner({ icon = 'cloud', tint = 'peach', title, body, action, onAction }: {
  icon?: IconName; tint?: Tint; title: string; body?: string; action?: string; onAction?: () => void;
}) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderRadius: radii.card, backgroundColor: tints[tint].bg }}>
    <Icon name={icon} size={20} color={tints[tint].fg} />
    <View style={{ flex: 1, gap: 2 }}>
      <T v="row" style={{ fontSize: 14 }} color={tints[tint].fg}>{title}</T>
      {body ? <T v="meta" color={tints[tint].fg}>{body}</T> : null}
    </View>
    {action && onAction ? <Press onPress={onAction} label={action}><Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.bold, fontSize: 13, color: tints[tint].fg }}>{action}</Text></Press> : null}
  </View>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.canvas }}>
    <ActivityIndicator color={colors.ember} />
    <T v="small">{label}</T>
  </View>;
}

export function Segmented({ options, initial, value: controlled, onChange }: { options: string[]; initial?: string; value?: string; onChange?: (value: string) => void }) {
  const [own, setOwn] = useState(initial ?? options[0]);
  const value = controlled ?? own;
  const setValue = (v: string) => { setOwn(v); onChange?.(v); };
  return <View style={{ flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: colors.card, boxShadow: shadows.rest }}>
    {options.map((o) => {
      const on = o === value;
      return <Pressable key={o} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setValue(o)}
        style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: on ? colors.inkButton : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        <Text maxFontSizeMultiplier={maxScale(14)} style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 14, color: on ? '#FFFFFF' : colors.ink }}>{o}</Text>
      </Pressable>;
    })}
  </View>;
}

export function Progress({ pct, color = colors.ember, track = colors.rule, height = 6 }: { pct: number; color?: string; track?: string; height?: number }) {
  return <View style={{ height, borderRadius: radii.round, backgroundColor: track, overflow: 'hidden' }}><View style={{ width: `${pct}%`, height: '100%', backgroundColor: color }} /></View>;
}

export function Steps({ n, total = 4 }: { n: number; total?: number }) {
  return <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${n} of ${total}`}>
    {Array.from({ length: total }, (_, i) => <View key={i} style={{ width: 26, height: 5, borderRadius: radii.round, backgroundColor: i < n ? colors.ember : colors.track }} />)}
  </View>;
}

export function DayChips({ days, initial }: { days: [string, string | number][]; initial?: string | number }) {
  const [active, setActive] = useState(initial ?? days[0][1]);
  return <HScroll>{days.map(([d, n]) => {
    const on = n === active;
    return <Pressable key={`${d}${n}`} onPress={() => setActive(n)} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ width: 54, paddingTop: 10, paddingBottom: 8, borderRadius: radii.tile, alignItems: 'center', backgroundColor: on ? colors.inkButton : colors.card, boxShadow: shadows.button }}>
      <Text maxFontSizeMultiplier={maxScale(11)} style={{ fontFamily: fonts.medium, fontSize: 11, color: on ? 'rgba(255,255,255,0.7)' : '#8A8A8A' }}>{d}</Text>
      <Text maxFontSizeMultiplier={maxScale(18)} style={{ fontFamily: fonts.semibold, fontSize: 18, color: on ? '#FFFFFF' : colors.ink }}>{n}</Text>
    </Pressable>;
  })}</HScroll>;
}

export function Avatar({ initials, tint = 'lavender', size = 36, overlap }: { initials: string; tint?: Tint; size?: number; overlap?: boolean }) {
  return <View style={[{ width: size, height: size, borderRadius: radii.round, backgroundColor: tints[tint].bg, alignItems: 'center', justifyContent: 'center' },
    overlap ? { marginLeft: -10, borderWidth: 2, borderColor: '#FFFFFF' } : null]}>
    {initials ? <Text maxFontSizeMultiplier={maxScale(15)} style={{ fontFamily: fonts.bold, fontSize: Math.round(size / 3) + 1, color: tints[tint].fg }}>{initials}</Text>
      : <Icon name="profile" size={Math.round(size * 0.45)} color={tints[tint].fg} />}
  </View>;
}

export function Swatches({ colors: list, size = 32 }: { colors: string[]; size?: number }) {
  return <View style={{ flexDirection: 'row' }}>
    {list.map((c, i) => <View key={i} style={{ width: size, height: size, borderRadius: radii.round, backgroundColor: c, marginLeft: i ? -10 : 0, borderWidth: i ? 2 : 0, borderColor: '#FFFFFF' }} />)}
  </View>;
}

export function Bars({ values, labels, active, color = colors.ember, faded = '#F1D7C8', height = 90 }: {
  values: number[]; labels: string[]; active?: number; color?: string; faded?: string; height?: number;
}) {
  const max = Math.max(...values, 1);
  return <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
    {values.map((v, i) => <View key={i} style={{ flex: 1, alignItems: 'center', gap: 8, justifyContent: 'flex-end', height: height + 26 }}>
      <View style={{ width: '100%', maxWidth: 28, height: Math.max(6, (v / max) * height), borderRadius: radii.round, backgroundColor: active === undefined || active === i ? color : faded }} />
      <T v="meta" style={{ fontSize: 11 }}>{labels[i]}</T>
    </View>)}
  </View>;
}

/* ------------------------------------------------------------------ Sheets */

/** Content of a modal route: grabber, centred title and a close button, then scrolling content. */
export function Sheet({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // A page sheet already clears the status bar; only a full-screen open (no screen below it) needs the inset.
  const top = router.canGoBack() ? 0 : insets.top;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.canvas }}
>
    <View style={{ alignItems: 'center', paddingTop: top + 10 }}><View style={{ width: 40, height: 5, borderRadius: radii.round, backgroundColor: colors.dashed }} /></View>
    <RowView style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10 }}>
      <View style={{ width: 48 }} />
      <T v="title">{title}</T>
      <RoundButton icon="x" label="Close" onPress={() => router.back()} />
    </RowView>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: footer ? 16 : insets.bottom + 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">{children}</ScrollView>
    {footer ? <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 4 }}>{footer}</View> : null}
  </KeyboardAvoidingView>;
}
