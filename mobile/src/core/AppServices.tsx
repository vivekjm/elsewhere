/**
 * Background work tied to the signed-in session. Renders nothing.
 * - Trip reminders (local notifications), rescheduled when trips or the setting change.
 * - Home-screen widgets (iOS and Android) and the trip-day Live Activity (iOS).
 * - Links: `tripsloom://…?trip=<id>` from widgets and Live Activities selects that trip;
 *   tapping a reminder opens its screen for its trip.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useOpenTripPage } from './nav';
import { useAuth, useExtras, useWorkspace } from '../data';
import { fromDate } from '../domain/format';
import { featuredTrip } from '../domain/trips';
import { syncReminders } from '../services/notifications';
import { tripWeather, weatherSymbol, type DayWeather } from '../services/weather';
import { publishWidgets, syncLiveActivity } from '../widgets';
import { nextTripTimeline, tripDayProps } from '../widgets/snapshot';
import { DEV_PREVIEW } from '../devStart';
import { usePrefs, useSelection } from './state';
import { configureAnalytics, track } from './analytics';

const TRIP_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** A trip id from a `?trip=` link, if it is well formed. */
function tripFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const id = Linking.parse(url).queryParams?.trip;
    return typeof id === 'string' && TRIP_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Only in-app paths from our own reminders are followed. */
const SAFE_PATH = /^\/[a-z0-9/-]{0,60}$/;

export function AppServices() {
  const auth = useAuth();
  const { workspace } = useWorkspace();
  const extras = useExtras();
  const prefs = usePrefs();
  const { select } = useSelection();
  const router = useRouter();
  const openTrip = useOpenTripPage();
  const signedIn = (!!auth.session && !!auth.profile?.onboarding_completed) || (__DEV__ && DEV_PREVIEW && auth.guestMode);
  const [tick, setTick] = useState(0);

  // Analytics: on for signed-in accounts that haven't turned it off in Data & privacy.
  const analyticsOn = signedIn && !!auth.session && prefs.native.analytics;
  useEffect(() => {
    configureAnalytics(analyticsOn ? auth.client : null, analyticsOn);
    if (analyticsOn) track('app_opened');
  }, [analyticsOn, auth.client]);
  const [weather, setWeather] = useState<{ tripId: string; days: Record<string, DayWeather> } | null>(null);

  // Refresh time-based content when the app comes back and at least every 15 minutes while it is open.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') setTick((n) => n + 1); });
    const timer = setInterval(() => setTick((n) => n + 1), 15 * 60000);
    return () => { sub.remove(); clearInterval(timer); };
  }, []);

  // Forecast for the featured trip, for the widget.
  const featured = workspace ? featuredTrip(workspace.trips) : null;
  const featuredKey = featured ? `${featured.id}|${featured.destination}|${featured.start}|${featured.end}` : '';
  useEffect(() => {
    if (!featured || !signedIn) { setWeather(null); return; }
    let active = true;
    void tripWeather(featured.destination, featured.start, featured.end).then((days) => { if (active) setWeather({ tripId: featured.id, days }); }).catch(() => {});
    return () => { active = false; };
  }, [featuredKey, signedIn, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Widgets and the Live Activity. Signed out: an empty widget and no activity.
  useEffect(() => {
    const handle = setTimeout(() => {
      // Still loading (session, profile or trips): leave the widget and Live Activity as they are.
      // Only a real sign-out clears them; a launch must not flash them empty or end today's activity.
      if (auth.phase === 'loading') return;
      const preview = __DEV__ && DEV_PREVIEW;
      const hasAccount = !!auth.session || (preview && auth.guestMode);
      if (preview && !auth.session && !auth.guestMode) return;
      if (hasAccount && (!signedIn || !workspace)) return;
      if (!signedIn || !workspace) {
        publishWidgets([{ date: new Date(), props: { state: 'empty', name: 'No trip yet', place: '', headline: 'Sign in to Trips Loom', dateLabel: '', big: '+', bigLabel: 'sign in', progress: 0, packed: 0, packTotal: 0, plans: [], weather: '', weatherSymbol: '', url: 'tripsloom:///' } }]);
        void syncLiveActivity(null);
        return;
      }
      const lookup = (tripId: string, date: string) => {
        const d = weather?.tripId === tripId ? weather.days[date] : undefined;
        if (!d || d.typical) return null;
        const t = (c: number) => (prefs.unit === 'imperial' ? Math.round(c * 9 / 5 + 32) : Math.round(c));
        return { symbol: weatherSymbol(d.code), label: `${t(d.high)}° / ${t(d.low)}°` };
      };
      publishWidgets(nextTripTimeline(workspace, extras.get, new Date(), lookup));
      void syncLiveActivity(prefs.native.liveActivities ? tripDayProps(workspace, extras.get, prefs.unit, new Date()) : null);
    }, 800);
    return () => clearTimeout(handle);
  }, [signedIn, auth.phase, auth.session, auth.guestMode, workspace, extras.all, extras.get, weather, prefs.unit, prefs.native.liveActivities, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reminders.
  const day = fromDate(new Date());
  useEffect(() => {
    const handle = setTimeout(() => {
      if (auth.phase === 'loading') return;
      const hasAccount = !!auth.session || (__DEV__ && DEV_PREVIEW && auth.guestMode);
      if (hasAccount && (!signedIn || !workspace)) return; // still loading; keep what's scheduled
      if (!signedIn || !workspace) { void syncReminders([], extras.get, false); return; }
      void syncReminders(workspace.trips, extras.get, prefs.native.notifications);
    }, 1500);
    return () => clearTimeout(handle);
  }, [signedIn, auth.phase, auth.session, auth.guestMode, workspace, extras.all, prefs.native.notifications, day]); // eslint-disable-line react-hooks/exhaustive-deps

  // Widget and Live Activity links carry the trip; select it before the screen shows.
  const known = useRef(new Set<string>());
  useEffect(() => { known.current = new Set(workspace?.trips.map((t) => t.id) ?? []); }, [workspace]);
  useEffect(() => {
    const pick = (url: string | null) => { const id = tripFromUrl(url); if (id && known.current.has(id)) select(id); };
    void Linking.getInitialURL().then(pick);
    const sub = Linking.addEventListener('url', ({ url }) => pick(url));
    return () => sub.remove();
  }, [select, signedIn]);

  // An invite opened while signed out is kept and opened once the person has signed in and finished onboarding.
  const pendingInvite = useRef<string | null>(null);
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;
  useEffect(() => {
    const keep = (url: string | null) => {
      const d = url && /^[a-z][a-z0-9+.-]*:\/\/\/?join\?/i.test(url) ? Linking.parse(url).queryParams?.d : null;
      const code = url?.match(/\/t\/([A-Za-z0-9]{10,16})(?:[/?#]|$)/)?.[1];
      // Signed in, the link opens the join sheet directly.
      if (!signedInRef.current && typeof d === 'string' && d.length <= 4000) pendingInvite.current = `d:${d}`;
      if (!signedInRef.current && code) pendingInvite.current = `code:${code}`;
    };
    void Linking.getInitialURL().then(keep);
    const sub = Linking.addEventListener('url', ({ url }) => keep(url));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!signedIn || !pendingInvite.current) return;
    const pending = pendingInvite.current;
    pendingInvite.current = null;
    const params = pending.startsWith('code:') ? { code: pending.slice(5) } : { d: pending.slice(2) };
    const timer = setTimeout(() => router.push({ pathname: '/join-trip', params } as never), 600);
    return () => clearTimeout(timer);
  }, [signedIn, router]);

  // Tapping a reminder opens its screen for its trip.
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response || handled.current === response.notification.request.identifier) return;
      handled.current = response.notification.request.identifier;
      const data = response.notification.request.content.data as { url?: unknown; tripId?: unknown } | undefined;
      if (typeof data?.tripId === 'string' && known.current.has(data.tripId)) select(data.tripId);
      if (typeof data?.url === 'string' && SAFE_PATH.test(data.url)) {
        if (/^\/(trip|adventure)\b/.test(data.url)) openTrip(data.url);
        else router.push(data.url as never);
      }
    };
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [signedIn, router, select, openTrip]);

  return null;
}
