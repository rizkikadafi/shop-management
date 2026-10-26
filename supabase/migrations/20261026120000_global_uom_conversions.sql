-- Global UoM conversion trees.
--
-- A UoM can define a reusable conversion to another UoM of the same
-- measurement family. Product UoMs can inherit these conversions or keep an
-- individual local override.
--
-- Examples:
--   1 kg      = 1000 g
--   1 karung  = 50 kg
--   1 L       = 1000 mL
--   1 box     = 4 pack      (optional, if every product agrees)
--
-- The global tree is optional for every UoM type. A UoM without a global
-- parent is a root and converts to 1 of itself.

-- 1. Global conversion tree on public.uoms.
alter table public.uoms
  add column if not exists global_parent_uom_id uuid
    references public.uoms (id) on delete restrict;
alter table public.uoms
  add column if not exists global_quantity_in_parent numeric(18, 6);

comment on column public.uoms.global_parent_uom_id is
  'Parent unit in the reusable global conversion tree. Null marks a global root.';
comment on column public.uoms.global_quantity_in_parent is
  'How many parent units one of this unit equals in the global conversion tree.';

alter table public.uoms
  drop constraint if exists uoms_global_parent_not_self;
alter table public.uoms
  add constraint uoms_global_parent_not_self
  check (global_parent_uom_id is null or global_parent_uom_id <> id);

alter table public.uoms
  drop constraint if exists uoms_global_conversion_pair;
alter table public.uoms
  add constraint uoms_global_conversion_pair
  check (
    (global_parent_uom_id is null and global_quantity_in_parent is null)
    or (global_parent_uom_id is not null and global_quantity_in_parent is not null)
  );

alter table public.uoms
  drop constraint if exists uoms_global_quantity_positive;
alter table public.uoms
  add constraint uoms_global_quantity_positive
  check (global_quantity_in_parent is null or global_quantity_in_parent > 0);

create index if not exists uoms_global_parent_idx
  on public.uoms (global_parent_uom_id);

-- Validate family compatibility and prevent cycles in the global tree.
create or replace function public.validate_uom_global_conversion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_type text;
  v_cursor uuid;
  v_seen uuid[] := '{}';
  v_guard int := 0;
begin
  -- When a unit changes family, its existing global children must match too.
  if tg_op = 'UPDATE' and new.uom_type is distinct from old.uom_type then
    if exists (
      select 1
      from public.uoms child
      where child.global_parent_uom_id = new.id
        and child.uom_type is distinct from new.uom_type
    ) then
      raise exception
        'Global parent and child units must share the same measurement family.'
        using errcode = '23514';
    end if;
  end if;

  if new.global_parent_uom_id is null then
    return new;
  end if;

  if new.global_parent_uom_id = new.id then
    raise exception 'A unit cannot be its own global parent.'
      using errcode = '23514';
  end if;

  select parent.uom_type into v_parent_type
  from public.uoms parent
  where parent.id = new.global_parent_uom_id;

  if v_parent_type is null then
    raise exception 'Global parent unit not found.'
      using errcode = '23503';
  end if;

  if new.uom_type is distinct from v_parent_type then
    raise exception
      'Global parent and child units must share the same measurement family.'
      using errcode = '23514';
  end if;

  -- Walk up from the intended parent; reaching this row (or repeating a node)
  -- means the change would introduce a cycle.
  v_cursor := new.global_parent_uom_id;
  while v_cursor is not null loop
    if v_cursor = new.id then
      raise exception 'A unit cannot be its own global ancestor.'
        using errcode = '23514';
    end if;
    if v_cursor = any (v_seen) then
      raise exception 'Cycle detected in the global unit hierarchy.'
        using errcode = '23514';
    end if;
    v_seen := v_seen || v_cursor;
    v_guard := v_guard + 1;
    if v_guard > 1000 then
      raise exception 'Global unit hierarchy is too deep.'
        using errcode = '23514';
    end if;
    select parent.global_parent_uom_id into v_cursor
    from public.uoms parent
    where parent.id = v_cursor;
  end loop;

  return new;
end;
$$;

drop trigger if exists uoms_validate_global_conversion on public.uoms;
create trigger uoms_validate_global_conversion
  before insert or update of global_parent_uom_id, global_quantity_in_parent, uom_type
  on public.uoms
  for each row
  execute function public.validate_uom_global_conversion();

-- 2. Seed the common metric tree. Unknown custom units keep a null parent so
--    products can continue using their local conversion until it is configured.
update public.uoms child
set global_parent_uom_id = parent.id,
    global_quantity_in_parent = case lower(trim(child.symbol))
      when 'kg' then 1000
      when 'mg' then 0.001
      when 't' then 1000000
    end
from public.uoms parent
where child.uom_type = 'weight'
  and parent.uom_type = 'weight'
  and lower(trim(parent.symbol)) = 'g'
  and lower(trim(child.symbol)) in ('kg', 'mg', 't')
  and child.global_parent_uom_id is null;

update public.uoms child
set global_parent_uom_id = parent.id,
    global_quantity_in_parent = case lower(trim(child.symbol))
      when 'l' then 1000
      when 'cl' then 10
      when 'dl' then 100
    end
from public.uoms parent
where child.uom_type = 'volume'
  and parent.uom_type = 'volume'
  and lower(trim(parent.symbol)) = 'ml'
  and lower(trim(child.symbol)) in ('l', 'cl', 'dl')
  and child.global_parent_uom_id is null;

-- If the previous canonical implementation was already applied, preserve any
-- custom global values it stored before removing that column.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'uoms'
      and column_name = 'base_quantity'
  ) then
    execute $sql$
      update public.uoms child
      set global_parent_uom_id = parent.id,
          global_quantity_in_parent = child.base_quantity
      from public.uoms parent
      where parent.uom_type = child.uom_type
        and lower(trim(parent.symbol)) in ('g', 'ml')
        and child.base_quantity is not null
        and child.base_quantity > 0
        and child.id <> parent.id
        and child.global_parent_uom_id is null
    $sql$;

    execute 'alter table public.uoms drop column base_quantity';
  end if;
end $$;

-- 3. Per-product inheritance mode. Each non-base product row chooses
--    independently. Base rows stay local because their conversion is always 1.
--
-- All ALTER TABLE statements run before the backfill update: product_uoms has
-- deferred constraint triggers, and PostgreSQL refuses further ALTER TABLE
-- statements while those trigger events are still pending in a transaction.
do $$
declare
  v_added boolean := false;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_uoms'
      and column_name = 'conversion_mode'
  ) then
    alter table public.product_uoms
      add column conversion_mode text not null default 'local';
    v_added := true;
  end if;

  alter table public.product_uoms
    alter column conversion_mode set default 'local';
  alter table public.product_uoms
    alter column conversion_mode set not null;

  alter table public.product_uoms
    drop constraint if exists product_uoms_conversion_mode_check;
  alter table public.product_uoms
    add constraint product_uoms_conversion_mode_check
    check (conversion_mode in ('global', 'local'));

  comment on column public.product_uoms.conversion_mode is
    'global: use the UoM global conversion directly; local: use parent_product_uom_id and quantity_in_parent.';

  if v_added then
    -- Existing non-base rows whose UoM has a shared conversion available keep
    -- the shared behavior. Local overrides can be enabled per row in the UI.
    update public.product_uoms product_uom
    set conversion_mode = 'global'
    from public.uoms uom
    where uom.id = product_uom.uom_id
      and uom.global_parent_uom_id is not null
      and product_uom.parent_product_uom_id is not null;
  end if;
end $$;
