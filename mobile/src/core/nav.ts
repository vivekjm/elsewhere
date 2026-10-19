/**
 * expo-router's router with a safe `back()`: a screen opened directly (from a reminder, widget or link) has
 * nothing beneath it, so going back goes Home instead of doing nothing.
 */
import { useCallback, useMemo } from 'react';
import { useNavigationContainerRef, useRouter as useExpoRouter } from 'expo-router';
import { StackActions } from 'expo-router/react-navigation';

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

/** Long enough for iOS to finish dismissing a sheet: a page pushed sooner lands inside the closing sheet. */
const SHEET_CLOSE_MS = 450;

/**
 * Opens a trip's page (`/trip…` or `/adventure…`). There's only ever one such page, right above Home: if it's
 * already open this just switches its tab; otherwise everything above Home (sheets, plan mode, another trip) is
 * closed first, and the page is pushed once they've gone. Pushing a page while a sheet is still up puts it inside
 * that sheet, and closing that pile later leaves a stale sheet on screen; Back from a trip always lands on Home.
 * `then`: a sheet to open over the page once it's in (the invite after creating a group trip).
 */
export function useOpenTripPage() {
  const router = useExpoRouter();
  const container = useNavigationContainerRef();
  return useCallback((path: string, then?: string) => {
    const page = path.split(/[/?]/)[1];
    // The app's stack sits inside expo-router's single `__root` route: find the level that holds the tabs.
    type Nav = { key: string; index?: number; routes: { name: string; state?: Nav }[] };
    let stack = (container.isReady() ? container.getRootState() : undefined) as Nav | undefined;
    while (stack && !stack.routes.some((r) => r.name === '(tabs)') && stack.routes.length === 1 && stack.routes[0].state) stack = stack.routes[0].state;
    const top = stack?.routes[stack.index ?? stack.routes.length - 1]?.name;
    const after = () => { if (then) setTimeout(() => router.push(then as never), SHEET_CLOSE_MS + 150); };
    if (top === page) { router.navigate(path as never); after(); return; }
    if (stack && stack.routes.length > 1) {
      container.dispatch({ ...StackActions.popToTop(), target: stack.key });
      setTimeout(() => { router.push(path as never); after(); }, SHEET_CLOSE_MS);
      return;
    }
    router.push(path as never);
    after();
  }, [router, container]);
}
