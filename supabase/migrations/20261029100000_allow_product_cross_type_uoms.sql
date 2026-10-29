-- Allow cross-type conversions for local product UoMs.
--
-- Global conversions on public.uoms stay within the same measurement family
-- (e.g., 1 kg = 1000 g, 1 L = 1000 mL).
--
-- However, products in retail frequently bridge families (e.g., eggs:
-- 1 pc [unit] = 0.0625 kg [weight], or fabric: 1 roll [unit] = 50 m [length]).
--
-- This migration updates validate_product_uom_row() and sync_base_product_uom()
-- so that:
--   1. Product UoMs can link across measurement families when conversion_mode = 'local'.
--   2. Global conversion mode continues to enforce same measurement family.
--   3. Base UoM re-rooting marks reversed edges as 'local'.

create or replace function public.validate_product_uom_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child_type text;
  v_parent_type text;
  v_cursor uuid;
  v_guard int := 0;
  v_seen uuid[] := '{}';
begin
  if new.parent_product_uom_id is null then
    return new;
  end if;

  select u.uom_type into v_child_type
  from public.uoms u
  where u.id = new.uom_id;

  select u.uom_type into v_parent_type
  from public.product_uoms p
  join public.uoms u on u.id = p.uom_id
  where p.id = new.parent_product_uom_id;

  -- Global conversions must stay within the same family (e.g. g -> kg, ml -> L).
  -- Local conversions are permitted to cross families (e.g. 1 egg [unit] = 0.0625 kg [weight]).
  if new.conversion_mode = 'global' and v_child_type is distinct from v_parent_type then
    raise exception
      'Global unit conversions must share the same measurement family. Use a local product conversion for cross-type units.'
      using errcode = '23514';
  end if;

  -- Walk up from the intended parent; reaching this row (or repeating a node)
  -- means the change would introduce a cycle.
  v_cursor := new.parent_product_uom_id;
  while v_cursor is not null loop
    if v_cursor = new.id then
      raise exception 'A unit cannot be its own ancestor.'
        using errcode = '23514';
    end if;
    if v_cursor = any (v_seen) then
      raise exception 'Cycle detected in the unit hierarchy.'
        using errcode = '23514';
    end if;
    v_seen := v_seen || v_cursor;
    v_guard := v_guard + 1;
    if v_guard > 1000 then
      raise exception 'Unit hierarchy is too deep.'
        using errcode = '23514';
    end if;
    select p.parent_product_uom_id into v_cursor
    from public.product_uoms p
    where p.id = v_cursor and p.product_id = new.product_id;
  end loop;

  return new;
end;
$$;

drop trigger if exists product_uoms_validate_row on public.product_uoms;
create trigger product_uoms_validate_row
  before insert or update of uom_id, parent_product_uom_id, product_id, conversion_mode
  on public.product_uoms
  for each row
  execute function public.validate_product_uom_row();

create or replace function public.sync_base_product_uom()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_row_id uuid;
  v_old_root_id uuid;
  v_ids uuid[];
  v_qs numeric[];
  v_len int;
  v_i int;
begin
  -- Nothing to do when the base unit is untouched.
  if tg_op = 'UPDATE' and new.base_uom_id is not distinct from old.base_uom_id then
    return new;
  end if;

  select pu.id into v_new_row_id
  from public.product_uoms pu
  where pu.product_id = new.id and pu.uom_id = new.base_uom_id;

  select pu.id into v_old_root_id
  from public.product_uoms pu
  where pu.product_id = new.id and pu.parent_product_uom_id is null;

  -- New product, or no hierarchy yet: just make sure the base row exists.
  if v_old_root_id is null then
    insert into public.product_uoms (
      product_id, uom_id, parent_product_uom_id, quantity_in_parent, conversion_mode
    )
    values (new.id, new.base_uom_id, null, 1, 'local')
    on conflict (product_id, uom_id) do update
      set parent_product_uom_id = null,
          quantity_in_parent = 1,
          conversion_mode = 'local';
    return new;
  end if;

  if v_new_row_id is null then
    -- The requested base unit is not one of the product's units.
    if exists (
      select 1 from public.product_uoms pu
      where pu.product_id = new.id and pu.parent_product_uom_id is not null
    ) or exists (
      select 1 from public.product_prices pp
      where pp.product_id = new.id
    ) then
      raise exception
        'Cannot change the base unit to a unit that is not part of the product''s hierarchy. Add it as a unit first, or remove the other units and prices.'
        using errcode = '23514';
    end if;

    -- Only the lone base row exists: replace it.
    delete from public.product_uoms pu
    where pu.id = v_old_root_id and pu.product_id = new.id;
    insert into public.product_uoms (
      product_id, uom_id, parent_product_uom_id, quantity_in_parent, conversion_mode
    )
    values (new.id, new.base_uom_id, null, 1, 'local');
    return new;
  end if;

  if v_new_row_id = v_old_root_id then
    update public.product_uoms
      set parent_product_uom_id = null,
          quantity_in_parent = 1,
          conversion_mode = 'local'
      where id = v_new_row_id;
    return new;
  end if;

  -- Collect the path from the new base up to the old root.
  with recursive up as (
    select pu.id,
           pu.parent_product_uom_id as parent,
           pu.quantity_in_parent as q,
           0 as depth
    from public.product_uoms pu
    where pu.id = v_new_row_id
    union all
    select p.id, p.parent_product_uom_id, p.quantity_in_parent, up.depth + 1
    from public.product_uoms p
    join up on p.id = up.parent
    where up.depth < 1000
  )
  select array_agg(id order by depth), array_agg(q order by depth)
  into v_ids, v_qs
  from up;

  v_len := coalesce(array_length(v_ids, 1), 0);
  if v_len = 0 then
    return new;
  end if;

  -- New base becomes the root. Doing this first keeps the cycle guard happy.
  update public.product_uoms
    set parent_product_uom_id = null,
        quantity_in_parent = 1,
        conversion_mode = 'local'
    where id = v_ids[1];

  for v_i in 2 .. v_len loop
    update public.product_uoms
      set parent_product_uom_id = v_ids[v_i - 1],
          quantity_in_parent = 1 / v_qs[v_i - 1],
          conversion_mode = 'local'
      where id = v_ids[v_i];
  end loop;

  return new;
end;
$$;
