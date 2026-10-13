/** Android: a home-screen widget fed from the stored timeline. Live Activities don't exist on Android. */
import React from 'react';
import Storage from 'expo-sqlite/kv-store';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { ANDROID_WIDGET, NextTripAndroid, storedProps, TIMELINE_KEY } from './android';
import type { NextTripProps, TripDayProps } from './snapshot';

let last = '';

export function publishWidgets(timeline: { date: Date; props: NextTripProps }[]) {
  const value = JSON.stringify(timeline.map((e) => ({ date: e.date.getTime(), props: e.props })));
  if (value === last) return;
  last = value;
  void (async () => {
    try {
      await Storage.setItem(TIMELINE_KEY, value);
      const p = await storedProps();
      await requestWidgetUpdate({ widgetName: ANDROID_WIDGET, renderWidget: (info) => React.createElement(NextTripAndroid, { p, wide: info.width >= 220 }) });
    } catch { /* Widgets are best effort. */ }
  })();
}

export async function syncLiveActivity(_props: TripDayProps | null) {}

export const widgetsSupported = true;
