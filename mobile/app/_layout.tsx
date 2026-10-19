import React, { useEffect } from 'react';
import { Outfit_200ExtraLight, Outfit_300Light, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, useFonts } from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaFrameContext, SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary as AppErrorBoundary } from '../src/core/ErrorBoundary';
import { SelectionProvider } from '../src/core/state';
import { ExpandProvider } from '../src/core/expand';
import { AppServices } from '../src/core/AppServices';
import { ShareInbox } from '../src/core/shareInbox';
import { ShareIntentProvider } from 'expo-share-intent';
import { LiveProvider } from '../src/core/live';
import { ProProvider } from '../src/core/pro';
import { DataProvider, useAuth } from '../src/data';
import { DEV_FRAME, DEV_PREVIEW } from '../src/devStart';
import { Button, colors, Loading, T } from '../src/loom';

void SplashScreen.preventAutoHideAsync().catch(() => { /* Already hidden in a fast refresh. */ });
// The window behind every screen. iOS shows it for a frame at the start of a zoom transition and in sheet
// corners; left at its default it flashed black.
void SystemUI.setBackgroundColorAsync(colors.ground).catch(() => {});

export { AppErrorBoundary as ErrorBoundary };

/** Sheets that slide up over the current screen. Each add/edit flow is a sheet; `?id=` edits an existing record. */
const SHEETS = [
  'join-trip', 'add-plan', 'add-expense', 'edit-trip', 'altitude-check-in', 'add-item', 'add-piece', 'add-document', 'people',
  'start-vote', 'date-poll', 'ready', 'kitty', 'trip-pass', 'shortlist-add', 'shortlist-plan', 'use-template', 'settle-up', 'log-dive', 'add-stage', 'add-gear', 'safety-details', 'feedback', 'invite', 'trip-actions', 'day', 'pack-suggest',
];
/** Whole flows (a new trip, planning with AI): full screen, sliding up, rather than a card over the screen below. */
const FLOWS = ['new-trip', 'planner', 'planner-draft', 'import-bookings', 'plan-mode'];
/** Full screens pushed over the tabs. */
const PAGES = ['search', 'recap', 'trail-map', 'preferences', 'help', 'privacy', 'essentials', 'flight', 'plan'];

const expandedOptions = ({ route }: { route: { params?: object } }) =>
  ((route.params as { via?: string } | undefined)?.via === 'expand' ? { animation: 'none' as const } : {});

function Splash() {
  return <Loading label="Opening Trips Loom…" />;
}

function Unavailable({ retry }: { retry: () => void }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: colors.canvas }}>
    <T v="title" center>Can’t reach Trips Loom</T>
    <T v="body" center>Check your connection, then try again. Your saved trips stay on this phone.</T>
    <Button label="Try again" icon="refresh" onPress={retry} full={false} />
  </View>;
}

function Navigator() {
  const auth = useAuth();
  const [, setRetry] = React.useState(0);
  const preview = __DEV__ && DEV_PREVIEW;
  useEffect(() => { if (preview && auth.phase === 'ready' && !auth.session && !auth.guestMode) auth.enterGuestMode(); }, [preview, auth]);
  if (auth.phase === 'loading' || (auth.session && auth.profileLoading && !auth.profile)) return <Splash />;
  if (auth.phase === 'unconfigured' || (auth.phase === 'error' && !auth.session)) return <Unavailable retry={() => setRetry((n) => n + 1)} />;
  const local = preview && auth.guestMode && !auth.session;
  const signedIn = !!auth.session || local;
  // A password-reset link shows only the reset screen until the new password is saved.
  const recovering = signedIn && auth.recovery;
  const onboarded = local || (signedIn && !recovering && !!auth.profile?.onboarding_completed);
  return <>{onboarded ? <ShareInbox /> : null}<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
    <Stack.Protected guard={!signedIn}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="email-sign-in" />
    </Stack.Protected>
    <Stack.Protected guard={recovering}>
      <Stack.Screen name="reset-password" options={{ presentation: 'modal' }} />
    </Stack.Protected>
    <Stack.Protected guard={signedIn && !local && !recovering && !auth.profile?.onboarding_completed}>
      <Stack.Screen name="onboarding/[step]" />
    </Stack.Protected>
    <Stack.Protected guard={onboarded}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      {/* Opened by a growing card (src/core/expand.tsx): the card already covers the screen, so the page fades in. */}
      <Stack.Screen name="trip" options={expandedOptions} />
      <Stack.Screen name="adventure" options={expandedOptions} />
      {PAGES.map((name) => <Stack.Screen key={name} name={name} options={name === 'recap' ? expandedOptions : undefined} />)}
      {SHEETS.map((name) => <Stack.Screen key={name} name={name} options={{ presentation: 'modal' }} />)}
      {FLOWS.map((name) => <Stack.Screen key={name} name={name} options={{ presentation: 'fullScreenModal' }} />)}
      <Stack.Screen name="paywall" options={{ presentation: 'fullScreenModal' }} />
    </Stack.Protected>
  </Stack></>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ Outfit_200ExtraLight, Outfit_300Light, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold });
  const ready = loaded || !!error; // On a font error, render with the platform sans.
  useEffect(() => { if (ready) void SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;
  const frame = __DEV__ ? DEV_FRAME : null;
  // A smaller phone frame for layout checks: SE-sized, with an SE's 20pt status bar and no home indicator.
  const Provider = frame ? React.Fragment : SafeAreaProvider;
  const app = <Provider>
    <StatusBar style="light" />
    {/* Reels shared from Instagram, YouTube or TikTok arrive here (an iOS share extension, an Android share target). */}
    <ShareIntentProvider options={{ resetOnBackground: false }}>
    <DataProvider>
      <ProProvider>
        <SelectionProvider>
          <LiveProvider>
            <AppServices />
            <ExpandProvider><Navigator /></ExpandProvider>
          </LiveProvider>
        </SelectionProvider>
      </ProProvider>
    </DataProvider>
    </ShareIntentProvider>
  </Provider>;
  if (!frame) return app;
  return <View style={{ flex: 1, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: frame.width, height: frame.height, overflow: 'hidden' }}>
      <SafeAreaProvider>
        <SafeAreaInsetsContext.Provider value={{ top: 20, left: 0, right: 0, bottom: 0 }}>
          <SafeAreaFrameContext.Provider value={{ x: 0, y: 0, ...frame }}>{app}</SafeAreaFrameContext.Provider>
        </SafeAreaInsetsContext.Provider>
      </SafeAreaProvider>
    </View>
  </View>;
}
