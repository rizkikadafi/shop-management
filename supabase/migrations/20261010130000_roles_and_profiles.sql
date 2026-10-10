-- Roles and staff profiles.
-- Single-shop model: every authenticated staff member shares one catalog.
-- Authorization is derived from public.profiles.role (app_role) via helper
-- functions so RLS does not need to query the table per policy recursively.

create type public.app_role as enum ('admin', 'manager', 'cashier');

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role public.app_role not null default 'cashier',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Staff profile and role. One row per authenticated user.';

create index if not exists profiles_role_idx on public.profiles (role);

-- Keep updated_at server-maintained (reuses the helper from the products migration).
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_current_timestamp_updated_at();

-- Auto-create a profile whenever an auth user is created (signup or admin API).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Role helpers used by RLS and by the admin Edge Function.
create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid() and is_active
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and is_active
  )
$$;

create or replace function public.has_role(variadic required_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and is_active and role = any (required_roles)
  )
$$;

-- Remove PostgREST RPC exposure for anon (helpers are only meaningful for a
-- signed-in user; authenticated keeps execute so RLS policies can call them).
revoke execute on function public.current_user_role() from anon;
revoke execute on function public.is_active_staff() from anon;
revoke execute on function public.has_role(public.app_role[]) from anon;

-- RLS: staff read their own profile; admins read and update everyone.
alter table public.profiles enable row level security;

drop policy if exists "Profiles are readable by owner or admins" on public.profiles;
create policy "Profiles are readable by owner or admins"
  on public.profiles for select
  using (id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
