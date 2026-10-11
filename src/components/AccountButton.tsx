import { DownOutlined, LogoutOutlined } from "@ant-design/icons";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { Avatar, Button, Dropdown, Space, Typography } from "antd";
import type { MenuProps } from "antd";

import { useI18n } from "../i18n/useI18n";

export interface Identity {
  id: string;
  name?: string;
  avatar?: string;
}

export function AccountButton({ showName = true }: { showName?: boolean }) {
  const { t } = useI18n();
  const { data: user } = useGetIdentity<Identity>();
  const { mutate: logout } = useLogout();

  const menu: MenuProps = {
    items: [
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: t("common.logout"),
      },
    ],
    onClick: ({ key }) => {
      if (key === "logout") {
        logout();
      }
    },
  };

  return (
    <Dropdown menu={menu} trigger={["click"]} placement="bottomRight">
      <Button type="text" style={{ height: "auto", paddingInline: 8 }}>
        <Space size={8} align="center">
          {user?.avatar ? (
            <Avatar size="small" src={user.avatar} alt={user.name} />
          ) : user?.name ? (
            <Avatar size="small">{user.name.charAt(0).toUpperCase()}</Avatar>
          ) : null}
          {showName && user?.name ? (
            <Typography.Text strong>{user.name}</Typography.Text>
          ) : null}
          <DownOutlined style={{ fontSize: 10 }} />
        </Space>
      </Button>
    </Dropdown>
  );
}