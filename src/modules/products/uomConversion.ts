import type { Database } from "../../data/remote/database.types";

export type ProductUom = Database["public"]["Tables"]["product_uoms"]["Row"];

/** Minimal shape needed to compute conversions (works with joined rows too). */
export interface UomLike {
  id: string;
  uom_id: string;
  parent_product_uom_id: string | null;
  quantity_in_parent: number | string;
}

/**
 * Factor that converts 1 of a unit into the product's base unit. It is the
 * product of the `quantity_in_parent` values along the path up to the root
 * (the base row has no parent, so its factor is 1).
 *
 * The base unit does not have to be the smallest unit: a unit smaller than the
 * base simply yields a factor below 1.
 */
export function factorToBaseMap(rows: UomLike[]): Map<string, number> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const cache = new Map<string, number>();

  const resolve = (startId: string): number => {
    const cached = cache.get(startId);
    if (cached !== undefined) {
      return cached;
    }

    let factor = 1;
    let cursor: UomLike | undefined = byId.get(startId);
    const seen = new Set<string>();
    let guard = 0;

    while (cursor?.parent_product_uom_id && guard < 1000) {
      if (seen.has(cursor.id)) {
        break;
      }
      seen.add(cursor.id);
      factor *= Number(cursor.quantity_in_parent);
      cursor = byId.get(cursor.parent_product_uom_id);
      guard += 1;
    }

    cache.set(startId, factor);
    return factor;
  };

  for (const row of rows) {
    resolve(row.id);
  }

  return cache;
}

/** Ids of every unit that sits below `rootId` in the product's unit tree. */
export function descendantIds(rows: UomLike[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, UomLike[]>();
  for (const row of rows) {
    if (!row.parent_product_uom_id) {
      continue;
    }
    const siblings = childrenByParent.get(row.parent_product_uom_id) ?? [];
    siblings.push(row);
    childrenByParent.set(row.parent_product_uom_id, siblings);
  }

  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];

  while (stack.length) {
    const node = stack.pop()!;
    if (descendants.has(node.id)) {
      continue;
    }
    descendants.add(node.id);
    stack.push(...(childrenByParent.get(node.id) ?? []));
  }

  return descendants;
}

export type PurchasePriceSource = "manual" | "derived" | "none";

export interface PurchasePriceInfo {
  price: number | null;
  source: PurchasePriceSource;
  /** Product UoM id whose recorded price the value was derived from. */
  anchorId: string | null;
}

/** Round a monetary amount to 2 decimals. */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Resolve a purchase price for every unit of a product.
 *
 * Recorded prices win. Unrecorded units are derived from the nearest recorded
 * unit in the conversion tree (ancestors first, then descendants):
 *
 *   price(target) = price(anchor) * factor(target) / factor(anchor)
 *
 * Derived values are never persisted; they are recomputed from the recorded
 * prices every time, so they stay correct when conversions change.
 */
export function derivePurchasePrices(
  rows: UomLike[],
  recorded: Map<string, number>,
): Map<string, PurchasePriceInfo> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const childrenByParent = new Map<string, UomLike[]>();
  for (const row of rows) {
    if (!row.parent_product_uom_id) {
      continue;
    }
    const list = childrenByParent.get(row.parent_product_uom_id) ?? [];
    list.push(row);
    childrenByParent.set(row.parent_product_uom_id, list);
  }

  const factorMap = factorToBaseMap(rows);

  const findAnchor = (start: UomLike): string | null => {
    // Walk up to the root first so an ancestor is preferred when it is priced.
    const seen = new Set<string>([start.id]);
    let cursor = start.parent_product_uom_id
      ? byId.get(start.parent_product_uom_id)
      : undefined;
    while (cursor && !seen.has(cursor.id)) {
      if (recorded.has(cursor.id)) {
        return cursor.id;
      }
      seen.add(cursor.id);
      cursor = cursor.parent_product_uom_id
        ? byId.get(cursor.parent_product_uom_id)
        : undefined;
    }

    // Otherwise take the closest priced descendant.
    const queue = [...(childrenByParent.get(start.id) ?? [])];
    while (queue.length) {
      const node = queue.shift()!;
      if (seen.has(node.id)) {
        continue;
      }
      seen.add(node.id);
      if (recorded.has(node.id)) {
        return node.id;
      }
      queue.push(...(childrenByParent.get(node.id) ?? []));
    }

    return null;
  };

  const result = new Map<string, PurchasePriceInfo>();
  for (const row of rows) {
    const manual = recorded.get(row.id);
    if (manual !== undefined) {
      result.set(row.id, { price: manual, source: "manual", anchorId: null });
      continue;
    }

    const anchorId = findAnchor(row);
    const anchorPrice = anchorId ? recorded.get(anchorId) : undefined;
    if (anchorId === null || anchorPrice === undefined) {
      result.set(row.id, { price: null, source: "none", anchorId: null });
      continue;
    }

    result.set(row.id, {
      price: priceFromFactors(factorMap, anchorId, row.id, anchorPrice),
      source: "derived",
      anchorId,
    });
  }

  return result;
}

/**
 * Price of `targetId` given the recorded price of `anchorId`, using the
 * product's conversion factors. Used by the "calculate from" action.
 */
export function derivePriceBetween(
  rows: UomLike[],
  anchorId: string,
  targetId: string,
  anchorPrice: number,
): number | null {
  return priceFromFactors(factorToBaseMap(rows), anchorId, targetId, anchorPrice);
}

function priceFromFactors(
  factors: Map<string, number>,
  anchorId: string,
  targetId: string,
  anchorPrice: number,
): number | null {
  const anchorFactor = factors.get(anchorId) ?? 1;
  const targetFactor = factors.get(targetId) ?? 1;
  if (anchorFactor === 0) {
    return null;
  }
  return roundCurrency((anchorPrice * targetFactor) / anchorFactor);
}

/** Trim trailing zeros from a PostgREST numeric (e.g. 6.000000 -> "6"). */
export function formatQuantity(value: number | string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value);
  }
  // Avoid floating point noise while keeping meaningful fractions.
  return Number(parsed.toFixed(6)).toString();
}
