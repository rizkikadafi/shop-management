import type { CrudFilter } from "@refinedev/core";
import {
  conditionsToFilters,
  filtersToConditions,
  type FilterColumnDef,
  type FilterCondition,
} from "../../components/filtering";
import { UOM_TYPES, type UomType } from "./uom.schema";

function findFilter(
  filters: CrudFilter[],
  field: string,
  operator: string,
): (CrudFilter & { value?: unknown }) | undefined {
  return filters.find(
    (filter) => "field" in filter && filter.field === field && filter.operator === operator,
  ) as (CrudFilter & { value?: unknown }) | undefined;
}

export const UOM_FILTER_COLUMNS: FilterColumnDef[] = [
  {
    key: "name",
    label: "Name",
    type: "text",
    placeholder: "Unit name",
    toFilters: (value) => {
      const text = typeof value === "string" ? value.trim() : "";
      return text ? [{ field: "name", operator: "contains", value: text }] : [];
    },
    fromFilters: (filters) => {
      const filter = findFilter(filters, "name", "contains");
      return filter ? String(filter.value ?? "") : undefined;
    },
  },
  {
    key: "symbol",
    label: "Symbol",
    type: "text",
    placeholder: "Symbol",
    toFilters: (value) => {
      const text = typeof value === "string" ? value.trim() : "";
      return text ? [{ field: "symbol", operator: "contains", value: text }] : [];
    },
    fromFilters: (filters) => {
      const filter = findFilter(filters, "symbol", "contains");
      return filter ? String(filter.value ?? "") : undefined;
    },
  },
  {
    key: "uom_type",
    label: "Type",
    type: "select",
    options: UOM_TYPES.map((type) => ({ ...type })),
    toFilters: (value) =>
      typeof value === "string"
        ? [{ field: "uom_type", operator: "eq", value }]
        : [],
    fromFilters: (filters) => {
      const filter = findFilter(filters, "uom_type", "eq");
      return filter ? (filter.value as UomType) : undefined;
    },
  },
];

export function uomConditionsToFilters(
  conditions: FilterCondition[],
): CrudFilter[] {
  return conditionsToFilters(UOM_FILTER_COLUMNS, conditions);
}

export function uomFiltersToConditions(
  filters: CrudFilter[],
): FilterCondition[] {
  return filtersToConditions(UOM_FILTER_COLUMNS, filters);
}
