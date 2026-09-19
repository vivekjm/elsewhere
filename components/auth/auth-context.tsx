"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  createBrowserSupabase,
  localSupabaseConfig,
  type SupabaseConfig,
} from "@/lib/supabase";

export const TRAVEL_STYLES = [
  {
    value: "slow and scenic",
    label: "Slow and scenic",
    detail: "Long walks, quiet corners, and room to wander.",
  },
  {
    value: "city weekends",
    label: "City weekends",
    detail: "A good neighbourhood, a full day, and no wasted time.",
  },
  {
    value: "food and culture",
    label: "Food and culture",
    detail: "Markets, museums, local tables, and stories to bring home.",
  },
  {
    value: "outdoors and open air",
    label: "Outdoors and open air",
    detail: "Fresh air, scenic routes, and a little healthy effort.",
  },
  {
    value: "a little of everything",
    label: "A little of everything",
    detail: "The best parts of a place, at a pace that feels like yours.",
  },
] as const;

export const INTERESTS = [
  "Food and drink",
  "Architecture",
  "Nature",
  "Art and design",
  "Local life",
  "Rest and slow mornings",
] as const;

export const PACKING_STYLES = [
  {
    value: "light and considered",
    label: "Light and considered",
    detail: "Fewer pieces, more combinations.",
  },
  {
    value: "ready for anything",
    label: "Ready for anything",
    detail: "A thoughtful safety net for changing plans.",
  },
  {
    value: "comfort first",
    label: "Comfort first",
    detail: "The right layers and familiar favourites.",
  },
] as const;

export type AuthProfile = {
  id: string;
  display_name: string;
  home_base: string;
  travel_style: string;
  interests: string[];
  packing_style: string;
  unit: "metric" | "imperial";
  onboarding_completed: boolean;
};

export type OnboardingInput = Omit<
  AuthProfile,
  "id" | "onboarding_completed"
>;

type AuthPhase = "loading" | "ready" | "unconfigured" | "error";
type AuthMode = "sign-in" | "sign-up" | "forgot" | "recover";

type AuthContextValue = {
  phase: AuthPhase;
  config: SupabaseConfig | null;
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
  signUp: (email: string, password: string, displayName: string) => Promise<{
    needsEmailConfirmation: boolean;
  }>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function message(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) return fallback;
  return error.message
    .replace(/^AuthApiError:\s*/i, "")
    .replace(/\.$/, "")
    .trim();
}

function isProfile(value: unknown): value is AuthProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.display_name === "string" &&
    typeof p.home_base === "string" &&
    typeof p.travel_style === "string" &&
    Array.isArray(p.interests) &&
    p.interests.every((v) => typeof v === "string") &&
    typeof p.packing_style === "string" &&
    (p.unit === "metric" || p.unit === "imperial") &&
    typeof p.onboarding_completed === "boolean"
  );
}

async function requestConfig(): Promise<SupabaseConfig | null> {
  const local = localSupabaseConfig();
  if (local) return local;
  try {
    const response = await fetch("/api/auth/config", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const result = (await response.json()) as {
      configured?: boolean;
      url?: unknown;
      publishableKey?: unknown;
    };
    return result.configured &&
      typeof result.url === "string" &&
      typeof result.publishableKey === "string"
      ? { url: result.url, publishableKey: result.publishableKey }
      : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AuthPhase>("loading"),
    [config, setConfig] = useState<SupabaseConfig | null>(null),
    [client, setClient] = useState<SupabaseClient | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<AuthProfile | null>(null),
    [profileLoading, setProfileLoading] = useState(false),
    [profileError, setProfileError] = useState(""),
    [recovery, setRecovery] = useState(false),
    [guestMode, setGuestMode] = useState(false);
  const profileRequest = useRef(0);

  const loadProfile = useCallback(
    async (nextClient: SupabaseClient, nextUser: User | null) => {
      const request = ++profileRequest.current;
      if (!nextUser) {
        setProfile(null);
        setProfileError("");
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      setProfileError("");
      const { data, error } = await nextClient
        .from("profiles")
        .select(
          "id,display_name,home_base,travel_style,interests,packing_style,unit,onboarding_completed",
        )
        .eq("id", nextUser.id)
        .maybeSingle();
      if (request !== profileRequest.current) return;
      if (error) {
        setProfile(null);
        setProfileError(
          "Your account is connected, but your preferences could not be loaded yet.",
        );
      } else if (isProfile(data)) {
        setProfile(data);
      } else {
        setProfile(null);
      }
      setProfileLoading(false);
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;
    const start = async () => {
      const nextConfig = await requestConfig();
      if (!mounted) return;
      if (!nextConfig) {
        setPhase("unconfigured");
        return;
      }
      const nextClient = createBrowserSupabase(nextConfig);
      setConfig(nextConfig);
      setClient(nextClient);
      const [{ data, error }, authState] = await Promise.all([
        nextClient.auth.getSession(),
        Promise.resolve(nextClient.auth.onAuthStateChange((event, nextSession) => {
          if (!mounted) return;
          setSession(nextSession);
          if (event === "PASSWORD_RECOVERY") setRecovery(true);
          if (!nextSession) {
            setProfile(null);
            setProfileLoading(false);
          } else {
            window.setTimeout(() => {
              if (mounted) void loadProfile(nextClient, nextSession.user);
            }, 0);
          }
        })),
      ]);
      subscription = authState.data.subscription;
      if (!mounted) {
        subscription.unsubscribe();
        return;
      }
      if (error) setPhase("error");
      else {
        setSession(data.session);
        setPhase("ready");
        await loadProfile(nextClient, data.session?.user || null);
      }
    };
    void start();
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      phase,
      config,
      client,
      session,
      user: session?.user || null,
      profile,
      profileLoading,
      profileError,
      recovery,
      guestMode,
      enterGuestMode: () => setGuestMode(true),
      leaveGuestMode: () => setGuestMode(false),
      refreshProfile: async () => {
        if (!client || !session?.user) return;
        await loadProfile(client, session.user);
      },
      signIn: async (email, password) => {
        if (!client) throw new Error("Sign-in is not available yet.");
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(message(error, "Could not sign in."));
        setGuestMode(false);
      },
      signUp: async (email, password, displayName) => {
        if (!client) throw new Error("Sign-up is not available yet.");
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: `${window.location.origin}/?auth=callback`,
          },
        });
        if (error) throw new Error(message(error, "Could not create your account."));
        setGuestMode(false);
        return { needsEmailConfirmation: !data.session };
      },
      sendPasswordReset: async (email) => {
        if (!client) throw new Error("Password reset is not available yet.");
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/?auth=reset`,
        });
        if (error) throw new Error(message(error, "Could not send a reset link."));
      },
      updatePassword: async (password) => {
        if (!client) throw new Error("Password reset is not available yet.");
        const { error } = await client.auth.updateUser({ password });
        if (error) throw new Error(message(error, "Could not update your password."));
        setRecovery(false);
      },
      completeOnboarding: async (input) => {
        if (!client || !session?.user)
          throw new Error("Please sign in again before saving preferences.");
        const { data, error } = await client
          .from("profiles")
          .upsert(
            {
              id: session.user.id,
              ...input,
              onboarding_completed: true,
            },
            { onConflict: "id" },
          )
          .select(
            "id,display_name,home_base,travel_style,interests,packing_style,unit,onboarding_completed",
          )
          .single();
        if (error || !isProfile(data))
          throw new Error(
            error
              ? message(error, "Could not save your preferences.")
              : "Could not read your saved preferences.",
          );
        await client.auth.updateUser({
          data: { display_name: input.display_name },
        });
        setProfile(data);
      },
      signOut: async () => {
        if (client) {
          const { error } = await client.auth.signOut();
          if (error) throw new Error(message(error, "Could not sign out."));
        }
        setGuestMode(false);
        setProfile(null);
      },
    }),
    [
      phase,
      config,
      client,
      session,
      profile,
      profileLoading,
      profileError,
      recovery,
      guestMode,
      loadProfile,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function useAuthToken() {
  return useAuth().session?.access_token || null;
}

export type { AuthMode };
