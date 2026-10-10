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

insert into public.products (id, user_id, sku, name, description, price, is_active)
values
  (
    '00000000-0000-0000-0000-0000000000b1',
    '00000000-0000-0000-0000-0000000000a1',
    'SKU-001', 'Espresso Beans 1kg', 'Dark roast whole beans', 18.50, true
  ),
  (
    '00000000-0000-0000-0000-0000000000b2',
    '00000000-0000-0000-0000-0000000000a1',
    'SKU-002', 'Paper Cups (100)', '8oz double-wall cups', 6.25, true
  ),
  (
    '00000000-0000-0000-0000-0000000000b3',
    '00000000-0000-0000-0000-0000000000a1',
    'SKU-003', 'Oat Milk 1L', 'Barista edition', 3.75, false
  )
on conflict (id) do nothing;
