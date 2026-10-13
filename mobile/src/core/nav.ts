/**
 * expo-router's router with a safe `back()`: a screen opened directly (from a reminder, widget or link) has
 * nothing beneath it, so going back goes Home instead of doing nothing.
 */
import { useMemo } from 'react';
import { useRouter as useExpoRouter } from 'expo-router';

export function useRouter() {
  const router = useExpoRouter();
  return useMemo(() => ({
    ...router,
    back: () => (router.canGoBack() ? router.back() : router.replace('/home' as never)),
  }), [router]);
}
