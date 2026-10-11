import { useContext } from "react";
import { I18nContext } from "./context";
import {
  currencySymbol,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
} from "./format";

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within an AppI18nProvider.");
  }

  const { locale, setLocale, t, i18nProvider } = context;

  return {
    locale,
    setLocale,
    t,
    i18nProvider,
    currencySymbol: currencySymbol(locale),
    formatCurrency: (value: number | string) => formatCurrency(value, locale),
    formatNumber: (value: number | string) => formatNumber(value, locale),
    formatDate: (value: Date | string | number) => formatDate(value, locale),
    formatDateTime: (value: Date | string | number) =>
      formatDateTime(value, locale),
  };
}
