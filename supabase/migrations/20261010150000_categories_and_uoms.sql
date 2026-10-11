-- Product master data: categories and units of measure (UoM).
-- Categories are flat with a globally unique name (single-shop catalog).
-- UoMs are reusable definitions shared across products.
-- Single-shop security: active staff read; admins and managers write.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_key unique (name)
);

comment on table public.categories is
  'Flat product categories with a globally unique name.';

create table if not exists public.uoms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  symbol text not null,
  uom_type text not null
    check (uom_type in ('unit', 'weight', 'volume')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uoms_name_key unique (name),
  constraint uoms_symbol_key unique (symbol)
);

comment on table public.uoms is
  'Reusable unit-of-measure definitions (e.g. Piece/pcs, Kilogram/kg).';

-- Keep updated_at server-maintained (reuses the helper from the products migration).
drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
  before update on public.categories
  for each row
  execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_uoms_updated_at on public.uoms;
create trigger set_uoms_updated_at
  before update on public.uoms
  for each row
  execute function public.set_current_timestamp_updated_at();

-- Guarantee a base UoM exists before products.base_uom_id becomes required.
insert into public.uoms (id, name, symbol, uom_type)
values
  ('00000000-0000-0000-0000-0000000000c1', 'Piece', 'pcs', 'unit')
on conflict (id) do nothing;

-- Extend products with category and base UoM.
alter table public.products
  add column if not exists category_id uuid references public.categories (id);

alter table public.products
  add column if not exists base_uom_id uuid references public.uoms (id);

-- Backfill existing rows before enforcing NOT NULL (upgrades of populated DBs).
update public.products
set base_uom_id = '00000000-0000-0000-0000-0000000000c1'
where base_uom_id is null;

alter table public.products
  alter column base_uom_id set not null;

create index if not exists products_category_id_idx
  on public.products (category_id);

create index if not exists products_base_uom_id_idx
  on public.products (base_uom_id);

-- Row Level Security -------------------------------------------------------

alter table public.categories enable row level security;

drop policy if exists "Staff can read categories" on public.categories;
create policy "Staff can read categories"
  on public.categories for select
  using (public.is_active_staff());

drop policy if exists "Managers and admins can insert categories" on public.categories;
create policy "Managers and admins can insert categories"
  on public.categories for insert
  with check (public.has_role('admin', 'manager'));

drop policy if exists "Managers and admins can update categories" on public.categories;
create policy "Managers and admins can update categories"
  on public.categories for update
  using (public.has_role('admin', 'manager'))
  with check (public.has_role('admin', 'manager'));

drop policy if exists "Managers and admins can delete categories" on public.categories;
create policy "Managers and admins can delete categories"
  on public.categories for delete
  using (public.has_role('admin', 'manager'));

alter table public.uoms enable row level security;

drop policy if exists "Staff can read uoms" on public.uoms;
create policy "Staff can read uoms"
  on public.uoms for select
  using (public.is_active_staff());

drop policy if exists "Managers and admins can insert uoms" on public.uoms;
create policy "Managers and admins can insert uoms"
  on public.uoms for insert
  with check (public.has_role('admin', 'manager'));

drop policy if exists "Managers and admins can update uoms" on public.uoms;
create policy "Managers and admins can update uoms"
  on public.uoms for update
  using (public.has_role('admin', 'manager'))
  with check (public.has_role('admin', 'manager'));

drop policy if exists "Managers and admins can delete uoms" on public.uoms;
create policy "Managers and admins can delete uoms"
  on public.uoms for delete
  using (public.has_role('admin', 'manager'));
