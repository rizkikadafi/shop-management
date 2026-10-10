import type { ReactNode } from "react";
import { Refine } from "@refinedev/core";
import { RefineThemes, useNotificationProvider } from "@refinedev/antd";
import routerProvider from "@refinedev/react-router";
import { App as AntdApp, ConfigProvider } from "antd";

import "@refinedev/antd/dist/reset.css";

import { accessControlProvider } from "../auth/accessControlProvider";
import { authProvider } from "../auth/authProvider";
import { dataProvider } from "../data/refine/dataProvider";

function RefineWithProviders({ children }: { children: ReactNode }) {
  const notificationProvider = useNotificationProvider();

  return (
    <Refine
      routerProvider={routerProvider}
      dataProvider={dataProvider}
      authProvider={authProvider}
      accessControlProvider={accessControlProvider}
      notificationProvider={notificationProvider}
      resources={[
        {
          name: "products",
          list: "/products",
          create: "/products/create",
          edit: "/products/edit/:id",
          show: "/products/show/:id",
          meta: { label: "Products" },
        },
        {
          name: "profiles",
          list: "/users",
          create: "/users/create",
          edit: "/users/edit/:id",
          meta: { label: "Users", hideIfUnauthorized: true },
        },
      ]}
      options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
    >
      {children}
    </Refine>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={RefineThemes.Blue}>
      <AntdApp>
        <RefineWithProviders>{children}</RefineWithProviders>
      </AntdApp>
    </ConfigProvider>
  );
}
