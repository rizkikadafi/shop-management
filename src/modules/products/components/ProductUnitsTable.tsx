import { useList } from "@refinedev/core";
import { Space, Table, Tag } from "antd";
import { useMemo } from "react";
import { useI18n } from "../../../i18n/useI18n";
import type { Database } from "../../../data/remote/database.types";

type ProductUom = Database["public"]["Tables"]["product_uoms"]["Row"];

type ProductUomRow = ProductUom & {
  uom?: { name?: string | null; symbol?: string | null } | null;
};

interface ProductUnitsTableProps {
  productId: string;
  baseUomId: string;
}

function symbolOf(uom: ProductUomRow, fallback: string): string {
  return uom.uom?.symbol || uom.uom?.name || fallback;
}

/** Trim trailing zeros from a PostgREST numeric (e.g. 6.000000 -> "6"). */
function formatQty(value: number | string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toString() : String(value);
}

export function ProductUnitsTable({
  productId,
  baseUomId,
}: ProductUnitsTableProps) {
  const { t } = useI18n();
  const { query, result } = useList<ProductUomRow>({
    resource: "product_uoms",
    filters: [{ field: "product_id", operator: "eq", value: productId }],
    sorters: [{ field: "created_at", order: "asc" }],
    pagination: { pageSize: 1000 },
    meta: {
      select: "id, product_id, uom_id, parent_product_uom_id, quantity_in_parent, created_at, updated_at, uom:uom_id(name, symbol)",
    },
  });

  const rows = useMemo(() => result.data ?? [], [result.data]);
  const isLoading = query.isLoading;

  const unitById = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows],
  );

  const isBase = (row: ProductUomRow) => row.uom_id === baseUomId;

  return (
    <Table<ProductUomRow>
      rowKey="id"
      loading={isLoading}
      dataSource={rows}
      pagination={false}
      scroll={{ x: "max-content" }}
    >
      <Table.Column<ProductUomRow>
        title={t("productUnits.unit")}
        render={(_, row) => (
          <Space>
            {row.uom ? `${row.uom.name} (${row.uom.symbol ?? ""})` : row.uom_id}
            {isBase(row) && <Tag color="green">{t("productUnits.base")}</Tag>}
          </Space>
        )}
      />
      <Table.Column<ProductUomRow>
        title={t("productUnits.conversion")}
        render={(_, row) => {
          if (!row.parent_product_uom_id) {
            return t("common.none");
          }
          const parent = unitById.get(row.parent_product_uom_id);
          const fallback = t("productUnits.unit");
          return parent
            ? `1 ${symbolOf(row, fallback)} = ${formatQty(row.quantity_in_parent)} ${symbolOf(parent, fallback)}`
            : t("common.none");
        }}
      />
    </Table>
  );
}
