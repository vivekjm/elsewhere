import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { packing, uid, type Extra, type PackRow } from '../types';
import { Card, fonts, PressableScale, SegmentedControl, useTheme } from '../design';
import { EditorSheet } from './EditorSheet';
import { Checkbox, Chip, type EditTarget, Group, GroupLabel, ListEmpty, Page, Row, ScreenTitle, styles, type WorkspaceScreenProps } from './shared';

const suggestions: { name: string; category: Extra['category']; weight: number }[] = [
  { name: 'Passport & travel documents', category: 'Documents', weight: 80 },
  { name: 'Phone charger', category: 'Electronics', weight: 120 },
  { name: 'Toiletry kit', category: 'Toiletries', weight: 300 },
];

export function PackingScreen(props: WorkspaceScreenProps) {
  const { colors } = useTheme();
  const [editor, setEditor] = useState<EditTarget | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | 'To pack' | 'Packed'>('All');
  const trip = props.trip;
  if (!trip) return <Page><ScreenTitle title="Packing" /><View style={{ paddingTop: 48 }}><ListEmpty icon="bag" title="No trip selected" description="Plan a trip to start a list." action="Plan a trip" onAction={() => setEditor({ kind: 'trip' })} /></View><EditorSheet target={editor} workspace={props.workspace} change={props.change} onClose={() => setEditor(null)} onSavedTrip={props.onSelectTrip} /></Page>;

  const rows = packing(props.workspace, trip);
  const packed = rows.filter(item => item.packed).length;
  const weight = rows.reduce((sum, item) => sum + item.weight * item.quantity, 0) / 1000;
  const visible = rows.filter(item => (filter === 'All' || (filter === 'Packed' ? item.packed : !item.packed)) && `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase()));
  const sections = Array.from(new Set(visible.map(item => item.category))).map(title => ({ title, data: visible.filter(item => item.category === title) }));

  const toggle = (item: PackRow) => {
    try { props.change(draft => { const owner = draft.trips.find(value => value.id === trip.id)!; if (item.automatic) owner.packed = owner.packed.includes(item.id) ? owner.packed.filter(id => id !== item.id) : [...owner.packed, item.id]; else { const extra = owner.extras.find(value => value.id === item.id); if (extra) extra.packed = !extra.packed; } }); }
    catch (error) { Alert.alert('Could not update list', error instanceof Error ? error.message : 'Try again.'); }
  };
  const addSuggestion = (suggestion: typeof suggestions[number]) => {
    try { props.change(draft => { const extras = draft.trips.find(value => value.id === trip.id)!.extras; if (!extras.some(value => value.name.toLowerCase() === suggestion.name.toLowerCase())) extras.push({ id: uid(), name: suggestion.name, category: suggestion.category, weight: suggestion.weight, quantity: 1, packed: false }); }); }
    catch (error) { Alert.alert('Could not add essential', error instanceof Error ? error.message : 'Try again.'); }
  };
  const over = trip.weightLimit > 0 && weight > trip.weightLimit;
  const progress = rows.length ? packed / rows.length : 0;
  const header = <View style={{ gap: 20 }}>
    <ScreenTitle title="Packing" detail={rows.length ? `${packed} of ${rows.length} packed` : undefined} action="plus" actionLabel="Add an essential" onAction={() => setEditor({ kind: 'extra' })} />
    <Card elevated style={{ gap: 16, padding: 20 }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }} accessibilityLabel={`${packed} of ${rows.length} items packed`}>
        <View style={{ height: 8, borderRadius: 4, width: `${progress * 100}%`, backgroundColor: colors.primary }} />
      </View>
      <PressableScale onPress={() => setEditor({ kind: 'trip', id: trip.id })} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`Bag weight ${weight.toFixed(1)} kilograms${trip.weightLimit ? ` of ${trip.weightLimit}` : ''}. Edit target`}
        style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ color: over ? colors.danger : colors.text, fontSize: 28, fontFamily: fonts.semibold }}>{weight.toFixed(1)}<Text style={{ fontSize: 16, color: colors.textMuted, fontFamily: fonts.regular }}> kg</Text></Text>
        <Text style={{ color: colors.textMuted, fontSize: 15, fontFamily: fonts.regular }}>{trip.weightLimit > 0 ? `of ${trip.weightLimit} kg` : 'Set a target'}</Text>
      </PressableScale>
    </Card>
    {rows.length > 3 ? <SegmentedControl label="Filter packing list" stretch value={filter} onChange={setFilter}
      options={(['All', 'To pack', 'Packed'] as const).map(value => ({ value, label: value }))} /> : null}
    {!visible.length ? rows.length
      ? <ListEmpty icon="search" title="Nothing here" description="Try another filter." action="Clear filters" onAction={() => { setQuery(''); setFilter('All'); }} />
      : <View style={{ paddingTop: 24 }}><ListEmpty icon="bag" title="Your list is empty" description="Pick outfits for your days, or add essentials." /></View> : null}
  </View>;
  const remaining = suggestions.filter(suggestion => !trip.extras.some(item => item.name.toLowerCase() === suggestion.name.toLowerCase()));
  const footer = remaining.length ? <View style={{ gap: 16 }}>
    <GroupLabel subtitle="Tap to add">Suggestions</GroupLabel>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{remaining.map(suggestion => <Chip key={suggestion.name} icon="plus" label={suggestion.name} onPress={() => addSuggestion(suggestion)} />)}</View>
  </View> : null;
  const renderRow = (item: PackRow) => <Row leading={<Checkbox checked={item.packed} label={`Pack ${item.name}`} onPress={() => toggle(item)} />}
    title={item.name} detail={item.automatic ? `${item.dates.length} ${item.dates.length === 1 ? 'day' : 'days'}` : item.quantity > 1 ? `×${item.quantity}` : undefined}
    done={item.packed} onPress={() => setEditor({ kind: item.automatic ? 'item' : 'extra', id: item.id })} accessibilityLabel={`Edit ${item.name}`} />;
  return <View style={{ flex: 1 }}><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    {header}
    {sections.map(section => <View key={section.title} style={{ gap: 16 }}><GroupLabel subtitle={`${section.data.filter(item => item.packed).length} of ${section.data.length} packed`}>{section.title}</GroupLabel><Group>{section.data.map(item => <React.Fragment key={`${item.automatic ? 'auto' : 'extra'}-${item.id}`}>{renderRow(item)}</React.Fragment>)}</Group></View>)}
    {footer}
  </ScrollView><EditorSheet target={editor} workspace={props.workspace} trip={trip} change={props.change} onClose={() => setEditor(null)} onSavedTrip={props.onSelectTrip} /></View>;
}
