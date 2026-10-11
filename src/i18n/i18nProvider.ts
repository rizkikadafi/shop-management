import type { I18nProvider } from "@refinedev/core";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { dictionaries, interpolate, resolveKey } from "./dictionary";

let currentLocale: Locale = DEFAULT_LOCALE;

export function setCurrentLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getCurrentLocale(): Locale {
  return currentLocale;
}

type TranslateOptions = Record<string, unknown> | string | undefined;

/**
 * Translate a dotted key. Mirrors Refine's `translate(key, options?, defaultMessage?)`
 * signature but also accepts Refine's shorter `translate(key, defaultMessage)`.
 * Falls back to the English dictionary, then to the supplied default, then the key.
 */
export function translate(
  key: string,
  options?: TranslateOptions,
  defaultMessage?: string,
): string {
  let values: Record<string, unknown> | undefined;
  let fallback: string | undefined;

  if (typeof options === "string" && defaultMessage === undefined) {
    fallback = options;
  } else {
    values = options as Record<string, unknown> | undefined;
    fallback = defaultMessage;
  }

  const message =
    resolveKey(dictionaries[currentLocale], key) ??
    resolveKey(dictionaries.en, key);

  if (message) {
    return interpolate(message, values);
  }

  return fallback ?? key;
}

export function createI18nProvider(
  locale: Locale,
  onChange: (locale: Locale) => void,
): I18nProvider {
  return {
    translate: (key, options, defaultMessage) => {
      currentLocale = locale;
      return translate(key, options, defaultMessage);
    },
    changeLocale: (next) => {
      onChange(next as Locale);
    },
    getLocale: () => locale,
  };
}
