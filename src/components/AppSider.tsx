import type { FC, ReactNode } from "react";
import { LogoutOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { useThemedLayoutContext } from "@refinedev/antd";
import {
  CanAccess,
  useIsExistAuthentication,
  useLink,
  useLogout,
  useMenu,
  useTranslate,
  useWarnAboutChange,
  type TitleProps,
  type TreeMenuItem,
} from "@refinedev/core";
import { Drawer, Grid, Layout, Menu, theme } from "antd";

import { AccountButton } from "./AccountButton";
import { AppTitle } from "./AppTitle";

const { Sider } = Layout;

const SIDER_WIDTH = 200;
const SIDER_COLLAPSED_WIDTH = 80;
const TITLE_HEIGHT = 64;

interface AppSiderProps {
  Title?: FC<TitleProps>;
  meta?: Record<string, unknown>;
}

export function AppSider({ Title, meta }: AppSiderProps) {
  const { token } = theme.useToken();
  const { siderCollapsed, setSiderCollapsed, mobileSiderOpen, setMobileSiderOpen } =
    useThemedLayoutContext();
  const breakpoint = Grid.useBreakpoint();
  const isMobile = breakpoint.lg === undefined ? false : !breakpoint.lg;

  const isExistAuthentication = useIsExistAuthentication();
  const Link = useLink();
  const translate = useTranslate();
  const { warnWhen, setWarnWhen } = useWarnAboutChange();
  const { mutate: logout } = useLogout();
  const { menuItems, selectedKey, defaultOpenKeys } = useMenu({ meta });

  const RenderToTitle = Title ?? AppTitle;

  const handleLogout = () => {
    if (warnWhen) {
      const confirm = window.confirm(
        translate(
          "warnWhenUnsavedChanges",
          "Are you sure you want to leave? You have unsaved changes.",
        ),
      );
      if (confirm) {
        setWarnWhen(false);
        logout();
      }
      return;
    }
    logout();
  };

  const renderTreeView = (tree: TreeMenuItem[]): ReactNode[] =>
    tree.map((item) => {
      const label = item.label ?? item.meta?.label ?? item.name;
      const icon = item.icon ?? item.meta?.icon ?? <UnorderedListOutlined />;
      const route = item.list;

      if (item.children.length > 0) {
        return (
          <CanAccess
            key={item.key}
            resource={item.name}
            action="list"
            params={{ resource: item }}
          >
            <Menu.SubMenu key={item.key} icon={icon} title={label}>
              {renderTreeView(item.children)}
            </Menu.SubMenu>
          </CanAccess>
        );
      }

      return (
        <CanAccess
          key={item.key}
          resource={item.name}
          action="list"
          params={{ resource: item }}
        >
          <Menu.Item key={item.key} icon={icon}>
            <Link to={route ?? ""}>{label}</Link>
          </Menu.Item>
        </CanAccess>
      );
    });

  const logoutItem = isExistAuthentication ? (
    <Menu.Item key="logout" onClick={handleLogout} icon={<LogoutOutlined />}>
      {translate("buttons.logout", "Logout")}
    </Menu.Item>
  ) : null;

  const menu = (
    <Menu
      selectedKeys={selectedKey ? [selectedKey] : []}
      defaultOpenKeys={defaultOpenKeys}
      mode="inline"
      style={{ border: "none", flex: 1, overflow: "auto", paddingTop: 8, minHeight: 0 }}
      onClick={() => setMobileSiderOpen(false)}
    >
      {renderTreeView(menuItems)}
      {logoutItem}
    </Menu>
  );

  if (isMobile) {
    return (
      <Drawer
        open={mobileSiderOpen}
        onClose={() => setMobileSiderOpen(false)}
        placement="left"
        closable={false}
        width={SIDER_WIDTH}
        styles={{ body: { padding: 0, overflowX: "hidden" } }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minWidth: 0,
            overflowX: "hidden",
            backgroundColor: token.colorBgContainer,
          }}
        >
          <div
            style={{
              height: TITLE_HEIGHT,
              display: "flex",
              alignItems: "center",
              minWidth: 0,
              overflow: "hidden",
              padding: "0 16px",
              backgroundColor: token.colorBgElevated,
            }}
          >
            <RenderToTitle collapsed={false} />
          </div>
          {menu}
          <div
            style={{
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              padding: 8,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <AccountButton />
          </div>
        </div>
      </Drawer>
    );
  }

  return (
    <Sider
      style={{
        backgroundColor: token.colorBgContainer,
        borderRight: `1px solid ${token.colorBgElevated}`,
      }}
      collapsible
      collapsed={siderCollapsed}
      onCollapse={(collapsed) => setSiderCollapsed(collapsed)}
      trigger={null}
      width={SIDER_WIDTH}
      collapsedWidth={SIDER_COLLAPSED_WIDTH}
    >
      <div
        style={{
          height: TITLE_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: siderCollapsed ? "center" : "flex-start",
          minWidth: 0,
          overflow: "hidden",
          padding: siderCollapsed ? 0 : "0 16px",
          backgroundColor: token.colorBgElevated,
        }}
      >
        <RenderToTitle collapsed={siderCollapsed} />
      </div>
      {menu}
    </Sider>
  );
}