import { Show } from "@refinedev/antd";
import { useShow } from "@refinedev/core";
import { Descriptions, Tag, Tabs } from "antd";
import { normalizePrice, type Product } from "../product.schema";
import { ProductUnitsTable } from "../components/ProductUnitsTable";
import { ProductPricesTable } from "../components/ProductPricesTable";

type ProductRecord = Product & {
  category?: { name?: string | null } | null;
  base_uom?: { name?: string | null; symbol?: string | null } | null;
};

export function ProductShow() {
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
            label: "General Information",
            children: (
              <Descriptions column={1} bordered size="middle">
                <Descriptions.Item label="Name">
                  {record?.name}
                </Descriptions.Item>
                <Descriptions.Item label="SKU">
                  {record?.sku ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Description">
                  {record?.description ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Category">
                  {record?.category?.name ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Base Unit of Measure">
                  {record?.base_uom
                    ? `${record.base_uom.name} (${record.base_uom.symbol ?? ""})`
                    : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Price">
                  {record ? normalizePrice(record.price).toFixed(2) : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  {record ? (
                    <Tag color={record.is_active ? "green" : "default"}>
                      {record.is_active ? "Active" : "Inactive"}
                    </Tag>
                  ) : (
                    "—"
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {record ? new Date(record.created_at).toLocaleString() : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Updated">
                  {record ? new Date(record.updated_at).toLocaleString() : "—"}
                </Descriptions.Item>
              </Descriptions>
            ),
          },
          {
            key: "units",
            label: "Unit Conversions",
            children: record ? (
              <ProductUnitsTable
                productId={record.id}
                baseUomId={record.base_uom_id}
              />
            ) : null,
          },
          {
            key: "pricing",
            label: "Pricing Information",
            children: record ? (
              <ProductPricesTable productId={record.id} />
            ) : null,
          },
        ]}
      />
    </Show>
  );
}