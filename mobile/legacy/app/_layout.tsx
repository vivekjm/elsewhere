import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, useFonts } from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import Storage from 'expo-sqlite/kv-store';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppButton, AppText, ThemeProvider, useTheme, type ThemePreferences } from '../src/design';
import { DataProvider, useAuth, useWorkspace } from '../src/data';
import { RouteBackground, SelectionProvider } from '../src/navigation';
import { AuthScreen, OnboardingScreen } from '../src/screens';

const PREFERENCES_KEY = 'tripsloom.appearance.v1';
void SplashScreen.preventAutoHideAsync().catch(() => { /* Already hidden in a fast refresh. */ });

function validPreferences(value: unknown): value is ThemePreferences {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return ['olive', 'coast', 'terracotta', 'lavender'].includes(String(candidate.palette)) &&
    ['system', 'light', 'dark'].includes(String(candidate.mode));
}

function FullScreenMessage({ title, message, action, onAction }: { title: string; message: string; action?: string; onAction?: () => void }) {
  const { spacing } = useTheme();
  return <RouteBackground><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg }}>
    <AppText variant="title" style={{ textAlign: 'center' }}>{title}</AppText>
    <AppText tone="muted" style={{ textAlign: 'center' }}>{message}</AppText>
    {action && onAction ? <AppButton label={action} onPress={onAction} /> : null}
  </View></RouteBackground>;
}

/** Shows sign-in, onboarding or loading states until a workspace is open, then the native navigators. */
function Gate({ onRetryAuth }: { onRetryAuth: () => void }) {
  const auth = useAuth();
  const state = useWorkspace();
  const { colors, fonts } = useTheme();
  if (auth.phase === 'loading') return <FullScreenMessage title="Trips Loom" message="Opening your journeys…" />;
  if ((auth.phase === 'error' && !auth.guestMode) || auth.recovery || (!auth.session && !auth.guestMode)) {
    return <RouteBackground><AuthScreen onRetry={onRetryAuth} /></RouteBackground>;
  }
  if (auth.session && auth.profileLoading && !auth.profile) return <FullScreenMessage title="Your travel profile" message="Getting your preferences ready…" />;
  if (auth.session && auth.profileError && !auth.profile) {
    return <FullScreenMessage title="Couldn’t load your profile" message={auth.profileError} action="Try again" onAction={() => { void auth.refreshProfile(); }} />;
  }
  if (auth.session && !auth.profile?.onboarding_completed) return <RouteBackground><OnboardingScreen /></RouteBackground>;
  if (!state.workspace) {
    if (state.status === 'loading') return <FullScreenMessage title="Your journeys" message="Opening your plans…" />;
    return <FullScreenMessage title="Couldn’t open your plans" message={state.error || 'Check your connection and try again.'} action="Try again" onAction={() => { void state.reload(); }} />;
  }
  return <SelectionProvider>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" options={{
        presentation: 'modal', headerShown: true, title: 'Profile',
        headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text }, headerTintColor: colors.primary,
        headerShadowVisible: false, headerStyle: { backgroundColor: colors.background },
      }} />
    </Stack>
  </SelectionProvider>;
}

function Frame() {
  const { mode } = useTheme();
  const [authEpoch, setAuthEpoch] = useState(0);
  return <>
    <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    <DataProvider key={authEpoch}><Gate onRetryAuth={() => setAuthEpoch((value) => value + 1)} /></DataProvider>
  </>;
}

export default function RootLayout() {
  const [preferences, setPreferences] = useState<ThemePreferences>({ palette: 'coast', mode: 'system' });
  const [fontsLoaded, fontError] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });
  const fontsReady = fontsLoaded || !!fontError; // On a font error, render with the platform sans.
  useEffect(() => { if (fontsReady) void SplashScreen.hideAsync().catch(() => {}); }, [fontsReady]);
  useEffect(() => {
    let mounted = true;
    void Storage.getItem(PREFERENCES_KEY).then((value) => {
      if (!mounted || !value) return;
      try { const parsed: unknown = JSON.parse(value); if (validPreferences(parsed)) setPreferences(parsed); } catch { /* Keep the default. */ }
    });
    return () => { mounted = false; };
  }, []);
  const savePreferences = (next: ThemePreferences) => { setPreferences(next); void Storage.setItem(PREFERENCES_KEY, JSON.stringify(next)); };
  if (!fontsReady) return null;
  return <SafeAreaProvider>
    <ThemeProvider palette={preferences.palette} mode={preferences.mode} onPreferencesChange={savePreferences}>
      <Frame />
    </ThemeProvider>
  </SafeAreaProvider>;
}
