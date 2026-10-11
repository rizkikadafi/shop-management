import { CreateButton, EditButton, List, useTable } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Button, Space, Table } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ColumnFilterBar } from "../../../components/ColumnFilterBar";
import { type FilterCondition } from "../../../components/filtering";
import type { Category } from "../category.schema";
import {
  CATEGORY_FILTER_COLUMNS,
  categoryConditionsToFilters,
  categoryFiltersToConditions,
} from "../category.filters";

export function CategoryList() {
  const navigate = useNavigate();
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
      title="Categories"
      headerButtons={
        <Space wrap>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/products")}
          >
            Back to products
          </Button>
          <CreateButton>Create category</CreateButton>
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

      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column
          title="Actions"
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
