-- Add products delete policy (admin/manager) for hard-purge and cleanup.
-- The product list UI performs soft deletes via deleted_at by default; this
-- policy covers explicit hard deletions and admin cleanup flows.

drop policy if exists "Managers and admins can delete products" on public.products;
create policy "Managers and admins can delete products"
  on public.products for delete
  using (public.has_role('admin', 'manager'));