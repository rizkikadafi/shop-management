import { CreateButton, EditButton, List, useTable } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Space, Table, Tag } from "antd";
import { createColumnFilter } from "../../../components/columnFilterProps";
import { useI18n } from "../../../i18n/useI18n";
import { ROLE_COLORS, ROLE_LABEL_KEYS, type Profile } from "../user.schema";
import { USER_FILTER_COLUMNS } from "../user.filters";

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

  const filterProps = createColumnFilter(
    USER_FILTER_COLUMNS,
    filters,
    setFilters,
    setCurrentPage,
  );

  return (
    <List
      title={t("users.listTitle")}
      headerButtons={<CreateButton>{t("users.create")}</CreateButton>}
    >
      <Table {...tableProps} rowKey="id" scroll={{ x: "max-content" }}>
        <Table.Column
          dataIndex="email"
          title={t("users.columns.email")}
          {...filterProps("email")}
        />
        <Table.Column
          dataIndex="full_name"
          title={t("users.columns.name")}
          render={(value: string | null) => value ?? t("common.none")}
          {...filterProps("full_name")}
        />
        <Table.Column
          dataIndex="role"
          title={t("users.columns.role")}
          render={(role: Profile["role"]) => (
            <Tag color={ROLE_COLORS[role]}>{t(ROLE_LABEL_KEYS[role])}</Tag>
          )}
          {...filterProps("role")}
        />
        <Table.Column
          dataIndex="is_active"
          title={t("users.columns.status")}
          render={(value: boolean) => (
            <Tag color={value ? "green" : "default"}>
              {value ? t("common.active") : t("common.inactive")}
            </Tag>
          )}
          {...filterProps("is_active")}
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
