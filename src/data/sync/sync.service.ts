import type { Session } from "@supabase/supabase-js";
import {
  db,
  META_KEYS,
  type LocalRow,
  type QueueEntry,
} from "../local/db";
import {
  getResourceConfig,
  RESOURCES,
  SERVER_MANAGED_COLUMNS,
  type SyncResourceConfig,
} from "../local/resources";
import { supabaseClient } from "../remote/supabase";
import { onSyncRequested } from "./notify";

/**
 * Fingerprint of the pulled table/column shape. When it changes, the next sync
 * forces one full re-read so cached rows pick up added or removed columns even
 * though their remote `updated_at` did not change.
 */
const PULL_SCHEMA_FINGERPRINT = JSON.stringify(
  RESOURCES.filter((config) => config.pull).map((config) => [
    config.name,
    config.table,
    config.columns,
  ]),
);

/**
 * Resource-generic sync engine.
 *
 * Push: drains the durable `sync_queue` in insertion order (which keeps
 * parent-before-child ordering), using client-generated UUIDs and upserts so
 * retries are idempotent. Pull: reconciles each registered table with the
 * remote rows, skipping anything that still has a pending local change.
 *
 * Conflict policy (v1): last write wins by `updated_at`. Each local row keeps
 * the `__baseUpdatedAt` it was based on so a later version can detect and
 * surface conflicts instead of silently overwriting.
 */

export interface SyncState {
  online: boolean;
  syncing: boolean;
  hydrating: boolean;
  hydrated: boolean;
  pending: number;
  failed: number;
  lastSyncedAt: number | null;
  lastError: string | null;
}

type Listener = () => void;

/** Loose Supabase surface so registry table names can be used dynamically. */
interface DynamicClient {
  from: (table: string) => {
    select: (columns: string) => {
      range: (
        from: number,
        to: number,
      ) => Promise<{ data: unknown[] | null; error: unknown | null }>;
    };
    upsert: (
      payload: Record<string, unknown>,
      options: { onConflict: string },
    ) => Promise<{ error: unknown | null }>;
    delete: () => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: unknown | null }>;
    };
  };
}

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 60_000;
const PULL_PAGE_SIZE = 1000;
const SYNC_INTERVAL_MS = 60_000;
const DEBOUNCE_MS = 800;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function supabaseError(error: unknown): Error {
  const wrapped = new Error(errorMessage(error)) as Error & { code?: string };
  if (typeof error === "object" && error !== null && "code" in error) {
    wrapped.code = String((error as { code: unknown }).code);
  }
  return wrapped;
}

/**
 * Permanent failures should not be retried automatically: they indicate a
 * constraint or permission problem that a retry will not fix.
 */
function isPermanent(error: unknown): boolean {
  const code = String((error as { code?: string })?.code ?? "");
  if (/^(22|23|42)/.test(code)) {
    return true;
  }
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("violates") ||
    message.includes("duplicate key")
  );
}

function backoffDelay(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempts, BACKOFF_MAX_MS);
}

/**
 * Keep only declared resource columns before pushing. Besides dropping local
 * metadata and server-managed fields, this makes queued writes from an older
 * schema safe after a column is renamed or removed.
 */
function remotePayload(
  config: SyncResourceConfig,
  row: LocalRow,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const column of config.columns) {
    if (SERVER_MANAGED_COLUMNS.has(column) || row[column] === undefined) {
      continue;
    }
    payload[column] = row[column];
  }
  return payload;
}

/** True when a pulled row is already cached unchanged. */
function isUnchanged(existing: LocalRow, record: Record<string, unknown>): boolean {
  if (existing.__sync !== "synced") {
    return false;
  }
  const remoteStamp = record.updated_at ?? null;
  return existing.updated_at === remoteStamp;
}

class SyncService {
  private state: SyncState = {
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    syncing: false,
    hydrating: false,
    hydrated: false,
    pending: 0,
    failed: 0,
    lastSyncedAt: null,
    lastError: null,
  };

  private listeners = new Set<Listener>();
  private unsubscribers: Array<() => void> = [];
  private invalidator: (() => void) | null = null;
  private started = false;
  private running = false;
  private debounceTimer: number | null = null;
  private intervalTimer: number | null = null;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): SyncState => this.state;

  /** Registered by the React bridge so the UI can refetch after a pull. */
  setInvalidator(invalidator: (() => void) | null): void {
    this.invalidator = invalidator;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.updateState({ online: navigator.onLine });

    const handleOnline = () => {
      this.updateState({ online: true });
      void this.syncNow();
    };
    const handleOffline = () => this.updateState({ online: false });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    this.unsubscribers.push(() => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    });
    this.unsubscribers.push(onSyncRequested(() => this.scheduleSync()));

    this.intervalTimer = window.setInterval(
      () => void this.syncNow(),
      SYNC_INTERVAL_MS,
    );

    void this.syncNow();
  }

  stop(): void {
    this.started = false;
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.intervalTimer !== null) {
      window.clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  /** Debounced sync request, used after local writes. */
  private scheduleSync(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      void this.syncNow();
    }, DEBOUNCE_MS);
  }

  async retryFailed(): Promise<void> {
    const entries = await db.sync_queue.toArray();
    await Promise.all(
      entries
        .filter((entry) => entry.status === "failed")
        .map((entry) =>
          db.sync_queue.update(entry.seq!, {
            status: "pending",
            attempts: 0,
            nextAttemptAt: Date.now(),
            lastError: null,
          }),
        ),
    );
    await this.syncNow();
    await this.refreshCounts();
  }

  async syncNow(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    this.updateState({ syncing: true, lastError: null });

    try {
      const session = await this.getSession();
      if (!session) {
        return;
      }

      await this.ensureOwner(session.user.id);

      const hydratedAt = await db.sync_meta.get(META_KEYS.hydratedAt);
      if (!hydratedAt) {
        this.updateState({ hydrating: true });
      }

      const pullSchemaFingerprint = await db.sync_meta.get(
        META_KEYS.pullSchemaFingerprint,
      );
      const forcePull =
        pullSchemaFingerprint?.value !== PULL_SCHEMA_FINGERPRINT;

      const pushed = await this.pushQueue();
      const { changes, tablesPulled } = await this.pullAll(forcePull);

      if (tablesPulled > 0) {
        await db.sync_meta.put({ key: META_KEYS.hydratedAt, value: Date.now() });
        await db.sync_meta.put({ key: META_KEYS.lastPulledAt, value: Date.now() });
        this.updateState({ hydrating: false, hydrated: true });
      }

      if (
        tablesPulled > 0 &&
        tablesPulled === RESOURCES.filter((config) => config.pull).length
      ) {
        await db.sync_meta.put({
          key: META_KEYS.pullSchemaFingerprint,
          value: PULL_SCHEMA_FINGERPRINT,
        });
      }

      this.updateState({ lastSyncedAt: Date.now(), lastError: null });

      if (pushed > 0 || changes > 0) {
        this.invalidator?.();
      }
    } catch (error) {
      this.updateState({ hydrating: false, lastError: errorMessage(error) });
    } finally {
      this.running = false;
      this.updateState({ syncing: false, hydrating: false });
      await this.refreshCounts();
    }
  }

  private async getSession(): Promise<Session | null> {
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
  }

  /**
   * Records which user owns the local cache. The catalog is shared by all
   * staff, so product data is kept across sign-ins, but cached profiles are
   * dropped because only admins may read everyone's profile (RLS).
   */
  private async ensureOwner(userId: string): Promise<void> {
    const owner = await db.sync_meta.get(META_KEYS.ownerUserId);
    if (!owner) {
      await db.sync_meta.put({ key: META_KEYS.ownerUserId, value: userId });
      return;
    }
    if (owner.value !== userId) {
      await db.resourceTable("profiles").clear();
      await db.sync_meta.put({ key: META_KEYS.ownerUserId, value: userId });
    }
  }

  private async pushQueue(): Promise<number> {
    const now = Date.now();
    const entries = (await db.sync_queue.orderBy("seq").toArray()).filter(
      (entry) => entry.status === "pending" && entry.nextAttemptAt <= now,
    );

    let pushed = 0;
    for (const entry of entries) {
      if (!navigator.onLine) {
        break;
      }
      if (entry.seq === undefined) {
        continue;
      }
      try {
        await this.pushEntry(entry);
        await db.sync_queue.delete(entry.seq);
        await this.finalizePush(entry);
        pushed += 1;
      } catch (error) {
        const message = errorMessage(error);
        if (isPermanent(error)) {
          await db.sync_queue.update(entry.seq, {
            status: "failed",
            lastError: message,
          });
          await this.markRowFailed(entry, message);
          continue;
        }
        const attempts = entry.attempts + 1;
        await db.sync_queue.update(entry.seq, {
          attempts,
          status: "pending",
          nextAttemptAt: Date.now() + backoffDelay(attempts),
          lastError: message,
        });
        break;
      }
    }
    return pushed;
  }

  private async pushEntry(entry: QueueEntry): Promise<void> {
    const config = getResourceConfig(entry.resource);
    if (!config) {
      return;
    }
    const client = supabaseClient as unknown as DynamicClient;

    if (entry.op === "delete") {
      const { error } = await client
        .from(config.table)
        .delete()
        .eq("id", entry.rowId);
      if (error) throw supabaseError(error);
      return;
    }

    if (!entry.payload) {
      return;
    }
    const { error } = await client
      .from(config.table)
      .upsert(remotePayload(config, entry.payload), { onConflict: "id" });
    if (error) throw supabaseError(error);
  }

  private async finalizePush(entry: QueueEntry): Promise<void> {
    const table = db.resourceTable(entry.resource);

    if (entry.op === "delete") {
      await table.delete(entry.rowId);
      return;
    }

    const remaining = (
      await db.sync_queue.where("rowId").equals(entry.rowId).toArray()
    ).some((candidate) => candidate.resource === entry.resource);
    if (remaining) {
      return;
    }

    const row = await table.get(entry.rowId);
    if (row) {
      await table.update(entry.rowId, {
        __sync: "synced",
        __lastSyncError: null,
        __pendingDelete: false,
      });
    }
  }

  private async markRowFailed(
    entry: QueueEntry,
    message: string,
  ): Promise<void> {
    if (entry.op === "delete") {
      return;
    }
    const table = db.resourceTable(entry.resource);
    const row = await table.get(entry.rowId);
    if (row) {
      await table.update(entry.rowId, {
        __sync: "failed",
        __lastSyncError: message,
      });
    }
  }

  private async pullAll(
    force: boolean,
  ): Promise<{ changes: number; tablesPulled: number }> {
    let changes = 0;
    let tablesPulled = 0;

    for (const config of RESOURCES) {
      if (!config.pull) {
        continue;
      }
      let remote: Array<Record<string, unknown>>;
      try {
        remote = await this.fetchAll(config.table);
      } catch {
        // A transient pull failure must not stop the other tables.
        continue;
      }
      tablesPulled += 1;
      changes += await this.applyRemote(config, remote, force);
    }

    return { changes, tablesPulled };
  }

  private async fetchAll(table: string): Promise<Array<Record<string, unknown>>> {
    const client = supabaseClient as unknown as DynamicClient;
    const all: Array<Record<string, unknown>> = [];
    let from = 0;
    for (;;) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .range(from, from + PULL_PAGE_SIZE - 1);
      if (error) {
        throw supabaseError(error);
      }
      const batch = (data ?? []) as Array<Record<string, unknown>>;
      all.push(...batch);
      if (batch.length < PULL_PAGE_SIZE) {
        break;
      }
      from += PULL_PAGE_SIZE;
    }
    return all;
  }

  private async applyRemote(
    config: SyncResourceConfig,
    remote: Array<Record<string, unknown>>,
    force: boolean,
  ): Promise<number> {
    const table = db.resourceTable(config.name);
    const now = new Date().toISOString();
    let changes = 0;

    await db.transaction("rw", table, async () => {
      const local = await table.toArray();
      const localById = new Map(local.map((row) => [String(row.id), row]));
      const remoteIds = new Set(remote.map((record) => String(record.id)));

      for (const record of remote) {
        const id = String(record.id);
        const existing = localById.get(id);
        if (
          existing &&
          (existing.__sync === "pending" || existing.__sync === "failed")
        ) {
          continue;
        }
        if (existing && !force && isUnchanged(existing, record)) {
          continue;
        }
        await table.put({
          ...record,
          __sync: "synced",
          __localUpdatedAt: now,
          __baseUpdatedAt: (record.updated_at as string) ?? null,
          __lastSyncError: null,
          __pendingDelete: false,
        });
        changes += 1;
      }

      for (const row of local) {
        if (row.__pendingDelete) {
          continue;
        }
        if (row.__sync === "pending" || row.__sync === "failed") {
          continue;
        }
        if (!remoteIds.has(String(row.id))) {
          await table.delete(String(row.id));
          changes += 1;
        }
      }
    });

    return changes;
  }

  private async refreshCounts(): Promise<void> {
    const entries = await db.sync_queue.toArray();
    this.updateState({
      pending: entries.filter((entry) => entry.status === "pending").length,
      failed: entries.filter((entry) => entry.status === "failed").length,
    });
  }

  private updateState(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const syncService = new SyncService();
