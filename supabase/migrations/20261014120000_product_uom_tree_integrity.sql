-- Product UoM tree integrity.
--
-- Option A: a product's base UoM is the *root* of a single conversion tree.
-- The base may be any size (not necessarily the smallest): units smaller than
-- the base simply store a fractional quantity_in_parent (< 1).
--
-- This migration:
--   1. Validates each row (same measurement family, no cycles).
--   2. Replaces sync_base_product_uom() so changing products.base_uom_id
--      re-roots the existing hierarchy instead of leaving a second root.
--   3. Repairs legacy products that ended up with multiple parentless rows.
--   4. Guards the single-root invariant with a deferred constraint trigger.

-- 1. Row-level validation: measurement-family compatibility + cycle prevention.
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

  if v_child_type is distinct from v_parent_type then
    raise exception
      'Parent and child units must share the same measurement family.'
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
  before insert or update of uom_id, parent_product_uom_id, product_id
  on public.product_uoms
  for each row
  execute function public.validate_product_uom_row();

-- 2. Base-unit changes re-root the existing tree instead of creating a forest.
--
--    If the requested base unit already exists as a product unit we reverse the
--    edges on the path from it up to the old root (inverting each factor), so
--    the relative conversions are preserved and nothing has to be deleted
--    (price rules keep working). If the requested base unit is unrelated and the
--    product already has conversions or prices, the change is rejected.
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
      product_id, uom_id, parent_product_uom_id, quantity_in_parent
    )
    values (new.id, new.base_uom_id, null, 1)
    on conflict (product_id, uom_id) do update
      set parent_product_uom_id = null,
          quantity_in_parent = 1;
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
      product_id, uom_id, parent_product_uom_id, quantity_in_parent
    )
    values (new.id, new.base_uom_id, null, 1);
    return new;
  end if;

  if v_new_row_id = v_old_root_id then
    update public.product_uoms
      set parent_product_uom_id = null, quantity_in_parent = 1
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
    set parent_product_uom_id = null, quantity_in_parent = 1
    where id = v_ids[1];

  for v_i in 2 .. v_len loop
    update public.product_uoms
      set parent_product_uom_id = v_ids[v_i - 1],
          quantity_in_parent = 1 / v_qs[v_i - 1]
      where id = v_ids[v_i];
  end loop;

  return new;
end;
$$;

-- 3. Repair legacy products that ended up with more than one parentless row.
--    Extra roots that are childless and unreferenced by prices are removed;
--    anything else is reported so it can be reconciled manually.
do $$
declare
  v_product uuid;
  v_base uuid;
  v_extra uuid;
begin
  for v_product, v_base in
    select p.id, p.base_uom_id
    from public.products p
    where (
      select count(*) from public.product_uoms pu
      where pu.product_id = p.id and pu.parent_product_uom_id is null
    ) > 1
  loop
    for v_extra in
      select pu.id
      from public.product_uoms pu
      where pu.product_id = v_product
        and pu.parent_product_uom_id is null
        and pu.uom_id <> v_base
        and not exists (
          select 1 from public.product_uoms c
          where c.parent_product_uom_id = pu.id
        )
        and not exists (
          select 1 from public.product_prices pp
          where pp.product_uom_id = pu.id
        )
    loop
      delete from public.product_uoms where id = v_extra;
    end loop;

    if (
      select count(*) from public.product_uoms pu
      where pu.product_id = v_product and pu.parent_product_uom_id is null
    ) > 1 then
      raise notice
        'Product % still has multiple base rows; please reconcile manually.',
        v_product;
    end if;
  end loop;
end;
$$;

-- 4. Deferred invariant: exactly one parentless row per product, and it must be
--    the row for products.base_uom_id with quantity_in_parent = 1. Because every
--    finite acyclic forest component has one parentless node, this (together with
--    the cycle guard above) also guarantees a single connected tree.
create or replace function public.check_product_uom_tree()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
  v_base uuid;
  v_root_count int;
begin
  select p.base_uom_id into v_base
  from public.products p
  where p.id = v_product;

  -- Product row gone (cascade delete): nothing to validate.
  if v_base is null then
    return null;
  end if;

  select count(*) into v_root_count
  from public.product_uoms pu
  where pu.product_id = v_product
    and pu.parent_product_uom_id is null;

  if v_root_count <> 1 then
    raise exception
      'Product % must have exactly one base unit row (found %).',
      v_product, v_root_count
      using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.product_uoms pu
    where pu.product_id = v_product
      and pu.parent_product_uom_id is null
      and pu.uom_id = v_base
      and pu.quantity_in_parent = 1
  ) then
    raise exception
      'Product % base unit row is inconsistent with products.base_uom_id.',
      v_product
      using errcode = '23514';
  end if;

  return null;
end;
$$;

drop trigger if exists product_uoms_tree_check on public.product_uoms;
create constraint trigger product_uoms_tree_check
  after insert or update or delete on public.product_uoms
  deferrable initially deferred
  for each row
  execute function public.check_product_uom_tree();
