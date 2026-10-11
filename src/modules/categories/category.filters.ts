import type { CrudFilter } from "@refinedev/core";
import {
  conditionsToFilters,
  filtersToConditions,
  type FilterColumnDef,
  type FilterCondition,
} from "../../components/filtering";

function findFilter(
  filters: CrudFilter[],
  field: string,
  operator: string,
): (CrudFilter & { value?: unknown }) | undefined {
  return filters.find(
    (filter) => "field" in filter && filter.field === field && filter.operator === operator,
  ) as (CrudFilter & { value?: unknown }) | undefined;
}

export const CATEGORY_FILTER_COLUMNS: FilterColumnDef[] = [
  {
    key: "name",
    labelKey: "categories.columns.name",
    type: "text",
    placeholderKey: "categories.form.namePlaceholder",
    toFilters: (value) => {
      const text = typeof value === "string" ? value.trim() : "";
      return text ? [{ field: "name", operator: "contains", value: text }] : [];
    },
    fromFilters: (filters) => {
      const filter = findFilter(filters, "name", "contains");
      return filter ? String(filter.value ?? "") : undefined;
    },
  },
];

export function categoryConditionsToFilters(
  conditions: FilterCondition[],
): CrudFilter[] {
  return conditionsToFilters(CATEGORY_FILTER_COLUMNS, conditions);
}

export function categoryFiltersToConditions(
  filters: CrudFilter[],
): FilterCondition[] {
  return filtersToConditions(CATEGORY_FILTER_COLUMNS, filters);
}
