# Offline-First + PWA Implementation Plan

Status: **implemented** (Phases A–C; Phase D validation ongoing).
This doc is both the plan and the implementation record.

## 1. Goal

Make the shop-management app:

1. **Offline-first** — the UI reads and writes local data (IndexedDB) first, and a
   sync engine reconciles with Supabase in the background. Works with no network
   after the app has been loaded once.
2. **Installable PWA** — manifest + service worker so it can be installed on
   phone/desktop and *opens* while offline.

Scope: **product data first** (products, categories, uoms, product_uoms,
product_prices, product_purchase_prices), but the infrastructure is
**resource-generic** so any future module/table becomes offline-capable by
registering it — not by writing new sync code.

User management (`profiles` + `admin-users` edge function) stays **online-only**;
its list is cached read-only.

## 2. Architecture

```
UI (Refine pages — unchanged)
        │  Refine hooks
        ▼
dataProvider (src/data/refine/dataProvider.ts)      ← stable boundary
        │  re-exports the local repository
        ▼
Local repository (src/data/local/repository.ts)
   ├── Dexie tables (one per registered resource + local metadata)
   ├── query engine (filters / sort / pagination / select + embeds)
   └── writes → row + sync_queue entry in the SAME transaction
        │
        ▼
Sync engine (src/data/sync/sync.service.ts)
   ├── push: FIFO queue → Supabase upsert/delete (idempotent)
   ├── pull: full per-table fetch + delete reconciliation
   └── status: pending / failed counts, retry, last sync time
        │
        ▼
Supabase (REST / Auth / Functions) — reachable only when online
```

**Design rule:** the service worker caches the **app shell only**. All offline
*data* comes from IndexedDB. Supabase REST/Auth/Functions responses are
`NetworkOnly` and never cached.

### Resource registry — the key to "easy to apply to other data"

`src/data/local/resources.ts` describes each offline-capable resource. Adding a
future module = add one entry (plus its migration/table). Every part of the
system (Dexie schema, repository, query engine, sync queue, puller) reads from
it.

```ts
interface SyncResourceConfig {
  name: string;                      // Refine resource, also the Dexie table
  table: string;                     // Supabase table
  columns: string[];                 // remote columns
  searchableColumns: string[];       // powers Refine `q` / useSelect search
  embeds: Record<string, EmbedConfig>; // alias -> { column, resource, columns }
  softDeleteColumn?: string;         // "deleted_at" for products
  offlineWrites: boolean;            // false => online-only (profiles)
  pull: boolean;                     // participate in remote pull
}
```

Registered: `products`, `categories`, `uoms`, `product_uoms`, `product_prices`,
`product_purchase_prices` (writable offline) and `profiles` (read-only cache).

## 3. What was built

### Phase A — PWA shell ✅

- `vite-plugin-pwa` (Workbox) configured in `vite.config.ts`:
  `registerType: "prompt"`, `injectRegister: false`.
- Manifest: name/short_name, description, `display: standalone`, `start_url`,
  `scope`, theme/background colors, icons.
- Icons generated from `public/favicon.svg` with ImageMagick into
  `public/icons/` (`icon-192.png`, `icon-512.png`, `maskable-512.png`) plus
  `public/apple-touch-icon.png`. The SVG's `color(display-p3 …)` styles are
  stripped for the raster conversion only; the source SVG is untouched.
- `index.html`: Apple/theme meta tags; the manifest link is injected by the
  plugin at build time.
- Workbox: precache hashed assets + `index.html`, SPA navigation fallback,
  `NetworkOnly` for `*.supabase.co`, `maximumFileSizeToCacheInBytes` raised to
  5 MiB (the single app-shell chunk is ~2.7 MiB — antd + Refine).
- Update flow: `src/pwa/ReloadPrompt.tsx` uses `useRegisterSW` and shows an antd
  notification with a **Reload** button (safer than `autoUpdate` with Refine's
  `warnWhenUnsavedChanges`).
- `vercel.json`: `sw.js` and `manifest.webmanifest` revalidate; icons
  immutable-cached.

### Phase B — Local persistence ✅

- `dexie` + `src/data/local/db.ts`: one Dexie table per registered resource,
  plus `sync_queue` and `sync_meta`. Rows carry local metadata prefixed `__`:
  `__sync` (`synced` | `pending` | `failed`), `__localUpdatedAt`,
  `__baseUpdatedAt`, `__lastSyncError`, `__pendingDelete`.
- `src/data/local/query.ts`: in-memory query engine matching the operators the
  app uses (`eq, ne, in, nin, contains` [case-insensitive like Supabase's
  `ilike`], `ncontains, containss, ncontainss, startswith, endswith, gt, gte,
  lt, lte, between, nbetween, null, nnull, ina, nina, and, or`) plus multi-column
  sort and pagination.
- `src/data/local/select.ts`: parses PostgREST-style `meta.select` strings and
  projects rows, including registry-driven embeds — reproducing shapes such as
  `category:category_id(name)` and `base_uom:base_uom_id(name, symbol)` locally.
- `src/data/local/repository.ts`: generic `getList/getOne/getMany/create/
  createMany/update/updateMany/deleteOne/deleteMany`. Reads come from Dexie
  (pending hard-deletes hidden). Writes commit the row and its queue entry in one
  transaction. Soft vs hard delete is decided by the registry.
- `src/data/refine/dataProvider.ts` now re-exports the local repository. **No
  product/category/uom page changed.**

### Phase C — Sync engine ✅

- `src/data/sync/queue.ts`: durable, coalescing FIFO queue. One entry per row
  (repeated edits fold in, preserving the original sequence number so
  parent→child ordering holds). A row that was only ever a local create is
  dropped entirely when deleted (it never reached the server).
- `src/data/sync/sync.service.ts`:
  - **Triggers:** startup, `online` event, after each local write (debounced
    800 ms), a 60 s timer, and a manual **Retry**.
  - **Push:** single global queue in insertion order → `upsert` on `id` for
    create/update, `delete().eq("id")` for hard deletes. Client UUIDs make
    replays idempotent. `created_at`/`updated_at` are stripped so the server
    owns them.
  - **Pull:** full fetch per registered table (paged at 1000) + id-set
    reconciliation, so hard-deleted rows don't reappear. Rows with pending/failed
    local changes are skipped (local wins until pushed). Unchanged rows
    (same `updated_at` and already synced) are skipped to avoid churn.
  - **Failures:** transient (network/5xx) → bounded exponential backoff;
    permanent (constraint `22/23/42`, RLS/permission) → marked `failed`, shown
    in the UI, never dropped. Rows keep the error in `__lastSyncError`.
  - **Conflict policy:** v1 last-write-wins by `updated_at` (documented
    limitation). `__baseUpdatedAt` is stored so a later phase can flag conflicts.
- `src/data/sync/useSyncStatus.ts` + `src/components/SyncStatus.tsx`: live
  online/offline state, pending/failed counts, last-synced time, retry.
- `src/data/sync/SyncManager.tsx`: starts the engine while authenticated and
  invalidates Refine queries (`invalidates: ["all"]`) only when a push or pull
  actually changed something.
- **Auth offline tolerance:** `src/auth/profileCache.ts` (localStorage role
  cache), `src/auth/authProvider.ts` (`check`/`getIdentity` fall back to the
  cache only on network failure; explicit inactive/denied always wins),
  `src/auth/permissions.ts` (role falls back to cache offline).
- **Users online-only:** `src/components/OfflineNotice.tsx` plus gating in
  `UserList`/`UserCreate`/`UserEdit` (disabled actions + hint while offline).

### Phase D — Reliability & polish (ongoing)

Manual test matrix (see §6). Pending-changes visibility is provided by the
header status tag; IndexedDB is not a backup.

### Phase E — Future (out of scope)

Delta-pull optimization, Background Sync API, multi-device conflict resolution
UI, additional modules, backup/restore tooling.

## 4. Deviations from the original plan

- **No `hydrate.ts` file.** First-login seeding is just the sync engine's first
  full pull; there is no separate hydration path.
- **No `navigator.locks` in v1.** Concurrent pushes from two tabs are safe
  because every mutation is an idempotent upsert/delete; a lock would add
  complexity for no correctness gain. The per-tab `running` guard prevents
  overlapping cycles within a tab.
- **Account switching keeps the shared catalog.** The data model is
  single-shop: RLS lets all active staff read the whole catalog, so cached
  product data is *not* wiped on user change. Only the read-cached `profiles`
  table is cleared (only admins may read everyone), and `ownerUserId` is
  recorded. An inactive/denied response always forces logout.
- **Pull is full, not delta.** Correctness first: hard deletes leave no
  tombstone, so the id-set diff needs the full set. Data volume is small; delta
  is a Phase E optimization.
- **Icons generated by ImageMagick**, not a committed generator script; the
  output is committed under `public/`.
- **Local metadata uses a `__` prefix** (`__sync`) rather than a single `_`.

## 5. File-level change list

**New**

- `public/icons/icon-192.png`, `public/icons/icon-512.png`,
  `public/icons/maskable-512.png`, `public/apple-touch-icon.png`
- `src/data/local/db.ts`
- `src/data/local/resources.ts` (registry)
- `src/data/local/query.ts`
- `src/data/local/select.ts`
- `src/data/local/repository.ts`
- `src/data/sync/queue.ts`
- `src/data/sync/sync.service.ts`
- `src/data/sync/notify.ts`
- `src/data/sync/useSyncStatus.ts`
- `src/data/sync/SyncManager.tsx`
- `src/auth/profileCache.ts`
- `src/components/OfflineNotice.tsx`
- `src/pwa/ReloadPrompt.tsx`

**Modified**

- `package.json` (`dexie`, `vite-plugin-pwa`)
- `vite.config.ts` (VitePWA config)
- `index.html` (Apple/theme meta)
- `vercel.json` (cache headers for sw/manifest/icons)
- `src/vite-env.d.ts` (`vite-plugin-pwa/client` types)
- `src/data/refine/dataProvider.ts` (local repository, unchanged signature)
- `src/app/providers.tsx` (`SyncManager`, `ReloadPrompt`)
- `src/auth/authProvider.ts`, `src/auth/permissions.ts` (offline fallback)
- `src/components/AppHeader.tsx` (mount `SyncStatus`)
- `src/components/SyncStatus.tsx` (queue status + retry)
- `src/i18n/locales/en.ts`, `src/i18n/locales/id.ts` (new keys)
- `src/modules/users/pages/UserList.tsx`, `UserCreate.tsx`, `UserEdit.tsx`
  (online-only gating)

**Unchanged (by design)**

- All product/category/uom page components and schemas.

## 6. Verification

- `bun run build` — typecheck + production build + SW/manifest generation.
- `bun run lint` — clean.
- Manual matrix:
  1. Load online → go offline → create/edit/delete → reload (still offline) →
     data persists with pending badges.
  2. Reconnect → queue drains → another device sees the changes.
  3. Force a failed push and retry → no duplicate rows (idempotency).
  4. Two devices edit the same product offline → last-write-wins.
  5. Clear site data → app re-seeds on next online load.
  6. Deploy a new version → SW update prompt appears and reload is clean.
  7. Users module is disabled offline; product modules keep working.

## 7. Acceptance checklist

- [x] App is installable and opens offline after the first visit (PWA).
- [x] Cached product list loads with no network.
- [x] Create/update/delete are persisted locally before remote sync.
- [x] Pending changes survive refresh and app restart.
- [x] Returning online triggers sync and updates visible status.
- [x] Retry does not create duplicates (idempotent upserts).
- [x] Deletes/deactivations don't reappear after sync (id-set diff; soft delete
      keeps `deleted_at`).
- [x] UI warns about unsynchronized changes (header status + counts).
- [x] Product UI never calls Supabase directly.
- [x] Adding a new offline table requires only a registry entry (+ migration).

## 8. Known limitations

- Offline sign-in is not supported (requires network). An already-signed-in
  session keeps working offline as long as the token is still valid; if the
  refresh token cannot be renewed offline the user is signed out.
- Last-write-wins can lose a concurrent edit made on another device.
- `profiles` is read-cached; if it was never pulled while online, user
  management shows nothing offline.
- The app-shell bundle is large; offline boot may be slower on low-end devices.
- IndexedDB may be evicted by the browser under storage pressure; it is not a
  backup.
