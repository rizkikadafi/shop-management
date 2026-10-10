import { CreateButton, EditButton, List, useTable } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Space, Table, Tag } from "antd";
import { useState } from "react";
import { ColumnFilterBar } from "../../../components/ColumnFilterBar";
import { type FilterCondition } from "../../../components/filtering";
import { ROLE_COLORS, type Profile } from "../user.schema";
import {
  USER_FILTER_COLUMNS,
  userConditionsToFilters,
  userFiltersToConditions,
} from "../user.filters";

export function UserList() {
  const { tableProps, filters, setFilters, setCurrentPage } = useTable<
    Profile,
    HttpError
  >({
    resource: "profiles",
    syncWithLocation: true,
    filters: { defaultBehavior: "replace" },
    sorters: {
      initial: [{ field: "created_at", order: "asc" }],
    },
  });

  const [conditions, setConditions] = useState<FilterCondition[]>(() =>
    filters.length > 0 ? userFiltersToConditions(filters) : [],
  );

  const handleSubmit = () => {
    setFilters(userConditionsToFilters(conditions));
    setCurrentPage(1);
  };

  const handleClear = () => {
    setConditions([]);
    setFilters([]);
    setCurrentPage(1);
  };

  return (
    <List
      title="Users"
      headerButtons={<CreateButton>Create user</CreateButton>}
    >
      <ColumnFilterBar
        columns={USER_FILTER_COLUMNS}
        value={conditions}
        onChange={setConditions}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />

      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="email" title="Email" />
        <Table.Column
          dataIndex="full_name"
          title="Name"
          render={(value: string | null) => value ?? "—"}
        />
        <Table.Column
          dataIndex="role"
          title="Role"
          render={(role: Profile["role"]) => (
            <Tag color={ROLE_COLORS[role]}>{role}</Tag>
          )}
        />
        <Table.Column
          dataIndex="is_active"
          title="Status"
          render={(value: boolean) => (
            <Tag color={value ? "green" : "default"}>
              {value ? "Active" : "Inactive"}
            </Tag>
          )}
        />
        <Table.Column
          title="Actions"
          render={(_, record: Profile) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
}
