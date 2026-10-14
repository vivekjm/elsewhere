/**
 * Rewrites incoming system links before routing. Invite links (`tripsloom://join?d=…`) open the join sheet;
 * a path the app doesn't know goes Home instead of a dead end. Plain string parsing: this can run before
 * the URL polyfill loads.
 */
const KNOWN = /^\/(home|discover|shared|profile|trip(\/[a-z]+)?|adventure(\/[a-z]+)?|new-trip|planner|join-trip|altitude-check-in|search|recap|essentials|help|privacy|preferences|trail-map|flight)?$/;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  // "tripsloom://join?d=x" → "/join?d=x"; "tripsloom:///trip?trip=1" → "/trip?trip=1"; "/home" stays.
  const withoutScheme = path.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '/').replace(/^\/{2,}/, '/');
  const q = withoutScheme.search(/[?#]/);
  const route = (q >= 0 ? withoutScheme.slice(0, q) : withoutScheme).replace(/\/+$/, '') || '/';
  const query = q >= 0 && withoutScheme[q] === '?' ? withoutScheme.slice(q).split('#')[0] : '';
  if (route === '/join') return `/join-trip${query}`;
  // Sign-in and reset links are read by the auth layer; routing just needs a valid screen.
  if (route === '/auth/reset') return '/reset-password';
  if (route.startsWith('/auth/')) return '/';
  if (route === '/' || KNOWN.test(route)) return `${route}${query}`;
  return '/home';
}
