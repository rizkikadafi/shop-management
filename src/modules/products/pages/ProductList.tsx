import {
  CreateButton,
  EditButton,
  List,
  ShowButton,
  useTable,
} from "@refinedev/antd";
import { useList, type HttpError } from "@refinedev/core";
import { Space, Table, Tag } from "antd";
import { useMemo } from "react";
import { createColumnFilter } from "../../../components/columnFilterProps";
import { useI18n } from "../../../i18n/useI18n";
import { type Product } from "../product.schema";
import { ProductSoftDeleteButton } from "../components/ProductSoftDeleteButton";
import {
  baseUomFilterColumn,
  categoryFilterColumn,
  PRODUCT_FILTER_COLUMNS,
} from "../product.filters";

type ProductRow = Product & {
  category?: { name?: string | null } | null;
  base_uom?: { name?: string | null; symbol?: string | null } | null;
};

export function ProductList() {
  const { t, formatCurrency } = useI18n();
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

  const categoriesQuery = useList<{ id: string; name: string }>({
    resource: "categories",
    pagination: { mode: "off" },
    sorters: [{ field: "name", order: "asc" }],
  });
  const uomsQuery = useList<{ id: string; name: string; symbol: string | null }>({
    resource: "uoms",
    pagination: { mode: "off" },
    sorters: [{ field: "name", order: "asc" }],
  });

  const filterColumns = useMemo(
    () => [
      ...PRODUCT_FILTER_COLUMNS,
      categoryFilterColumn(
        (categoriesQuery.result.data ?? []).map((category) => ({
          label: category.name,
          value: category.id,
        })),
      ),
      baseUomFilterColumn(
        (uomsQuery.result.data ?? []).map((uom) => ({
          label: uom.symbol ? `${uom.name} (${uom.symbol})` : uom.name,
          value: uom.id,
        })),
      ),
    ],
    [categoriesQuery.result.data, uomsQuery.result.data],
  );

  const filterProps = createColumnFilter(
    filterColumns,
    filters,
    setFilters,
    setCurrentPage,
  );

  return (
    <List
      title={t("products.listTitle")}
      headerButtons={
        <CreateButton>{t("products.create")}</CreateButton>
      }
    >
      <Table {...tableProps} rowKey="id" scroll={{ x: "max-content" }}>
        <Table.Column
          title={t("products.columns.actions")}
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
        <Table.Column
          dataIndex="name"
          title={t("products.columns.name")}
          {...filterProps("name")}
        />
        <Table.Column
          dataIndex="sku"
          title={t("products.columns.sku")}
          render={(value: string | null) => value ?? t("common.none")}
          {...filterProps("sku")}
        />
        <Table.Column
          dataIndex="category_id"
          title={t("products.columns.category")}
          render={(_, record: ProductRow) =>
            record.category?.name ?? t("common.none")
          }
          {...filterProps("category_id")}
        />
        <Table.Column
          dataIndex="base_uom_id"
          title={t("products.columns.baseUom")}
          render={(_, record: ProductRow) =>
            record.base_uom
              ? `${record.base_uom.name} (${record.base_uom.symbol ?? ""})`
              : t("common.none")
          }
          {...filterProps("base_uom_id")}
        />
        <Table.Column
          dataIndex="price"
          title={t("products.columns.price")}
          align="right"
          render={(value: number | string) => formatCurrency(value)}
          {...filterProps("price")}
        />
        <Table.Column
          dataIndex="is_active"
          title={t("products.columns.status")}
          render={(value: boolean) => (
            <Tag color={value ? "green" : "default"}>
              {value ? t("common.active") : t("common.inactive")}
            </Tag>
          )}
          {...filterProps("is_active")}
        />
      </Table>
    </List>
  );
}
