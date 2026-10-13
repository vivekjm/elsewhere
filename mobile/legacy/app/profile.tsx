import React, { useLayoutEffect } from 'react';
import { router, useNavigation } from 'expo-router';
import { useTheme } from '../src/design';
import { useScreenProps } from '../src/navigation';
import { SettingsScreen } from '../src/screens';

/** Profile, presented as a native page sheet from the navigation bar's profile button. */
export default function ProfileRoute() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const props = useScreenProps();
  useLayoutEffect(() => {
    navigation.setOptions({
      unstable_headerRightItems: () => [{ type: 'button', label: 'Done', variant: 'done', tintColor: colors.primary, onPress: () => router.back() }],
    });
  }, [navigation, colors.primary]);
  if (!props) return null;
  return <SettingsScreen {...props} />;
}
