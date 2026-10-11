import { en } from "./locales/en";
import { id } from "./locales/id";
import type { Locale } from "./config";

export const dictionaries: Record<Locale, unknown> = { en, id };

/** Resolve a dotted key ("products.form.name") against a nested dictionary. */
export function resolveKey(
  dictionary: unknown,
  key: string,
): string | undefined {
  let current: unknown = dictionary;

  for (const part of key.split(".")) {
    if (
      current !== null &&
      typeof current === "object" &&
      part in (current as Record<string, unknown>)
    ) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return typeof current === "string" ? current : undefined;
}

/** Replace `{name}` placeholders with values from `options`. */
export function interpolate(
  message: string,
  options?: Record<string, unknown>,
): string {
  if (!options) {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (match, token: string) => {
    const value = options[token];
    return value === undefined || value === null ? match : String(value);
  });
}
