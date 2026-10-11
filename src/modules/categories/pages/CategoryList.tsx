import { CreateButton, EditButton, List, useTable } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Button, Space, Table } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ColumnFilterBar } from "../../../components/ColumnFilterBar";
import { type FilterCondition } from "../../../components/filtering";
import { useI18n } from "../../../i18n/useI18n";
import type { Category } from "../category.schema";
import {
  CATEGORY_FILTER_COLUMNS,
  categoryConditionsToFilters,
  categoryFiltersToConditions,
} from "../category.filters";

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

  const [conditions, setConditions] = useState<FilterCondition[]>(() =>
    filters.length > 0 ? categoryFiltersToConditions(filters) : [],
  );

  const handleSubmit = () => {
    setFilters(categoryConditionsToFilters(conditions));
    setCurrentPage(1);
  };

  const handleClear = () => {
    setConditions([]);
    setFilters([]);
    setCurrentPage(1);
  };

  return (
    <List
      title={t("categories.listTitle")}
      headerButtons={
        <Space wrap>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/products")}
          >
            {t("categories.backToProducts")}
          </Button>
          <CreateButton>{t("categories.create")}</CreateButton>
        </Space>
      }
    >
      <ColumnFilterBar
        columns={CATEGORY_FILTER_COLUMNS}
        value={conditions}
        onChange={setConditions}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />

      <Table {...tableProps} rowKey="id" scroll={{ x: "max-content" }}>
        <Table.Column dataIndex="name" title={t("categories.columns.name")} />
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
