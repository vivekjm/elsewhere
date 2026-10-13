/** Dev-only: the route the app opens on after a reload, for checking a screen quickly. Empty in release. */
export const DEV_START_ROUTE: string = '';
/** Dev-only: render inside a smaller phone frame (iPhone SE is 375 × 667) to check layouts. Null in release. */
export const DEV_FRAME: { width: number; height: number } | null = null;
/** Dev-only: open the signed-in app on a local workspace that never touches the server, to check screens without an account. False in release. */
export const DEV_PREVIEW: boolean = false;
