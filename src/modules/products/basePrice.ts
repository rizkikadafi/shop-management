/**
 * The single price rule that mirrors `products.price`.
 *
 * The product's base price is the retail rule for its base unit at a minimum
 * quantity of one. Keeping this in one place lets the form, the price editor,
 * and the offline data layer agree on which row is linked.
 */

export const BASE_PRICE_LIST = "retail";
export const BASE_PRICE_MIN_QUANTITY = 1;

export interface PriceRuleLike {
  product_uom_id: string;
  price_list: string;
  min_quantity: number | string;
}

export function normalizePriceList(value: string): string {
  return value.trim().toLowerCase();
}

export function isBasePriceRule(
  rule: PriceRuleLike,
  baseProductUomId: string | null | undefined,
): boolean {
  if (!baseProductUomId || rule.product_uom_id !== baseProductUomId) {
    return false;
  }

  return (
    normalizePriceList(rule.price_list) === BASE_PRICE_LIST &&
    Number(rule.min_quantity) === BASE_PRICE_MIN_QUANTITY
  );
}

export function samePriceRuleIdentity(
  a: PriceRuleLike,
  b: PriceRuleLike,
): boolean {
  return (
    a.product_uom_id === b.product_uom_id &&
    normalizePriceList(a.price_list) === normalizePriceList(b.price_list) &&
    Number(a.min_quantity) === Number(b.min_quantity)
  );
}
