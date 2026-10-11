import { ShopOutlined } from "@ant-design/icons";
import type { TitleProps } from "@refinedev/core";
import { Space, Typography, theme } from "antd";

import { useI18n } from "../i18n/useI18n";

export function AppTitle({ collapsed }: TitleProps) {
  const { t } = useI18n();
  const { token } = theme.useToken();

  return (
    <Space size={8} align="center" style={{ minWidth: 0, overflow: "hidden" }}>
      <ShopOutlined
        style={{ fontSize: 20, color: token.colorPrimary, flexShrink: 0 }}
      />
      {!collapsed && (
        <Typography.Text
          strong
          ellipsis
          style={{
            fontSize: 16,
            color: token.colorPrimary,
            minWidth: 0,
          }}
        >
          {t("auth.brand")}
        </Typography.Text>
      )}
    </Space>
  );
}