import type { ReactNode } from "react";
import { Refine } from "@refinedev/core";
import { RefineThemes, useNotificationProvider } from "@refinedev/antd";
import routerProvider from "@refinedev/react-router";
import { App as AntdApp, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import idID from "antd/locale/id_ID";

import "@refinedev/antd/dist/reset.css";

import { accessControlProvider } from "../auth/accessControlProvider";
import { authProvider } from "../auth/authProvider";
import { dataProvider } from "../data/refine/dataProvider";
import { AppI18nProvider } from "../i18n/AppI18nProvider";
import type { Locale } from "../i18n/config";
import { useI18n } from "../i18n/useI18n";

const ANTD_LOCALES: Record<Locale, typeof enUS> = {
  en: enUS,
  id: idID,
};

function RefineWithProviders({ children }: { children: ReactNode }) {
  const notificationProvider = useNotificationProvider();
  const { i18nProvider, t } = useI18n();

  return (
    <Refine
      routerProvider={routerProvider}
      dataProvider={dataProvider}
      authProvider={authProvider}
      accessControlProvider={accessControlProvider}
      notificationProvider={notificationProvider}
      i18nProvider={i18nProvider}
      resources={[
        {
          name: "product-management",
          meta: { label: t("resources.productManagement") },
        },
        {
          name: "products",
          list: "/products",
          create: "/products/create",
          edit: "/products/edit/:id",
          show: "/products/show/:id",
          meta: {
            label: t("resources.products"),
            parent: "product-management",
          },
        },
        {
          name: "categories",
          list: "/products/categories",
          create: "/products/categories/create",
          edit: "/products/categories/edit/:id",
          meta: {
            label: t("resources.categories"),
            parent: "product-management",
          },
        },
        {
          name: "uoms",
          list: "/products/uoms",
          create: "/products/uoms/create",
          edit: "/products/uoms/edit/:id",
          meta: {
            label: t("resources.uoms"),
            parent: "product-management",
          },
        },
        {
          name: "product_uoms",
          meta: { label: t("resources.productUoms"), hide: true },
        },
        {
          name: "product_prices",
          meta: { label: t("resources.productPrices"), hide: true },
        },
        {
          name: "profiles",
          list: "/users",
          create: "/users/create",
          edit: "/users/edit/:id",
          meta: { label: t("resources.users"), hideIfUnauthorized: true },
        },
      ]}
      options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
    >
      {children}
    </Refine>
  );
}

function ThemedApp({ children }: { children: ReactNode }) {
  const { locale } = useI18n();

  return (
    <ConfigProvider theme={RefineThemes.Blue} locale={ANTD_LOCALES[locale]}>
      <AntdApp>
        <RefineWithProviders>{children}</RefineWithProviders>
      </AntdApp>
    </ConfigProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppI18nProvider>
      <ThemedApp>{children}</ThemedApp>
    </AppI18nProvider>
  );
}
