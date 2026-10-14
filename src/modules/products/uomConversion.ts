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

/** Trim trailing zeros from a PostgREST numeric (e.g. 6.000000 -> "6"). */
export function formatQuantity(value: number | string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value);
  }
  // Avoid floating point noise while keeping meaningful fractions.
  return Number(parsed.toFixed(6)).toString();
}
