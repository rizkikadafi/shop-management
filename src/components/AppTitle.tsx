import { ShopOutlined } from "@ant-design/icons";
import type { TitleProps } from "@refinedev/core";
import { Space, Typography, theme } from "antd";

import { useI18n } from "../i18n/useI18n";

export function AppTitle({ collapsed }: TitleProps) {
  const { t } = useI18n();
  const { token } = theme.useToken();

  return (
    <Space size={8} align="center" style={{ overflow: "hidden" }}>
      <ShopOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
      {!collapsed && (
        <Typography.Text
          strong
          style={{
            fontSize: 16,
            color: token.colorPrimary,
            whiteSpace: "nowrap",
          }}
        >
          {t("auth.brand")}
        </Typography.Text>
      )}
    </Space>
  );
}