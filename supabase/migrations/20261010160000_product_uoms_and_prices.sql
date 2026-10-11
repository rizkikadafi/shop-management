-- Product-specific UoM conversions and package-based price rules.
-- Conversions are per product; prices reference a product UoM so historical
-- package contents stay tied to the conversion hierarchy.
-- Single-shop security: active staff read; admins and managers write.

create table if not exists public.product_uoms (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  uom_id uuid not null references public.uoms (id),
  parent_product_uom_id uuid,
  quantity_in_parent numeric(18, 6) not null
    check (quantity_in_parent > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (product_id, uom_id),
  unique (id, product_id),

  foreign key (parent_product_uom_id, product_id)
    references public.product_uoms (id, product_id),

  check (
    parent_product_uom_id is null
    or id <> parent_product_uom_id
  )
);

comment on table public.product_uoms is
  'UoMs available for a product and their parent/child conversion hierarchy.';

create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  product_uom_id uuid not null,
  price_list text not null default 'retail',
  min_quantity numeric(18, 6) not null
    check (min_quantity > 0),
  package_quantity numeric(18, 6) not null
    check (package_quantity > 0),
  package_price numeric(18, 2) not null
    check (package_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (product_uom_id, product_id)
    references public.product_uoms (id, product_id),

  unique (
    product_id,
    product_uom_id,
    price_list,
    min_quantity
  )
);

comment on table public.product_prices is
  'Package-based price rules expressed in a product UoM.';

create index if not exists product_uoms_product_id_idx
  on public.product_uoms (product_id);

create index if not exists product_uoms_parent_id_idx
  on public.product_uoms (parent_product_uom_id);

create index if not exists product_prices_product_list_idx
  on public.product_prices (product_id, price_list);

-- Keep updated_at server-maintained (reuses the helper from the products migration).
drop trigger if exists set_product_uoms_updated_at on public.product_uoms;
create trigger set_product_uoms_updated_at
  before update on public.product_uoms
  for each row
  execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_product_prices_updated_at on public.product_prices;
create trigger set_product_prices_updated_at
  before update on public.product_prices
  for each row
  execute function public.set_current_timestamp_updated_at();

-- Keep the product's base UoM represented as a parentless factor-1 row.
-- SECURITY DEFINER lets the insert bypass product_uoms RLS during a user write.
create or replace function public.sync_base_product_uom()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.base_uom_id is distinct from old.base_uom_id then
    delete from public.product_uoms pu
    where pu.product_id = new.id
      and pu.parent_product_uom_id is null
      and pu.quantity_in_parent = 1
      and not exists (
        select 1 from public.product_uoms c
        where c.parent_product_uom_id = pu.id
      )
      and not exists (
        select 1 from public.product_prices r
        where r.product_uom_id = pu.id
      );
  end if;

  insert into public.product_uoms (
    product_id, uom_id, parent_product_uom_id, quantity_in_parent
  )
  values (new.id, new.base_uom_id, null, 1)
  on conflict (product_id, uom_id) do update
    set parent_product_uom_id = null,
        quantity_in_parent = 1;

  return new;
end;
$$;

drop trigger if exists sync_base_product_uom_on_products on public.products;
create trigger sync_base_product_uom_on_products
  after insert or update of base_uom_id on public.products
  for each row
  execute function public.sync_base_product_uom();

-- Backfill the base row for products that existed before this migration.
insert into public.product_uoms (
  product_id, uom_id, parent_product_uom_id, quantity_in_parent
)
select id, base_uom_id, null, 1
from public.products
on conflict (product_id, uom_id) do nothing;

-- Row Level Security -------------------------------------------------------

alter table public.product_uoms enable row level security;

drop policy if exists "Staff can read product_uoms" on public.product_uoms;
create policy "Staff can read product_uoms"
  on public.product_uoms for select
  using (public.is_active_staff());

drop policy if exists "Managers and admins can insert product_uoms" on public.product_uoms;
create policy "Managers and admins can insert product_uoms"
  on public.product_uoms for insert
  with check (public.has_role('admin', 'manager'));

drop policy if exists "Managers and admins can update product_uoms" on public.product_uoms;
create policy "Managers and admins can update product_uoms"
  on public.product_uoms for update
  using (public.has_role('admin', 'manager'))
  with check (public.has_role('admin', 'manager'));

drop policy if exists "Managers and admins can delete product_uoms" on public.product_uoms;
create policy "Managers and admins can delete product_uoms"
  on public.product_uoms for delete
  using (public.has_role('admin', 'manager'));

alter table public.product_prices enable row level security;

drop policy if exists "Staff can read product_prices" on public.product_prices;
create policy "Staff can read product_prices"
  on public.product_prices for select
  using (public.is_active_staff());

drop policy if exists "Managers and admins can insert product_prices" on public.product_prices;
create policy "Managers and admins can insert product_prices"
  on public.product_prices for insert
  with check (public.has_role('admin', 'manager'));

drop policy if exists "Managers and admins can update product_prices" on public.product_prices;
create policy "Managers and admins can update product_prices"
  on public.product_prices for update
  using (public.has_role('admin', 'manager'))
  with check (public.has_role('admin', 'manager'));

drop policy if exists "Managers and admins can delete product_prices" on public.product_prices;
create policy "Managers and admins can delete product_prices"
  on public.product_prices for delete
  using (public.has_role('admin', 'manager'));
