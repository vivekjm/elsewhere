import React from 'react';
import { View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { Button, colors, T } from '../loom';

/** Shown instead of a blank screen when a screen throws. Data on the phone is untouched. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: colors.canvas }}>
    <T v="title" center>Something went wrong</T>
    <T v="body" center>This screen hit a problem. Your trips are safe. Try again, and if it keeps happening, send us a note from Help.</T>
    {__DEV__ ? <T v="meta" center>{error.message}</T> : null}
    <Button label="Try again" icon="refresh" onPress={() => { void retry(); }} full={false} />
  </View>;
}
