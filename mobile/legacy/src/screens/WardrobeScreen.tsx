import React, { useLayoutEffect, useState } from 'react';
import { useNavigation } from 'expo-router';
import { FlatList, Image, Text, View } from 'react-native';
import { CLOTHING_CATEGORIES, type Item, type Outfit } from '../types';
import { useWorkspace } from '../data/WorkspaceContext';
import { useTheme, fonts, Icon, PressableScale, SegmentedControl } from '../design';
import { EditorSheet } from './EditorSheet';
import { Chip, ChipRow, type EditTarget, ListEmpty, ScreenTitle, styles, type WorkspaceScreenProps } from './shared';

function ItemArt({ item }: { item: Item }) {
  const { colors } = useTheme();
  const { photoSource } = useWorkspace();
  const source = item.image ? photoSource(item.image) : null;
  return <View style={{ aspectRatio: 1, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderRadius: 24, overflow: 'hidden' }}>{source ? <Image source={source} resizeMode="cover" accessibilityLabel={item.name} style={{ width: '100%', height: '100%' }} /> : <View style={{ width: 72, height: 72, borderRadius: 18, backgroundColor: item.color || colors.accent, borderWidth: 5, borderColor: colors.surface, transform: [{ rotate: '-8deg' }] }} />}</View>;
}
function WardrobeCollection({ props, outfitsOnly }: { props: WorkspaceScreenProps; outfitsOnly: boolean }) {
  const { workspace } = props;
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [editor, setEditor] = useState<EditTarget | null>(null);
  const clothing = workspace.items.filter(item => CLOTHING_CATEGORIES.includes(item.category as (typeof CLOTHING_CATEGORIES)[number]));
  const items = clothing.filter(item => (category === 'All' || item.category === category) && `${item.name} ${item.category} ${item.notes || ''}`.toLowerCase().includes(query.toLowerCase()));
  const outfits = workspace.outfits.filter(item => `${item.name} ${item.occasion || ''} ${item.items.map(id => workspace.items.find(piece => piece.id === id)?.name || '').join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const navigation = useNavigation();
  const searchable = (outfitsOnly ? workspace.outfits.length : clothing.length) > 6;
  useLayoutEffect(() => {
    navigation.setOptions({ headerSearchBarOptions: searchable ? { placeholder: outfitsOnly ? 'Search outfits' : 'Search pieces', hideWhenScrolling: true,
      onChangeText: (event: { nativeEvent: { text: string } }) => setQuery(event.nativeEvent.text), onCancelButtonPress: () => setQuery('') } : undefined });
  }, [navigation, searchable, outfitsOnly]);
  const nothingYet = outfitsOnly ? workspace.outfits.length === 0 : clothing.length === 0;
  const filtered = !!query || (!outfitsOnly && category !== 'All');
  const header = <View style={{ gap: 20, marginBottom: 8 }}>
    <ScreenTitle title="Wardrobe" detail={`${clothing.length} ${clothing.length === 1 ? 'piece' : 'pieces'} · ${workspace.outfits.length} ${workspace.outfits.length === 1 ? 'outfit' : 'outfits'}`} action="plus" actionLabel={outfitsOnly ? 'Create an outfit' : 'Add clothing'} onAction={() => setEditor({ kind: outfitsOnly ? 'outfit' : 'item' })} />
    <SegmentedControl label="Wardrobe view" stretch value={outfitsOnly ? 'outfits' : 'items'} onChange={value => props.onNavigate(value === 'outfits' ? 'outfits' : 'wardrobe')}
      options={[{ value: 'items', label: 'Pieces' }, { value: 'outfits', label: 'Outfits' }]} />
    {!nothingYet && !outfitsOnly ? <ChipRow>{['All', ...CLOTHING_CATEGORIES].map(value => <Chip key={value} label={value} selected={category === value} onPress={() => setCategory(value)} />)}</ChipRow> : null}
  </View>;
  const empty = filtered
    ? <ListEmpty icon="search" title="Nothing matches" description="Try another search or category." action="Clear filters" onAction={() => { setQuery(''); setCategory('All'); }} />
    : outfitsOnly
      ? <ListEmpty icon="layers" title="No outfits yet" description="Combine a few pieces into a look." action="Create an outfit" onAction={() => setEditor({ kind: 'outfit' })} />
      : <ListEmpty icon="hanger" title="No pieces yet" description="Add clothes to build outfits and pack." action="Add clothing" onAction={() => setEditor({ kind: 'item' })} />;
  const render = (entry: Item | Outfit) => {
    if (outfitsOnly) {
      const outfit = entry as Outfit;
      return <PressableScale onPress={() => setEditor({ kind: 'outfit', id: outfit.id })} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`${outfit.name}, ${outfit.items.length} pieces`} style={{ flex: 1, maxWidth: '48.5%', gap: 8 }}>
        <View style={{ aspectRatio: 1, borderRadius: 24, backgroundColor: colors.surfaceAlt, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', gap: 6, padding: 16 }}>
          {outfit.items.slice(0, 4).map(id => { const piece = workspace.items.find(item => item.id === id); return piece ? <View key={id} style={{ width: 44, height: 44, backgroundColor: piece.color || colors.accent, borderRadius: 12, borderWidth: 3, borderColor: colors.surface }} /> : null; })}
          {outfit.items.length === 0 ? <Icon name="layers" size={28} color={colors.textMuted} /> : null}
        </View>
        <View style={{ paddingHorizontal: 4 }}><Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 15 }}>{outfit.name}</Text><Text style={{ color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 }}>{outfit.items.length} pieces</Text></View>
      </PressableScale>;
    }
    const item = entry as Item;
    return <PressableScale onPress={() => setEditor({ kind: 'item', id: item.id })} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.category}`} style={{ flex: 1, maxWidth: '48.5%', gap: 8 }}>
      <ItemArt item={item} />
      <View style={{ paddingHorizontal: 4 }}><Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 15 }}>{item.name}</Text><Text style={{ color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 }}>{item.category}</Text></View>
    </PressableScale>;
  };
  return <View style={{ flex: 1 }}><FlatList<Item | Outfit> data={outfitsOnly ? outfits : items} keyExtractor={entry => entry.id} renderItem={({ item }) => render(item)} numColumns={2} key={outfitsOnly ? 'outfits' : 'items'} columnWrapperStyle={{ gap: 8 }} ListHeaderComponent={header} ListEmptyComponent={empty} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.page, { gap: 20 }]} keyboardShouldPersistTaps="handled" initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7} /><EditorSheet target={editor} workspace={workspace} trip={props.trip} change={props.change} onClose={() => setEditor(null)} /></View>;
}
export function WardrobeScreen(props: WorkspaceScreenProps) { return <WardrobeCollection props={props} outfitsOnly={false} />; }
export function OutfitsScreen(props: WorkspaceScreenProps) { return <WardrobeCollection props={props} outfitsOnly />; }
