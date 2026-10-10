import { DeleteButton, EditButton, List, ShowButton, useTable } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Space, Table, Tag } from "antd";
import { useState } from "react";
import { ColumnFilterBar } from "../../../components/ColumnFilterBar";
import { type FilterCondition } from "../../../components/filtering";
import { normalizePrice, type Product } from "../product.schema";
import {
  PRODUCT_FILTER_COLUMNS,
  productConditionsToFilters,
  productFiltersToConditions,
} from "../product.filters";

export function ProductList() {
  const { tableProps, filters, setFilters, setCurrentPage } = useTable<
    Product,
    HttpError
  >({
    resource: "products",
    syncWithLocation: true,
    filters: {
      defaultBehavior: "replace",
      permanent: [{ field: "deleted_at", operator: "null", value: null }],
    },
    sorters: {
      initial: [{ field: "created_at", order: "desc" }],
    },
  });

  const [conditions, setConditions] = useState<FilterCondition[]>(() =>
    filters.length > 0 ? productFiltersToConditions(filters) : [],
  );

  const handleSubmit = () => {
    setFilters(productConditionsToFilters(conditions));
    setCurrentPage(1);
  };

  const handleClear = () => {
    setConditions([]);
    setFilters([]);
    setCurrentPage(1);
  };

  return (
    <List>
      <ColumnFilterBar
        columns={PRODUCT_FILTER_COLUMNS}
        value={conditions}
        onChange={setConditions}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />

      <Table {...tableProps} rowKey="id">
        <Table.Column
          title="Actions"
          render={(_, record: Product) => (
            <Space>
              <ShowButton hideText size="small" recordItemId={record.id} />
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column
          dataIndex="sku"
          title="SKU"
          render={(value: string | null) => value ?? "—"}
        />
        <Table.Column
          dataIndex="price"
          title="Price"
          align="right"
          render={(value: number | string) => normalizePrice(value).toFixed(2)}
        />
        <Table.Column
          dataIndex="is_active"
          title="Status"
          render={(value: boolean) => (
            <Tag color={value ? "green" : "default"}>
              {value ? "Active" : "Inactive"}
            </Tag>
          )}
        />
      </Table>
    </List>
  );
}
