import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

type PublicImportMeta = ImportMeta & {
  env?: Record<string, string | undefined>;
};

/** Local preview can use Vite variables; production reads the same values from /api/auth/config. */
export function localSupabaseConfig(): SupabaseConfig | null {
  const values = (import.meta as PublicImportMeta).env || {},
    url = (values.VITE_SUPABASE_URL || values.NEXT_PUBLIC_SUPABASE_URL || "")
      .trim()
      .replace(/\/$/, ""),
    publishableKey = (
      values.VITE_SUPABASE_PUBLISHABLE_KEY ||
      values.VITE_SUPABASE_ANON_KEY ||
      values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      values.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ""
    ).trim();
  return url && publishableKey ? { url, publishableKey } : null;
}

export function createBrowserSupabase(
  config: SupabaseConfig,
): SupabaseClient {
  return createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
}
