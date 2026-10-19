import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { APP_TABS, colors, makeTabBar } from '../../src/loom';

const TabBar = makeTabBar(APP_TABS);

export default function AppTabs() {
  return <Tabs initialRouteName="home" tabBar={(props) => <TabBar {...props} />} backBehavior="history"
    // Instant tab switches: react-navigation's fade can leave a tab returned to by Back (Android's back button) blank.
    screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas } }} />;
}
