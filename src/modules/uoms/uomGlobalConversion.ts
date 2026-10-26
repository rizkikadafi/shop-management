/** Minimal UoM shape needed to resolve the reusable global conversion tree. */
export interface GlobalUomLike {
  id: string;
  uom_type?: string | null;
  global_parent_uom_id?: string | null;
  global_quantity_in_parent?: number | string | null;
}

export interface GlobalFactorEntry {
  /** Root of the global conversion tree containing this unit. */
  rootId: string;
  /** Quantity of the root represented by one of this unit. */
  factor: number;
  uomType: string | null;
  valid: boolean;
}

export interface GlobalFactorMap {
  readonly entries: Map<string, GlobalFactorEntry>;
  /**
   * Factor that converts one `unitId` into `baseId` using the global tree.
   * Returns null when the units do not share a valid global conversion.
   */
  factorToBase(unitId: string, baseId: string): number | null;
}

function positiveNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Build lookup factors for the reusable global UoM tree.
 *
 * The global tree is a forest: each UoM has at most one global parent. Factors
 * are relative to the root (`1` for roots). Cycles and malformed links are
 * marked invalid so callers can fall back to local product conversions.
 */
export function buildGlobalFactorMap(
  uoms: GlobalUomLike[],
): GlobalFactorMap {
  const byId = new Map(uoms.map((uom) => [uom.id, uom]));
  const entries = new Map<string, GlobalFactorEntry>();
  const visiting = new Set<string>();

  const resolve = (id: string): GlobalFactorEntry | null => {
    const cached = entries.get(id);
    if (cached) {
      return cached;
    }

    const uom = byId.get(id);
    if (!uom) {
      return null;
    }

    if (visiting.has(id)) {
      return null;
    }

    visiting.add(id);

    const parentId = uom.global_parent_uom_id ?? null;
    const quantity = positiveNumber(uom.global_quantity_in_parent);
    let entry: GlobalFactorEntry;

    if (parentId === null) {
      entry = {
        rootId: id,
        factor: 1,
        uomType: uom.uom_type ?? null,
        valid: true,
      };
    } else {
      const parent = resolve(parentId);
      const sameType =
        !uom.uom_type ||
        !parent?.uomType ||
        uom.uom_type === parent.uomType;

      if (!parent || !parent.valid || quantity === null || !sameType) {
        entry = {
          rootId: id,
          factor: 0,
          uomType: uom.uom_type ?? null,
          valid: false,
        };
      } else {
        entry = {
          rootId: parent.rootId,
          factor: parent.factor * quantity,
          uomType: uom.uom_type ?? null,
          valid: true,
        };
      }
    }

    visiting.delete(id);
    entries.set(id, entry);
    return entry;
  };

  for (const uom of uoms) {
    resolve(uom.id);
  }

  return {
    entries,
    factorToBase(unitId: string, baseId: string): number | null {
      const unit = entries.get(unitId) ?? resolve(unitId);
      const base = entries.get(baseId) ?? resolve(baseId);

      if (!unit?.valid || !base?.valid) {
        return null;
      }
      if (unit.rootId !== base.rootId || unit.uomType !== base.uomType) {
        return null;
      }
      if (!(base.factor > 0)) {
        return null;
      }

      return unit.factor / base.factor;
    },
  };
}

/** Every UoM below `rootId` in the global tree, excluding the root itself. */
export function globalDescendantIds(
  uoms: GlobalUomLike[],
  rootId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const uom of uoms) {
    const parentId = uom.global_parent_uom_id;
    if (!parentId) {
      continue;
    }
    const children = childrenByParent.get(parentId) ?? [];
    children.push(uom.id);
    childrenByParent.set(parentId, children);
  }

  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];

  while (stack.length) {
    const id = stack.pop()!;
    if (id === rootId || descendants.has(id)) {
      continue;
    }
    descendants.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }

  return descendants;
}
