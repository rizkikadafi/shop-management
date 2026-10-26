/**
 * Resource registry — the single source of truth for the offline data layer.
 *
 * Adding a new offline-capable table means adding one entry here (plus the
 * Supabase migration). The repository, query engine, sync queue and puller are
 * all registry-driven, so no new sync code is required.
 */

/** A PostgREST-style embedded relation: `alias:fk_column(child, columns)`. */
export interface EmbedConfig {
  /** Foreign-key column on the parent row (e.g. `category_id`). */
  column: string;
  /** Resource the foreign key points at (e.g. `categories`). */
  resource: string;
  /** Columns to include in the embedded object. */
  columns: string[];
}

export interface SyncResourceConfig {
  /** Refine resource name; also the Dexie table name. */
  name: string;
  /** Supabase table name. */
  table: string;
  /** All remote columns (used for `select *` parity and documentation). */
  columns: string[];
  /** Columns matched by the Refine search terms (`meta.q`). */
  searchableColumns: string[];
  /** Embedded relations keyed by alias. */
  embeds: Record<string, EmbedConfig>;
  /** Column used for soft deletes; unset for hard-delete resources. */
  softDeleteColumn?: string;
  /** Whether local writes should be queued and synced. */
  offlineWrites: boolean;
  /**
   * Whether the resource participates in remote pull. Set to false for tables
   * whose rows are managed outside the app's own writes.
   */
  pull: boolean;
}

const PRODUCTS: SyncResourceConfig = {
  name: "products",
  table: "products",
  columns: [
    "id",
    "user_id",
    "sku",
    "name",
    "description",
    "price",
    "is_active",
    "category_id",
    "base_uom_id",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
  searchableColumns: ["name", "sku"],
  embeds: {
    category: { column: "category_id", resource: "categories", columns: ["name"] },
    base_uom: {
      column: "base_uom_id",
      resource: "uoms",
      columns: ["name", "symbol"],
    },
  },
  softDeleteColumn: "deleted_at",
  offlineWrites: true,
  pull: true,
};

const CATEGORIES: SyncResourceConfig = {
  name: "categories",
  table: "categories",
  columns: ["id", "name", "created_at", "updated_at"],
  searchableColumns: ["name"],
  embeds: {},
  offlineWrites: true,
  pull: true,
};

const UOMS: SyncResourceConfig = {
  name: "uoms",
  table: "uoms",
  columns: [
    "id",
    "name",
    "symbol",
    "uom_type",
    "global_parent_uom_id",
    "global_quantity_in_parent",
    "created_at",
    "updated_at",
  ],
  searchableColumns: ["name", "symbol"],
  embeds: {},
  offlineWrites: true,
  pull: true,
};

const PRODUCT_UOMS: SyncResourceConfig = {
  name: "product_uoms",
  table: "product_uoms",
  columns: [
    "id",
    "product_id",
    "uom_id",
    "parent_product_uom_id",
    "quantity_in_parent",
    "conversion_mode",
    "created_at",
    "updated_at",
  ],
  searchableColumns: [],
  embeds: {
    uom: {
      column: "uom_id",
      resource: "uoms",
      columns: ["name", "symbol", "uom_type"],
    },
  },
  offlineWrites: true,
  pull: true,
};

const PRODUCT_PRICES: SyncResourceConfig = {
  name: "product_prices",
  table: "product_prices",
  columns: [
    "id",
    "product_id",
    "product_uom_id",
    "price_list",
    "min_quantity",
    "package_quantity",
    "package_price",
    "created_at",
    "updated_at",
  ],
  searchableColumns: [],
  embeds: {},
  offlineWrites: true,
  pull: true,
};

const PRODUCT_PURCHASE_PRICES: SyncResourceConfig = {
  name: "product_purchase_prices",
  table: "product_purchase_prices",
  columns: [
    "id",
    "product_id",
    "product_uom_id",
    "purchase_price",
    "created_at",
    "updated_at",
  ],
  searchableColumns: [],
  embeds: {},
  offlineWrites: true,
  pull: true,
};

/**
 * Profiles are read-cached only. Account creation and role changes go through
 * the `admin-users` Edge Function, which cannot be replayed safely from a
 * queue, so writes stay online-only.
 */
const PROFILES: SyncResourceConfig = {
  name: "profiles",
  table: "profiles",
  columns: [
    "id",
    "email",
    "full_name",
    "role",
    "is_active",
    "created_at",
    "updated_at",
  ],
  searchableColumns: ["email", "full_name"],
  embeds: {},
  offlineWrites: false,
  pull: true,
};

export const RESOURCES: SyncResourceConfig[] = [
  PRODUCTS,
  CATEGORIES,
  UOMS,
  PRODUCT_UOMS,
  PRODUCT_PRICES,
  PRODUCT_PURCHASE_PRICES,
  PROFILES,
];

const RESOURCE_MAP = new Map(RESOURCES.map((config) => [config.name, config]));

export function getResourceConfig(
  resource: string,
): SyncResourceConfig | undefined {
  return RESOURCE_MAP.get(resource);
}

/** Resolve an embed by alias, falling back to its foreign-key column name. */
export function findEmbed(
  config: SyncResourceConfig | undefined,
  aliasOrColumn: string,
): EmbedConfig | undefined {
  if (!config) {
    return undefined;
  }
  return (
    config.embeds[aliasOrColumn] ??
    Object.values(config.embeds).find(
      (embed) => embed.column === aliasOrColumn,
    )
  );
}

/** Columns the server maintains; never sent from the client on push. */
export const SERVER_MANAGED_COLUMNS = new Set(["created_at", "updated_at"]);
