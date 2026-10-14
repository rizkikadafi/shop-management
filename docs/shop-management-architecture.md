# Shop Management App --- Architecture Design

## 1. Goal

Build a simple shop-management web app with **Product Management as the
first module**. The architecture should support additional modules later
without introducing a separate backend deployment.

Priorities: - Offline-first: users can view and edit product data while
temporarily offline. - Simple deployment: Vite frontend hosted as a
static app; Supabase provides backend services. - Modular code: future
modules can reuse shared data, auth, and sync infrastructure. - Keep the
first release focused on products.

## 2. Tech stack

  -----------------------------------------------------------------------
  Area                    Technology              Responsibility
  ----------------------- ----------------------- -----------------------
  Runtime and package     Bun                     Install dependencies,
  manager                                         run scripts, build

  Frontend tooling        Vite + TypeScript       SPA development and
                                                  production build

  Admin/data UI           Refine Core             Resources, CRUD flows,
                                                  data-provider
                                                  integration

  Backend platform        Supabase                PostgreSQL, Auth, Row
                                                  Level Security,
                                                  optional Storage

  Local database          IndexedDB via Dexie     Persistent product
                                                  cache and offline
                                                  writes

  Sync coordination       Small app-owned sync    Queue local mutations
                          service                 and synchronize with
                                                  Supabase
  -----------------------------------------------------------------------

**Why Dexie?** Supabase is remote and cannot by itself provide durable
offline writes. IndexedDB gives the browser a local database that
survives refreshes. Dexie is a thin wrapper that makes IndexedDB easier
to use. This is the one additional core dependency recommended for
offline-first behavior.

Keep the first version as a **single Vite application**. Do not add a
custom API server, microservices, or a separate backend deployment
unless requirements later justify them.

## 3. High-level architecture

``` text
┌─────────────────────────────────────────────────────┐
│                   Vite SPA (Bun)                    │
│                                                     │
│  Refine UI                                          │
│  ├── Product List / Create / Edit / Detail          │
│  └── Shared layout, navigation, status indicator    │
│                                                     │
│  Application layer                                  │
│  ├── Product use cases / validation                 │
│  └── Offline-aware repository                       │
│                                                     │
│  Data layer                                         │
│  ├── Local DB (Dexie / IndexedDB)                   │
│  ├── Sync queue + sync worker                       │
│  └── Supabase client                                │
└───────────────┬───────────────────┬─────────────────┘
                │                   │
          Local read/write     HTTPS when online
                │                   │
                ▼                   ▼
       Browser IndexedDB       Supabase
                               ├── Auth
                               ├── PostgreSQL
                               └── RLS policies
```

### Main design rule

**The UI reads and writes through the local repository, not directly to
Supabase.**

-   Reads come from IndexedDB so product screens remain responsive and
    available offline.
-   Writes are saved locally first and added to a sync queue.
-   When online, the sync service sends queued changes to Supabase.
-   Successful synchronization updates local sync metadata.
-   The UI shows whether changes are `Pending sync`, `Synced`, or
    `Sync failed`.

Refine's `dataProvider` is the bridge between Refine resources and this
offline-aware repository. Avoid using direct Supabase calls inside
individual page components.

## 4. Suggested project structure

``` text
src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── providers.tsx          # Refine, auth, data provider
├── components/
│   ├── AppLayout.tsx
│   └── SyncStatus.tsx
├── modules/
│   └── products/
│       ├── pages/
│       │   ├── ProductList.tsx
│       │   ├── ProductCreate.tsx
│       │   ├── ProductEdit.tsx
│       │   └── ProductShow.tsx
│       ├── components/
│       ├── product.schema.ts   # Validation and types
│       └── product.service.ts  # Product use cases
├── data/
│   ├── local/
│   │   ├── db.ts               # Dexie schema and migrations
│   │   └── product.repository.ts
│   ├── remote/
│   │   └── supabase.ts
│   ├── sync/
│   │   ├── sync.service.ts
│   │   └── sync.queue.ts
│   └── refine/
│       └── dataProvider.ts
├── auth/
│   └── authProvider.ts
└── main.tsx
```

Keep module-specific UI and product rules in `modules/products`. Shared
infrastructure such as local persistence, authentication, and
synchronization belongs outside the module so future modules can reuse
it.

## 5. Product data model

Start with a small schema. Do not build inventory movements, suppliers,
sales, or purchasing until they are needed.

### `products` --- Supabase PostgreSQL

  -----------------------------------------------------------------------
  Column                  Type                    Notes
  ----------------------- ----------------------- -----------------------
  `id`                    `uuid`                  Primary key; generate
                                                  client-side so offline
                                                  creation works

  `user_id`               `uuid`                  Owner/tenant
                                                  identifier; references
                                                  authenticated user

  `sku`                   `text`                  Optional SKU; unique
                                                  per owner if provided

  `name`                  `text`                  Required

  `description`           `text`                  Optional

  `price`                 `numeric(12,2)`         Non-negative selling
                                                  price

  `is_active`             `boolean`               Soft deactivation
                                                  instead of immediate
                                                  deletion

  `created_at`            `timestamptz`           Server timestamp

  `updated_at`            `timestamptz`           Server-maintained
                                                  update timestamp

  `deleted_at`            `timestamptz`           Nullable tombstone for
                                                  synchronized deletion
  -----------------------------------------------------------------------

Use the same product shape in IndexedDB, with local-only metadata such
as: - `sync_status`: `pending`, `synced`, or `failed` -
`local_updated_at`: timestamp of the latest local change -
`last_sync_error`: optional diagnostic message

These local-only fields should not be sent as product columns to
Supabase.

### Important decisions

-   **Generate UUIDs on the client** to create products offline without
    waiting for the server.
-   Use `deleted_at` as a tombstone so deletion can synchronize to other
    devices. In the initial UI, prefer deactivation; implement hard
    deletion only if a clear requirement emerges.
-   Store prices as decimal values in the database. Validate the value
    at the application boundary and avoid floating-point arithmetic for
    future totals; use integer minor units or a decimal library if money
    calculations become more complex.
-   If multiple shop accounts will use the app, introduce an explicit
    `shop_id` and membership model. Do not assume `user_id` alone
    represents a shop forever.

## 6. Offline-first read/write flow

### Read products

1.  Refine calls `dataProvider.getList("products", ...)`.
2.  The provider reads matching records from IndexedDB.
3.  The UI renders immediately from local data.
4.  If online, synchronization runs in the background and refreshes
    local records.
5.  Local changes notify the UI so the list updates.

### Create or update a product

1.  Validate the form input.
2.  Write the change to IndexedDB in a transaction.
3.  Add or update a queue entry in the same transaction.
4.  Return the local product to Refine immediately.
5.  If online, attempt synchronization; otherwise leave it pending.
6.  On success, mark the record as synced and remove/complete the queue
    entry.
7.  On failure, retain the queued mutation and expose a retryable
    status.

### Delete or deactivate

Prefer `is_active = false` for normal product lifecycle management. If
actual deletion is required, write a tombstone (`deleted_at`) locally
and synchronize it like any other mutation. Never simply remove the
local record before the deletion has been synchronized, or it may
reappear after a remote refresh.

## 7. Synchronization strategy --- keep version one simple

Use a **single-device-first, queued synchronization model** for the
first release.

-   Track pending operations in a local `sync_queue` table.
-   Process queue entries in order.
-   Retry transient network/server errors with bounded backoff.
-   Make operations idempotent by using stable UUIDs and upserts.
-   Do not discard queued operations when the app closes or reloads.
-   Trigger sync on app startup, when the browser returns online, and
    after a local write.
-   Add a visible manual "Retry sync" action for failed items.

### Conflict policy

For the first version, use a simple **last-write-wins based on
`updated_at`**, and make the limitation explicit. If two devices edit
the same product offline, one change may overwrite the other. Keep
conflict detection possible by storing a server version or comparing the
remote `updated_at` before update.

Do not implement a general-purpose conflict-resolution engine in the
first release. If concurrent multi-device editing becomes a real
requirement, introduce a conflict state and ask the user to resolve
competing edits rather than silently losing data.

### Browser limitations

-   The app can work offline after it has been loaded and its required
    data has been cached.
-   A normal Vite SPA does not automatically load when visited for the
    first time offline. Add a service worker/PWA setup if launch-offline
    behavior is required.
-   Browser storage can be cleared or evicted. This is not a substitute
    for server backups; warn users when unsynchronized changes exist.
-   Background sync is not guaranteed by every browser. Also sync while
    the app is open and when it regains connectivity.

## 8. Refine integration

Define `products` as a Refine resource and route all CRUD operations
through the custom offline-aware `dataProvider`.

Conceptual example:

``` tsx
<Refine
  dataProvider={offlineDataProvider}
  resources={[
    {
      name: "products",
      list: "/products",
      create: "/products/create",
      edit: "/products/edit/:id",
      show: "/products/show/:id",
    },
  ]}
/>
```

The custom provider implements the Refine data-provider methods used by
the UI (`getList`, `getOne`, `create`, `update`, and, if required,
`delete`). Each method delegates to the local repository. Remote
synchronization is a separate responsibility.

For list filtering, sorting, and pagination, either implement the needed
operations in IndexedDB or keep the first release's product list
deliberately small. Ensure the provider's behavior matches Refine's
expected response shape and pagination metadata.

## 9. Supabase security

-   Use Supabase Auth for sign-in.
-   Enable Row Level Security on `products`.
-   Add policies that limit reads and writes to the authenticated user's
    rows (or the user's authorized shop membership).
-   Never ship the Supabase `service_role` key to the browser. The
    frontend may use the project's public/publishable key; RLS is the
    security boundary.
-   Validate input both in the app and through database constraints.
-   Treat local IndexedDB as untrusted client storage. Local data is not
    protected by Supabase RLS while it is on the device.

Example policy direction for a single-user prototype:

``` sql
alter table public.products enable row level security;

create policy "Users can read their products"
on public.products for select
using (auth.uid() = user_id);

create policy "Users can insert their products"
on public.products for insert
with check (auth.uid() = user_id);

create policy "Users can update their products"
on public.products for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

Add a corresponding delete policy only if physical deletes are
supported. If the app becomes multi-user-per-shop, replace the direct
`user_id` check with membership-based policies.

## 10. Implementation phases

> Status: **Phase 1–3 implemented**, Phase 4 in progress. The resource-generic
> offline/PWA build is documented in `docs/offline-pwa-plan.md`.

### Phase 1 --- Product CRUD online ✅

-   Set up Bun, Vite, TypeScript, Refine, and Supabase.
-   Create the `products` table, constraints, Auth, and RLS.
-   Build product list, create, edit, and show pages.
-   Use a temporary direct Supabase data provider only if needed to
    validate the basic screens; keep it behind the provider boundary.

**Done when:** authenticated users can safely manage their own products
online.

### Phase 2 --- Local persistence ✅

-   Add Dexie and define the local schema (`src/data/local/db.ts`).
-   Route Refine reads and writes through the local repository
    (`src/data/local/repository.ts` via `dataProvider.ts`).
-   Ensure product records remain after refresh.
-   Add local validation and local-first create/update behavior.

**Done when:** cached products can be viewed and edited offline after
the app has been loaded.

### Phase 3 --- Queue and sync ✅

-   Add the durable sync queue (`src/data/sync/queue.ts`).
-   Sync creates, updates, and tombstones to Supabase
    (`src/data/sync/sync.service.ts`).
-   Add retry behavior and sync status UI (`src/components/SyncStatus.tsx`).
-   Test offline → edit → reload → online → synchronized.

**Done when:** queued changes survive reloads and eventually synchronize
when connectivity returns.

### Phase 4 --- Reliability (in progress)

-   Test duplicate retries, network failures, stale updates, and
    two-device conflicts.
-   Service worker added (PWA shell + offline reopen) via `vite-plugin-pwa`.
-   Add backup/restore and operational monitoring appropriate to the
    deployment.

**Done when:** common failure cases are visible and recoverable, with no
silent deletion of pending local changes.

## 11. First-release scope

**Build now** - Authentication - Product list, search/filter, create,
edit, view - SKU, name, description, price, active/inactive - IndexedDB
persistence - Offline mutation queue and sync status - Installable PWA

**Defer** - Stock quantity and stock movements - Sales, purchases,
suppliers, and reports - Barcode scanning - Multi-warehouse support -
Real-time collaborative editing - Complex conflict resolution - AI
features

## 12. Core acceptance checklist

-   [x] Product CRUD works online and is protected by RLS.
-   [x] Cached product list loads without a network connection.
-   [x] Create/update operations are persisted locally before remote
    sync.
-   [x] Pending changes survive browser refresh and app restart.
-   [x] Returning online triggers sync and updates the visible status.
-   [x] Retry does not create duplicate products.
-   [x] Deactivation/deletion does not cause a product to reappear after
    sync.
-   [x] The UI clearly warns about unsynchronized changes.
-   [x] Product UI does not call Supabase directly.
-   [x] A future module can reuse the same local DB and sync
    infrastructure (add a registry entry in `src/data/local/resources.ts`).
