-- Keep products.price and the retail/base-unit price rule in sync.
--
-- The product edit screen treats them as two views of the same number. The
-- app writes both rows in the offline cache; these triggers guarantee the
-- server invariant as well, including rows created on another device and
-- products created while the local cache has not seen their base unit yet.
--
-- The linked rule is identified by:
--   * product_uom_id = the product's parentless base unit row
--   * price_list = retail (case-insensitive)
--   * min_quantity = 1

-- Find or create the linked rule without racing the unique constraint when a
-- legacy row uses a differently-cased price list.
create or replace function public.upsert_base_product_price(
  p_product_id uuid,
  p_product_uom_id uuid,
  p_price numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule_id uuid;
begin
  select pp.id into v_rule_id
  from public.product_prices pp
  where pp.product_id = p_product_id
    and pp.product_uom_id = p_product_uom_id
    and lower(trim(pp.price_list)) = 'retail'
    and pp.min_quantity = 1
  limit 1;

  if v_rule_id is not null then
    update public.product_prices
    set package_quantity = 1,
        package_price = p_price
    where id = v_rule_id
      and (
        package_quantity <> 1
        or package_price is distinct from p_price
      );
    return;
  end if;

  insert into public.product_prices (
    product_id,
    product_uom_id,
    price_list,
    min_quantity,
    package_quantity,
    package_price
  )
  values (
    p_product_id,
    p_product_uom_id,
    'retail',
    1,
    1,
    p_price
  )
  on conflict (product_id, product_uom_id, price_list, min_quantity)
  do update
    set package_quantity = 1,
        package_price = excluded.package_price
    where product_prices.package_quantity <> 1
       or product_prices.package_price is distinct from excluded.package_price;
end;
$$;

revoke all on function public.upsert_base_product_price(uuid, uuid, numeric)
  from public;

-- Product price -> linked rule.
create or replace function public.sync_base_price_from_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_row_id uuid;
begin
  select pu.id into v_base_row_id
  from public.product_uoms pu
  where pu.product_id = new.id
    and pu.uom_id = new.base_uom_id
    and pu.parent_product_uom_id is null
  limit 1;

  if v_base_row_id is not null then
    perform public.upsert_base_product_price(
      new.id,
      v_base_row_id,
      new.price
    );
  end if;

  return new;
end;
$$;

revoke all on function public.sync_base_price_from_product() from public;

drop trigger if exists sync_base_price_on_products on public.products;
create trigger sync_base_price_on_products
  after insert or update of price on public.products
  for each row
  execute function public.sync_base_price_from_product();

-- Base-unit row -> linked rule. This covers new products, where the product
-- trigger may run before the base product_uom row exists, and base-unit
-- re-rooting.
create or replace function public.ensure_base_price_on_product_uom()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price numeric(18, 2);
begin
  if new.parent_product_uom_id is not null
     or new.quantity_in_parent <> 1 then
    return new;
  end if;

  select p.price into v_price
  from public.products p
  where p.id = new.product_id;

  if found then
    perform public.upsert_base_product_price(
      new.product_id,
      new.id,
      v_price
    );
  end if;

  return new;
end;
$$;

revoke all on function public.ensure_base_price_on_product_uom() from public;

drop trigger if exists ensure_base_price_on_product_uoms on public.product_uoms;
create trigger ensure_base_price_on_product_uoms
  after insert or update of parent_product_uom_id, quantity_in_parent
  on public.product_uoms
  for each row
  execute function public.ensure_base_price_on_product_uom();

-- Linked rule -> product price.
create or replace function public.sync_product_price_from_base_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_uom_id uuid;
begin
  if lower(trim(new.price_list)) <> 'retail'
     or new.min_quantity <> 1 then
    return new;
  end if;

  select p.base_uom_id into v_base_uom_id
  from public.products p
  where p.id = new.product_id;

  if v_base_uom_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.product_uoms pu
    where pu.id = new.product_uom_id
      and pu.product_id = new.product_id
      and pu.uom_id = v_base_uom_id
      and pu.parent_product_uom_id is null
  ) then
    update public.products
    set price = new.package_price
    where id = new.product_id
      and price is distinct from new.package_price;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_product_price_from_base_rule() from public;

drop trigger if exists sync_product_price_from_base_rule_on_prices
  on public.product_prices;
create trigger sync_product_price_from_base_rule_on_prices
  after insert or update of
    package_price,
    product_uom_id,
    price_list,
    min_quantity
  on public.product_prices
  for each row
  execute function public.sync_product_price_from_base_rule();

-- Give every existing product a linked rule when it does not already have
-- one. Existing linked rules are left as-is; the next edit reconciles them.
insert into public.product_prices (
  product_id,
  product_uom_id,
  price_list,
  min_quantity,
  package_quantity,
  package_price
)
select
  p.id,
  pu.id,
  'retail',
  1,
  1,
  coalesce(p.price, 0)
from public.products p
join public.product_uoms pu
  on pu.product_id = p.id
 and pu.uom_id = p.base_uom_id
 and pu.parent_product_uom_id is null
where p.deleted_at is null
  and not exists (
    select 1
    from public.product_prices pp
    where pp.product_id = p.id
      and pp.product_uom_id = pu.id
      and lower(trim(pp.price_list)) = 'retail'
      and pp.min_quantity = 1
  );
