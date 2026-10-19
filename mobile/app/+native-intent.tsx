/**
 * Rewrites incoming system links before routing. Invite links (`https://tripsloom.com/t/<code>`, and the older
 * `tripsloom://join?d=…`) open the join sheet;
 * a path the app doesn't know goes Home instead of a dead end. Plain string parsing: this can run before
 * the URL polyfill loads.
 */
const KNOWN = /^\/(home|discover|shared|profile|trip(\/[a-z]+)?|adventure(\/[a-z]+)?|new-trip|planner|plan-mode|planning|plan|join-trip|altitude-check-in|search|recap|essentials|help|privacy|preferences|trail-map|flight)?$/;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  // "tripsloom://join?d=x" → "/join?d=x"; "tripsloom:///trip?trip=1" → "/trip?trip=1"; "/home" stays.
  const withoutScheme = path.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '/').replace(/^\/{2,}/, '/');
  const q = withoutScheme.search(/[?#]/);
  const route = (q >= 0 ? withoutScheme.slice(0, q) : withoutScheme).replace(/\/+$/, '') || '/';
  const query = q >= 0 && withoutScheme[q] === '?' ? withoutScheme.slice(q).split('#')[0] : '';
  if (route === '/join') return `/join-trip${query}`;
  // Something shared to the app (tripsloom://dataUrl=…): the share handler reads it and opens plan mode.
  if (route.startsWith('/dataUrl=')) return '/home';
  // A live trip link: https://tripsloom.com/t/<code> (universal link) or tripsloom://t/<code>.
  const live = route.match(/^\/t\/([A-Za-z0-9]{10,16})$/);
  if (live) return `/join-trip?code=${live[1]}`;
  // A trip template ("do it again"): https://tripsloom.com/r/<code> or tripsloom://r/<code>.
  const template = route.match(/^\/r\/([A-Za-z0-9]{10,16})$/);
  if (template) return `/use-template?code=${template[1]}`;
  // Sign-in and reset links are read by the auth layer; routing just needs a valid screen.
  if (route === '/auth/reset') return '/reset-password';
  if (route.startsWith('/auth/')) return '/';
  if (route === '/' || KNOWN.test(route)) return `${route}${query}`;
  return '/home';
}
