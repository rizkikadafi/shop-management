import { Show } from "@refinedev/antd";
import { useShow } from "@refinedev/core";
import { Descriptions, Tag, Tabs } from "antd";
import { useI18n } from "../../../i18n/useI18n";
import { type Product } from "../product.schema";
import { ProductUnitsTable } from "../components/ProductUnitsTable";
import { ProductPricesTable } from "../components/ProductPricesTable";

type ProductRecord = Product & {
  category?: { name?: string | null } | null;
  base_uom?: { name?: string | null; symbol?: string | null } | null;
};

export function ProductShow() {
  const { t, formatCurrency, formatDateTime } = useI18n();
  const { query, result } = useShow<Product>({
    resource: "products",
    meta: {
      select: "id, user_id, sku, name, description, price, is_active, category_id, base_uom_id, created_at, updated_at, deleted_at, category:category_id(name), base_uom:base_uom_id(name, symbol)",
    },
  });
  const { isLoading } = query;
  const record = result as ProductRecord | undefined;

  return (
    <Show isLoading={isLoading}>
      <Tabs
        items={[
          {
            key: "general",
            label: t("products.show.general"),
            children: (
              <Descriptions column={1} bordered size="middle">
                <Descriptions.Item label={t("products.columns.name")}>
                  {record?.name}
                </Descriptions.Item>
                <Descriptions.Item label={t("products.columns.sku")}>
                  {record?.sku ?? t("common.none")}
                </Descriptions.Item>
                <Descriptions.Item label={t("products.form.description")}>
                  {record?.description ?? t("common.none")}
                </Descriptions.Item>
                <Descriptions.Item label={t("products.columns.category")}>
                  {record?.category?.name ?? t("common.none")}
                </Descriptions.Item>
                <Descriptions.Item label={t("products.form.baseUom")}>
                  {record?.base_uom
                    ? `${record.base_uom.name} (${record.base_uom.symbol ?? ""})`
                    : t("common.none")}
                </Descriptions.Item>
                <Descriptions.Item label={t("products.columns.price")}>
                  {record ? formatCurrency(record.price) : t("common.none")}
                </Descriptions.Item>
                <Descriptions.Item label={t("common.status")}>
                  {record ? (
                    <Tag color={record.is_active ? "green" : "default"}>
                      {record.is_active ? t("common.active") : t("common.inactive")}
                    </Tag>
                  ) : (
                    t("common.none")
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={t("products.show.created")}>
                  {record
                    ? formatDateTime(record.created_at)
                    : t("common.none")}
                </Descriptions.Item>
                <Descriptions.Item label={t("products.show.updated")}>
                  {record
                    ? formatDateTime(record.updated_at)
                    : t("common.none")}
                </Descriptions.Item>
              </Descriptions>
            ),
          },
          {
            key: "units",
            label: t("products.show.units"),
            children: record ? (
              <ProductUnitsTable
                productId={record.id}
                baseUomId={record.base_uom_id}
              />
            ) : null,
          },
          {
            key: "pricing",
            label: t("products.show.pricing"),
            children: record ? (
              <ProductPricesTable productId={record.id} />
            ) : null,
          },
        ]}
      />
    </Show>
  );
}