import { MenuOutlined } from "@ant-design/icons";
import { useThemedLayoutContext } from "@refinedev/antd";
import { Button, Grid, Layout, Space, Typography, theme } from "antd";

import { useI18n } from "../i18n/useI18n";
import { AccountButton } from "./AccountButton";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SyncStatus } from "./SyncStatus";

const { Header } = Layout;

export function AppHeader() {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const { t } = useI18n();
  const { siderCollapsed, setSiderCollapsed, setMobileSiderOpen } =
    useThemedLayoutContext();

  const isMobile = !screens.lg;

  const toggleSider = () => {
    if (isMobile) {
      setMobileSiderOpen(true);
      return;
    }
    setSiderCollapsed(!siderCollapsed);
  };

  return (
    <Header
      style={{
        background: token.colorBgElevated,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        padding: isMobile ? "0 16px" : "0 24px",
        height: 64,
        lineHeight: "normal"
      }}
    >
      <Space
        size="middle"
        align="center"
        style={{ minWidth: 0, overflow: "hidden" }}
      >
        <Button
          type="text"
          aria-label={t("common.toggleSidebar")}
          icon={<MenuOutlined />}
          onClick={toggleSider}
        />
        {isMobile && (
          <Typography.Text
            strong
            ellipsis
            style={{
              color: token.colorPrimary,
              fontSize: 16,
              minWidth: 0,
            }}
          >
            {t("auth.brand")}
          </Typography.Text>
        )}
      </Space>
      <Space
        size="middle"
        align="center"
        style={{ minWidth: 0, overflow: "hidden" }}
      >
        <LanguageSwitcher />
        <SyncStatus compact={isMobile} />
        {!isMobile && <AccountButton />}
      </Space>
    </Header>
  );
}
