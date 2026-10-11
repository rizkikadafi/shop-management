-- Local development seed.
-- Bootstraps one admin, one manager, and one cashier, plus a few products.
-- Runs automatically on `supabase db reset`.
--
-- Credentials (change immediately outside local dev):
--   admin@shop.local   / admin123456    (admin)
--   manager@shop.local / manager123456  (manager)
--   cashier@shop.local / cashier123456  (cashier)

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000a1',
    'authenticated', 'authenticated',
    'admin@shop.local',
    crypt('admin123456', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Shop Admin"}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000a2',
    'authenticated', 'authenticated',
    'manager@shop.local',
    crypt('manager123456', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Shop Manager"}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000a3',
    'authenticated', 'authenticated',
    'cashier@shop.local',
    crypt('cashier123456', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Shop Cashier"}',
    '', '', '', ''
  )
on conflict (email) where is_sso_user = false do nothing;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a1',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"admin@shop.local","email_verified":true,"phone_verified":false}',
    'email', now(), now(), now()
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-0000000000a2',
    '{"sub":"00000000-0000-0000-0000-0000000000a2","email":"manager@shop.local","email_verified":true,"phone_verified":false}',
    'email', now(), now(), now()
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-0000000000a3',
    '00000000-0000-0000-0000-0000000000a3',
    '{"sub":"00000000-0000-0000-0000-0000000000a3","email":"cashier@shop.local","email_verified":true,"phone_verified":false}',
    'email', now(), now(), now()
  )
on conflict (provider_id, provider) do nothing;

-- The auth.users trigger created default (cashier) profiles; assign real roles.
update public.profiles
set role = 'admin', full_name = 'Shop Admin'
where id = '00000000-0000-0000-0000-0000000000a1';

update public.profiles
set role = 'manager', full_name = 'Shop Manager'
where id = '00000000-0000-0000-0000-0000000000a2';

update public.profiles
set role = 'cashier', full_name = 'Shop Cashier'
where id = '00000000-0000-0000-0000-0000000000a3';

-- Reusable units of measure. The base "Piece" row is created by the
-- categories/uoms migration; the rest are optional catalog entries.
insert into public.uoms (id, name, symbol, uom_type)
values
  ('00000000-0000-0000-0000-0000000000c1', 'Piece', 'pcs', 'unit'),
  ('00000000-0000-0000-0000-0000000000c2', 'Pack', 'pack', 'unit'),
  ('00000000-0000-0000-0000-0000000000c3', 'Box', 'box', 'unit'),
  ('00000000-0000-0000-0000-0000000000c4', 'Kilogram', 'kg', 'weight'),
  ('00000000-0000-0000-0000-0000000000c5', 'Gram', 'g', 'weight'),
  ('00000000-0000-0000-0000-0000000000c6', 'Liter', 'L', 'volume'),
  ('00000000-0000-0000-0000-0000000000c7', 'Milliliter', 'mL', 'volume')
on conflict (id) do nothing;

-- Flat product categories.
insert into public.categories (id, name)
values
  ('00000000-0000-0000-0000-0000000000d1', 'Beverages'),
  ('00000000-0000-0000-0000-0000000000d2', 'Packaging'),
  ('00000000-0000-0000-0000-0000000000d3', 'Food')
on conflict (id) do nothing;

insert into public.products (
  id, user_id, sku, name, description, price, is_active, category_id, base_uom_id
)
values
  (
    '00000000-0000-0000-0000-0000000000b1',
    '00000000-0000-0000-0000-0000000000a1',
    'SKU-001', 'Espresso Beans 1kg', 'Dark roast whole beans', 18.50, true,
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000c4'
  ),
  (
    '00000000-0000-0000-0000-0000000000b2',
    '00000000-0000-0000-0000-0000000000a1',
    'SKU-002', 'Paper Cups (100)', '8oz double-wall cups', 6.25, true,
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000c1'
  ),
  (
    '00000000-0000-0000-0000-0000000000b3',
    '00000000-0000-0000-0000-0000000000a1',
    'SKU-003', 'Oat Milk 1L', 'Barista edition', 3.75, false,
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000c1'
  )
on conflict (id) do nothing;

-- Demo conversion hierarchy and package prices for the paper-cup product.
-- 1 pack = 6 pcs, 1 box = 4 packs (24 pcs). The base "pcs" row is created
-- automatically by the products trigger, so reference it by lookup.
insert into public.product_uoms (
  product_id, uom_id, parent_product_uom_id, quantity_in_parent
)
select
  '00000000-0000-0000-0000-0000000000b2',
  '00000000-0000-0000-0000-0000000000c2',
  base.id,
  6
from public.product_uoms base
where base.product_id = '00000000-0000-0000-0000-0000000000b2'
  and base.uom_id = '00000000-0000-0000-0000-0000000000c1'
on conflict (product_id, uom_id) do nothing;

insert into public.product_uoms (
  product_id, uom_id, parent_product_uom_id, quantity_in_parent
)
select
  '00000000-0000-0000-0000-0000000000b2',
  '00000000-0000-0000-0000-0000000000c3',
  pack.id,
  4
from public.product_uoms pack
where pack.product_id = '00000000-0000-0000-0000-0000000000b2'
  and pack.uom_id = '00000000-0000-0000-0000-0000000000c2'
on conflict (product_id, uom_id) do nothing;

insert into public.product_prices (
  product_id, product_uom_id, price_list, min_quantity,
  package_quantity, package_price
)
select
  '00000000-0000-0000-0000-0000000000b2',
  pu.id,
  'retail', 1, 1, 0.10
from public.product_uoms pu
where pu.product_id = '00000000-0000-0000-0000-0000000000b2'
  and pu.uom_id = '00000000-0000-0000-0000-0000000000c1'
on conflict (product_id, product_uom_id, price_list, min_quantity) do nothing;

insert into public.product_prices (
  product_id, product_uom_id, price_list, min_quantity,
  package_quantity, package_price
)
select
  '00000000-0000-0000-0000-0000000000b2',
  pu.id,
  'retail', 1, 1, 1.80
from public.product_uoms pu
where pu.product_id = '00000000-0000-0000-0000-0000000000b2'
  and pu.uom_id = '00000000-0000-0000-0000-0000000000c3'
on conflict (product_id, product_uom_id, price_list, min_quantity) do nothing;
