import type { Database } from "../../data/remote/database.types";
import type { GlobalFactorMap } from "../uoms/uomGlobalConversion";

export type ProductUom = Database["public"]["Tables"]["product_uoms"]["Row"];

/** Minimal shape needed to compute conversions (works with joined rows too). */
export interface UomLike {
  id: string;
  uom_id: string;
  parent_product_uom_id: string | null;
  quantity_in_parent: number | string;
  conversion_mode?: "global" | "local" | null;
}

/**
 * Factor that converts 1 of a unit into the product's base unit.
 *
 * A `global` row ignores its stored parent and uses the reusable UoM
 * conversion tree. A `local` row multiplies its own `quantity_in_parent` by
 * its parent's factor, so it can compose with a global parent. When a global
 * conversion is unavailable, the stored product tree is used as a fallback.
 *
 * The base unit does not have to be the smallest unit: a unit smaller than the
 * base simply yields a factor below 1.
 */
export function factorToBaseMap(
  rows: UomLike[],
  globalFactors?: GlobalFactorMap,
): Map<string, number> {
  const baseRow = rows.find((row) => row.parent_product_uom_id === null);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const cache = new Map<string, number>();
  const resolving = new Set<string>();

  const resolve = (id: string): number => {
    const cached = cache.get(id);
    if (cached !== undefined) {
      return cached;
    }

    const row = byId.get(id);
    if (!row || row.parent_product_uom_id === null) {
      cache.set(id, 1);
      return 1;
    }

    // A cycle should never pass the database trigger, but avoid hanging the
    // UI if a local/offline snapshot contains one.
    if (resolving.has(id)) {
      return 1;
    }
    resolving.add(id);

    let factor: number;
    const globalFactor =
      row.conversion_mode === "global" && globalFactors && baseRow
        ? globalFactors.factorToBase(row.uom_id, baseRow.uom_id)
        : null;

    if (globalFactor !== null) {
      factor = globalFactor;
    } else {
      factor =
        Number(row.quantity_in_parent) * resolve(row.parent_product_uom_id);
    }

    resolving.delete(id);
    cache.set(id, factor);
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
 * Global rows are anchored directly to the product base, so a priced sibling
 * may not be an ancestor or descendant in the stored tree. In that case any
 * recorded unit is a valid anchor because every product row shares one
 * conversion base.
 *
 * Derived values are never persisted; they are recomputed from the recorded
 * prices every time, so they stay correct when conversions change.
 */
export function derivePurchasePrices(
  rows: UomLike[],
  recorded: Map<string, number>,
  globalFactors?: GlobalFactorMap,
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

  const factorMap = factorToBaseMap(rows, globalFactors);

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

    // A global conversion can place two units side by side under the product
    // base. Any recorded unit in the same product is still a valid anchor.
    for (const candidate of rows) {
      if (candidate.id !== start.id && recorded.has(candidate.id)) {
        return candidate.id;
      }
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
  globalFactors?: GlobalFactorMap,
): number | null {
  return priceFromFactors(
    factorToBaseMap(rows, globalFactors),
    anchorId,
    targetId,
    anchorPrice,
  );
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
  // A chained global conversion can be smaller than the stored scale. Do not
  // render it as zero just because it is below six decimal places.
  if (parsed !== 0 && Math.abs(parsed) < 0.000001) {
    return parsed.toExponential(6).replace(/\.?0+e/, "e");
  }
  // Avoid floating point noise while keeping meaningful fractions.
  return Number(parsed.toFixed(6)).toString();
}
