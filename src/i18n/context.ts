import { createContext } from "react";
import type { I18nProvider } from "@refinedev/core";
import type { Locale } from "./config";

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  i18nProvider: I18nProvider;
  t: (
    key: string,
    options?: Record<string, unknown>,
    defaultMessage?: string,
  ) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
