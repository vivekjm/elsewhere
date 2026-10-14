/**
 * expo-router's router with a safe `back()`: a screen opened directly (from a reminder, widget or link) has
 * nothing beneath it, so going back goes Home instead of doing nothing.
 */
import { useMemo } from 'react';
import { useRouter as useExpoRouter } from 'expo-router';

/** Set while the app itself closes a screen (after Save or Delete), so an unsaved-changes guard lets it through. */
let intentional = 0;
export const closingOnPurpose = () => Date.now() - intentional < 800;

export function useRouter() {
  const router = useExpoRouter();
  return useMemo(() => ({
    ...router,
    back: () => { intentional = Date.now(); return router.canGoBack() ? router.back() : router.replace('/home' as never); },
  }), [router]);
}
