import { useList } from "@refinedev/core";
import { Table, Tag, Typography } from "antd";
import { useMemo } from "react";
import { useI18n } from "../../../i18n/useI18n";
import type { Database } from "../../../data/remote/database.types";
import { useUomGlobalFactors } from "../../uoms/useUomGlobalFactors";
import { derivePurchasePrices } from "../uomConversion";

type ProductPurchasePrice =
  Database["public"]["Tables"]["product_purchase_prices"]["Row"];

type ProductUomRow = Database["public"]["Tables"]["product_uoms"]["Row"] & {
  uom?: {
    name?: string | null;
    symbol?: string | null;
  } | null;
};

interface ProductPurchasePricesTableProps {
  productId: string;
}

function labelOf(row: ProductUomRow | undefined, fallback = ""): string {
  if (!row) {
    return fallback;
  }
  return row.uom ? `${row.uom.name} (${row.uom.symbol ?? ""})` : row.id;
}

export function ProductPurchasePricesTable({
  productId,
}: ProductPurchasePricesTableProps) {
  const { t, formatCurrency } = useI18n();
  const {
    globalFactors,
    isLoading: uomsLoading,
  } = useUomGlobalFactors();

  const uomQuery = useList<ProductUomRow>({
    resource: "product_uoms",
    filters: [{ field: "product_id", operator: "eq", value: productId }],
    sorters: [{ field: "created_at", order: "asc" }],
    pagination: { pageSize: 1000 },
    meta: {
      select:
        "id, product_id, uom_id, parent_product_uom_id, quantity_in_parent, conversion_mode, created_at, updated_at, uom:uom_id(name, symbol)",
    },
  });
  const units = useMemo(
    () => uomQuery.result.data ?? [],
    [uomQuery.result.data],
  );

  const { query, result } = useList<ProductPurchasePrice>({
    resource: "product_purchase_prices",
    filters: [{ field: "product_id", operator: "eq", value: productId }],
    sorters: [{ field: "created_at", order: "asc" }],
    pagination: { pageSize: 1000 },
    meta: {
      select:
        "id, product_id, product_uom_id, purchase_price, created_at, updated_at",
    },
  });
  const prices = useMemo(() => result.data ?? [], [result.data]);
  const isLoading = query.isLoading || uomQuery.query.isLoading || uomsLoading;

  const unitById = useMemo(
    () => new Map(units.map((unit) => [unit.id, unit])),
    [units],
  );
  const recordedPrices = useMemo(
    () =>
      new Map(
        prices.map((price) => [
          price.product_uom_id,
          Number(price.purchase_price),
        ]),
      ),
    [prices],
  );
  const infoByUnit = useMemo(
    () => derivePurchasePrices(units, recordedPrices, globalFactors),
    [units, recordedPrices, globalFactors],
  );
  const unitFilters = useMemo(
    () =>
      units.map((unit) => ({
        text: labelOf(unit, unit.id),
        value: unit.id,
      })),
    [units],
  );

  const filterLocale = {
    filterConfirm: t("filters.filter"),
    filterReset: t("filters.clear"),
  };

  return (
    <Table<ProductUomRow>
      rowKey="id"
      loading={isLoading}
      dataSource={units}
      pagination={false}
      locale={filterLocale}
      scroll={{ x: "max-content" }}
    >
      <Table.Column<ProductUomRow>
        title={t("purchasePrices.unit")}
        filters={unitFilters}
        filterSearch
        onFilter={(value, unit) => unit.id === value}
        render={(_, unit) => labelOf(unit, unit.id)}
      />
      <Table.Column<ProductUomRow>
        title={t("purchasePrices.price")}
        render={(_, unit) => {
          const info = infoByUnit.get(unit.id);
          if (!info || info.price === null) {
            return t("common.none");
          }
          return info.source === "derived" ? (
            <Typography.Text type="secondary">
              {formatCurrency(info.price)}
            </Typography.Text>
          ) : (
            formatCurrency(info.price)
          );
        }}
      />
      <Table.Column<ProductUomRow>
        title={t("purchasePrices.source")}
        render={(_, unit) => {
          const info = infoByUnit.get(unit.id);
          if (!info || info.source === "none") {
            return <Tag>{t("purchasePrices.sourceNone")}</Tag>;
          }
          if (info.source === "manual") {
            return <Tag color="green">{t("purchasePrices.sourceManual")}</Tag>;
          }
          return <Tag color="blue">{t("purchasePrices.sourceDerived")}</Tag>;
        }}
      />
      <Table.Column<ProductUomRow>
        title={t("purchasePrices.basedOn")}
        render={(_, unit) => {
          const info = infoByUnit.get(unit.id);
          const anchor = info?.anchorId
            ? unitById.get(info.anchorId)
            : undefined;
          return anchor ? labelOf(anchor, anchor.id) : t("common.none");
        }}
      />
    </Table>
  );
}
