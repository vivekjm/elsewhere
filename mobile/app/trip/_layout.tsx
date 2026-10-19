import React, { useMemo } from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { useWorkspace } from '../../src/data';
import { colors, makeTabBar, TabRootsContext, TRIP_TABS, type TabItem } from '../../src/loom';

/** Budget, Documents, Tides and Stylist are hidden tabs so the trip bar stays in view on them. */
const WithWardrobe = makeTabBar(TRIP_TABS, { budget: 'index', documents: 'index', tides: 'index', stylist: 'wardrobe', map: 'days' });
/**
 * Until someone adds clothes, the wardrobe is a detour: the bar shows Budget in its place (shared costs are what a
 * group trip needs every day). Wardrobe and the stylist stay one tap away from Packing.
 */
const BUDGET_TABS: TabItem[] = TRIP_TABS.map((t) => (t.route === 'wardrobe' ? { route: 'budget', label: 'Budget', icon: 'card' } : t));
const WithBudget = makeTabBar(BUDGET_TABS, { documents: 'index', tides: 'index', stylist: 'packing', wardrobe: 'packing', map: 'days' });

export default function TripTabs() {
  const { workspace } = useWorkspace();
  const budgetBar = !!workspace && workspace.items.length === 0;
  const TabBar = budgetBar ? WithBudget : WithWardrobe;
  const roots = useMemo(() => new Set((budgetBar ? BUDGET_TABS : TRIP_TABS).map((t) => t.route)), [budgetBar]);
  // No cross-fade between tabs: react-navigation's fade can leave a tab you return to (by Back) at opacity 0, a
  // blank page. Tabs switch instantly, as native tab bars do; content still rises in on first open.
  return <TabRootsContext.Provider value={roots}>
    <Tabs tabBar={(props) => <TabBar {...props} />} backBehavior="history" screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas } }} />
  </TabRootsContext.Provider>;
}
