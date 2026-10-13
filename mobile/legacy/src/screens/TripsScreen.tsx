import React, { useState } from 'react';
import { ActionSheetIOS, Alert, Modal, Platform, ScrollView, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { packing, tripDates, uid, type Trip } from '../types';
import { AppButton, EmptyState, TripCard, useTheme, fonts } from '../design';
import { EditorSheet } from './EditorSheet';
import { Action, type EditTarget, formatDate, GroupLabel, landscapeImage, moodFor, Muted, ScreenTitle, styles, Surface, Title, type WorkspaceScreenProps } from './shared';

export function TripsScreen(props: WorkspaceScreenProps) {
  const { colors, spacing } = useTheme();
  const { workspace } = props;
  const [editor, setEditor] = useState<EditTarget | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<Trip | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const openTrip = (trip: Trip) => { props.onSelectTrip(trip.id); props.onSelectDay(trip.start); props.onNavigate('planner'); };
  const duplicate = (trip: Trip | null = duplicateSource, name = duplicateName) => {
    if (!trip) return;
    const duplicateName = name;
    if (!duplicateName.trim() || duplicateName.trim().length > 200) return Alert.alert('Name this trip', 'Enter a trip name up to 200 characters.');
    const copy: Trip = JSON.parse(JSON.stringify(trip));
    copy.id = uid(); copy.name = duplicateName.trim(); copy.packed = [];
    copy.activities = copy.activities.map(item => ({ ...item, id: uid(), completed: false }));
    copy.extras = copy.extras.map(item => ({ ...item, id: uid(), packed: false }));
    try { props.change(draft => { draft.trips.push(copy); }); setDuplicateSource(null); props.onSelectTrip(copy.id); } catch (error) { Alert.alert('Could not duplicate trip', error instanceof Error ? error.message : 'Please try again.'); }
  };
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = workspace.trips.filter(trip => trip.end >= today).sort((a, b) => a.start.localeCompare(b.start));
  const past = workspace.trips.filter(trip => trip.end < today).sort((a, b) => b.start.localeCompare(a.start));
  const tripActions = (trip: Trip) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const edit = () => setEditor({ kind: 'trip', id: trip.id });
    const copy = () => {
      // iOS: the system text prompt; elsewhere the in-app dialog.
      if (Platform.OS === 'ios') return Alert.prompt('Duplicate trip', 'Plans and outfits carry over. Packing resets.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Create copy', isPreferred: true, onPress: (name?: string) => duplicate(trip, name ?? '') },
      ], 'plain-text', `${trip.name} (copy)`);
      setDuplicateSource(trip); setDuplicateName(`${trip.name} (copy)`);
    };
    if (Platform.OS !== 'ios') return Alert.alert(trip.name, undefined, [{ text: 'Edit trip', onPress: edit }, { text: 'Duplicate', onPress: copy }, { text: 'Cancel', style: 'cancel' }]);
    ActionSheetIOS.showActionSheetWithOptions({ title: trip.name, options: ['Edit trip', 'Duplicate', 'Cancel'], cancelButtonIndex: 2 }, index => {
      if (index === 0) edit();
      if (index === 1) copy();
    });
  };
  const renderTrip = (trip: Trip, wide = false) => {
    const pack = packing(workspace, trip);
    const done = pack.filter(item => item.packed).length;
    const days = tripDates(trip).length;
    const dates = `${formatDate(trip.start)} – ${formatDate(trip.end)}`;
    return <TripCard key={trip.id} style={{ flex: 1 }} height={wide ? 280 : 218} title={trip.name}
      meta={trip.destination || dates} metaIcon="location" image={landscapeImage(trip.theme)} mood={moodFor(trip)}
      badge={`${days} ${days === 1 ? 'day' : 'days'}`}
      chips={[{ icon: 'calendar' as const, label: wide ? `${formatDate(trip.start)} – ${formatDate(trip.end)}` : formatDate(trip.start) }, { icon: 'people' as const, label: `${trip.travellers}` }]}
      onLongPress={() => tripActions(trip)} onPress={() => openTrip(trip)}
      accessibilityLabel={`Open ${trip.name}, ${trip.destination}, ${dates}, ${days} days, ${done} of ${pack.length} packed`} />;
  };
  const grid = (trips: Trip[]) => <View style={{ gap: 8 }}>
    {Array.from({ length: Math.ceil(trips.length / 2) }, (_, row) => {
      const pair = trips.slice(row * 2, row * 2 + 2);
      // An odd trip out (or a single trip) spans the full width as a feature card.
      return <View key={row} style={{ flexDirection: 'row', gap: 8 }}>{pair.map(trip => renderTrip(trip, pair.length === 1))}</View>;
    })}
  </View>;
  const count = workspace.trips.length;
  return <View style={{ flex: 1 }}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page}>
      <ScreenTitle title="Trips" detail={count ? `${count} ${count === 1 ? 'trip' : 'trips'} planned` : undefined} action="plus" actionLabel="Plan a new trip" onAction={() => setEditor({ kind: 'trip' })} />
      {count === 0 ? <View style={{ paddingTop: 48 }}><EmptyState title="No trips yet" description="Plan one to bring your days, outfits and packing together."
        action={<AppButton label="Plan a trip" icon="plus" onPress={() => setEditor({ kind: 'trip' })} />} /></View> : null}
      {upcoming.length ? <>{past.length ? <GroupLabel subtitle={`${upcoming.length} ahead of you`}>Upcoming</GroupLabel> : null}{grid(upcoming)}</> : null}
      {past.length ? <><GroupLabel subtitle={`${past.length} ${past.length === 1 ? 'memory' : 'memories'}`}>Past trips</GroupLabel>{grid(past)}</> : null}
    </ScrollView>
    <Modal visible={!!duplicateSource} transparent animationType="fade" onRequestClose={() => setDuplicateSource(null)}><View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: 16 }}><Surface><Title size={23}>Duplicate trip</Title><Muted>Plans and outfits carry over. Packing resets.</Muted><TextInput value={duplicateName} onChangeText={setDuplicateName} accessibilityLabel="New trip name" autoFocus maxLength={200} style={{ minHeight: 52, borderWidth: 1, borderColor: colors.textMuted, borderRadius: 16, color: colors.text, paddingHorizontal: 16, fontSize: 16, fontFamily: fonts.regular }} /><Action label="Create copy" onPress={() => duplicate()} primary /><Action label="Cancel" onPress={() => setDuplicateSource(null)} /></Surface></View></Modal>
    <EditorSheet target={editor} workspace={workspace} trip={props.trip} change={props.change} onClose={() => setEditor(null)} onSavedTrip={id => { props.onSelectTrip(id); props.onNavigate('planner'); }} />
  </View>;
}
