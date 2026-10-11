export type Locale = "en" | "id";

export const LOCALES: Locale[] = ["en", "id"];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_STORAGE_KEY = "shop-management.locale";

export interface LocaleConfig {
  /** BCP 47 tag passed to the native Intl formatters. */
  intl: string;
  /** Currency displayed for monetary values in this locale. */
  currency: "USD" | "IDR";
  /** Native name shown in the language switcher. */
  label: string;
}

export const LOCALE_CONFIG: Record<Locale, LocaleConfig> = {
  en: { intl: "en-US", currency: "USD", label: "English" },
  id: { intl: "id-ID", currency: "IDR", label: "Bahasa Indonesia" },
};

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "id";
}
