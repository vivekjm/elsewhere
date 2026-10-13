/**
 * The Android "Next trip" widget (react-native-android-widget). The app stores the same timeline it gives
 * iOS; the widget task handler picks the entry for "now", so the widget moves on between app launches.
 */
import React from 'react';
import Storage from 'expo-sqlite/kv-store';
import { FlexWidget, TextWidget, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import type { NextTripProps } from './snapshot';

export const ANDROID_WIDGET = 'NextTrip';
export const TIMELINE_KEY = 'tripsloom.widget.timeline.v1';

type Stored = { date: number; props: NextTripProps }[];

const INK = '#1E1E1E', STONE = '#7A7A7A', EMBER = '#FF6A2B', CANVAS = '#F7F6F4', TRACK = '#E6E5E2';

export async function storedProps(now = Date.now()): Promise<NextTripProps | null> {
  try {
    const raw = await Storage.getItem(TIMELINE_KEY);
    if (!raw) return null;
    const entries = JSON.parse(raw) as Stored;
    const current = entries.filter((e) => e.date <= now).pop() ?? entries[0];
    return current?.props ?? null;
  } catch {
    return null;
  }
}

export function NextTripAndroid({ p, wide }: { p: NextTripProps | null; wide: boolean }) {
  const url = p?.url ?? 'tripsloom:///home';
  if (!p || p.state === 'empty') {
    return <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'tripsloom:///new-trip' }}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: CANVAS, borderRadius: 20, padding: 16, justifyContent: 'space-between' }}>
      <TextWidget text="Trips Loom" style={{ fontSize: 13, fontWeight: '600', color: EMBER }} />
      <TextWidget text="Plan your next trip" style={{ fontSize: 18, fontWeight: '700', color: INK }} maxLines={2} />
      <TextWidget text="Tap to start" style={{ fontSize: 13, color: STONE }} />
    </FlexWidget>;
  }
  const pct = Math.max(0.02, Math.min(1, p.progress));
  return <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: url }}
    style={{ height: 'match_parent', width: 'match_parent', backgroundColor: CANVAS, borderRadius: 20, padding: 16, flexGap: 6 }}>
    <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between' }}>
      <TextWidget text={p.headline} style={{ fontSize: 13, fontWeight: '600', color: EMBER }} maxLines={1} />
      {wide && p.weather ? <TextWidget text={p.weather} style={{ fontSize: 13, color: STONE }} maxLines={1} /> : <TextWidget text="" />}
    </FlexWidget>
    {wide ? <>
      <TextWidget text={p.name} style={{ fontSize: 18, fontWeight: '700', color: INK }} maxLines={1} truncate="END" />
      <TextWidget text={[p.place, p.dateLabel].filter(Boolean).join(' · ')} style={{ fontSize: 13, color: STONE }} maxLines={1} truncate="END" />
    </> : <>
      <TextWidget text={p.big} style={{ fontSize: 34, fontWeight: '700', color: INK }} />
      <TextWidget text={p.bigLabel} style={{ fontSize: 12, color: STONE }} />
      <TextWidget text={p.place || p.name} style={{ fontSize: 15, fontWeight: '600', color: INK }} maxLines={2} truncate="END" />
    </>}
    <FlexWidget style={{ width: 'match_parent', height: 5, backgroundColor: TRACK, borderRadius: 3, flexDirection: 'row' }}>
      <FlexWidget style={{ flex: pct, height: 5, backgroundColor: EMBER, borderRadius: 3 }} />
      <FlexWidget style={{ flex: 1 - pct, height: 5 }} />
    </FlexWidget>
    {wide ? p.plans.slice(0, 2).map((plan, i) => <FlexWidget key={i} style={{ flexDirection: 'row', flexGap: 8, width: 'match_parent' }}>
      <TextWidget text={plan.time} style={{ fontSize: 13, fontWeight: '600', color: INK }} maxLines={1} />
      <TextWidget text={plan.title} style={{ fontSize: 13, color: STONE }} maxLines={1} truncate="END" />
    </FlexWidget>) : null}
    {wide && !p.plans.length ? <TextWidget text={p.state === 'upcoming' && p.packTotal ? `Packed ${p.packed} of ${p.packTotal}` : 'No more plans'} style={{ fontSize: 13, color: STONE }} /> : null}
  </FlexWidget>;
}

/** Runs headless when Android adds, updates or resizes the widget. */
export async function widgetTaskHandler({ widgetAction, widgetInfo, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  const p = await storedProps();
  renderWidget(<NextTripAndroid p={p} wide={widgetInfo.width >= 220} />);
}
