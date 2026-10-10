import type { CrudFilter } from "@refinedev/core";

export type FilterColumnType = "text" | "select" | "numberRange" | "dateRange";

export interface FilterSelectOption {
  label: string;
  value: string | number | boolean;
}

export interface FilterColumnDef {
  key: string;
  label: string;
  type: FilterColumnType;
  placeholder?: string;
  options?: FilterSelectOption[];
  /** Column value -> zero or more Refine filters (empty value returns []). */
  toFilters: (value: unknown) => CrudFilter[];
  /** Active Refine filters -> column value, or undefined when the column is unused. */
  fromFilters: (filters: CrudFilter[]) => unknown;
}

export interface FilterCondition {
  id: string;
  column: string;
  value: unknown;
}

/** Build the Refine filter list from the user's chosen conditions. */
export function conditionsToFilters(
  columns: FilterColumnDef[],
  conditions: FilterCondition[],
): CrudFilter[] {
  return conditions.flatMap((condition) => {
    const def = columns.find((column) => column.key === condition.column);
    return def ? def.toFilters(condition.value) : [];
  });
}

/** Rebuild conditions from active filters (e.g. parsed from the URL). */
export function filtersToConditions(
  columns: FilterColumnDef[],
  filters: CrudFilter[],
): FilterCondition[] {
  return columns.flatMap((def) => {
    const value = def.fromFilters(filters);
    return value === undefined
      ? []
      : [{ id: crypto.randomUUID(), column: def.key, value }];
  });
}
