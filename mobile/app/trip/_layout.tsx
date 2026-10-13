import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { colors, makeTabBar, TRIP_TABS } from '../../src/loom';

/** Budget, Documents, Tides and Stylist are hidden tabs so the trip bar stays in view on them. */
const TabBar = makeTabBar(TRIP_TABS, { budget: 'index', documents: 'index', tides: 'index', stylist: 'wardrobe', map: 'days' });

export default function TripTabs() {
  return <Tabs tabBar={(props) => <TabBar {...props} />} backBehavior="history"
    screenOptions={{ headerShown: false, animation: 'shift', sceneStyle: { backgroundColor: colors.canvas } }} />;
}
