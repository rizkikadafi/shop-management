# Development Workflow

**Project:** Shop Management App 
**Stack:** Vite + React (SPA), Refine, Supabase (PostgreSQL, Auth, RLS), Bun 
**Deploys to:** Vercel (frontend) + hosted Supabase (backend)

This document explains how local development, database migrations, and
deployment fit together.

## 1. Two separate Supabase instances

Everything runs against **two independent Supabase instances**. They share no
data, schema, or users — the `supabase/migrations/` folder is the contract that
keeps their schemas aligned.

| | Local | Hosted (production / preview) |
|---|---|---|
| Runs where | Docker, via the Supabase CLI | Supabase cloud project |
| API URL | `http://127.0.0.1:54321` | `https://<project-ref>.supabase.co` |
| Keys | `bunx supabase status` | Dashboard → Settings → API |
| Used by | `bun run dev` via `.env.local` | Vercel build via env vars |
| Data | disposable, reseeded freely | real, must be preserved |
| Users | demo users from `seed.sql` | created manually / by an admin |

The migration files — not either database — are the source of truth.

## 2. Prerequisites

- [Bun](https://bun.sh) and Docker (for the local Supabase stack).
- The Supabase CLI is run through `bunx supabase ...` (no global install needed).
- A Supabase account for the hosted project.

## 3. First-time local setup

```sh
bun install                 # install dependencies
bunx supabase start         # boot Docker stack: Postgres, Auth, REST, Studio, Functions
bunx supabase status        # print API URL + anon/service keys
cp .env.example .env.local  # then paste the local URL + anon key into .env.local
bun run dev                 # start the Vite dev server
```

Local service URLs:

- Studio (DB browser): `http://127.0.0.1:54323`
- Mail catcher (local emails): `http://127.0.0.1:54324`
- REST API: `http://127.0.0.1:54321`

`.env.local` is git-ignored and only holds the local URL and the publishable
(anon) key. Never put the `service_role` key in the browser config.

## 4. Daily development loop

1. `bunx supabase start` (or `bunx supabase status` if it is already running).
2. `bun run dev`.
3. Edit code; Vite hot-reloads.
4. `bun run lint` before committing.

The app is a client-side SPA that talks directly to Supabase; there is no
separate backend server to run.

## 5. Schema changes (migrations)

Never edit the hosted schema by hand — it drifts. Change the schema through a
migration and apply it locally first.

```sh
bunx supabase migration new add_something   # creates supabase/migrations/<ts>_add_something.sql
#   ...edit the generated SQL...
bunx supabase db reset                       # drop → replay all migrations → run seed.sql
```

`db reset` rebuilds the local database from scratch, so it proves a migration
works from zero. `seed.sql` (demo users, products, units) runs **only** on this
local reset, never in production.

## 6. Regenerating database types

After any schema change, regenerate the TypeScript types used by the app:

```sh
bunx supabase gen types typescript --local > src/data/remote/database.types.ts
```

Commit the migration and the regenerated types together.

## 7. Edge Functions

Privileged, admin-only operations (user management) run in the `admin-users`
Edge Function, which uses the service role key server-side only.

```sh
bun run functions:serve            # serve locally (JWT still required)
bunx supabase functions deploy admin-users   # deploy to hosted
```

The function's `verify_jwt` setting lives in `supabase/config.toml`.

## 8. Environment variables

Vite exposes only variables prefixed with `VITE_`, and it bakes them in at
**build time** (so redeploy after changing them). Files merge in this order
(later wins):

```
.env  <  .env.local  <  .env.[mode]  <  .env.[mode].local
```

`bun run dev` = `development`; `bun run build` = `production`.

| Variable | Local (`.env.local`) | Production (Vercel) |
|---|---|---|
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | local anon key | hosted anon key |

Production/preview values live in **Vercel → Project → Settings → Environment
Variables** and are never committed. `.gitignore` ignores all `.env*` files
except `.env.example`.

## 9. Deploying

### Backend (Supabase)

```sh
bunx supabase login
bunx supabase link --project-ref <project-ref>
bunx supabase db push            # apply pending migrations (no seed)
bunx supabase functions deploy admin-users
```

Then, in the Dashboard:

1. **Authentication → Users** → add the first admin (auto-confirm).
2. SQL Editor: `update public.profiles set role = 'admin' where id = '<uuid>';`
3. **Authentication → URL Configuration**: set the Site URL to the Vercel
   domain and add it to the redirect URLs.
4. Disable new-user sign-up (matches `enable_signup = false`).

### Frontend (Vercel)

1. Import the Git repository. Bun is detected from `bun.lock`.
2. Build settings: install `bun install`, build `bun run build`, output `dist`.
3. Add the two `VITE_*` environment variables (Production + Preview).
4. Deploy, then copy the production URL back into the Supabase Auth URL config.

`vercel.json` rewrites all routes to `index.html` so SPA deep links work.

### Reference data

The app needs at least one Unit of Measure before products can be created.
Since `seed.sql` is local-only, create the default units and categories through
the deployed UI after the first admin logs in.

## 10. Command reference

| Command | Purpose |
|---|---|
| `bun run dev` | Start the Vite dev server |
| `bun run build` | Type-check and production build (`dist/`) |
| `bun run preview` | Serve the production build locally |
| `bun run lint` | Run `oxlint` |
| `bun run functions:serve` | Serve the `admin-users` Edge Function locally |
| `bunx supabase start` / `stop` | Start / stop the local stack |
| `bunx supabase status` | Show local URLs and keys |
| `bunx supabase db reset` | Rebuild local DB from migrations + seed |
| `bunx supabase migration new <name>` | Create a new migration file |
| `bunx supabase gen types typescript --local` | Regenerate DB types |
| `bunx supabase db push` | Apply pending migrations to hosted |
| `bunx supabase functions deploy admin-users` | Deploy the Edge Function |
