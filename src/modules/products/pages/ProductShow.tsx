import { Show } from "@refinedev/antd";
import { useShow } from "@refinedev/core";
import { Descriptions, Tag } from "antd";
import { normalizePrice, type Product } from "../product.schema";

export function ProductShow() {
  const { query, result } = useShow<Product>({ resource: "products" });
  const { isLoading } = query;
  const record = result;

  return (
    <Show isLoading={isLoading}>
      <Descriptions column={1} bordered size="middle">
        <Descriptions.Item label="Name">{record?.name}</Descriptions.Item>
        <Descriptions.Item label="SKU">{record?.sku ?? "—"}</Descriptions.Item>
        <Descriptions.Item label="Description">
          {record?.description ?? "—"}
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
    </Show>
  );
}
