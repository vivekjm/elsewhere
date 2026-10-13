import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTheme } from '../../src/design';

/** The system tab bar (UITabBarController): Liquid Glass on iOS 26, minimising as you scroll down. */
export default function TabsLayout() {
  const { colors, fonts } = useTheme();
  return <NativeTabs tintColor={colors.primary} minimizeBehavior="onScrollDown"
    labelStyle={{ default: { fontFamily: fonts.medium, color: colors.textMuted }, selected: { fontFamily: fonts.semibold, color: colors.primary } }}>
    <NativeTabs.Trigger name="calendar">
      <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} />
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="wardrobe">
      <NativeTabs.Trigger.Label>Wardrobe</NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Icon sf={{ default: 'tshirt', selected: 'tshirt.fill' }} />
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="essentials">
      <NativeTabs.Trigger.Label>Essentials</NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Icon sf={{ default: 'checkmark.shield', selected: 'checkmark.shield.fill' }} />
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="packing">
      <NativeTabs.Trigger.Label>Packing</NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Icon sf={{ default: 'suitcase', selected: 'suitcase.fill' }} />
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="trips">
      <NativeTabs.Trigger.Label>Trips</NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} />
    </NativeTabs.Trigger>
  </NativeTabs>;
}
