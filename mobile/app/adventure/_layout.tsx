import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { ADVENTURE_TABS, colors, makeTabBar, TabRootsContext } from '../../src/loom';

const TabBar = makeTabBar(ADVENTURE_TABS);
const ROOTS = new Set(ADVENTURE_TABS.map((t) => t.route));

export default function AdventureTabs() {
  // Instant tab switches (see app/trip/_layout.tsx), and Back on a tab leaves the adventure.
  return <TabRootsContext.Provider value={ROOTS}>
    <Tabs tabBar={(props) => <TabBar {...props} />} backBehavior="history" screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas } }} />
  </TabRootsContext.Provider>;
}
