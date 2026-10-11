import type { TableColumnProps } from "antd";
import type { CrudFilters } from "@refinedev/core";
import type { ComponentProps, ReactNode } from "react";
import { ColumnFilterControl, type SetFilters } from "./columnFilters";
import type { FilterColumnDef } from "./filtering";

type AntdFilterDropdownProps = ComponentProps<
  Exclude<TableColumnProps["filterDropdown"], ReactNode>
>;

export function createColumnFilter(
  columns: FilterColumnDef[],
  filters: CrudFilters,
  setFilters: SetFilters,
  setCurrentPage?: (page: number) => void,
) {
  return (
    key: string,
  ): Pick<TableColumnProps, "filterDropdown" | "filteredValue"> => {
    const def = columns.find((column) => column.key === key);
    if (!def) return {};

    const active = def.fromFilters(filters) !== undefined;

    return {
      filterDropdown: (props: AntdFilterDropdownProps) => (
        <ColumnFilterControl
          def={def}
          filters={filters}
          setFilters={setFilters}
          setCurrentPage={setCurrentPage}
          close={props.close}
        />
      ),
      filteredValue: active ? ["active"] : null,
    };
  };
}
