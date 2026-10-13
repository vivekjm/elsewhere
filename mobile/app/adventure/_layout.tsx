import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { ADVENTURE_TABS, colors, makeTabBar } from '../../src/loom';

const TabBar = makeTabBar(ADVENTURE_TABS);

export default function AdventureTabs() {
  return <Tabs tabBar={(props) => <TabBar {...props} />} backBehavior="history"
    screenOptions={{ headerShown: false, animation: 'shift', sceneStyle: { backgroundColor: colors.canvas } }} />;
}
