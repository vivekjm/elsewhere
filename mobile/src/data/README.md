# Trips Loom mobile data contract

`DataProvider` wraps authentication and the workspace. The app uses the existing Trips Loom Worker at `EXPO_PUBLIC_API_BASE_URL` (default: `https://tripsloom.com`) and fetches the public Supabase URL and publishable key from `/api/auth/config`. For staging or offline development, set both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

The Expo app has the `tripsloom` URL scheme. Add both `tripsloom://auth/callback` and `tripsloom://auth/reset` to Supabase Auth's redirect allowlist for email confirmation and password recovery. These links need an installed native development or release build; Expo Go does not provide a stable auth callback URL.

The Worker stores one validated version-1 workspace per owner. GET `/api/workspace` returns `{workspace,revision}`. PUT sends both fields, a Supabase Bearer token for accounts, and an `Origin` header equal to the Worker origin. The server rejects a stale revision with HTTP 409. Guest mode uses a device-local UUID in the `tripsloom_guest` cookie. Native cookie transport and private photo headers should be verified on both iOS and Android devices before release.

The workspace hook saves every validated edit to a SQLite cache scoped to the account or guest UUID, then serializes server writes. Network errors keep edits available offline. A 409 blocks further edits to protect the newer server copy; `exportPendingWorkspace()` returns a data-only backup accepted by the web restore flow, and `discardAndReload()` fetches the server copy before replacing it. A data-only backup does not transfer private wardrobe photo bytes to another owner. The cache contains trip details in the app sandbox; Supabase session tokens are stored separately in chunked Expo SecureStore values.

Wardrobe photos must be uploaded with `uploadWardrobePhoto(uri,mimeType)` before adding their returned `/api/images/<uuid>` path to an item. `photoSource(path)` adds private owner headers for React Native `Image`.
