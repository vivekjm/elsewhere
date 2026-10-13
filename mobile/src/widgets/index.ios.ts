/** iOS: WidgetKit widgets and the trip-day Live Activity through expo-widgets. */
import { AppState } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { endOfToday, type NextTripProps, type TripDayProps } from './snapshot';
import { nextTripWidget } from './NextTripWidget';
import { tripDayActivity } from './TripDayActivity';

let lastTimeline = '';

export function publishWidgets(timeline: { date: Date; props: NextTripProps }[]) {
  const key = JSON.stringify(timeline.map((e) => [e.date.getTime(), e.props]));
  if (key === lastTimeline) return;
  lastTimeline = key;
  try { nextTripWidget.updateTimeline(timeline); } catch { /* Widgets are best effort. */ }
}

let lastActivity = '';

/** Bump when the Live Activity layout changes: a running activity keeps its old layout until it is restarted. */
const LAYOUT_VERSION = '8';
const LAYOUT_KEY = 'tripsloom.liveActivity.layout';
let layoutChecked = false;
/** Activities this app ended; iOS can keep listing them for a moment afterwards. */
const ended = new Set<string>();
const live = () => tripDayActivity.getInstances().filter((a) => !ended.has(a.getId()));
const endAll = async () => { await Promise.all(live().map((a) => { ended.add(a.getId()); return a.end('immediate'); })); };

/** Starts, updates or ends today's Live Activity so exactly one matches `props`. */
export async function syncLiveActivity(props: TripDayProps | null) {
  // iOS only starts Live Activities from the foreground; the app syncs again each time it becomes active.
  if (AppState.currentState !== 'active') return;
  try {
    let reset = false;
    if (!layoutChecked) {
      layoutChecked = true;
      const stored = await Storage.getItem(LAYOUT_KEY).catch(() => null);
      if (stored !== LAYOUT_VERSION) {
        await endAll();
        await Storage.setItem(LAYOUT_KEY, LAYOUT_VERSION).catch(() => {});
        lastActivity = '';
        reset = true;
      }
    }
    const running = reset ? [] : live();
    if (!props) {
      lastActivity = '';
      await endAll();
      return;
    }
    const key = JSON.stringify(props);
    const [first, ...extra] = running;
    await Promise.all(extra.map((a) => { ended.add(a.getId()); return a.end('immediate'); }));
    if (first) {
      if (key !== lastActivity) await first.update(props, endOfToday());
    } else {
      tripDayActivity.start(props, props.url, endOfToday());
    }
    lastActivity = key;
  } catch (error) {
    // Live Activities can be turned off in Settings; nothing to do in release.
    if (__DEV__) console.warn('Live Activity sync failed', error);
  }
}

export const widgetsSupported = true;
