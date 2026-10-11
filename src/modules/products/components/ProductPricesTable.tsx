import { useCan, useList } from "@refinedev/core";
import { Button, Space, Table, Tag } from "antd";
import { EditOutlined, TagsOutlined } from "@ant-design/icons";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useI18n } from "../../../i18n/useI18n";
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

export function ProductPricesTable({ productId }: ProductPricesTableProps) {
  const navigate = useNavigate();
  const { t, formatCurrency } = useI18n();
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
  const uomRecords = useMemo(
    () => uomQuery.result.data ?? [],
    [uomQuery.result.data],
  );

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
      scroll={{ x: "max-content" }}
      title={() => (
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <span>{t("productPrices.title")}</span>
          {canEdit && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/products/edit/${productId}`)}
            >
              {t("productPrices.editUnits")}
            </Button>
          )}
        </Space>
      )}
    >
      <Table.Column<ProductPrice>
        title={t("productPrices.unit")}
        render={(_, row) => {
          const productUom = uomById.get(row.product_uom_id);
          return productUom?.uom
            ? `${productUom.uom.name} (${productUom.uom.symbol ?? ""})`
            : row.product_uom_id;
        }}
      />
      <Table.Column<ProductPrice>
        title={t("productPrices.priceList")}
        render={(_, row) => (
          <Tag icon={<TagsOutlined />} color="blue">
            {row.price_list}
          </Tag>
        )}
      />
      <Table.Column<ProductPrice>
        title={t("productPrices.minQty")}
        align="right"
        render={(_, row) => formatQty(row.min_quantity)}
      />
      <Table.Column<ProductPrice>
        title={t("productPrices.price")}
        align="right"
        render={(_, row) => formatCurrency(row.package_price)}
      />
    </Table>
  );
}
