# Shop Management

Offline-first shop and product management, built with React, TypeScript, Vite,
Refine, Ant Design, Supabase, and Dexie. Installable as a PWA.

## Getting started

```sh
bun install
cp .env.example .env.local   # set VITE_SUPABASE_URL + publishable key
bun run dev
```

Scripts:

- `bun run dev` — start the dev server.
- `bun run build` — typecheck, build, and generate the service worker + manifest.
- `bun run preview` — serve the production build (use this to test the PWA).
- `bun run lint` — oxlint.
- `bun run test:offline` — self-tests for the local query engine and select
  projection.

## Offline-first + PWA

- **Local-first reads/writes.** All product data (products, categories, uoms,
  product_uoms, product_prices, product_purchase_prices) is read from and
  written to IndexedDB through `src/data/refine/dataProvider.ts`. Refine pages
  never call Supabase directly.
- **Background sync.** `src/data/sync/sync.service.ts` drains a durable queue to
  Supabase (idempotent upserts/deletes) and pulls remote changes back. The header
  status tag shows pending/failed counts with a manual retry.
- **Installable PWA.** `vite-plugin-pwa` precaches the app shell (Workbox) and
  serves a `manifest.webmanifest`; the app opens offline after the first visit.
  Supabase requests are never cached.
- **User management is online-only** (the `admin-users` edge function is not
  queue-safe); product data keeps working offline.

Adding another offline-capable table only requires an entry in
`src/data/local/resources.ts` (plus its Supabase migration) — the repository,
query engine, and sync engine are all registry-driven.

See [`docs/offline-pwa-plan.md`](docs/offline-pwa-plan.md) for the design and
[`docs/shop-management-architecture.md`](docs/shop-management-architecture.md)
for the broader architecture.

## Tooling notes

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) uses
  [Oxc](https://oxc.rs).
- The React Compiler is not enabled.

To enable type-aware linting, install `oxlint-tsgolint` and set
`options.typeAware: true` in `.oxlintrc.json`.
