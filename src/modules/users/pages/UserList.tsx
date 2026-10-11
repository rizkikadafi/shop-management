import { CreateButton, EditButton, List, useTable } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Space, Table, Tag } from "antd";
import { useState } from "react";
import { ColumnFilterBar } from "../../../components/ColumnFilterBar";
import { type FilterCondition } from "../../../components/filtering";
import { useI18n } from "../../../i18n/useI18n";
import { ROLE_COLORS, ROLE_LABEL_KEYS, type Profile } from "../user.schema";
import {
  USER_FILTER_COLUMNS,
  userConditionsToFilters,
  userFiltersToConditions,
} from "../user.filters";

export function UserList() {
  const { t } = useI18n();
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
      title={t("users.listTitle")}
      headerButtons={<CreateButton>{t("users.create")}</CreateButton>}
    >
      <ColumnFilterBar
        columns={USER_FILTER_COLUMNS}
        value={conditions}
        onChange={setConditions}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />

      <Table {...tableProps} rowKey="id" scroll={{ x: "max-content" }}>
        <Table.Column dataIndex="email" title={t("users.columns.email")} />
        <Table.Column
          dataIndex="full_name"
          title={t("users.columns.name")}
          render={(value: string | null) => value ?? t("common.none")}
        />
        <Table.Column
          dataIndex="role"
          title={t("users.columns.role")}
          render={(role: Profile["role"]) => (
            <Tag color={ROLE_COLORS[role]}>{t(ROLE_LABEL_KEYS[role])}</Tag>
          )}
        />
        <Table.Column
          dataIndex="is_active"
          title={t("users.columns.status")}
          render={(value: boolean) => (
            <Tag color={value ? "green" : "default"}>
              {value ? t("common.active") : t("common.inactive")}
            </Tag>
          )}
        />
        <Table.Column
          title={t("users.columns.actions")}
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
