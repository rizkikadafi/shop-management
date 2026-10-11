import { useCan, useList } from "@refinedev/core";
import { Button, Space, Table, Tag } from "antd";
import { EditOutlined, TagsOutlined } from "@ant-design/icons";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import type { Database } from "../../../data/remote/database.types";

type ProductPrice = Database["public"]["Tables"]["product_prices"]["Row"];

type ProductUomLookup = {
  id: string;
  uom?: { name?: string | null; symbol?: string | null } | null;
};

interface ProductPricesTableProps {
  productId: string;
}

/** Trim trailing zeros from a PostgREST numeric (e.g. 1.000000 -> "1"). */
function formatQty(value: number | string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toString() : String(value);
}

function formatPrice(value: number | string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : String(value);
}

export function ProductPricesTable({ productId }: ProductPricesTableProps) {
  const navigate = useNavigate();
  const { data: canEditData } = useCan({
    resource: "products",
    action: "edit",
  });
  const canEdit = canEditData?.can ?? false;

  const uomQuery = useList<ProductUomLookup>({
    resource: "product_uoms",
    filters: [{ field: "product_id", operator: "eq", value: productId }],
    pagination: { pageSize: 1000 },
    meta: { select: "id, uom_id, uom:uom_id(name, symbol)" },
  });
  const uomRecords = uomQuery.result.data ?? [];

  const { query, result } = useList<ProductPrice>({
    resource: "product_prices",
    filters: [{ field: "product_id", operator: "eq", value: productId }],
    sorters: [{ field: "created_at", order: "asc" }],
    pagination: { pageSize: 1000 },
    meta: {
      select: "id, product_id, product_uom_id, price_list, min_quantity, package_quantity, package_price, created_at, updated_at",
    },
  });

  const rows = result.data ?? [];
  const isLoading = query.isLoading || uomQuery.query.isLoading;

  const uomById = useMemo(
    () => new Map(uomRecords.map((uom) => [uom.id, uom])),
    [uomRecords],
  );

  return (
    <Table<ProductPrice>
      rowKey="id"
      loading={isLoading}
      dataSource={rows}
      pagination={false}
      title={() => (
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <span>Price Rules</span>
          {canEdit && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/products/edit/${productId}`)}
            >
              Edit units &amp; prices
            </Button>
          )}
        </Space>
      )}
    >
      <Table.Column<ProductPrice>
        title="Unit"
        render={(_, row) => {
          const productUom = uomById.get(row.product_uom_id);
          return productUom?.uom
            ? `${productUom.uom.name} (${productUom.uom.symbol ?? ""})`
            : row.product_uom_id;
        }}
      />
      <Table.Column<ProductPrice>
        title="Price list"
        render={(_, row) => (
          <Tag icon={<TagsOutlined />} color="blue">
            {row.price_list}
          </Tag>
        )}
      />
      <Table.Column<ProductPrice>
        title="Min qty"
        align="right"
        render={(_, row) => formatQty(row.min_quantity)}
      />
      <Table.Column<ProductPrice>
        title="Price"
        align="right"
        render={(_, row) => formatPrice(row.package_price)}
      />
    </Table>
  );
}
