import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View, type ImageStyle, type ViewStyle } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useRouter } from '../core/nav';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Sharing from 'expo-sharing';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { FREE_DOCUMENTS_PER_TRIP, usePro } from '../core/pro';
import { reportError, useCurrentTrip, usePrefs, useTrips } from '../core/state';
import { canScanReceipts, scanReceipt } from '../services/intelligence';
import {
  CATEGORIES, CURRENCIES, DOCUMENT_KINDS, EXPENSE_CATEGORIES, EXTRA_CATEGORIES, ME, packing, tripDates, uid, useWorkspace,
  type DocumentKind, type Expense, type ExpenseCategory, type Extra, type Item, type PackRow,
} from '../data';
import { dayOfMonth, initials, longDay, money, plural, shortDay, todayISO, weekday, weight } from '../domain/format';
import { applyStyle, combinations, styleTrip } from '../domain/stylist';
import { budgetOf, convert, EXPENSE_ICON, EXPENSE_LABEL, EXPENSE_TINT, nameOf } from '../domain/trips';
import {
  Avatar, Bars, Button, Card, Checkbox, CheckToggle, Chips, colors, CurrencyField, DateField, EmptyState, Field, FieldLabel, fonts, Group, Header, Hero, HeroText,
  Icon, IconTile, Loading, Note, Press, Progress, Radio, radii, Ring, RoundButton, Row, RowView, Screen, Section, Segmented, shadows, Sheet, Stack, SwatchRow, T, Tag,
  tints, type IconName,
} from '../loom';
import { convertLabel, useRates } from '../services/currency';
import { tides, type TideDay } from '../services/outdoors';
import { summary, useTripWeather, weatherIcon } from '../services/weather';
import { DayStrip, initialDay, NoTrip } from './trip';
import { tintFor } from './shared';

/* ------------------------------------------------------------------ Wardrobe */

const CATEGORY_LABEL: Record<Item['category'], string> = { Tops: 'Top', Bottoms: 'Bottom', Layers: 'Layer', Shoes: 'Shoes', Accessories: 'Accessory', Gear: 'Gear' };
export const PALETTE = ['#1E1E1E', '#F2EFE8', '#D9CBB5', '#7A5A3C', '#9A3F13', '#C8553D', '#E9B44C', '#8FA36B', '#2E5E4E', '#2E3A5C', '#6C8EBF', '#8B8B73'];
const PALETTE_NAMES: Record<string, string> = { '#1E1E1E': 'Black', '#F2EFE8': 'White', '#D9CBB5': 'Beige', '#7A5A3C': 'Brown', '#9A3F13': 'Rust', '#C8553D': 'Red', '#E9B44C': 'Mustard', '#8FA36B': 'Sage', '#2E5E4E': 'Forest green', '#2E3A5C': 'Navy', '#6C8EBF': 'Blue', '#8B8B73': 'Olive' };

function ItemPhoto({ item, size, radius = 0 }: { item: Item; size: number | '100%'; radius?: number }) {
  const { photoSource } = useWorkspace();
  const [failed, setFailed] = useState(false);
  // A percent size becomes a full-width square; a percent height would stretch to the screen in an auto-height card.
  const style: ImageStyle = size === '100%' ? { width: '100%', aspectRatio: 1, borderRadius: radius, backgroundColor: item.color || '#8b8b73' } : { width: size, height: size, borderRadius: radius, backgroundColor: item.color || '#8b8b73' };
  if (!item.image || failed) return <View style={style as ViewStyle} />;
  let source: ReturnType<typeof photoSource> | null = null;
  try { source = photoSource(item.image); } catch { source = null; }
  return source ? <Image source={source} style={style} onError={() => setFailed(true)} accessibilityIgnoresInvertColors /> : <View style={style as ViewStyle} />;
}

export function WardrobeScreen() {
  const { workspace, status } = useTrips();
  const router = useRouter();
  const [filter, setFilter] = useState(0);
  if (!workspace) return status === 'loading' ? <Loading /> : <NoTrip />;
  const filters: (Item['category'] | null)[] = [null, ...CATEGORIES];
  const chosen = filters[filter];
  const items = workspace.items.filter((i) => !chosen || i.category === chosen);
  const pairs: Item[][] = [];
  for (let i = 0; i < items.length; i += 2) pairs.push(items.slice(i, i + 2));
  return <Screen bar="tabs">
    <Header title="Wardrobe" right={<RoundButton icon="plus" dark label="Add a piece" href="/add-piece" />} />
    <Chips value={filter} onChange={setFilter} items={filters.map((c) => ({ label: c ? `${c} · ${workspace.items.filter((i) => i.category === c).length}` : `All · ${workspace.items.length}` }))} />
    {workspace.items.length ? <Press href="/trip/stylist" label="AI stylist" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingHorizontal: 16, borderRadius: radii.card, backgroundColor: colors.inkButton, boxShadow: shadows.dark }}>
      <IconTile icon="sparkle" bg="rgba(255,255,255,0.14)" color="#FFFFFF" />
      <View style={{ flex: 1, gap: 2 }}><T v="row" style={{ fontSize: 15 }} color="#FFFFFF">Stylist</T><T v="meta" color="rgba(255,255,255,0.8)">{combinations(workspace.items) ? `${plural(combinations(workspace.items), 'combination')} from ${plural(workspace.items.length, 'piece')}, dressed for the forecast` : 'Add tops and bottoms to get outfits for each day'}</T></View>
      <Icon name="chev" size={18} color="#FFFFFF" />
    </Press> : null}
    {items.length ? <Stack>{pairs.map((pair, r) => <RowView key={r} align="stretch">
      {pair.map((item) => <Press key={item.id} label={`${item.name}, ${CATEGORY_LABEL[item.category]}`} onPress={() => router.push({ pathname: '/add-piece', params: { id: item.id } } as never)}
        style={{ flex: 1, backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden', boxShadow: shadows.rest }}>
        <ItemPhoto item={item} size="100%" />
        <View style={{ padding: 12, paddingHorizontal: 14, gap: 2 }}><T v="row" lines={1} style={{ fontSize: 15 }}>{item.name}</T><T v="meta">{CATEGORY_LABEL[item.category]}{item.weight ? ` · ${weight(item.weight)}` : ''}</T></View>
      </Press>)}
      {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
    </RowView>)}</Stack>
      : <EmptyState art="suitcase" title={chosen ? `No ${chosen.toLowerCase()} yet` : 'Your wardrobe is empty'} body="Add the clothes you travel with. Outfits and packing lists are built from them."
        action={<Button label="Add a piece" icon="plus" href="/add-piece" />} />}
  </Screen>;
}

export function AddPieceSheet() {
  const ws = useTrips();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const existing = ws.workspace?.items.find((i) => i.id === params.id);
  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState<Item['category']>(existing?.category ?? 'Tops');
  const [color, setColor] = useState(existing?.color ?? PALETTE[2]);
  const [grams, setGrams] = useState(existing?.weight ? String(existing.weight) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [image, setImage] = useState(existing?.image ?? '');
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true };
    if (!perm.granted) { Alert.alert('Camera access is off', 'Allow camera access for Trips Loom in Settings, or choose a photo instead.'); return; }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, exif: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, exif: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPreview(asset.uri);
    setUploading(true);
    try {
      const path = await ws.uploadWardrobePhoto(asset.uri, asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg');
      setImage(path);
    } catch (e) {
      setPreview(null);
      reportError(e, 'Couldn’t upload the photo');
    } finally { setUploading(false); }
  };
  const choosePhoto = () => Alert.alert('Add a photo', undefined, [
    { text: 'Take photo', onPress: () => void pick(true) }, { text: 'Choose from library', onPress: () => void pick(false) },
    ...(image ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => { setImage(''); setPreview(null); } }] : []),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
  const save = () => {
    if (!name.trim()) { setError('Name the piece.'); return; }
    if (uploading) return;
    const g = grams.trim() ? Number(grams.replace(',', '.')) : 0;
    const item: Item = { id: existing?.id ?? uid(), name: name.trim().slice(0, 200), category, weight: Number.isFinite(g) ? Math.min(50000, Math.max(0, Math.round(g))) : 0, image, color, shape: existing?.shape, notes: notes.slice(0, 5000) };
    if (ws.edit((w) => { const i = w.items.findIndex((x) => x.id === item.id); if (i >= 0) w.items[i] = { ...w.items[i], ...item }; else w.items.push(item); })) router.back();
  };
  const remove = () => Alert.alert(`Remove ${existing?.name}?`, 'It also comes out of outfits and packing lists.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => {
    if (ws.edit((w) => {
      w.items = w.items.filter((i) => i.id !== existing!.id);
      w.outfits.forEach((o) => { o.items = o.items.filter((i) => i !== existing!.id); });
      w.trips.forEach((t) => { t.packed = t.packed.filter((i) => i !== existing!.id); t.activities.forEach((a) => { a.gear = a.gear.filter((i) => i !== existing!.id); }); Object.values(t.days).forEach((d) => { d.gear = d.gear?.filter((i) => i !== existing!.id); }); });
    })) router.back();
  } }]);
  const shown: Item = { id: 'preview', name, category, weight: 0, image, color };
  return <Sheet title={existing ? 'Edit piece' : 'Add a piece'} footer={<Stack gap={10}>
    <Button label={uploading ? 'Uploading photo…' : 'Save'} icon={uploading ? undefined : 'check'} leading={uploading ? <ActivityIndicator color="#FFFFFF" /> : undefined} onPress={save} />
    {existing ? <Button label="Remove from wardrobe" icon="trash" kind="white" onPress={remove} /> : null}
  </Stack>}>
    <Pressable accessibilityRole="button" accessibilityLabel={image || preview ? 'Change photo' : 'Add a photo'} onPress={choosePhoto} style={{ alignSelf: 'center' }}>
      {preview ? <Image source={{ uri: preview }} style={{ width: 140, height: 140, borderRadius: radii.card }} /> : <ItemPhoto item={shown} size={140} radius={radii.card} />}
      <View style={{ position: 'absolute', right: -6, bottom: -6, width: 40, height: 40, borderRadius: radii.button, backgroundColor: colors.inkButton, alignItems: 'center', justifyContent: 'center' }}><Icon name="camera" size={18} color="#FFFFFF" /></View>
    </Pressable>
    <Field label="Name" value={name} onChangeText={(t) => { setName(t); setError(''); }} icon="wardrobe" placeholder="Linen overshirt" maxLength={200} error={error} />
    <Stack gap={8}><FieldLabel>Kind</FieldLabel><Chips value={CATEGORIES.indexOf(category)} onChange={(i) => setCategory(CATEGORIES[i])} items={CATEGORIES.map((c) => ({ label: c }))} /></Stack>
    <Stack gap={8}><FieldLabel>Colour</FieldLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {PALETTE.map((c) => <Pressable key={c} accessibilityRole="radio" accessibilityState={{ checked: color === c }} accessibilityLabel={PALETTE_NAMES[c] ?? 'Colour'} onPress={() => setColor(c)}
          style={{ width: 40, height: 40, borderRadius: radii.round, backgroundColor: c, borderWidth: color === c ? 3 : 1, borderColor: color === c ? colors.ember : colors.rule }} />)}
      </View>
    </Stack>
    <Field label="Weight (grams)" value={grams} onChangeText={setGrams} icon="trips" kind="number" placeholder="e.g. 320" />
    <Field label="Notes" value={notes} onChangeText={setNotes} multiline maxLength={5000} placeholder="Fabric, care, what it goes with" />
  </Sheet>;
}

/* ------------------------------------------------------------------ Stylist */

export function StylistScreen() {
  const current = useCurrentTrip();
  const ws = useTrips();
  const prefs = usePrefs();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const weather = useTripWeather(current?.trip ?? null);
  const [date, setDate] = useState(current ? initialDay(current.trip, params.date) : '');
  const [shuffle, setShuffle] = useState(0);
  if (!current || !ws.workspace) return ws.status === 'loading' ? <Loading /> : <NoTrip />;
  const { trip } = current;
  const w = ws.workspace;
  const dates = tripDates(trip);
  const day = dates.includes(date) ? date : dates[0];
  const outfit = w.outfits.find((o) => o.id === trip.days[day]?.outfitId);
  const pieces = outfit ? outfit.items.map((id) => w.items.find((i) => i.id === id)).filter((i): i is Item => !!i) : [];
  const wx = weather[day];
  const t = (c: number) => prefs.unit === 'imperial' ? `${Math.round(c * 9 / 5 + 32)}°` : `${c}°`;
  const styled = dates.filter((d) => trip.days[d]?.outfitId).length;
  const styleAll = () => {
    const run = () => {
      const plan = styleTrip(w, trip, weather, shuffle);
      if (!plan.some((p) => p.outfit.items.length)) { Alert.alert('Add some clothes first', 'The stylist needs at least a top or a bottom in your wardrobe.'); return; }
      if (ws.edit((draft) => applyStyle(draft, trip.id, plan))) setShuffle((s) => s + 1);
    };
    if (styled) Alert.alert('Restyle every day?', 'Outfits the stylist made before are replaced. Outfits you named yourself stay in your wardrobe.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Restyle', onPress: run }]);
    else run();
  };
  const swap = (piece: Item) => {
    const same = w.items.filter((i) => i.category === piece.category);
    if (same.length < 2 || !outfit) return;
    const next = same[(same.findIndex((i) => i.id === piece.id) + 1) % same.length];
    ws.edit((d) => { const o = d.outfits.find((x) => x.id === outfit.id); if (o) o.items = o.items.map((i) => i === piece.id ? next.id : i); });
  };
  const remove = (piece: Item) => outfit && ws.edit((d) => { const o = d.outfits.find((x) => x.id === outfit.id); if (o) o.items = o.items.filter((i) => i !== piece.id); });
  if (!w.items.length) return <Screen bar="tabs"><Header title="Stylist" /><EmptyState art="suitcase" title="Nothing to style yet" body="Add a few pieces to your wardrobe and the stylist dresses each day for the weather."
    action={<Button label="Add a piece" icon="plus" href="/add-piece" />} /></Screen>;
  return <Screen bar="tabs">
    <Header title="Stylist" right={<RoundButton icon="sparkle" dark label={styled ? 'Restyle every day' : 'Style every day'} onPress={styleAll} />} />
    <DayStrip dates={dates} value={day} onChange={setDate} weather={weather} />
    <Hero>
      <RowView align="flex-start" style={{ justifyContent: 'space-between' }}>
        <View style={{ gap: 4, flex: 1 }}><HeroText faint style={{ fontSize: 14 }}>{longDay(day)}</HeroText><HeroText v="display" style={{ fontSize: 26, lineHeight: 30 }}>Day {dates.indexOf(day) + 1} outfit</HeroText></View>
        {wx ? <RowView gap={8}><Icon name={weatherIcon(wx.code)} size={20} color="#FFFFFF" /><HeroText v="row" style={{ fontSize: 15 }}>{t(wx.high)} / {t(wx.low)}</HeroText></RowView> : null}
      </RowView>
      {pieces.length ? <RowView gap={8} style={{ flexWrap: 'wrap' }}>{pieces.map((p) => <ItemPhoto key={p.id} item={p} size={56} radius={radii.tile} />)}</RowView>
        : <HeroText v="small">No outfit for this day yet.</HeroText>}
      <HeroText v="small">{wx ? `${summary(wx.code)}${wx.rain >= 50 ? `, ${wx.rain}% chance of rain` : ''}${wx.typical ? ' (last year on this date)' : ''}.` : 'The forecast appears 16 days before the trip; until then, last year’s weather guides the layers.'}</HeroText>
    </Hero>
    {!outfit ? <Button label={styled ? 'Style this trip again' : 'Style every day'} icon="sparkle" onPress={styleAll} /> : null}
    {pieces.length ? <Section title="Pieces" action="Change day’s look" onAction={styleAll}>
      <Group>{pieces.map((p) => <Row key={p.id} leading={<ItemPhoto item={p} size={44} radius={radii.iconTile} />} title={p.name} meta={`${CATEGORY_LABEL[p.category]} · tap to swap`}
        onPress={() => swap(p)} trailing={<Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name} from this outfit`} hitSlop={10} onPress={() => remove(p)}><Icon name="x" size={18} color={colors.stone} /></Pressable>} />)}</Group>
    </Section> : null}
    <Note>{styled} of {dates.length} days styled. Packing lists pick these pieces up automatically.</Note>
    <Button label="See the packing list" icon="chev" kind="white" onPress={() => router.push('/trip/packing' as never)} />
  </Screen>;
}

/* ------------------------------------------------------------------ Packing */

const FILTERS = ['All', 'To pack', 'Packed', 'Needed soon'] as const;

export function PackingScreen() {
  const current = useCurrentTrip();
  const ws = useTrips();
  const prefs = usePrefs();
  const router = useRouter();
  const [filter, setFilter] = useState(0);
  if (!current || !ws.workspace) return ws.status === 'loading' ? <Loading /> : <NoTrip />;
  const { trip, editTrip } = current;
  const rows = packing(ws.workspace, trip);
  const total = rows.length, done = rows.filter((r) => r.packed).length;
  const grams = rows.filter((r) => r.packed).reduce((s, r) => s + r.weight * r.quantity, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const soon = new Set(tripDates(trip).slice(0, 2));
  const visible = rows.filter((r) => [true, !r.packed, r.packed, r.dates.some((d) => soon.has(d)) || (!r.automatic && (r.category === 'Documents' || r.category === 'Essentials'))][filter]);
  const groups = [...new Set(visible.map((r) => r.category))];
  const toggle = (row: PackRow) => editTrip((t) => {
    if (row.automatic) t.packed = row.packed ? t.packed.filter((id) => id !== row.id) : [...t.packed, row.id];
    else { const e = t.extras.find((x) => x.id === row.id); if (e) e.packed = !e.packed; }
  });
  const limit = (trip.weightLimit || 0) * 1000;
  return <Screen bar="tabs">
    <Header title="Packing" right={<RoundButton icon="plus" dark label="Add an item" href="/add-item" />} />
    <Hero padding={18}>
      <RowView gap={16}>
        <Ring pct={pct}><HeroText v="row" style={{ fontFamily: fonts.bold, fontSize: 15 }}>{pct}%</HeroText></Ring>
        <View style={{ flex: 1, gap: 6 }}>
          <HeroText v="title" style={{ fontSize: 24, lineHeight: 28, letterSpacing: -0.4 }}>{done} of {total} packed</HeroText>
          <HeroText v="small" style={{ fontSize: 14 }}>{weight(grams, prefs.unit)}{limit ? ` of ${weight(limit, prefs.unit)}` : ''} · {total - done === 0 ? (total ? 'all packed' : 'nothing on the list') : `${total - done} to go`}</HeroText>
          <Progress pct={limit ? Math.min(100, (grams / limit) * 100) : pct} color={limit && grams > limit ? '#FFE0D6' : '#FFFFFF'} track="rgba(255,255,255,0.35)" />
        </View>
      </RowView>
    </Hero>
    {limit && grams > limit ? <Note>Over the bag limit by {weight(grams - limit, prefs.unit)}.</Note> : null}
    <Button label="Suggest items for this trip" icon="sparkle" kind="white" height={48} href="/pack-suggest" />
    <Chips value={filter} onChange={setFilter} items={FILTERS.map((f, i) => ({ label: i === 0 ? `${f} · ${total}` : i === 1 ? `${f} · ${total - done}` : i === 2 ? `${f} · ${done}` : f }))} />
    {groups.map((group) => <Section key={group} title={group}>
      <Stack>{visible.filter((r) => r.category === group).map((r) => r.automatic
        ? <SwatchRow key={r.id} color={r.color || '#8b8b73'} eyebrow={r.packed ? 'Packed' : `For ${r.dates.slice(0, 3).map((d) => weekday(d)).join(', ')}${r.dates.length > 3 ? '…' : ''}`} tint={r.packed ? 'mint' : 'grey'}
          title={r.name} meta={r.weight ? weight(r.weight, prefs.unit) : 'From your outfits'} trailing={<CheckToggle label={`${r.name} packed`} checked={r.packed} onChange={() => toggle(r)} />} />
        : <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Edit ${r.name}`} onPress={() => router.push({ pathname: '/add-item', params: { id: r.id } } as never)}>
          <Card padding={14}><RowView gap={14}>
            <IconTile icon={r.category === 'Documents' ? 'doc' : r.category === 'Electronics' ? 'plug' : r.category === 'Toiletries' || r.category === 'Health & care' ? 'heart' : 'trips'} tint={r.packed ? 'mint' : undefined} />
            <View style={{ flex: 1, gap: 2 }}><T v="row" style={{ fontSize: 15 }}>{r.quantity > 1 ? `${r.quantity} × ` : ''}{r.name}</T><T v="meta">{r.packed ? 'Packed' : 'To pack'}{r.weight ? ` · ${weight(r.weight * r.quantity, prefs.unit)}` : ''}</T></View>
            <CheckToggle label={`${r.name} packed`} checked={r.packed} onChange={() => toggle(r)} />
          </RowView></Card>
        </Pressable>)}</Stack>
    </Section>)}
    {!rows.length ? <EmptyState art="suitcase" title="Nothing to pack yet" body="Style your days and the clothes appear here. Add essentials like chargers and passports yourself."
      action={<Stack gap={10}><Button label="Suggest items" icon="sparkle" href="/pack-suggest" /><Button label="Add an item" icon="plus" kind="white" href="/add-item" /></Stack>} />
      : !visible.length ? <Card><T v="small">{filter === 1 ? 'Everything is packed. Have a good trip.' : filter === 2 ? 'Nothing packed yet.' : 'Nothing needed in the first two days.'}</T></Card> : null}
  </Screen>;
}

const QUICK_ADD = ['Passport', 'Phone charger', 'Toothbrush', 'Adapter', 'Sunscreen', 'Medication', 'Headphones', 'Wallet'];

export function AddItemSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const existing = current?.trip.extras.find((e) => e.id === params.id);
  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState<Extra['category']>(existing?.category ?? 'Essentials');
  const [quantity, setQuantity] = useState(String(existing?.quantity ?? 1));
  const [grams, setGrams] = useState(existing?.weight ? String(existing.weight) : '');
  const [error, setError] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  if (!current) return <Sheet title="Add an item"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const save = (preset?: string) => {
    const n = (preset ?? name).trim();
    if (!n) { setError('Name the item.'); return; }
    const q = Math.min(999, Math.max(1, Math.round(Number(quantity) || 1)));
    const g = Math.min(50000, Math.max(0, Math.round(Number(grams.replace(',', '.')) || 0)));
    const cat: Extra['category'] = preset ? (/passport/i.test(preset) ? 'Documents' : /charger|adapter|headphones/i.test(preset) ? 'Electronics' : /toothbrush|sunscreen/i.test(preset) ? 'Toiletries' : /medication/i.test(preset) ? 'Health & care' : 'Essentials') : category;
    const ok = current.editTrip((t) => {
      const value: Extra = { id: existing?.id ?? uid(), name: n.slice(0, 200), quantity: preset ? 1 : q, weight: preset ? 0 : g, packed: existing?.packed ?? false, category: cat };
      const i = t.extras.findIndex((e) => e.id === value.id);
      if (i >= 0) t.extras[i] = value; else t.extras.push(value);
    });
    if (ok && !preset) router.back();
    if (ok && preset) { setName(''); setAdded((list) => [...list, preset]); }
  };
  const remove = () => current.editTrip((t) => { t.extras = t.extras.filter((e) => e.id !== existing!.id); }) && router.back();
  const already = new Set(current.trip.extras.map((e) => e.name.toLowerCase()));
  return <Sheet title={existing ? 'Edit item' : 'Add an item'} footer={<Stack gap={10}>
    <Button label="Save" icon="check" onPress={() => save()} />
    {existing ? <Button label="Remove from list" icon="trash" kind="white" onPress={remove} /> : null}
  </Stack>}>
    <Field label="Item" value={name} onChangeText={(t) => { setName(t); setError(''); }} icon="trips" placeholder="Phone charger" maxLength={200} error={error} autoFocus={!existing} />
    {!existing ? <Stack gap={8}><FieldLabel>Quick add</FieldLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{QUICK_ADD.filter((q) => !already.has(q.toLowerCase())).map((q) => <Pressable key={q} accessibilityRole="button" accessibilityLabel={`Add ${q}`} onPress={() => save(q)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.button, backgroundColor: colors.card, boxShadow: shadows.button }}>
        <Icon name="plus" size={14} /><T v="small" color={colors.ink} style={{ fontSize: 14 }}>{q}</T></Pressable>)}</View>
      {added.length ? <RowView gap={6}><Icon name="check" size={14} color={tints.mint.fg} /><T v="meta" color={tints.mint.fg} style={{ flex: 1 }}>Added {added.join(', ')}</T></RowView> : null}
    </Stack> : null}
    <Stack gap={8}><FieldLabel>Kind</FieldLabel><Chips value={EXTRA_CATEGORIES.indexOf(category ?? 'Essentials')} onChange={(i) => setCategory(EXTRA_CATEGORIES[i])} items={EXTRA_CATEGORIES.map((c) => ({ label: c }))} /></Stack>
    <RowView align="flex-start">
      <Field flex label="How many" value={quantity} onChangeText={(t) => setQuantity(t.replace(/\D/g, '').slice(0, 3))} kind="number" icon="plus" />
      <Field flex label="Weight each (g)" value={grams} onChangeText={setGrams} kind="number" icon="trips" placeholder="Optional" />
    </RowView>
  </Sheet>;
}

/* ------------------------------------------------------------------ Budget */

export function BudgetScreen() {
  const current = useCurrentTrip();
  const prefs = usePrefs();
  const router = useRouter();
  const { status } = useTrips();
  const rates = useRates(current?.trip.currency ?? 'EUR');
  const [selected, setSelected] = useState<number | null>(null);
  if (!current) return status === 'loading' ? <Loading /> : <NoTrip />;
  const { trip, extras } = current;
  const b = budgetOf(trip, extras, rates, trip.currency);
  const dates = tripDates(trip);
  const day = selected === null ? null : dates[selected];
  const expenses = [...extras.expenses].filter((e) => !day || e.date === day).sort((a, c) => (c.date || '').localeCompare(a.date || '') || c.createdAt.localeCompare(a.createdAt));
  const priced = trip.activities.filter((a) => a.cost > 0 && (!day || a.date === day));
  const home = b.planned > 0 && prefs.currency !== trip.currency && rates?.[prefs.currency] ? `≈ ${money(b.planned * rates[prefs.currency], prefs.currency)}` : '';
  const pct = b.limit ? Math.min(100, (b.planned / b.limit) * 100) : 0;
  return <Screen bar="tabs">
    <Header title="Budget" right={<RoundButton icon="plus" dark label="Add expense" href="/add-expense" />} />
    <Hero>
      <Stack gap={4}>
        <HeroText faint style={{ fontSize: 14 }}>Total planned</HeroText>
        <HeroText v="hero" style={{ lineHeight: 40, letterSpacing: -1 }}>{money(b.planned, trip.currency)}</HeroText>
        <HeroText faint style={{ fontSize: 14 }}>{b.limit ? `of ${money(b.limit, trip.currency)} · ${Math.round((b.planned / b.limit) * 100)}%` : 'No budget set'}{b.spent ? ` · ${money(b.spent, trip.currency)} spent` : ''}</HeroText>
      </Stack>
      {b.limit ? <Progress pct={pct} color={b.remaining < 0 ? '#FFE0D6' : '#FFFFFF'} track="rgba(255,255,255,0.35)" /> : null}
      <RowView style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <HeroText v="small">{home ? `${home} at today’s rate` : b.missingRates ? 'Some currencies couldn’t be converted offline' : ' '}</HeroText>
        {b.limit ? <HeroText v="small" style={{ flexShrink: 1, textAlign: 'right' }}>{b.remaining >= 0 ? `${money(b.perDayLeft, trip.currency)} a day left` : `${money(-b.remaining, trip.currency)} over`}</HeroText> : null}
      </RowView>
    </Hero>
    {!b.limit ? <Button label="Set a budget" icon="card" kind="white" href="/edit-trip" /> : null}
    {b.byDay.some((d) => d.amount > 0) || selected !== null ? <Section title="By day" action={selected === null ? undefined : 'Show all'} onAction={() => setSelected(null)}>
      <Card>
        <Bars values={b.byDay.map((d) => d.amount)} labels={b.byDay.map((d) => dates.length > 7 ? dayOfMonth(d.date) : weekday(d.date))} active={selected ?? undefined} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {dates.length <= 14 ? dates.map((d, i) => <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: selected === i }} accessibilityLabel={`Show ${longDay(d)}`} onPress={() => setSelected(selected === i ? null : i)}
            style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: radii.chip, backgroundColor: selected === i ? colors.inkButton : colors.mist }}>
            <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.semibold, fontSize: 11, color: selected === i ? '#FFFFFF' : colors.ink }}>{shortDay(d)}</Text></Pressable>) : null}
        </View>
        {dates.length <= 14 ? <T v="meta">Tap a day to see only its costs.</T> : null}
      </Card>
    </Section> : null}
    {(() => {
      // Where the money went, in the trip currency (Splitwise Pro-style breakdown).
      const totals = EXPENSE_CATEGORIES.map((c) => ({ c, amount: extras.expenses.filter((e) => e.category === c).reduce((s, e) => s + convert(e.amount, e.currency, trip.currency, rates, trip.currency), 0) }))
        .filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
      const all = totals.reduce((s, x) => s + x.amount, 0);
      return totals.length > 1 && selected === null ? <Section title="By category">
        <Card>{totals.map((x) => <Stack key={x.c} gap={6}>
          <RowView style={{ justifyContent: 'space-between' }}><RowView gap={8}><Icon name={EXPENSE_ICON[x.c]} size={16} color={tints[EXPENSE_TINT[x.c]].fg} /><T v="row" style={{ fontSize: 14 }}>{EXPENSE_LABEL[x.c]}</T></RowView>
            <T v="small">{money(x.amount, trip.currency)} · {Math.round((x.amount / all) * 100)}%</T></RowView>
          <Progress pct={(x.amount / all) * 100} color={tints[EXPENSE_TINT[x.c]].fg} />
        </Stack>)}</Card>
      </Section> : null;
    })()}
    <Section title={day ? longDay(day) : 'Expenses'}>
      {expenses.length ? <Group>{expenses.map((e) => <Row key={e.id} icon={EXPENSE_ICON[e.category]} tint={EXPENSE_TINT[e.category]} title={e.title}
        meta={[EXPENSE_LABEL[e.category], e.date ? shortDay(e.date) : '', extras.people.length ? `${nameOf(extras.people, e.paidBy)} paid${e.splitWith.length > 1 ? ` · split ${e.splitWith.length} ways` : ''}` : ''].filter(Boolean).join(' · ')}
        onPress={() => router.push({ pathname: '/add-expense', params: { id: e.id } } as never)}
        trailing={<View style={{ alignItems: 'flex-end' }}><T v="row" style={{ fontSize: 15 }}>{money(e.amount, e.currency)}</T>{e.currency !== trip.currency ? <T v="meta">{convertLabel(e.amount, e.currency, trip.currency, rates)}</T> : null}</View>} />)}</Group>
        : <Card><T v="small">{day ? 'No expenses on this day.' : 'Log what you spend as you go. Split costs with the people on the trip.'}</T></Card>}
    </Section>
    {priced.length ? <Section title="Plans with a price">
      <Group>{priced.map((a) => <Row key={a.id} icon="calendar" title={a.title} meta={`${shortDay(a.date)}${a.time ? ` · ${a.time}` : ''}`} onPress={() => router.push({ pathname: '/add-plan', params: { id: a.id } } as never)}
        trailing={<T v="row" style={{ fontSize: 15 }}>{money(a.cost, trip.currency)}</T>} />)}</Group>
    </Section> : null}
  </Screen>;
}

export function AddExpenseSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const existing = current?.extras.expenses.find((e) => e.id === params.id);
  const everyone = current ? [ME, ...current.extras.people.map((p) => p.id)] : [ME];
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [currency, setCurrency] = useState(existing?.currency ?? current?.trip.currency ?? 'EUR');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<ExpenseCategory>(existing?.category ?? 'food');
  // Until the person picks a kind, guess it from what they type ("Taxi" → Move, "Hotel" → Stay).
  const [picked, setPicked] = useState(!!existing);
  const guess = (t: string): ExpenseCategory | null => {
    const s = t.toLowerCase();
    if (/\b(taxi|uber|bolt|lyft|cab|train|metro|subway|bus|tram|ferry|flight|fuel|petrol|gas|parking|toll|car hire|rental|scooter|bike)\b/.test(s)) return 'move';
    if (/\b(hotel|hostel|airbnb|apartment|room|stay|ryokan|guesthouse|lodge|camping)\b/.test(s)) return 'stay';
    if (/\b(dinner|lunch|breakfast|brunch|cafe|café|coffee|restaurant|bar|drinks|tapas|food|groceries|snack|wine|beer)\b/.test(s)) return 'food';
    if (/\b(museum|ticket|tour|entry|gallery|park|show|concert|tickets|admission|excursion|class)\b/.test(s)) return 'sight';
    if (/\b(shop|shopping|souvenir|gift|clothes|market)\b/.test(s)) return 'shopping';
    return null;
  };
  const [date, setDate] = useState(existing?.date || (current ? initialDay(current.trip) : todayISO()));
  const [paidBy, setPaidBy] = useState(existing?.paidBy ?? ME);
  const [split, setSplit] = useState<string[]>(existing?.splitWith.length ? existing.splitWith : everyone.length > 1 ? everyone : []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scanning, setScanning] = useState(false);
  const rates = useRates(current?.trip.currency ?? 'EUR');
  // Read a receipt photo on the device and fill in what it finds.
  const scan = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true };
    if (!perm.granted) { Alert.alert('Camera access is off', 'Allow camera access for Trips Loom in Settings, or choose a photo instead.'); return; }
    const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, exif: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
    if (result.canceled || !result.assets[0]) return;
    setScanning(true);
    try {
      const r = await scanReceipt(result.assets[0].uri);
      if (r.amount === null && !r.merchant) { Alert.alert('Couldn’t read that receipt', 'Try a flatter, brighter photo, or enter it by hand.'); return; }
      if (r.amount !== null) setAmount(Number.isInteger(r.amount) ? String(r.amount) : r.amount.toFixed(2));
      if (r.currency && (CURRENCIES as readonly string[]).includes(r.currency)) setCurrency(r.currency);
      if (r.merchant && !title.trim()) { setTitle(r.merchant); if (!picked) { const g = guess(r.merchant); if (g) setCategory(g); } }
      if (r.date && current && r.date >= current.trip.start && r.date <= current.trip.end) setDate(r.date);
      setErrors({});
    } catch (e) {
      reportError(e, 'Couldn’t read that receipt');
    } finally {
      setScanning(false);
    }
  };
  if (!current) return <Sheet title="Add expense"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const { extras, editExtras, trip } = current;
  const value = Number(amount.replace(',', '.'));
  const mode = split.length <= 1 ? 'Just the payer' : split.length === everyone.length ? 'Everyone' : 'Some people';
  const save = () => {
    const e: Record<string, string> = {};
    if (!(value > 0) || value > 1e9) e.amount = 'Enter how much it cost.';
    if (!title.trim()) e.title = 'What was it for?';
    setErrors(e);
    if (Object.keys(e).length) return;
    const item: Expense = { id: existing?.id ?? uid(), title: title.trim().slice(0, 200), amount: Math.round(value * 100) / 100, currency, category, date, paidBy, splitWith: split.length > 1 ? split : [], createdAt: existing?.createdAt ?? new Date().toISOString() };
    editExtras((d) => { const i = d.expenses.findIndex((x) => x.id === item.id); if (i >= 0) d.expenses[i] = item; else d.expenses.push(item); });
    router.back();
  };
  const remove = () => Alert.alert('Delete this expense?', existing?.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {
    editExtras((d) => { d.expenses = d.expenses.filter((x) => x.id !== existing!.id); }); router.back();
  } }]);
  const name = (id: string) => nameOf(extras.people, id, 'You');
  return <Sheet title={existing ? 'Edit expense' : 'Add expense'} footer={<Stack gap={10}>
    <Button label={existing ? 'Save' : 'Add expense'} icon={existing ? 'check' : 'plus'} onPress={save} />
    {existing ? <Button label="Delete expense" icon="trash" kind="white" onPress={remove} /> : null}
  </Stack>}>
    {canScanReceipts && !existing ? <RowView gap={10}>
      <View style={{ flex: 1 }}><Button label={scanning ? 'Reading…' : 'Scan receipt'} icon="camera" kind="white" height={48} onPress={scanning ? undefined : () => void scan(true)} /></View>
      <View style={{ flex: 1 }}><Button label="From photos" icon="image" kind="white" height={48} onPress={scanning ? undefined : () => void scan(false)} /></View>
    </RowView> : null}
    <RowView align="flex-start">
      <Field flex label="Amount" value={amount} onChangeText={(t) => { setAmount(t); setErrors({ ...errors, amount: '' }); }} kind="number" icon="card" placeholder="0" error={errors.amount} autoFocus={!existing} />
      <CurrencyField flex value={currency} onChange={setCurrency} />
    </RowView>
    {value > 0 && currency !== trip.currency ? <Note>{convertLabel(value, currency, trip.currency, rates)} in the trip’s currency</Note> : null}
    <Field label="What" value={title} onChangeText={(t) => { setTitle(t); setErrors({ ...errors, title: '' }); if (!picked) { const g = guess(t); if (g) setCategory(g); } }} icon="edit" placeholder="Dinner with friends" maxLength={200} error={errors.title} />
    <Stack gap={8}><FieldLabel>Kind</FieldLabel><Chips value={EXPENSE_CATEGORIES.indexOf(category)} onChange={(i) => { setPicked(true); setCategory(EXPENSE_CATEGORIES[i]); }} items={EXPENSE_CATEGORIES.map((c) => ({ label: EXPENSE_LABEL[c], icon: EXPENSE_ICON[c] }))} /></Stack>
    <DateField label="Day" value={date} onChange={setDate} />
    {extras.people.length ? <>
      <Stack gap={8}><FieldLabel>Paid by</FieldLabel>
        <Group>{everyone.map((id) => <Row key={id} leading={<Avatar initials={initials(name(id))} tint={tintFor(id)} size={36} />} title={name(id)} trailing={<Radio on={paidBy === id} />} onPress={() => setPaidBy(id)} />)}</Group>
      </Stack>
      <Stack gap={8}><FieldLabel>{`Split · ${mode}`}</FieldLabel>
        <Segmented options={['Just the payer', 'Everyone']} value={split.length === everyone.length ? 'Everyone' : 'Just the payer'} onChange={(v) => setSplit(v === 'Everyone' ? everyone : [])} />
        <Group>{everyone.map((id) => <Row key={id} leading={<Avatar initials={initials(name(id))} tint={tintFor(id)} size={36} />} title={name(id)}
          meta={split.includes(id) && value > 0 ? money(value / split.length, currency) : 'Not sharing'} trailing={<Checkbox checked={split.includes(id)} />}
          onPress={() => setSplit(split.includes(id) ? split.filter((x) => x !== id) : [...split, id])} />)}</Group>
      </Stack>
    </> : <Note>Add the people on this trip to split costs with them.</Note>}
  </Sheet>;
}

/* ------------------------------------------------------------------ Documents */

const DOC_LABEL: Record<DocumentKind, string> = { flight: 'Flight', stay: 'Stay', ticket: 'Ticket', insurance: 'Insurance', passport: 'Passport', visa: 'Visa', other: 'Other' };
const DOC_ICON: Record<DocumentKind, IconName> = { flight: 'plane', stay: 'bed', ticket: 'ticket', insurance: 'shield', passport: 'doc', visa: 'doc', other: 'file' };
const DOC_TINT: Record<DocumentKind, 'lavender' | 'peach' | 'mint' | 'rose' | 'grey'> = { flight: 'lavender', stay: 'peach', ticket: 'mint', insurance: 'rose', passport: 'grey', visa: 'grey', other: 'grey' };

const docsDir = () => { const d = new Directory(Paths.document, 'documents'); if (!d.exists) d.create({ intermediates: true }); return d; };
const docFile = (path: string) => new File(docsDir(), path.replace(/[^\w.-]/g, ''));

export function DocumentsScreen() {
  const current = useCurrentTrip();
  const prefs = usePrefs();
  const router = useRouter();
  const pro = usePro();
  const { status } = useTrips();
  const [unlocked, setUnlocked] = useState(!prefs.native.lockDocuments);
  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Open documents' });
    if (result.success) setUnlocked(true);
  }, []);
  useFocusEffect(useCallback(() => {
    if (prefs.native.lockDocuments) { setUnlocked(false); void unlock(); }
    return () => { if (prefs.native.lockDocuments) setUnlocked(false); };
  }, [prefs.native.lockDocuments, unlock]));
  if (!current) return status === 'loading' ? <Loading /> : <NoTrip />;
  const { extras, editExtras } = current;
  const add = () => {
    if (!pro.isPro && extras.documents.length >= FREE_DOCUMENTS_PER_TRIP) {
      Alert.alert('Documents are full on this trip', `Free accounts keep ${FREE_DOCUMENTS_PER_TRIP} documents per trip. Pro keeps as many as you need.`, [
        { text: 'Not now', style: 'cancel' }, { text: 'See Pro', onPress: () => router.push('/paywall' as never) },
      ]);
      return;
    }
    router.push('/add-document' as never);
  };
  const open = async (path: string, mime: string) => {
    const file = docFile(path);
    if (!file.exists) { Alert.alert('File not on this phone', 'Documents added on another device keep their details, but the file stays on that device.'); return; }
    try { await Sharing.shareAsync(file.uri, { mimeType: mime || undefined, dialogTitle: 'Document' }); } catch (e) { reportError(e, 'Couldn’t open'); }
  };
  if (!unlocked) return <Screen bar="tabs"><Header title="Documents" />
    <EmptyState art="passport" title="Documents are locked" body="Unlock to see tickets, bookings and passports." action={<Button label="Unlock" icon="lock" onPress={() => void unlock()} />} /></Screen>;
  const travel = extras.documents.filter((d) => ['flight', 'stay', 'ticket'].includes(d.kind));
  const other = extras.documents.filter((d) => !['flight', 'stay', 'ticket'].includes(d.kind));
  const row = (d: typeof extras.documents[number]) => <Row key={d.id} icon={DOC_ICON[d.kind]} tint={DOC_TINT[d.kind]} title={d.title}
    meta={[DOC_LABEL[d.kind], d.date ? shortDay(d.date) : '', d.detail, d.file ? 'File on this phone' : ''].filter(Boolean).join(' · ')}
    onPress={() => d.file ? void open(d.file.path, d.file.mime) : router.push({ pathname: '/add-document', params: { id: d.id } } as never)}
    trailing={<Pressable accessibilityRole="button" accessibilityLabel={`Edit ${d.title}`} hitSlop={10} onPress={() => router.push({ pathname: '/add-document', params: { id: d.id } } as never)}><Icon name="more" size={18} color={colors.stone} /></Pressable>} />;
  return <Screen bar="tabs">
    <Header title="Documents" right={<RoundButton icon="plus" dark label="Add document" onPress={add} />} />
    {prefs.native.lockDocuments ? <Card><RowView gap={14}><IconTile icon="lock" tint="mint" /><View style={{ flex: 1, gap: 2 }}><T v="row" style={{ fontSize: 15 }}>Unlocked</T><T v="meta">Locks again when you leave this screen</T></View></RowView></Card> : null}
    {travel.length ? <Section title="Travel"><Group>{travel.map(row)}</Group></Section> : null}
    {other.length ? <Section title="Other"><Group>{other.map(row)}</Group></Section> : null}
    {!extras.documents.length ? <EmptyState art="passport" title="No documents yet" body="Keep tickets, bookings, insurance and a passport copy with the trip. Files stay on this phone."
      action={<Stack gap={10}><Button label="Add a document" icon="plus" onPress={add} /><Button label="Import from an email" icon="mail" kind="white" href="/import-bookings" /></Stack>} /> : null}
    {!pro.isPro && extras.documents.length ? <Note>{extras.documents.length} of {FREE_DOCUMENTS_PER_TRIP} free documents on this trip.</Note> : null}
  </Screen>;
}

export function AddDocumentSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const existing = current?.extras.documents.find((d) => d.id === params.id);
  const [kind, setKind] = useState<DocumentKind>(existing?.kind ?? 'flight');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [detail, setDetail] = useState(existing?.detail ?? '');
  const [date, setDate] = useState(existing?.date ?? '');
  const [file, setFile] = useState(existing?.file);
  const [error, setError] = useState('');
  if (!current) return <Sheet title="Add document"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const id = existing?.id ?? uid();
  const attach = async (source: 'files' | 'photos') => {
    try {
      let uri = '', name = '', mime = '';
      if (source === 'files') {
        const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
        if (result.canceled || !result.assets[0]) return;
        ({ uri, name, mimeType: mime = '' } = result.assets[0] as { uri: string; name: string; mimeType?: string });
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
        if (result.canceled || !result.assets[0]) return;
        uri = result.assets[0].uri; name = result.assets[0].fileName ?? 'photo.jpg'; mime = result.assets[0].mimeType ?? 'image/jpeg';
      }
      const ext = (name.split('.').pop() || (mime.includes('pdf') ? 'pdf' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
      const target = docFile(`${id}.${ext}`);
      if (target.exists) target.delete();
      new File(uri).copy(target);
      setFile({ name: name.slice(0, 200), path: `${id}.${ext}`, mime });
      if (!title.trim()) setTitle(name.replace(/\.[^.]+$/, '').slice(0, 200));
    } catch (e) { reportError(e, 'Couldn’t attach the file'); }
  };
  const save = () => {
    if (!title.trim()) { setError('Name the document.'); return; }
    current.editExtras((d) => {
      const value = { id, kind, title: title.trim().slice(0, 200), detail: detail.trim().slice(0, 500), date, file, createdAt: existing?.createdAt ?? new Date().toISOString() };
      const i = d.documents.findIndex((x) => x.id === id);
      if (i >= 0) d.documents[i] = value; else d.documents.push(value);
    });
    router.back();
  };
  const remove = () => Alert.alert('Delete this document?', existing?.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {
    if (existing?.file) { try { const f = docFile(existing.file.path); if (f.exists) f.delete(); } catch { /* Already gone. */ } }
    current.editExtras((d) => { d.documents = d.documents.filter((x) => x.id !== existing!.id); });
    router.back();
  } }]);
  return <Sheet title={existing ? 'Edit document' : 'Add document'} footer={<Stack gap={10}>
    <Button label="Save" icon="check" onPress={save} />
    {existing ? <Button label="Delete document" icon="trash" kind="white" onPress={remove} /> : null}
  </Stack>}>
    <Stack gap={8}><FieldLabel>Kind</FieldLabel><Chips value={DOCUMENT_KINDS.indexOf(kind)} onChange={(i) => setKind(DOCUMENT_KINDS[i])} items={DOCUMENT_KINDS.map((k) => ({ label: DOC_LABEL[k], icon: DOC_ICON[k] }))} /></Stack>
    <Field label="Name" value={title} onChangeText={(t) => { setTitle(t); setError(''); }} icon="edit" placeholder={kind === 'flight' ? 'TP 1234 · LIS → KIX' : kind === 'stay' ? 'Ryokan Yoshida' : 'Travel insurance'} maxLength={200} error={error} />
    <Field label="Details" value={detail} onChangeText={setDetail} icon="file" placeholder="Seat 14A · booking ref ABC123" maxLength={500} />
    {date ? <DateField label="Date" value={date} onChange={setDate} /> : <Button label="Add a date" icon="calendar" kind="mist" height={48} onPress={() => setDate(current.trip.start)} />}
    <Stack gap={8}><FieldLabel>File</FieldLabel>
      {file ? <Card padding={14}><RowView gap={12}><IconTile icon={file.mime.includes('pdf') ? 'file' : 'image'} /><View style={{ flex: 1 }}><T v="row" lines={1} style={{ fontSize: 15 }}>{file.name}</T><T v="meta">Saved on this phone only</T></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Remove file" hitSlop={10} onPress={() => setFile(undefined)}><Icon name="x" size={18} color={colors.stone} /></Pressable></RowView></Card>
        : <RowView><Button label="Choose file" icon="file" kind="white" height={48} style={{ flex: 1 }} onPress={() => void attach('files')} /><Button label="Photo" icon="image" kind="white" height={48} style={{ flex: 1 }} onPress={() => void attach('photos')} /></RowView>}
    </Stack>
  </Sheet>;
}

/* ------------------------------------------------------------------ Tides & dives */

function TideChart({ day }: { day: TideDay }) {
  const heights = day.points.map((p) => p.height);
  const min = Math.min(...heights), max = Math.max(...heights);
  const y = (h: number) => 100 - ((h - min) / Math.max(max - min, 0.01)) * 80;
  const x = (i: number) => (i / Math.max(day.points.length - 1, 1)) * 320;
  const path = day.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.height).toFixed(1)}`).join(' ');
  const now = new Date();
  const nowIndex = now.getHours() + now.getMinutes() / 60;
  return <Svg width="100%" height={120} viewBox="0 0 320 120" preserveAspectRatio="none">
    <Path d={`${path} L320 120 L0 120 Z`} fill={tints.mint.bg} opacity={0.7} />
    <Path d={path} fill="none" stroke={tints.mint.fg} strokeWidth={3} />
    {nowIndex < day.points.length ? <>
      <Line x1={x(nowIndex)} y1={0} x2={x(nowIndex)} y2={120} stroke={colors.ember} strokeWidth={2} strokeDasharray="4 4" />
      <Circle cx={x(nowIndex)} cy={y(day.points[Math.floor(nowIndex)]?.height ?? min)} r={6} fill={colors.ember} />
    </> : null}
  </Svg>;
}

export function TidesScreen() {
  const current = useCurrentTrip();
  const router = useRouter();
  const { status } = useTrips();
  const [date, setDate] = useState(current ? initialDay(current.trip) : '');
  const [tide, setTide] = useState<TideDay | null | 'loading'>('loading');
  useEffect(() => {
    if (!current || !date) return;
    let active = true;
    setTide('loading');
    void tides(current.trip.destination, date).then((t) => { if (active) setTide(t); });
    return () => { active = false; };
  }, [current?.trip.destination, date]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!current) return status === 'loading' ? <Loading /> : <NoTrip />;
  const { trip, extras } = current;
  const dates = tripDates(trip);
  const dives = extras.dives.filter((d) => d.date === date);
  return <Screen bar="tabs">
    <Header title="Tides & dives" right={<RoundButton icon="plus" dark label="Log a dive" onPress={() => router.push({ pathname: '/log-dive', params: { date } } as never)} />} />
    <DayStrip dates={dates} value={date} onChange={setDate} />
    <View style={{ backgroundColor: colors.card, borderRadius: radii.hero, overflow: 'hidden', boxShadow: shadows.lift }}>
      <RowView style={{ justifyContent: 'space-between', padding: 18, paddingBottom: 6 }}>
        <View style={{ gap: 2, flex: 1 }}><T v="row" style={{ fontSize: 15 }}>Tide · {trip.destination.split(',')[0]}</T>
          <T v="meta">{tide && tide !== 'loading' && !tide.inland ? [tide.highs.length ? `high ${tide.highs.map((h) => h.time).join(', ')}` : '', tide.lows.length ? `low ${tide.lows.map((l) => l.time).join(', ')}` : ''].filter(Boolean).join(' · ') : longDay(date)}</T></View>
        {tide === 'loading' ? <ActivityIndicator color={colors.ember} /> : null}
      </RowView>
      {tide && tide !== 'loading' && !tide.inland ? <TideChart day={tide} /> : <View style={{ padding: 18, paddingTop: 6 }}>
        <T v="small">{tide === 'loading' ? 'Loading the tide model…' : tide?.inland ? 'No sea at this destination in the tide model. Set the trip’s destination to the coast you’re diving.' : 'Tides load when you’re online, up to a few days ahead.'}</T>
      </View>}
    </View>
    <Section title={`${weekday(date)} · dives`}>
      {dives.length ? <Group>{dives.map((d) => <Row key={d.id} icon="drop" tint="mint" title={d.site} meta={[`${d.minutes} min`, d.temperature ? `${d.temperature}°` : ''].filter(Boolean).join(' · ')}
        onPress={() => router.push({ pathname: '/log-dive', params: { id: d.id } } as never)} trailing={<T v="row" style={{ fontSize: 15 }}>{d.depth} m</T>} />)}</Group>
        : <Card><T v="small">No dives logged for this day.</T></Card>}
    </Section>
    {extras.dives.length ? <Note>{plural(extras.dives.length, 'dive')} logged · deepest {Math.max(...extras.dives.map((d) => d.depth))} m · {Math.round(extras.dives.reduce((s, d) => s + d.minutes, 0))} min underwater</Note> : null}
  </Screen>;
}

export function LogDiveSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const existing = current?.extras.dives.find((d) => d.id === params.id);
  const [site, setSite] = useState(existing?.site ?? '');
  const [date, setDate] = useState(existing?.date ?? (current ? initialDay(current.trip, params.date) : ''));
  const [depth, setDepth] = useState(existing ? String(existing.depth) : '');
  const [minutes, setMinutes] = useState(existing ? String(existing.minutes) : '');
  const [temperature, setTemperature] = useState(existing?.temperature ? String(existing.temperature) : '');
  const [error, setError] = useState('');
  if (!current) return <Sheet title="Log a dive"><EmptyState title="No trip" body="Open a trip first." /></Sheet>;
  const save = () => {
    if (!site.trim()) { setError('Name the dive site.'); return; }
    const value = { id: existing?.id ?? uid(), site: site.trim().slice(0, 200), date, depth: Math.min(330, Math.max(0, Number(depth.replace(',', '.')) || 0)), minutes: Math.min(600, Math.max(0, Number(minutes) || 0)), temperature: Math.min(40, Math.max(-2, Number(temperature.replace(',', '.')) || 0)) };
    current.editExtras((d) => { const i = d.dives.findIndex((x) => x.id === value.id); if (i >= 0) d.dives[i] = value; else d.dives.push(value); });
    router.back();
  };
  const remove = () => { current.editExtras((d) => { d.dives = d.dives.filter((x) => x.id !== existing!.id); }); router.back(); };
  return <Sheet title={existing ? 'Edit dive' : 'Log a dive'} footer={<Stack gap={10}><Button label="Save" icon="check" onPress={save} />{existing ? <Button label="Delete dive" icon="trash" kind="white" onPress={remove} /> : null}</Stack>}>
    <Field label="Site" value={site} onChangeText={(t) => { setSite(t); setError(''); }} icon="pin" placeholder="Blue Hole · The Bells" maxLength={200} error={error} autoFocus={!existing} />
    <DateField label="Day" value={date} onChange={setDate} min={current.trip.start} max={current.trip.end} />
    <RowView align="flex-start">
      <Field flex label="Max depth (m)" value={depth} onChangeText={setDepth} kind="number" icon="drop" />
      <Field flex label="Bottom time (min)" value={minutes} onChangeText={(t) => setMinutes(t.replace(/\D/g, ''))} kind="number" icon="clock" />
    </RowView>
    <Field label="Water temperature (°C)" value={temperature} onChangeText={setTemperature} kind="number" icon="thermo" placeholder="Optional" />
  </Sheet>;
}

