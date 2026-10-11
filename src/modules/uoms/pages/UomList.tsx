import { CreateButton, EditButton, List, useTable } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Space, Table, Tag } from "antd";
import { useNavigate } from "react-router";
import { createColumnFilter } from "../../../components/columnFilterProps";
import { useI18n } from "../../../i18n/useI18n";
import {
  UOM_TYPE_COLORS,
  UOM_TYPE_LABEL_KEYS,
  type Uom,
  type UomType,
} from "../uom.schema";
import { UOM_FILTER_COLUMNS } from "../uom.filters";

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

  const filterProps = createColumnFilter(
    UOM_FILTER_COLUMNS,
    filters,
    setFilters,
    setCurrentPage,
  );

  return (
    <List
      title={t("uoms.listTitle")}
      headerButtons={
        <CreateButton>{t("uoms.create")}</CreateButton>
      }
    >
      <Table {...tableProps} rowKey="id" scroll={{ x: "max-content" }}>
        <Table.Column
          dataIndex="name"
          title={t("uoms.columns.name")}
          {...filterProps("name")}
        />
        <Table.Column
          dataIndex="symbol"
          title={t("uoms.columns.symbol")}
          {...filterProps("symbol")}
        />
        <Table.Column
          dataIndex="uom_type"
          title={t("uoms.columns.type")}
          render={(value: UomType) => (
            <Tag color={UOM_TYPE_COLORS[value]}>
              {t(UOM_TYPE_LABEL_KEYS[value])}
            </Tag>
          )}
          {...filterProps("uom_type")}
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
