-- Single-shop products: all active staff can read; admins and managers write.
-- user_id remains as a creator/audit field and defaults to the caller.

alter table public.products alter column user_id set default auth.uid();

drop policy if exists "Users can read their products" on public.products;
drop policy if exists "Users can insert their products" on public.products;
drop policy if exists "Users can update their products" on public.products;

create policy "Staff can read products"
  on public.products for select
  using (public.is_active_staff());

create policy "Managers and admins can insert products"
  on public.products for insert
  with check (public.has_role('admin', 'manager'));

create policy "Managers and admins can update products"
  on public.products for update
  using (public.has_role('admin', 'manager'))
  with check (public.has_role('admin', 'manager'));
