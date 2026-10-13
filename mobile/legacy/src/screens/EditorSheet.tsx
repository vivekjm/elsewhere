import React, { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkspace } from '../data';
import { ACTIVITY_TYPES, CLOTHING_CATEGORIES, CURRENCIES, EXTRA_CATEGORIES, TRIP_MOODS, addDays, blankDay, defaultShape, dayOutfits, tripDates, uid, type Activity, type Day, type Extra, type Item, type Outfit, type Trip } from '../types';
import { Icon, PressableScale, useTheme, fonts } from '../design';
import { ActionRow, categoryIcons, ChoiceChips, CoverTiles, FormSection, MenuRow, PickChips, PickerRow, TextRow, ValueRow } from './form';
import { type EditTarget, formatDate, landscapeImage, validDate, type WorkspaceScreenProps } from './shared';

type Props = Pick<WorkspaceScreenProps, 'workspace' | 'trip' | 'change'> & { target: EditTarget | null; onClose: () => void; onSavedTrip?: (id: string) => void };
const numeric = (value: string, fallback = 0) => value.trim() === '' ? fallback : Number(value);
const labelOf = (kind: EditTarget['kind']) => ({ trip: 'trip', activity: 'plan', item: 'wardrobe item', outfit: 'outfit', day: 'day details', extra: 'essential' })[kind];

export function EditorSheet(props: Props) {
  if (!props.target) return null;
  return <EditorForm key={`${props.target.kind}-${props.target.id || 'new'}-${props.target.date || ''}`} {...props} target={props.target} />;
}

function EditorForm({ workspace, trip, change, target, onClose, onSavedTrip }: Props & { target: EditTarget }) {
  const { colors, mode } = useTheme();
  const { uploadWardrobePhoto, photoSource } = useWorkspace();
  const currentTrip = target.kind === 'trip' ? workspace.trips.find(item => item.id === target.id) : trip;
  const currentActivity = trip?.activities.find(item => item.id === target.id);
  const currentItem = workspace.items.find(item => item.id === target.id);
  const currentOutfit = workspace.outfits.find(item => item.id === target.id);
  const currentExtra = trip?.extras.find(item => item.id === target.id);
  const date = target.date || trip?.start || new Date().toISOString().slice(0, 10);
  const currentDay = trip?.days[date];
  const initial = target.kind === 'trip' ? currentTrip : target.kind === 'activity' ? currentActivity : target.kind === 'item' ? currentItem : target.kind === 'outfit' ? currentOutfit : target.kind === 'extra' ? currentExtra : currentDay;
  const [name, setName] = useState(target.kind === 'activity' || target.kind === 'day' ? (initial as Activity | Day | undefined)?.title || String(target.draft?.title || '') : (initial as Trip | Item | Outfit | Extra | undefined)?.name || '');
  const [destination, setDestination] = useState(currentTrip?.destination || '');
  const [start, setStart] = useState(currentTrip?.start || date);
  const [end, setEnd] = useState(currentTrip?.end || addDays(date, 6));
  const [travellers, setTravellers] = useState(String(currentTrip?.travellers || 1));
  const [budget, setBudget] = useState(currentTrip?.budget ? String(currentTrip.budget) : '');
  const [currency, setCurrency] = useState<Trip['currency']>(currentTrip?.currency || 'INR');
  const [weightLimit, setWeightLimit] = useState(String(currentTrip?.weightLimit || 15));
  const [theme, setTheme] = useState<Trip['theme']>(currentTrip?.theme || 'mountains');
  const [notes, setNotes] = useState((initial as { notes?: string } | undefined)?.notes || '');
  const [activityDate, setActivityDate] = useState(currentActivity?.date || date);
  const [time, setTime] = useState(currentActivity?.time || String(target.draft?.time || ''));
  const [endTime, setEndTime] = useState(currentActivity?.endTime || '');
  const [place, setPlace] = useState(currentActivity?.place || '');
  const [category, setCategory] = useState(currentActivity?.category || currentItem?.category || currentExtra?.category || String(target.draft?.category || (target.kind === 'activity' ? 'Explore' : target.kind === 'extra' ? 'Essentials' : 'Tops')));
  const [cost, setCost] = useState(currentActivity?.cost ? String(currentActivity.cost) : '');
  const [link, setLink] = useState(currentActivity?.link || '');
  const [weight, setWeight] = useState(String(currentItem?.weight ?? currentExtra?.weight ?? 0));
  const [color, setColor] = useState(currentItem?.color || '#8b8b73');
  const [occasion, setOccasion] = useState(currentOutfit?.occasion || 'Everyday');
  const [selectedItems, setSelectedItems] = useState<string[]>(currentOutfit?.items || []);
  const [selectedOutfits, setSelectedOutfits] = useState<string[]>(target.kind === 'day' ? dayOutfits(currentDay) : currentActivity?.outfitId ? [currentActivity.outfitId] : []);
  const [selectedGear, setSelectedGear] = useState<string[]>(target.kind === 'day' ? currentDay?.gear || [] : currentActivity?.gear || []);
  const [stay, setStay] = useState(currentDay?.stay || '');
  const [quantity, setQuantity] = useState(String(currentExtra?.quantity || 1));
  const [pendingPhoto, setPendingPhoto] = useState<{ uri: string; mimeType: string } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const hasPhoto = Boolean(pendingPhoto || (currentItem?.image && !removePhoto));
  const toggle = (list: string[], setter: (value: string[]) => void, id: string) => setter(list.includes(id) ? list.filter(item => item !== id) : [...list, id]);
  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: .82 });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPendingPhoto({ uri: asset.uri, mimeType: asset.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType) ? asset.mimeType : 'image/jpeg' });
        setRemovePhoto(false);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not open photos.'); }
  };

  useEffect(() => { setError(''); }, [target.kind]);
  const save = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      if (target.kind === 'trip') {
        if (!name.trim() || !destination.trim()) throw Error('Add a trip name and destination.');
        if (!validDate(start) || !validDate(end)) throw Error('Choose a start and end date.');
        tripDates({ start, end });
        const count = numeric(travellers), amount = numeric(budget), limit = numeric(weightLimit);
        if (!Number.isInteger(count) || count < 1 || count > 100 || amount < 0 || limit < 0) throw Error('Check travellers, budget and luggage target.');
        const id = currentTrip?.id || uid();
        change(draft => {
          const existing = draft.trips.find(item => item.id === id);
          if (existing) {
            const outside = existing.activities.some(item => item.date < start || item.date > end) || Object.entries(existing.days).some(([day, value]) => (day < start || day > end) && Boolean(value.title || value.stay || value.notes || value.outfitId || value.outfitIds?.length || value.gear?.length));
            if (outside) throw Error('Move plans and day details into the new date range before changing these dates.');
            Object.assign(existing, { name: name.trim(), destination: destination.trim(), start, end, travellers: count, budget: amount, currency, weightLimit: limit, theme, notes });
          } else draft.trips.push({ id, name: name.trim(), destination: destination.trim(), start, end, travellers: count, budget: amount, currency, weightLimit: limit, theme, notes, days: {}, activities: [], extras: [], packed: [] });
        });
        onSavedTrip?.(id);
      } else if (target.kind === 'activity') {
        if (!trip || !name.trim()) throw Error('Add a title for this plan.');
        if (!validDate(activityDate) || activityDate < trip.start || activityDate > trip.end) throw Error('Choose a date within this trip.');
        if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('Choose a valid start time.');
        if (endTime && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || !time || endTime <= time)) throw Error('End time must be after the start time.');
        if (link && !/^https?:\/\/[^\s]+$/i.test(link)) throw Error('Use a complete http or https link.');
        const amount = numeric(cost);
        if (!Number.isFinite(amount) || amount < 0) throw Error('Enter a valid cost.');
        const value: Activity = { id: currentActivity?.id || uid(), date: activityDate, time, endTime, title: name.trim(), place, category: category as Activity['category'], cost: amount, link, notes, outfitId: selectedOutfits[0] || '', gear: selectedGear, completed: currentActivity?.completed || false };
        change(draft => { const list = draft.trips.find(item => item.id === trip.id)!.activities; const index = list.findIndex(item => item.id === value.id); if (index < 0) list.push(value); else list[index] = value; });
      } else if (target.kind === 'day') {
        if (!trip) throw Error('Choose a trip first.');
        const value: Day = { ...blankDay(), title: name, stay, notes, outfitId: selectedOutfits[0] || '', outfitIds: selectedOutfits, gear: selectedGear };
        change(draft => { draft.trips.find(item => item.id === trip.id)!.days[date] = value; });
      } else if (target.kind === 'item') {
        if (!name.trim()) throw Error('Name this item.');
        const grams = numeric(weight);
        if (!Number.isFinite(grams) || grams < 0 || grams > 50000) throw Error('Weight must be between 0 and 50,000 grams.');
        if (!/^#[a-f0-9]{6}$/i.test(color)) throw Error('Use a six-digit colour, such as #8b8b73.');
        const uploadedPhoto = pendingPhoto ? await uploadWardrobePhoto(pendingPhoto.uri, pendingPhoto.mimeType) : null;
        const value: Item = { id: currentItem?.id || uid(), name: name.trim(), category: category as Item['category'], weight: grams, image: uploadedPhoto || (removePhoto ? '' : currentItem?.image || ''), color, shape: currentItem?.shape || defaultShape(category), notes };
        change(draft => { const index = draft.items.findIndex(item => item.id === value.id); if (index < 0) draft.items.push(value); else draft.items[index] = value; });
      } else if (target.kind === 'outfit') {
        if (!name.trim()) throw Error('Name this outfit.');
        if (!selectedItems.length) throw Error('Choose at least one wardrobe item.');
        const value: Outfit = { id: currentOutfit?.id || uid(), name: name.trim(), items: selectedItems, occasion, notes };
        change(draft => { const index = draft.outfits.findIndex(item => item.id === value.id); if (index < 0) draft.outfits.push(value); else draft.outfits[index] = value; });
      } else {
        if (!trip || !name.trim()) throw Error('Name this essential.');
        const grams = numeric(weight), count = numeric(quantity);
        if (!Number.isFinite(grams) || grams < 0 || grams > 50000 || !Number.isInteger(count) || count < 1) throw Error('Check weight and quantity.');
        const value: Extra = { id: currentExtra?.id || uid(), name: name.trim(), category: category as Extra['category'], quantity: count, weight: grams, packed: currentExtra?.packed || false };
        change(draft => { const list = draft.trips.find(item => item.id === trip.id)!.extras; const index = list.findIndex(item => item.id === value.id); if (index < 0) list.push(value); else list[index] = value; });
      }
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save. Try again.'); }
    finally { setBusy(false); }
  };
  const remove = () => Alert.alert(`Delete ${labelOf(target.kind)}?`, 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { try { change(draft => { if (target.kind === 'trip') draft.trips = draft.trips.filter(item => item.id !== target.id); if (target.kind === 'activity') { const owner = draft.trips.find(item => item.id === trip?.id); if (owner) owner.activities = owner.activities.filter(item => item.id !== target.id); } if (target.kind === 'extra') { const owner = draft.trips.find(item => item.id === trip?.id); if (owner) owner.extras = owner.extras.filter(item => item.id !== target.id); } if (target.kind === 'item') { draft.items = draft.items.filter(item => item.id !== target.id); draft.outfits.forEach(outfit => outfit.items = outfit.items.filter(id => id !== target.id)); draft.trips.forEach(item => { item.packed = item.packed.filter(id => id !== target.id); item.activities.forEach(activity => activity.gear = activity.gear.filter(id => id !== target.id)); Object.values(item.days).forEach(day => day.gear = day.gear?.filter(id => id !== target.id)); }); } if (target.kind === 'outfit') { draft.outfits = draft.outfits.filter(item => item.id !== target.id); draft.trips.forEach(item => { item.activities.forEach(activity => { if (activity.outfitId === target.id) activity.outfitId = ''; }); Object.values(item.days).forEach(day => { if (day.outfitId === target.id) day.outfitId = ''; day.outfitIds = day.outfitIds?.filter(id => id !== target.id); }); }); } }); onClose(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to delete.'); } } }]);

  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}><View style={{ paddingHorizontal: 12, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8} style={{ minWidth: 72, minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}><Text style={{ color: colors.primary, fontSize: 17, fontFamily: fonts.regular }}>Cancel</Text></Pressable>
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontFamily: fonts.semibold }}>{target.id ? 'Edit' : 'New'} {labelOf(target.kind)}</Text>
      <Pressable onPress={() => void save()} disabled={busy} accessibilityRole="button" accessibilityLabel="Save" hitSlop={8} style={{ minWidth: 72, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 8, opacity: busy ? 0.5 : 1 }}><Text style={{ color: colors.primary, fontSize: 17, fontFamily: fonts.semibold }}>{busy ? 'Saving…' : 'Save'}</Text></Pressable>
    </View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 24, paddingBottom: 60, gap: 28 }}>
    {target.kind === 'trip' ? <>
      <FormSection>
        <TextRow large value={name} onChangeText={setName} placeholder="Trip name" autoFocus={!target.id} />
        <TextRow icon="location" value={destination} onChangeText={setDestination} placeholder="Destination" />
      </FormSection>
      <FormSection title="Dates">
        <PickerRow icon="calendar" label="Starts" mode="date" value={start} onChange={setStart} />
        <PickerRow icon="calendar" label="Ends" mode="date" value={end} onChange={setEnd} min={start} />
      </FormSection>
      <FormSection title="Cover" bare>
        <CoverTiles options={TRIP_MOODS} value={theme || 'mountains'} onChange={value => setTheme(value)} image={value => landscapeImage(value)} />
      </FormSection>
      <FormSection title="Details">
        <ValueRow icon="people" label="Travellers" value={travellers} onChangeText={setTravellers} />
        <ValueRow icon="wallet" label="Budget" value={budget} onChangeText={setBudget} />
        <MenuRow icon="wallet" label="Currency" value={currency} options={CURRENCIES} onChange={setCurrency} />
        <ValueRow icon="weight" label="Luggage target" value={weightLimit} onChangeText={setWeightLimit} suffix="kg" />
      </FormSection>
      <FormSection title="Notes"><TextRow multiline value={notes} onChangeText={setNotes} placeholder="Anything worth remembering" label="Trip notes" /></FormSection>
    </> : null}
    {target.kind === 'activity' ? <>
      <FormSection>
        <TextRow large value={name} onChangeText={setName} placeholder="Plan title" autoFocus={!target.id} />
        <TextRow icon="location" value={place} onChangeText={setPlace} placeholder="Place" />
      </FormSection>
      <FormSection title="When">
        <PickerRow icon="calendar" label="Date" mode="date" value={activityDate} onChange={setActivityDate} min={trip?.start} max={trip?.end} />
        <PickerRow icon="clock" label="Starts" mode="time" value={time} onChange={setTime} optional defaultValue="09:00" />
        {time ? <PickerRow icon="clock" label="Ends" mode="time" value={endTime} onChange={setEndTime} optional defaultValue={`${String(Math.min(23, Number(time.slice(0, 2)) + 1)).padStart(2, '0')}:${time.slice(3, 5)}`} /> : null}
      </FormSection>
      <FormSection title="Type" bare><ChoiceChips label="Plan type" options={ACTIVITY_TYPES} value={category} onChange={setCategory} /></FormSection>
      <FormSection title="Outfit" bare>
        <PickChips options={workspace.outfits.map(item => ({ id: item.id, name: item.name, icon: 'hanger' as const }))} selected={selectedOutfits}
          onToggle={id => setSelectedOutfits(selectedOutfits.includes(id) ? [] : [id])} empty="Create outfits in Wardrobe to pick one here." />
      </FormSection>
      <FormSection title="Carry" bare>
        <PickChips options={workspace.items.map(item => ({ id: item.id, name: item.name, icon: categoryIcons[item.category] }))} selected={selectedGear}
          onToggle={id => toggle(selectedGear, setSelectedGear, id)} empty="Add pieces in Wardrobe to carry them." />
      </FormSection>
      <FormSection title="More">
        <ValueRow icon="wallet" label="Cost" value={cost} onChangeText={setCost} />
        <TextRow icon="link" value={link} onChangeText={setLink} placeholder="Link" keyboardType="url" label="Reference link" />
        <TextRow icon="note" multiline value={notes} onChangeText={setNotes} placeholder="Notes" />
      </FormSection>
    </> : null}
    {target.kind === 'day' ? <>
      <FormSection footer={formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}>
        <TextRow large value={name} onChangeText={setName} placeholder="Name this day" />
        <TextRow icon="stay" value={stay} onChangeText={setStay} placeholder="Staying at" />
      </FormSection>
      <FormSection title="What to wear" bare>
        <PickChips options={workspace.outfits.map(item => ({ id: item.id, name: item.name, icon: 'hanger' as const }))} selected={selectedOutfits}
          onToggle={id => toggle(selectedOutfits, setSelectedOutfits, id)} empty="Create outfits in Wardrobe to pick one here." />
      </FormSection>
      <FormSection title="Carry" bare>
        <PickChips options={workspace.items.map(item => ({ id: item.id, name: item.name, icon: categoryIcons[item.category] }))} selected={selectedGear}
          onToggle={id => toggle(selectedGear, setSelectedGear, id)} empty="Add pieces in Wardrobe to carry them." />
      </FormSection>
      <FormSection title="Notes"><TextRow multiline value={notes} onChangeText={setNotes} placeholder="Day notes" /></FormSection>
    </> : null}
    {target.kind === 'item' ? <>
      <PressableScale onPress={() => void pickPhoto()} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={hasPhoto ? 'Change photo' : 'Add a photo'}
        style={{ alignSelf: 'center', width: 168, height: 168, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        {hasPhoto ? <Image source={pendingPhoto ? { uri: pendingPhoto.uri } : photoSource(currentItem!.image)} resizeMode="cover" accessibilityLabel="Wardrobe photo preview" style={StyleSheet.absoluteFill} />
          : <View style={{ alignItems: 'center', gap: 8 }}><View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: color }} /><Text style={{ color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 }}>Add photo</Text></View>}
        <View style={{ position: 'absolute', right: 10, bottom: 10, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
          <Icon name="camera" size={17} color={colors.onPrimary} />
        </View>
      </PressableScale>
      {hasPhoto ? <Pressable onPress={() => { setPendingPhoto(null); setRemovePhoto(true); }} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: -10 }}><Text style={{ color: colors.danger, fontFamily: fonts.medium, fontSize: 15 }}>Remove photo</Text></Pressable> : null}
      <FormSection><TextRow large value={name} onChangeText={setName} placeholder="Item name" autoFocus={!target.id} /></FormSection>
      <FormSection title="Category" bare><ChoiceChips label="Category" options={CLOTHING_CATEGORIES} value={category} onChange={setCategory} /></FormSection>
      <FormSection title="Details">
        <ValueRow icon="weight" label="Weight" value={weight} onChangeText={setWeight} suffix="g" />
        <ValueRow icon="droplet" label="Colour" value={color} onChangeText={setColor} keyboardType="default" placeholder="#8b8b73" />
      </FormSection>
      <FormSection title="Notes"><TextRow multiline value={notes} onChangeText={setNotes} placeholder="Fabric, fit, care…" label="Notes" /></FormSection>
    </> : null}
    {target.kind === 'outfit' ? <>
      <FormSection>
        <TextRow large value={name} onChangeText={setName} placeholder="Outfit name" autoFocus={!target.id} />
        <TextRow icon="event" value={occasion} onChangeText={setOccasion} placeholder="Occasion" />
      </FormSection>
      <FormSection title="Pieces" bare>
        <PickChips options={workspace.items.filter(item => ['Tops', 'Bottoms', 'Layers', 'Shoes'].includes(item.category)).map(item => ({ id: item.id, name: item.name, icon: categoryIcons[item.category] }))}
          selected={selectedItems} onToggle={id => toggle(selectedItems, setSelectedItems, id)} empty="Add clothes in Wardrobe first." />
      </FormSection>
      <FormSection title="Notes"><TextRow multiline value={notes} onChangeText={setNotes} placeholder="When to wear it" label="Notes" /></FormSection>
    </> : null}
    {target.kind === 'extra' ? <>
      <FormSection><TextRow large value={name} onChangeText={setName} placeholder="Essential" autoFocus={!target.id} /></FormSection>
      <FormSection title="Category" bare><ChoiceChips label="Category" options={EXTRA_CATEGORIES} value={category} onChange={setCategory} /></FormSection>
      <FormSection title="Details">
        <ValueRow icon="hash" label="Quantity" value={quantity} onChangeText={setQuantity} />
        <ValueRow icon="weight" label="Weight each" value={weight} onChangeText={setWeight} suffix="g" />
      </FormSection>
    </> : null}
    {error ? <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: colors.surfaceAlt }}>
      <Icon name="warning" size={18} color={colors.danger} /><Text style={{ flex: 1, color: colors.danger, fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 }}>{error}</Text>
    </View> : null}
    {target.id && target.kind !== 'day' ? <FormSection><ActionRow label={`Delete ${labelOf(target.kind)}`} onPress={remove} destructive icon="trash" /></FormSection> : null}
  </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}
