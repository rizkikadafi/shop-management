import Dexie, { type Table } from "dexie";
import { RESOURCES, type SyncResourceConfig } from "./resources";

/**
 * Local-first storage.
 *
 * Every offline-capable resource is a Dexie table whose rows mirror the remote
 * columns plus local-only metadata (prefixed with `__`). Rows are written
 * together with a `sync_queue` entry in the same transaction so a mutation is
 * never lost between the write and the sync attempt.
 */

export type SyncStatus = "synced" | "pending" | "failed";

/** Local-only metadata attached to every cached row. */
export interface LocalMeta {
  /** Whether the row is in sync with the remote table. */
  __sync: SyncStatus;
  /** Client timestamp of the last local change (ISO string). */
  __localUpdatedAt: string;
  /** Remote `updated_at` the local change was based on (for future conflicts). */
  __baseUpdatedAt: string | null;
  /** Last sync error for this row, if any. */
  __lastSyncError: string | null;
  /** Hard delete queued: row is hidden locally until the remote delete lands. */
  __pendingDelete: boolean;
}

export type LocalRow = Record<string, unknown> & LocalMeta;

export type QueueOp = "create" | "update" | "delete";

/** A single queued mutation waiting to be pushed to Supabase. */
export interface QueueEntry {
  seq?: number;
  resource: string;
  op: QueueOp;
  rowId: string;
  /** Full local row snapshot for create/update ops. */
  payload?: LocalRow;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  status: "pending" | "failed";
  lastError: string | null;
}

/** Free-form key/value store for sync bookkeeping. */
export interface MetaEntry {
  key: string;
  value: unknown;
}

export const META_KEYS = {
  hydratedAt: "hydratedAt",
  lastPulledAt: "lastPulledAt",
  ownerUserId: "ownerUserId",
  pullSchemaFingerprint: "pullSchemaFingerprint",
} as const;

export class AppDatabase extends Dexie {
  sync_queue!: Table<QueueEntry, number>;
  sync_meta!: Table<MetaEntry, string>;

  constructor() {
    super("shop-management");
    const stores: Record<string, string> = {
      sync_queue: "++seq, resource, status, rowId, createdAt",
      sync_meta: "key",
    };
    for (const config of RESOURCES) {
      stores[config.name] = resourceIndexes(config);
    }
    this.version(1).stores(stores);
  }

  /** Typed accessor for a resource table by Refine resource name. */
  resourceTable(resource: string): Table<LocalRow, string> {
    return this.table<LocalRow, string>(resource);
  }
}

/** Indexed fields for a resource table. Only `id` is required for lookups. */
function resourceIndexes(config: SyncResourceConfig): string {
  const indexes = ["id"];
  if (config.columns.includes("product_id")) {
    indexes.push("product_id");
  }
  indexes.push("__sync");
  return indexes.join(", ");
}

export const db = new AppDatabase();

const LOCAL_META_KEYS = [
  "__sync",
  "__localUpdatedAt",
  "__baseUpdatedAt",
  "__lastSyncError",
  "__pendingDelete",
] as const;

/** Drop local-only metadata before sending a row to Supabase. */
export function stripLocalMeta(row: LocalRow): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!LOCAL_META_KEYS.includes(key as (typeof LOCAL_META_KEYS)[number])) {
      result[key] = value;
    }
  }
  return result;
}

export function isLocalRow(value: unknown): value is LocalRow {
  return typeof value === "object" && value !== null && "__sync" in value;
}

/** Build the local metadata for a freshly cached or written row. */
export function localMeta(
  status: SyncStatus,
  baseUpdatedAt: string | null = null,
): LocalMeta {
  return {
    __sync: status,
    __localUpdatedAt: new Date().toISOString(),
    __baseUpdatedAt: baseUpdatedAt,
    __lastSyncError: null,
    __pendingDelete: false,
  };
}
