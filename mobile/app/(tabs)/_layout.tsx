import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { APP_TABS, colors, makeTabBar } from '../../src/loom';

const TabBar = makeTabBar(APP_TABS);

export default function AppTabs() {
  return <Tabs initialRouteName="home" tabBar={(props) => <TabBar {...props} />} backBehavior="history"
    screenOptions={{ headerShown: false, animation: 'shift', sceneStyle: { backgroundColor: colors.canvas } }} />;
}
