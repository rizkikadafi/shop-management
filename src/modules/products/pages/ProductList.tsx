import {
  CreateButton,
  EditButton,
  List,
  ShowButton,
  useTable,
} from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Button, Space, Table, Tag } from "antd";
import { AppstoreOutlined, ExperimentOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ColumnFilterBar } from "../../../components/ColumnFilterBar";
import { type FilterCondition } from "../../../components/filtering";
import { normalizePrice, type Product } from "../product.schema";
import { ProductSoftDeleteButton } from "../components/ProductSoftDeleteButton";
import {
  PRODUCT_FILTER_COLUMNS,
  productConditionsToFilters,
  productFiltersToConditions,
} from "../product.filters";

type ProductRow = Product & {
  category?: { name?: string | null } | null;
  base_uom?: { name?: string | null; symbol?: string | null } | null;
};

export function ProductList() {
  const navigate = useNavigate();
  const { tableProps, filters, setFilters, setCurrentPage } = useTable<
    Product,
    HttpError
  >({
    resource: "products",
    syncWithLocation: true,
    meta: {
      select: "id, user_id, sku, name, description, price, is_active, category_id, base_uom_id, created_at, updated_at, deleted_at, category:category_id(name), base_uom:base_uom_id(name, symbol)",
    },
    filters: {
      defaultBehavior: "replace",
      permanent: [{ field: "deleted_at", operator: "null", value: true }],
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
    <List
      title="Products"
      headerButtons={
        <Space wrap>
          <Button
            icon={<AppstoreOutlined />}
            onClick={() => navigate("/products/categories")}
          >
            Categories
          </Button>
          <Button
            icon={<ExperimentOutlined />}
            onClick={() => navigate("/products/uoms")}
          >
            Units of Measure
          </Button>
          <CreateButton>Create product</CreateButton>
        </Space>
      }
    >
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
          render={(_, record: ProductRow) => (
            <Space>
              <ShowButton hideText size="small" recordItemId={record.id} />
              <EditButton hideText size="small" recordItemId={record.id} />
              <ProductSoftDeleteButton
                hideText
                size="small"
                recordItemId={record.id}
              />
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
          title="Category"
          render={(_, record: ProductRow) => record.category?.name ?? "—"}
        />
        <Table.Column
          title="Base UoM"
          render={(_, record: ProductRow) =>
            record.base_uom
              ? `${record.base_uom.name} (${record.base_uom.symbol ?? ""})`
              : "—"
          }
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
