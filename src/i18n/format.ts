import { LOCALE_CONFIG, type Locale } from "./config";

type Numeric = number | string;

function toNumber(value: Numeric): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumber(
  value: Numeric,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  const parsed = toNumber(value);
  if (parsed === null) {
    return String(value);
  }
  return new Intl.NumberFormat(LOCALE_CONFIG[locale].intl, options).format(
    parsed,
  );
}

export function formatCurrency(
  value: Numeric,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  const parsed = toNumber(value);
  if (parsed === null) {
    return String(value);
  }
  return new Intl.NumberFormat(LOCALE_CONFIG[locale].intl, {
    style: "currency",
    currency: LOCALE_CONFIG[locale].currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(parsed);
}

export function currencySymbol(locale: Locale): string {
  const parts = new Intl.NumberFormat(LOCALE_CONFIG[locale].intl, {
    style: "currency",
    currency: LOCALE_CONFIG[locale].currency,
    currencyDisplay: "narrowSymbol",
  }).formatToParts(0);

  return parts.find((part) => part.type === "currency")?.value ?? "";
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value: Date | string | number, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_CONFIG[locale].intl, {
    dateStyle: "medium",
  }).format(toDate(value));
}

export function formatDateTime(
  value: Date | string | number,
  locale: Locale,
): string {
  return new Intl.DateTimeFormat(LOCALE_CONFIG[locale].intl, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(toDate(value));
}
