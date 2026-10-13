import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { uid, type Extra } from '../types';
import { SegmentedControl } from '../design';
import { EditorSheet } from './EditorSheet';
import { Checkbox, Chip, type EditTarget, Group, GroupLabel, ListEmpty, Page, Row, ScreenTitle, styles, type WorkspaceScreenProps } from './shared';

const suggestions: { name: string; category: Extra['category']; weight: number }[] = [
  { name: 'Passport & travel documents', category: 'Documents', weight: 80 }, { name: 'Phone charger', category: 'Electronics', weight: 120 }, { name: 'Toiletry kit', category: 'Toiletries', weight: 300 }, { name: 'Reusable water bottle', category: 'Essentials', weight: 150 },
];

export function EssentialsScreen(props: WorkspaceScreenProps) {
  const [editor, setEditor] = useState<EditTarget | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | 'To pack' | 'Packed'>('All');
  const trip = props.trip;
  if (!trip) return <Page><ScreenTitle title="Essentials" /><View style={{ paddingTop: 48 }}><ListEmpty icon="shield" title="No trip selected" description="Plan a trip to start a list." action="Plan a trip" onAction={() => setEditor({ kind: 'trip' })} /></View><EditorSheet target={editor} workspace={props.workspace} change={props.change} onClose={() => setEditor(null)} onSavedTrip={props.onSelectTrip} /></Page>;
  const packed = trip.extras.filter(item => item.packed).length;
  const visible = trip.extras.filter(item => (filter === 'All' || (filter === 'Packed' ? item.packed : !item.packed)) && `${item.name} ${item.category || 'Essentials'}`.toLowerCase().includes(query.toLowerCase()));
  const categories = Array.from(new Set(visible.map(item => item.category || 'Essentials')));
  const toggle = (id: string) => { try { props.change(draft => { const extra = draft.trips.find(item => item.id === trip.id)?.extras.find(item => item.id === id); if (extra) extra.packed = !extra.packed; }); } catch (error) { Alert.alert('Could not update list', error instanceof Error ? error.message : 'Try again.'); } };
  const addSuggestion = (suggestion: typeof suggestions[number]) => { try { props.change(draft => { const list = draft.trips.find(item => item.id === trip.id)!.extras; if (!list.some(item => item.name.toLowerCase() === suggestion.name.toLowerCase())) list.push({ id: uid(), name: suggestion.name, category: suggestion.category, weight: suggestion.weight, quantity: 1, packed: false }); }); } catch (error) { Alert.alert('Could not add essential', error instanceof Error ? error.message : 'Try again.'); } };
  const sections = categories.map(category => ({ title: category, data: visible.filter(item => (item.category || 'Essentials') === category) }));
  const header = <View style={{ gap: 20 }}>
    <ScreenTitle title="Essentials" detail={trip.extras.length ? `${packed} of ${trip.extras.length} packed` : undefined} action="plus" actionLabel="Add an essential" onAction={() => setEditor({ kind: 'extra' })} />
    {trip.extras.length > 3 ? <SegmentedControl label="Filter essentials" stretch value={filter} onChange={setFilter}
      options={(['All', 'To pack', 'Packed'] as const).map(value => ({ value, label: value }))} /> : null}
    {!visible.length ? trip.extras.length
      ? <ListEmpty icon="search" title="Nothing here" description="Try another filter." action="Clear filters" onAction={() => { setQuery(''); setFilter('All'); }} />
      : <View style={{ paddingTop: 24 }}><ListEmpty icon="shield" title="Nothing added yet" description="Documents, chargers, the little things." /></View> : null}
  </View>;
  const remaining = suggestions.filter(suggestion => !trip.extras.some(item => item.name.toLowerCase() === suggestion.name.toLowerCase()));
  const footer = remaining.length ? <View style={{ gap: 16 }}>
    <GroupLabel subtitle="Tap to add">Suggestions</GroupLabel>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{remaining.map(suggestion => <Chip key={suggestion.name} icon="plus" label={suggestion.name} onPress={() => addSuggestion(suggestion)} />)}</View>
  </View> : null;
  const renderRow = (item: Extra) => <Row leading={<Checkbox checked={item.packed} label={`Pack ${item.name}`} onPress={() => toggle(item.id)} />}
    title={item.name} detail={item.quantity > 1 ? `×${item.quantity}` : undefined} done={item.packed} onPress={() => setEditor({ kind: 'extra', id: item.id })} accessibilityLabel={`Edit ${item.name}`} />;
  return <View style={{ flex: 1 }}><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    {header}
    {sections.map(section => <View key={section.title} style={{ gap: 16 }}><GroupLabel subtitle={`${section.data.filter(item => item.packed).length} of ${section.data.length} packed`}>{section.title}</GroupLabel><Group>{section.data.map(item => <React.Fragment key={item.id}>{renderRow(item)}</React.Fragment>)}</Group></View>)}
    {footer}
  </ScrollView><EditorSheet target={editor} workspace={props.workspace} trip={trip} change={props.change} onClose={() => setEditor(null)} onSavedTrip={props.onSelectTrip} /></View>;
}
