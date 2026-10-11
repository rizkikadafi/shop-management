import { CreateButton, EditButton, List, useTable } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Button, Space, Table, Tag } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ColumnFilterBar } from "../../../components/ColumnFilterBar";
import { type FilterCondition } from "../../../components/filtering";
import { useI18n } from "../../../i18n/useI18n";
import {
  UOM_TYPE_COLORS,
  UOM_TYPE_LABEL_KEYS,
  type Uom,
  type UomType,
} from "../uom.schema";
import {
  UOM_FILTER_COLUMNS,
  uomConditionsToFilters,
  uomFiltersToConditions,
} from "../uom.filters";

export function UomList() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { tableProps, filters, setFilters, setCurrentPage } = useTable<
    Uom,
    HttpError
  >({
    resource: "uoms",
    syncWithLocation: true,
    filters: { defaultBehavior: "replace" },
    sorters: {
      initial: [{ field: "name", order: "asc" }],
    },
  });

  const [conditions, setConditions] = useState<FilterCondition[]>(() =>
    filters.length > 0 ? uomFiltersToConditions(filters) : [],
  );

  const handleSubmit = () => {
    setFilters(uomConditionsToFilters(conditions));
    setCurrentPage(1);
  };

  const handleClear = () => {
    setConditions([]);
    setFilters([]);
    setCurrentPage(1);
  };

  return (
    <List
      title={t("uoms.listTitle")}
      headerButtons={
        <Space wrap>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/products")}
          >
            {t("uoms.backToProducts")}
          </Button>
          <CreateButton>{t("uoms.create")}</CreateButton>
        </Space>
      }
    >
      <ColumnFilterBar
        columns={UOM_FILTER_COLUMNS}
        value={conditions}
        onChange={setConditions}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />

      <Table {...tableProps} rowKey="id" scroll={{ x: "max-content" }}>
        <Table.Column dataIndex="name" title={t("uoms.columns.name")} />
        <Table.Column dataIndex="symbol" title={t("uoms.columns.symbol")} />
        <Table.Column
          dataIndex="uom_type"
          title={t("uoms.columns.type")}
          render={(value: UomType) => (
            <Tag color={UOM_TYPE_COLORS[value]}>
              {t(UOM_TYPE_LABEL_KEYS[value])}
            </Tag>
          )}
        />
        <Table.Column
          title={t("uoms.columns.actions")}
          render={(_, record: Uom) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
}
