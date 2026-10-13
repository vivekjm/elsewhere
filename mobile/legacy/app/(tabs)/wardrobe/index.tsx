import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useScreenProps } from '../../../src/navigation';
import { OutfitsScreen, WardrobeScreen } from '../../../src/screens';

/** Pieces and Outfits share one route; the segmented control switches the `view` param in place. */
export default function WardrobeRoute() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const base = useScreenProps();
  if (!base) return null;
  const props = { ...base, onNavigate: (screen: Parameters<typeof base.onNavigate>[0]) => {
    if (screen === 'wardrobe' || screen === 'outfits') router.setParams({ view: screen === 'outfits' ? 'outfits' : 'items' });
    else base.onNavigate(screen);
  } };
  return view === 'outfits' ? <OutfitsScreen {...props} /> : <WardrobeScreen {...props} />;
}
