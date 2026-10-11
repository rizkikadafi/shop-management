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
import { useI18n } from "../../../i18n/useI18n";
import { type Product } from "../product.schema";
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
      title={t("products.listTitle")}
      headerButtons={
        <Space wrap>
          <Button
            icon={<AppstoreOutlined />}
            onClick={() => navigate("/products/categories")}
          >
            {t("resources.categories")}
          </Button>
          <Button
            icon={<ExperimentOutlined />}
            onClick={() => navigate("/products/uoms")}
          >
            {t("resources.uoms")}
          </Button>
          <CreateButton>{t("products.create")}</CreateButton>
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
        <Table.Column dataIndex="name" title={t("products.columns.name")} />
        <Table.Column
          dataIndex="sku"
          title={t("products.columns.sku")}
          render={(value: string | null) => value ?? t("common.none")}
        />
        <Table.Column
          title={t("products.columns.category")}
          render={(_, record: ProductRow) =>
            record.category?.name ?? t("common.none")
          }
        />
        <Table.Column
          title={t("products.columns.baseUom")}
          render={(_, record: ProductRow) =>
            record.base_uom
              ? `${record.base_uom.name} (${record.base_uom.symbol ?? ""})`
              : t("common.none")
          }
        />
        <Table.Column
          dataIndex="price"
          title={t("products.columns.price")}
          align="right"
          render={(value: number | string) => formatCurrency(value)}
        />
        <Table.Column
          dataIndex="is_active"
          title={t("products.columns.status")}
          render={(value: boolean) => (
            <Tag color={value ? "green" : "default"}>
              {value ? t("common.active") : t("common.inactive")}
            </Tag>
          )}
        />
      </Table>
    </List>
  );
}
