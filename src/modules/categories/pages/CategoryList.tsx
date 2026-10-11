import { CreateButton, EditButton, List, useTable } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Space, Table } from "antd";
import { useNavigate } from "react-router";
import { createColumnFilter } from "../../../components/columnFilterProps";
import { useI18n } from "../../../i18n/useI18n";
import type { Category } from "../category.schema";
import { CATEGORY_FILTER_COLUMNS } from "../category.filters";

export function CategoryList() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { tableProps, filters, setFilters, setCurrentPage } = useTable<
    Category,
    HttpError
  >({
    resource: "categories",
    syncWithLocation: true,
    filters: { defaultBehavior: "replace" },
    sorters: {
      initial: [{ field: "name", order: "asc" }],
    },
  });

  const filterProps = createColumnFilter(
    CATEGORY_FILTER_COLUMNS,
    filters,
    setFilters,
    setCurrentPage,
  );

  return (
    <List
      title={t("categories.listTitle")}
      headerButtons={
        <CreateButton>{t("categories.create")}</CreateButton>
      }
    >
      <Table {...tableProps} rowKey="id" scroll={{ x: "max-content" }}>
        <Table.Column
          dataIndex="name"
          title={t("categories.columns.name")}
          {...filterProps("name")}
        />
        <Table.Column
          title={t("categories.columns.actions")}
          render={(_, record: Category) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
}
