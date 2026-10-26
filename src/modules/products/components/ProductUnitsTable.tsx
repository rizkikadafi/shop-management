import { useList } from "@refinedev/core";
import { Space, Table, Tag } from "antd";
import { useMemo } from "react";
import { useI18n } from "../../../i18n/useI18n";
import type { Database } from "../../../data/remote/database.types";
import { factorToBaseMap, formatQuantity } from "../uomConversion";

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
      select:
        "id, product_id, uom_id, parent_product_uom_id, quantity_in_parent, created_at, updated_at, uom:uom_id(name, symbol)",
    },
  });

  const rows = useMemo(() => result.data ?? [], [result.data]);
  const isLoading = query.isLoading;

  const factorMap = useMemo(() => factorToBaseMap(rows), [rows]);
  const baseRow = useMemo(
    () => rows.find((row) => row.uom_id === baseUomId),
    [rows, baseUomId],
  );
  const baseSymbol = baseRow
    ? symbolOf(baseRow, t("productUnits.unit"))
    : t("productUnits.unit");

  const unitFilters = useMemo(() => {
    const seen = new Set<string>();
    return rows.flatMap((row) => {
      if (seen.has(row.uom_id)) return [];
      seen.add(row.uom_id);
      return [
        {
          text: row.uom
            ? `${row.uom.name} (${row.uom.symbol ?? ""})`
            : row.uom_id,
          value: row.uom_id,
        },
      ];
    });
  }, [rows]);

  const filterLocale = {
    filterConfirm: t("filters.filter"),
    filterReset: t("filters.clear"),
  };

  const isBase = (row: ProductUomRow) => row.uom_id === baseUomId;

  return (
    <Table<ProductUomRow>
      rowKey="id"
      loading={isLoading}
      dataSource={rows}
      pagination={false}
      locale={filterLocale}
      scroll={{ x: "max-content" }}
    >
      <Table.Column<ProductUomRow>
        title={t("productUnits.unit")}
        filters={unitFilters}
        filterSearch
        onFilter={(value, row) => row.uom_id === value}
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
          if (isBase(row)) {
            return t("common.none");
          }
          const factor = factorMap.get(row.id) ?? 1;
          const fallback = t("productUnits.unit");
          return `1 ${symbolOf(row, fallback)} = ${formatQuantity(factor)} ${baseSymbol}`;
        }}
      />
    </Table>
  );
}
