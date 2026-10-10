import type { CrudFilter } from "@refinedev/core";
import {
  conditionsToFilters,
  filtersToConditions,
  type FilterColumnDef,
  type FilterCondition,
} from "../../components/filtering";
import { ROLES, type AppRole } from "./user.schema";

function findFilter(
  filters: CrudFilter[],
  field: string,
  operator: string,
): (CrudFilter & { value?: unknown }) | undefined {
  return filters.find(
    (filter) => "field" in filter && filter.field === field && filter.operator === operator,
  ) as (CrudFilter & { value?: unknown }) | undefined;
}

export const USER_FILTER_COLUMNS: FilterColumnDef[] = [
  {
    key: "email",
    label: "Email",
    type: "text",
    placeholder: "Email",
    toFilters: (value) => {
      const text = typeof value === "string" ? value.trim() : "";
      return text ? [{ field: "email", operator: "contains", value: text }] : [];
    },
    fromFilters: (filters) => {
      const filter = findFilter(filters, "email", "contains");
      return filter ? String(filter.value ?? "") : undefined;
    },
  },
  {
    key: "full_name",
    label: "Name",
    type: "text",
    placeholder: "Full name",
    toFilters: (value) => {
      const text = typeof value === "string" ? value.trim() : "";
      return text
        ? [{ field: "full_name", operator: "contains", value: text }]
        : [];
    },
    fromFilters: (filters) => {
      const filter = findFilter(filters, "full_name", "contains");
      return filter ? String(filter.value ?? "") : undefined;
    },
  },
  {
    key: "role",
    label: "Role",
    type: "select",
    options: ROLES,
    toFilters: (value) =>
      typeof value === "string"
        ? [{ field: "role", operator: "eq", value }]
        : [],
    fromFilters: (filters) => {
      const filter = findFilter(filters, "role", "eq");
      return filter ? (filter.value as AppRole) : undefined;
    },
  },
  {
    key: "is_active",
    label: "Status",
    type: "select",
    options: [
      { label: "Active", value: true },
      { label: "Inactive", value: false },
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
];

export function userConditionsToFilters(
  conditions: FilterCondition[],
): CrudFilter[] {
  return conditionsToFilters(USER_FILTER_COLUMNS, conditions);
}

export function userFiltersToConditions(
  filters: CrudFilter[],
): FilterCondition[] {
  return filtersToConditions(USER_FILTER_COLUMNS, filters);
}
