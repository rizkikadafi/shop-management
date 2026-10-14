-- Purchase prices per product unit.
--
-- A purchase price is recorded for a specific product UoM (the unit the shop
-- buys the product in). Units without a stored price can be derived by the
-- application from any recorded price using the product's conversion tree, so
-- only explicitly recorded prices are persisted here.
--
-- Single-shop security: active staff read; admins and managers write.

create table if not exists public.product_purchase_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  product_uom_id uuid not null,
  purchase_price numeric(18, 2) not null
    check (purchase_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (product_uom_id, product_id)
    references public.product_uoms (id, product_id) on delete cascade,

  unique (product_id, product_uom_id)
);

comment on table public.product_purchase_prices is
  'Recorded purchase price per product UoM. Unrecorded units are derived in-app from conversions.';

create index if not exists product_purchase_prices_product_idx
  on public.product_purchase_prices (product_id);

-- Keep updated_at server-maintained (reuses the helper from the products migration).
drop trigger if exists set_product_purchase_prices_updated_at
  on public.product_purchase_prices;
create trigger set_product_purchase_prices_updated_at
  before update on public.product_purchase_prices
  for each row
  execute function public.set_current_timestamp_updated_at();

-- Row Level Security -------------------------------------------------------

alter table public.product_purchase_prices enable row level security;

drop policy if exists "Staff can read product_purchase_prices" on public.product_purchase_prices;
create policy "Staff can read product_purchase_prices"
  on public.product_purchase_prices for select
  using (public.is_active_staff());

drop policy if exists "Managers and admins can insert product_purchase_prices" on public.product_purchase_prices;
create policy "Managers and admins can insert product_purchase_prices"
  on public.product_purchase_prices for insert
  with check (public.has_role('admin', 'manager'));

drop policy if exists "Managers and admins can update product_purchase_prices" on public.product_purchase_prices;
create policy "Managers and admins can update product_purchase_prices"
  on public.product_purchase_prices for update
  using (public.has_role('admin', 'manager'))
  with check (public.has_role('admin', 'manager'));

drop policy if exists "Managers and admins can delete product_purchase_prices" on public.product_purchase_prices;
create policy "Managers and admins can delete product_purchase_prices"
  on public.product_purchase_prices for delete
  using (public.has_role('admin', 'manager'));
