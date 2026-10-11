import type { CrudFilter } from "@refinedev/core";
import dayjs, { type Dayjs } from "dayjs";
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

export const PRODUCT_FILTER_COLUMNS: FilterColumnDef[] = [
  {
    key: "name",
    labelKey: "products.columns.name",
    type: "text",
    placeholderKey: "products.form.namePlaceholder",
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
    key: "sku",
    labelKey: "products.columns.sku",
    type: "text",
    placeholderKey: "products.columns.sku",
    toFilters: (value) => {
      const text = typeof value === "string" ? value.trim() : "";
      return text ? [{ field: "sku", operator: "contains", value: text }] : [];
    },
    fromFilters: (filters) => {
      const filter = findFilter(filters, "sku", "contains");
      return filter ? String(filter.value ?? "") : undefined;
    },
  },
  {
    key: "is_active",
    labelKey: "common.status",
    type: "select",
    options: [
      { labelKey: "common.active", value: true },
      { labelKey: "common.inactive", value: false },
    ],
    toFilters: (value) =>
      typeof value === "boolean"
        ? [{ field: "is_active", operator: "eq", value }]
        : [],
    fromFilters: (filters) => {
      const filter = findFilter(filters, "is_active", "eq");
      return filter ? Boolean(filter.value) : undefined;
    },
  },
  {
    key: "price",
    labelKey: "products.columns.price",
    type: "numberRange",
    toFilters: (value) => {
      const [min, max] = (value as [number | null, number | null]) ?? [];
      const filters: CrudFilter[] = [];
      if (min != null) {
        filters.push({ field: "price", operator: "gte", value: min });
      }
      if (max != null) {
        filters.push({ field: "price", operator: "lte", value: max });
      }
      return filters;
    },
    fromFilters: (filters) => {
      const min = findFilter(filters, "price", "gte");
      const max = findFilter(filters, "price", "lte");
      if (!min && !max) return undefined;
      return [min ? Number(min.value) : null, max ? Number(max.value) : null];
    },
  },
  {
    key: "created_at",
    labelKey: "common.created",
    type: "dateRange",
    toFilters: (value) => {
      const [start, end] = (value as [Dayjs, Dayjs]) ?? [];
      const filters: CrudFilter[] = [];
      if (start) {
        filters.push({
          field: "created_at",
          operator: "gte",
          value: start.startOf("day").toISOString(),
        });
      }
      if (end) {
        filters.push({
          field: "created_at",
          operator: "lte",
          value: end.endOf("day").toISOString(),
        });
      }
      return filters;
    },
    fromFilters: (filters) => {
      const start = findFilter(filters, "created_at", "gte");
      const end = findFilter(filters, "created_at", "lte");
      if (!start && !end) return undefined;
      return [
        start ? dayjs(start.value as string) : null,
        end ? dayjs(end.value as string) : null,
      ];
    },
  },
];

export function productConditionsToFilters(
  conditions: FilterCondition[],
): CrudFilter[] {
  return conditionsToFilters(PRODUCT_FILTER_COLUMNS, conditions);
}

export function productFiltersToConditions(
  filters: CrudFilter[],
): FilterCondition[] {
  return filtersToConditions(PRODUCT_FILTER_COLUMNS, filters);
}
