import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { I18nProvider } from "@refinedev/core";
import dayjs from "dayjs";
import "dayjs/locale/id";

import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale, type Locale } from "./config";
import { I18nContext, type I18nContextValue } from "./context";
import { createI18nProvider, setCurrentLocale, translate } from "./i18nProvider";

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (isLocale(stored)) {
    return stored;
  }

  const browserLocale = window.navigator.language?.toLowerCase() ?? "";
  return browserLocale.startsWith("id") ? "id" : DEFAULT_LOCALE;
}

export function AppI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = detectInitialLocale();
    setCurrentLocale(initial);
    return initial;
  });

  useEffect(() => {
    dayjs.locale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setCurrentLocale(next);
    dayjs.locale(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    setLocaleState(next);
  }, []);

  const i18nProvider = useMemo<I18nProvider>(
    () => createI18nProvider(locale, setLocale),
    [locale, setLocale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      i18nProvider,
      t: (key, options, defaultMessage) =>
        translate(key, options, defaultMessage),
    }),
    [locale, setLocale, i18nProvider],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
