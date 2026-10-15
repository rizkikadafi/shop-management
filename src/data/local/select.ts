import { findEmbed, getResourceConfig, type SyncResourceConfig } from "./resources";
import { stripLocalMeta, type LocalRow } from "./db";

/**
 * Parser and evaluator for PostgREST-style `select` strings.
 *
 * The app passes `meta.select` values such as
 * `"id, name, category:category_id(name), base_uom:base_uom_id(name, symbol)"`.
 * Reproducing the shape locally keeps product pages unchanged, including the
 * embedded relations they read (`record.category?.name`, `record.uom?.symbol`).
 */

export interface ParsedField {
  key: string;
  source: string;
}

export interface ParsedEmbed {
  alias: string;
  relation: string;
  columns: ParsedField[];
}

export interface ParsedSelect {
  /** True when no projection was requested — return the whole row. */
  all: boolean;
  fields: ParsedField[];
  embeds: ParsedEmbed[];
}

/** Split a select fragment on top-level commas (ignoring nested parentheses). */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of input) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    parts.push(current);
  }
  return parts.map((part) => part.trim()).filter(Boolean);
}

function parseField(input: string): ParsedField {
  const separator = input.indexOf(":");
  if (separator === -1) {
    return { key: input.trim(), source: input.trim() };
  }
  return {
    key: input.slice(0, separator).trim(),
    source: input.slice(separator + 1).trim(),
  };
}

export function parseSelect(select?: string): ParsedSelect {
  if (!select || select.trim() === "*") {
    return { all: true, fields: [], embeds: [] };
  }

  const fields: ParsedField[] = [];
  const embeds: ParsedEmbed[] = [];

  for (const part of splitTopLevel(select)) {
    const openIndex = part.indexOf("(");
    if (openIndex === -1 || !part.endsWith(")")) {
      fields.push(parseField(part));
      continue;
    }

    const head = part.slice(0, openIndex);
    const inner = part.slice(openIndex + 1, -1);
    const { key: alias, source: relation } = parseField(head);
    embeds.push({
      alias,
      relation,
      columns: splitTopLevel(inner).map(parseField),
    });
  }

  return { all: false, fields, embeds };
}

/** Resources whose rows are needed to resolve the embeds of a projection. */
export function embedResources(
  config: SyncResourceConfig | undefined,
  parsed: ParsedSelect,
): string[] {
  const names = new Set<string>();
  for (const embed of parsed.embeds) {
    const target = findEmbed(config, embed.alias) ?? findEmbed(config, embed.relation);
    if (target) {
      names.add(target.resource);
    }
  }
  return [...names];
}

function pickColumns(
  row: LocalRow | undefined,
  columns: ParsedField[],
): Record<string, unknown> | null {
  if (!row) {
    return null;
  }
  const result: Record<string, unknown> = {};
  for (const column of columns) {
    result[column.key] = row[column.source] ?? null;
  }
  return result;
}

/**
 * Project a stored row into the shape Refine expects for the given select.
 * `embedMaps` holds the related rows keyed by resource then id.
 */
export function projectRow(
  row: LocalRow,
  parsed: ParsedSelect,
  config: SyncResourceConfig | undefined,
  embedMaps: Record<string, Map<string, LocalRow>>,
): Record<string, unknown> {
  if (parsed.all) {
    return stripLocalMeta(row);
  }

  const result: Record<string, unknown> = {};
  for (const field of parsed.fields) {
    result[field.key] = row[field.source] ?? null;
  }

  for (const embed of parsed.embeds) {
    const target = findEmbed(config, embed.alias) ?? findEmbed(config, embed.relation);
    if (!target) {
      continue;
    }
    const foreignKey = row[embed.relation] ?? row[target.column];
    const related =
      typeof foreignKey === "string"
        ? embedMaps[target.resource]?.get(foreignKey)
        : undefined;
    result[embed.alias] = pickColumns(related, embed.columns);
  }

  return result;
}

export function projectRows(
  rows: LocalRow[],
  parsed: ParsedSelect,
  resource: string,
  embedMaps: Record<string, Map<string, LocalRow>>,
): Array<Record<string, unknown>> {
  const config = getResourceConfig(resource);
  return rows.map((row) => projectRow(row, parsed, config, embedMaps));
}
