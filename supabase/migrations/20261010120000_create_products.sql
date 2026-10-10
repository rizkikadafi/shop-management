-- Products table for the shop management app.
-- Client-generated UUIDs allow offline creation; deleted_at is a tombstone
-- used for synchronized deletion.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sku text,
  name text not null,
  description text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.products is
  'Products owned by a user. deleted_at is a tombstone for synchronized deletion.';

-- SKU is unique per owner when provided.
create unique index if not exists products_user_id_sku_key
  on public.products (user_id, sku)
  where sku is not null;

create index if not exists products_user_id_idx
  on public.products (user_id);

-- Keep updated_at server-maintained.
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
  before update on public.products
  for each row
  execute function public.set_current_timestamp_updated_at();

-- Row Level Security: each user can only touch their own rows.
alter table public.products enable row level security;

drop policy if exists "Users can read their products" on public.products;
create policy "Users can read their products"
  on public.products for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their products" on public.products;
create policy "Users can insert their products"
  on public.products for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their products" on public.products;
create policy "Users can update their products"
  on public.products for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
