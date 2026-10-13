import 'react-native-url-polyfill/auto';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as Localization from 'expo-localization';
import * as WebBrowser from 'expo-web-browser';
import Storage from 'expo-sqlite/kv-store';
import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import { API_BASE_URL, apiFetch, responseJson } from './backend';
import { uid } from './model';
import { secureSessionStorage } from './secure-session';

/** App-only preferences, stored in `profiles.native_preferences` (an object of at most 4 KB). */
export type NativePreferences = {
  intent: 'booked' | 'shaping' | 'looking';
  focus: string[];
  currency: string;
  notifications: boolean;
  /** Trip-day Live Activity on the Lock Screen and Dynamic Island (iOS). */
  liveActivities: boolean;
  lockDocuments: boolean;
  tripTimeZone: boolean;
  aiDraftMonth: string;
  aiDraftCount: number;
};
export const defaultNativePreferences = (): NativePreferences => ({
  intent: 'shaping', focus: ['outfits', 'budget', 'friends'], currency: Localization.getLocales()[0]?.currencyCode ?? 'EUR',
  notifications: true, liveActivities: true, lockDocuments: false, tripTimeZone: true, aiDraftMonth: '', aiDraftCount: 0,
});
export function parseNativePreferences(value: unknown): NativePreferences {
  const base = defaultNativePreferences();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  const v = value as Record<string, unknown>;
  return {
    intent: v.intent === 'booked' || v.intent === 'looking' || v.intent === 'shaping' ? v.intent : base.intent,
    focus: Array.isArray(v.focus) ? v.focus.filter((x): x is string => typeof x === 'string').slice(0, 12).map((x) => x.slice(0, 40)) : base.focus,
    currency: typeof v.currency === 'string' && /^[A-Z]{3}$/.test(v.currency) ? v.currency : base.currency,
    notifications: typeof v.notifications === 'boolean' ? v.notifications : base.notifications,
    liveActivities: typeof v.liveActivities === 'boolean' ? v.liveActivities : base.liveActivities,
    lockDocuments: typeof v.lockDocuments === 'boolean' ? v.lockDocuments : base.lockDocuments,
    tripTimeZone: typeof v.tripTimeZone === 'boolean' ? v.tripTimeZone : base.tripTimeZone,
    aiDraftMonth: typeof v.aiDraftMonth === 'string' ? v.aiDraftMonth.slice(0, 7) : '',
    aiDraftCount: typeof v.aiDraftCount === 'number' && Number.isFinite(v.aiDraftCount) ? Math.max(0, Math.round(v.aiDraftCount)) : 0,
  };
}

export type AuthProfile = {
  id: string;
  display_name: string;
  home_base: string;
  travel_style: string;
  interests: string[];
  packing_style: string;
  unit: 'metric' | 'imperial';
  onboarding_completed: boolean;
  native_preferences: NativePreferences;
};
export type OnboardingInput = Pick<AuthProfile, 'display_name' | 'home_base' | 'unit'> & { native: Partial<NativePreferences> };
export type ProfilePatch = Partial<Pick<AuthProfile, 'display_name' | 'home_base' | 'travel_style' | 'unit'>> & { native?: Partial<NativePreferences> };
export type FeedbackKind = 'issue' | 'idea' | 'question';
export type AuthPhase = 'loading' | 'ready' | 'unconfigured' | 'error';
export type SupabaseConfig = { url: string; publishableKey: string };
export type AuthContextValue = {
  phase: AuthPhase;
  client: SupabaseClient | null;
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  profileLoading: boolean;
  profileError: string;
  recovery: boolean;
  guestMode: boolean;
  enterGuestMode: () => void;
  leaveGuestMode: () => void;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsEmailConfirmation: boolean }>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  signInWithApple: () => Promise<'signed-in' | 'cancelled'>;
  signInWithGoogle: () => Promise<'signed-in' | 'cancelled'>;
  appleAvailable: boolean;
  sendFeedback: (kind: FeedbackKind, message: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const PROFILE_COLUMNS = 'id,display_name,home_base,travel_style,interests,packing_style,unit,onboarding_completed,native_preferences';
const CONFIG_KEY = `tripsloom.supabase.config.v1.${API_BASE_URL}`;
const profileKey = (id: string) => `tripsloom.profile.${id}`;

/** Accepts a profile row (or a cached copy) and normalises its app preferences. */
function asProfile(value: unknown): AuthProfile | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  const ok = typeof p.id === 'string' && typeof p.display_name === 'string' &&
    typeof p.home_base === 'string' && typeof p.travel_style === 'string' &&
    Array.isArray(p.interests) && p.interests.every((v) => typeof v === 'string') &&
    typeof p.packing_style === 'string' && (p.unit === 'metric' || p.unit === 'imperial') &&
    typeof p.onboarding_completed === 'boolean';
  return ok ? { ...(p as unknown as AuthProfile), native_preferences: parseNativePreferences(p.native_preferences) } : null;
}
function isConfig(value: unknown): value is SupabaseConfig {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  // HTTPS only, except a backend running on this computer during development (local Supabase).
  const local = __DEV__ && typeof v.url === 'string' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(v.url);
  return typeof v.url === 'string' && (/^https:\/\//.test(v.url) || local) &&
    typeof v.publishableKey === 'string' && v.publishableKey.length > 0;
}
function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message.replace(/^AuthApiError:\s*/i, '').trim() : fallback;
}

async function loadConfig(): Promise<SupabaseConfig | null> {
  const configured = {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
  };
  if (isConfig(configured)) return configured;
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/config`, { headers: { Accept: 'application/json' } });
    const data = await response.json() as Record<string, unknown>;
    const config = { url: data.url, publishableKey: data.publishableKey };
    if (response.ok && data.configured === true && isConfig(config)) {
      await Storage.setItem(CONFIG_KEY, JSON.stringify(config));
      return config;
    }
  } catch { /* Offline startup can use a previously verified public config. */ }
  try {
    const cached = await Storage.getItem(CONFIG_KEY);
    const config = cached ? JSON.parse(cached) as unknown : null;
    return isConfig(config) ? config : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AuthPhase>('loading');
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const profileRequest = useRef(0);

  const loadProfile = useCallback(async (auth: SupabaseClient, user: User | null) => {
    const request = ++profileRequest.current;
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      setProfileError('');
      return;
    }
    setProfileLoading(true);
    setProfileError('');
    const { data, error } = await auth.from('profiles').select(PROFILE_COLUMNS).eq('id', user.id).maybeSingle();
    if (request !== profileRequest.current) return;
    const fresh = error ? null : asProfile(data);
    if (fresh && fresh.id === user.id) {
      setProfile(fresh);
      await Storage.setItem(profileKey(user.id), JSON.stringify(fresh)).catch(() => {});
    } else {
      let cached: unknown = null;
      try { const raw = await Storage.getItem(profileKey(user.id)); cached = raw ? JSON.parse(raw) : null; } catch { /* Invalid cache is ignored. */ }
      if (request !== profileRequest.current) return;
      const saved = asProfile(cached);
      setProfile(saved && saved.id === user.id ? saved : null);
      setProfileError(error ? 'Your preferences could not be refreshed. Showing saved preferences when available.' : 'Your preferences are unavailable.');
    }
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    let auth: SupabaseClient | null = null;
    let subscription: { unsubscribe: () => void } | null = null;
    let linkSubscription: { remove: () => void } | null = null;
    let appSubscription: { remove: () => void } | null = null;
    const seenLinks = new Set<string>();
    const handleLink = async (url: string) => {
      if (!auth || seenLinks.has(url) || !url.includes('auth/')) return;
      seenLinks.add(url);
      try {
        const parsed = new URL(url);
        const params = parsed.searchParams;
        const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const code = params.get('code');
        const accessToken = fragment.get('access_token') || params.get('access_token');
        const refreshToken = fragment.get('refresh_token') || params.get('refresh_token');
        const isRecovery = url.includes('auth/reset') || params.get('type') === 'recovery' || fragment.get('type') === 'recovery';
        if (code) {
          const { error } = await auth.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await auth.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        }
        if (active && isRecovery) setRecovery(true);
      } catch {
        if (active) setPhase('error');
      }
    };
    const start = async () => {
      const config = await loadConfig();
      if (!active) return;
      if (!config) { setPhase('unconfigured'); return; }
      auth = createClient(config.url, config.publishableKey, {
        auth: {
          storage: secureSessionStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      });
      setClient(auth);
      const authClient = auth;
      const { data: listener } = authClient.auth.onAuthStateChange((event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        if (event === 'PASSWORD_RECOVERY') setRecovery(true);
        setTimeout(() => { if (active) void loadProfile(authClient, nextSession?.user || null); }, 0);
      });
      subscription = listener.subscription;
      const { data, error } = await authClient.auth.getSession();
      if (!active) return;
      if (error) { setPhase('error'); return; }
      setSession(data.session);
      setPhase('ready');
      await loadProfile(authClient, data.session?.user || null);
      linkSubscription = Linking.addEventListener('url', ({ url }) => { void handleLink(url); });
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) void handleLink(initialUrl);
      appSubscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') { authClient.auth.startAutoRefresh(); }
        else { authClient.auth.stopAutoRefresh(); }
      });
      if (AppState.currentState === 'active') authClient.auth.startAutoRefresh();
    };
    void start();
    return () => {
      active = false;
      subscription?.unsubscribe();
      linkSubscription?.remove();
      appSubscription?.remove();
      auth?.auth.stopAutoRefresh();
    };
  }, [loadProfile]);

  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => { void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false)); }, []);

  /** Upserts profile fields and merges app preferences into `native_preferences`. */
  const saveProfile = useCallback(async (patch: ProfilePatch, onboardingCompleted?: boolean) => {
    if (!client || !session?.user) throw new Error('Please sign in again before saving preferences.');
    const native = { ...(profile?.native_preferences ?? defaultNativePreferences()), ...(patch.native ?? {}) };
    const row: Record<string, unknown> = { id: session.user.id, native_preferences: native };
    for (const key of ['display_name', 'home_base', 'travel_style', 'unit'] as const) {
      if (patch[key] !== undefined) row[key] = typeof patch[key] === 'string' ? (patch[key] as string).trim().slice(0, 80) : patch[key];
    }
    if (onboardingCompleted) row.onboarding_completed = true;
    const { data, error } = await client.from('profiles').upsert(row, { onConflict: 'id' }).select(PROFILE_COLUMNS).single();
    const saved = error ? null : asProfile(data);
    if (!saved) throw new Error(message(error, 'Could not save your preferences.'));
    setProfile(saved);
    await Storage.setItem(profileKey(session.user.id), JSON.stringify(saved)).catch(() => {});
  }, [client, session, profile]);

  const value = useMemo<AuthContextValue>(() => ({
    phase, client, session, user: session?.user || null, profile, profileLoading, profileError,
    recovery, guestMode,
    enterGuestMode: () => setGuestMode(true),
    leaveGuestMode: () => setGuestMode(false),
    refreshProfile: async () => { if (client && session?.user) await loadProfile(client, session.user); },
    signIn: async (email, password) => {
      if (!client) throw new Error('Sign-in is unavailable.');
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(message(error, 'Could not sign in.'));
      setGuestMode(false);
    },
    signUp: async (email, password, displayName) => {
      if (!client) throw new Error('Sign-up is unavailable.');
      const { data, error } = await client.auth.signUp({
        email: email.trim(), password,
        options: { data: { display_name: displayName.trim() }, emailRedirectTo: Linking.createURL('auth/callback') },
      });
      if (error) throw new Error(message(error, 'Could not create your account.'));
      setGuestMode(false);
      return { needsEmailConfirmation: !data.session };
    },
    sendPasswordReset: async (email) => {
      if (!client) throw new Error('Password reset is unavailable.');
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: Linking.createURL('auth/reset') });
      if (error) throw new Error(message(error, 'Could not send a reset link.'));
    },
    updatePassword: async (password) => {
      if (!client) throw new Error('Password reset is unavailable.');
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error(message(error, 'Could not update your password.'));
      setRecovery(false);
    },
    completeOnboarding: async (input) => {
      await saveProfile({ display_name: input.display_name, home_base: input.home_base, unit: input.unit, native: input.native }, true);
      if (client) await client.auth.updateUser({ data: { display_name: input.display_name } }).catch(() => {});
    },
    updateProfile: async (patch) => { await saveProfile(patch, undefined); },
    appleAvailable,
    signInWithApple: async () => {
      if (!client) throw new Error('Sign-in is unavailable. Check your connection and try again.');
      const rawNonce = uid();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      let credential: AppleAuthentication.AppleAuthenticationCredential;
      try {
        credential = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
          nonce: hashedNonce,
        });
      } catch (error) {
        if ((error as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return 'cancelled';
        throw new Error('Apple sign-in did not complete. Please try again.');
      }
      if (!credential.identityToken) throw new Error('Apple did not return a sign-in token. Please try again.');
      const { error } = await client.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
      if (error) throw new Error(message(error, 'Could not sign in with Apple.'));
      // Apple shares the name only on the first sign-in; keep it for the profile.
      const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ').trim();
      if (name) await client.auth.updateUser({ data: { display_name: name } }).catch(() => {});
      setGuestMode(false);
      return 'signed-in';
    },
    signInWithGoogle: async () => {
      if (!client) throw new Error('Sign-in is unavailable. Check your connection and try again.');
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
      if (error || !data.url) throw new Error(message(error, 'Could not start Google sign-in.'));
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return 'cancelled';
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      const failure = url.searchParams.get('error_description') || new URLSearchParams(url.hash.replace(/^#/, '')).get('error_description');
      if (failure) throw new Error(failure);
      if (!code) throw new Error('Google sign-in did not complete. Please try again.');
      const exchange = await client.auth.exchangeCodeForSession(code);
      if (exchange.error) throw new Error(message(exchange.error, 'Could not sign in with Google.'));
      setGuestMode(false);
      return 'signed-in';
    },
    sendFeedback: async (kind, text) => {
      const body = text.trim();
      if (body.length < 10 || body.length > 4000) throw new Error('Write between 10 and 4,000 characters.');
      if (!client || !session?.user) throw new Error('Sign in again to send feedback.');
      const { error } = await client.from('feedback').insert({
        id: uid(), user_id: session.user.id, kind, message: body,
        app_version: `${Application.nativeApplicationVersion ?? '1.0'} (${Application.nativeBuildVersion ?? '1'})`,
        locale: Localization.getLocales()[0]?.languageTag ?? 'en',
      });
      if (error) throw new Error(message(error, 'Could not send your message.'));
    },
    deleteAccount: async () => {
      if (!client || !session) throw new Error('Sign in again before deleting your account.');
      const response = await apiFetch('/api/account', session.access_token, { method: 'DELETE' });
      await responseJson(response);
      await client.auth.signOut({ scope: 'local' }).catch(() => {});
      if (session.user) await Storage.removeItem(profileKey(session.user.id)).catch(() => {});
      setGuestMode(false);
      setProfile(null);
    },
    signOut: async () => {
      if (client) {
        const { error } = await client.auth.signOut();
        // Offline sign-out still ends the session on this device.
        if (error) await client.auth.signOut({ scope: 'local' }).catch(() => {});
      }
      setGuestMode(false);
      setProfile(null);
    },
  }), [phase, client, session, profile, profileLoading, profileError, recovery, guestMode, loadProfile, saveProfile, appleAvailable]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside DataProvider.');
  return context;
}
