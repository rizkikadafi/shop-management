import type { CrudFilter, CrudSort } from "@refinedev/core";
import type { LocalRow } from "./db";
import type { SyncResourceConfig } from "./resources";

/**
 * In-memory query engine implementing the subset of Refine/PostgREST filter,
 * sort and pagination semantics used by the app. The dataset is a single
 * shop's catalog (small), so filtering in memory keeps behaviour simple and
 * predictable while matching the remote provider's results.
 */

type LogicalFilter = CrudFilter & { field: string; operator: string; value: unknown };

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Compare two values the way Postgres would for the supported operators. */
function compare(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;

  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber === rightNumber ? 0 : leftNumber < rightNumber ? -1 : 1;
  }

  const leftString = String(left);
  const rightString = String(right);
  return leftString.localeCompare(rightString);
}

function like(value: unknown, pattern: string, caseSensitive: boolean): boolean {
  const raw = value == null ? "" : String(value);
  const haystack = caseSensitive ? raw : raw.toLowerCase();
  const needle = caseSensitive ? pattern : pattern.toLowerCase();
  const regex = new RegExp(
    `^${needle
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/%/g, ".*")}$`,
  );
  return regex.test(haystack);
}

function contains(value: unknown, search: unknown, caseSensitive: boolean): boolean {
  const raw = value == null ? "" : String(value);
  const needle = String(search ?? "");
  return caseSensitive
    ? raw.includes(needle)
    : raw.toLowerCase().includes(needle.toLowerCase());
}

function oneOf(value: unknown, list: unknown): boolean {
  if (!Array.isArray(list)) return false;
  return list.some((item) =>
    typeof item === "string" || typeof item === "number" || typeof item === "boolean"
      ? String(item) === String(value)
      : item === value,
  );
}

export function matchesFilter(
  row: LocalRow,
  filter: CrudFilter,
): boolean {
  if (!("field" in filter)) {
    const nested = filter.value as CrudFilter[];
    if (filter.operator === "or") {
      return nested.some((item) => matchesFilter(row, item));
    }
    return nested.every((item) => matchesFilter(row, item));
  }

  const { field, operator, value } = filter as LogicalFilter;
  const current = row[field];

  switch (operator) {
    case "eq":
      return String(current) === String(value) || current === value;
    case "ne":
      return !(String(current) === String(value) || current === value);
    case "in":
      return oneOf(current, value);
    case "nin":
      return !oneOf(current, value);
    case "contains":
      return contains(current, value, false);
    case "ncontains":
      return !contains(current, value, false);
    case "containss":
      return contains(current, value, true);
    case "ncontainss":
      return !contains(current, value, true);
    case "startswith":
      return like(current, `${value}%`, false);
    case "endswith":
      return like(current, `%${value}`, false);
    case "gt":
      return current != null && compare(current, value) > 0;
    case "gte":
      return current != null && compare(current, value) >= 0;
    case "lt":
      return current != null && compare(current, value) < 0;
    case "lte":
      return current != null && compare(current, value) <= 0;
    case "between": {
      const [min, max] = Array.isArray(value) ? value : [];
      return (
        current != null &&
        compare(current, min) >= 0 &&
        compare(current, max) <= 0
      );
    }
    case "nbetween": {
      const [min, max] = Array.isArray(value) ? value : [];
      return !(
        current != null &&
        compare(current, min) >= 0 &&
        compare(current, max) <= 0
      );
    }
    case "null":
      return current == null;
    case "nnull":
      return current != null;
    case "ina":
      return oneOf(value, current);
    case "nina":
      return !oneOf(value, current);
    default:
      return true;
  }
}

export function applyFilters(rows: LocalRow[], filters?: CrudFilter[]): LocalRow[] {
  if (!filters || filters.length === 0) {
    return rows;
  }
  return rows.filter((row) => filters.every((filter) => matchesFilter(row, filter)));
}

export function applySorters(rows: LocalRow[], sorters?: CrudSort[]): LocalRow[] {
  if (!sorters || sorters.length === 0) {
    return rows;
  }
  const sorted = [...rows];
  sorted.sort((left, right) => {
    for (const sorter of sorters) {
      const result = compare(left[sorter.field], right[sorter.field]);
      if (result !== 0) {
        return sorter.order === "asc" ? result : -result;
      }
    }
    return 0;
  });
  return sorted;
}

export interface PaginateResult {
  rows: LocalRow[];
  total: number;
}

export function paginate(
  rows: LocalRow[],
  pagination:
    | { current?: number; pageSize?: number; mode?: "server" | "client" | "off" }
    | undefined,
): PaginateResult {
  const total = rows.length;
  if (!pagination || pagination.mode === "off") {
    return { rows, total };
  }
  const current = pagination.current ?? 1;
  const pageSize = pagination.pageSize ?? 10;
  const start = (current - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total };
}

/** Search across the resource's declared searchable columns (Refine `q`). */
export function applySearch(
  rows: LocalRow[],
  term: string,
  config: SyncResourceConfig | undefined,
): LocalRow[] {
  const needle = term.trim().toLowerCase();
  if (!needle || !config) {
    return rows;
  }
  return rows.filter((row) =>
    config.searchableColumns.some((column) =>
      String(row[column] ?? "")
        .toLowerCase()
        .includes(needle),
    ),
  );
}
