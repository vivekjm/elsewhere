# Elsewhere

Calendar-first trip planning: daily activities, wardrobe, reusable outfits, and connected packing. Built with React 19, TypeScript, Vinext and Cloudflare Workers through ChatGPT Sites.

## Development

Use Node.js 22.13+ (Node 24 recommended).

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

The app has no ChatGPT login or account requirement. Each visitor receives a random, HttpOnly, SameSite cookie. D1 holds that visitor’s workspace; R2 holds their wardrobe photos. Clearing cookies or moving to a different browser creates a new workspace. Export a JSON backup before clearing browser data. JSON backups include image references; image access remains restricted to the uploading browser’s visitor cookie. They do not transfer photo bytes between browsers.

The included Lisbon trip is sample data, copied independently for each visitor. No workspace is shared simply by sharing the public URL.

## Structure

- `app/page.tsx`: workspace navigation and trip workflows.
- `components/travel`: reusable visual primitives and the accessible editor.
- `hooks/use-workspace.ts`: durable loading, ordered autosaves, error recovery, conflict handling and unsaved-change protection.
- `lib/model.ts`: typed schema, domain validation, packing derivation and deletion cleanup.
- `lib/exports.ts`: JSON downloads, calendar and CSV exports.
- `app/api/workspace`: visitor-scoped state with optimistic revision checks.
- `app/api/images`: private image upload/retrieval with size and signature checks.
- `db/schema.ts` and `drizzle/`: versioned D1 schema and migration.
- `tests/`: domain regression tests and API smoke checks.

## Local storage setup

Build once to generate `dist/server/wrangler.json`, then apply the local migration:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_friendly_morlun.sql
```

Restart the development server if bindings changed. Hosted Sites provisioning applies production migrations and binds D1/R2 automatically.

With the development server running:

```sh
node tests/api-smoke.mjs
```

The smoke check creates disposable local workspaces and verifies save isolation, simultaneous save conflicts, invalid payload rejection, origin protection, and private image ownership.

## Behaviour

Trip date changes cannot silently discard scheduled activities: reschedule them first. Reused clothes appear only once in automatic packing. Manual essentials carry quantity and per-piece weight. Day outfits and activity outfits can differ. Calendar exports use floating local wall times because trips do not currently have timezone settings.

Autosaves serialize requests. Concurrent tabs receive a clear conflict instead of overwriting newer data. Export unsaved edits before reloading after a conflict. Restore validates the entire backup before replacing any state.

## Deployment

The Site identity and logical storage bindings live in `.openai/hosting.json`. Publish the Worker build and migrations through the Sites tools. Public access is managed in the Site access policy, separately from application storage. No authentication capability is enabled by this application.

For wider release, add operational retention controls and platform traffic limits appropriate to expected anonymous usage. This guest testing version intentionally has no cross-device account recovery or shared trip collaboration.
