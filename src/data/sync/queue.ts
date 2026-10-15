import { db, type LocalRow, type QueueEntry, type QueueOp } from "../local/db";
import { getResourceConfig } from "../local/resources";
import { requestSync } from "./notify";

/**
 * Durable mutation queue.
 *
 * Row writes and their queue entries are always committed in the same Dexie
 * transaction. Repeated edits coalesce into a single entry per row (so the
 * queue stays small and replaying is cheap) while preserving the original
 * sequence number, which keeps parent-before-child ordering intact.
 */

function newEntry(
  resource: string,
  op: QueueOp,
  rowId: string,
  payload: LocalRow | null,
): QueueEntry {
  const now = Date.now();
  return {
    resource,
    op,
    rowId,
    payload: payload ?? undefined,
    createdAt: now,
    attempts: 0,
    nextAttemptAt: now,
    status: "pending",
    lastError: null,
  };
}

async function queueEntriesFor(
  resource: string,
  rowId: string,
): Promise<QueueEntry[]> {
  const entries = await db.sync_queue.where("rowId").equals(rowId).toArray();
  return entries.filter((entry) => entry.resource === resource);
}

async function dropEntries(entries: QueueEntry[]): Promise<void> {
  const seqs = entries
    .map((entry) => entry.seq)
    .filter((seq): seq is number => typeof seq === "number");
  if (seqs.length > 0) {
    await db.sync_queue.bulkDelete(seqs);
  }
}

function resetForRetry(payload: LocalRow): Partial<QueueEntry> {
  return {
    payload,
    attempts: 0,
    status: "pending",
    nextAttemptAt: Date.now(),
    lastError: null,
  };
}

async function coalesce(
  resource: string,
  rowId: string,
  op: "create" | "update",
  payload: LocalRow,
): Promise<void> {
  const existing = await queueEntriesFor(resource, rowId);
  const create = existing.find((entry) => entry.op === "create");
  const update = existing.find((entry) => entry.op === "update");

  if (op === "create") {
    if (create?.seq !== undefined) {
      await db.sync_queue.update(create.seq, resetForRetry(payload));
      await dropEntries(existing.filter((entry) => entry !== create));
    } else {
      await db.sync_queue.add(newEntry(resource, "create", rowId, payload));
      await dropEntries(existing);
    }
    return;
  }

  // Update: fold into an existing create, else refresh the pending update.
  if (create?.seq !== undefined) {
    await db.sync_queue.update(create.seq, resetForRetry(payload));
    await dropEntries(existing.filter((entry) => entry.op === "update"));
    return;
  }
  if (update?.seq !== undefined) {
    await db.sync_queue.update(update.seq, resetForRetry(payload));
    return;
  }
  await db.sync_queue.add(newEntry(resource, "update", rowId, payload));
}

/** Persist a new row and queue its creation. */
export async function saveLocalCreate(
  resource: string,
  row: LocalRow,
): Promise<void> {
  const table = db.resourceTable(resource);
  await db.transaction("rw", table, db.sync_queue, async () => {
    await table.put(row);
    await coalesce(resource, String(row.id), "create", row);
  });
  requestSync();
}

/** Persist an updated row and queue the change. */
export async function saveLocalUpdate(
  resource: string,
  row: LocalRow,
): Promise<void> {
  const table = db.resourceTable(resource);
  await db.transaction("rw", table, db.sync_queue, async () => {
    await table.put(row);
    await coalesce(resource, String(row.id), "update", row);
  });
  requestSync();
}

/**
 * Queue a delete.
 *
 * Resources that declare a `softDeleteColumn` (e.g. products use `deleted_at`)
 * keep the row and queue a tombstoning update, so the server record survives
 * and only disappears from filtered lists. Other resources queue a hard delete.
 * A row that was only ever a local create never reached the server, so it is
 * dropped entirely in either case.
 */
export async function saveLocalDelete(
  resource: string,
  row: LocalRow,
): Promise<void> {
  const config = getResourceConfig(resource);
  const softColumn = config?.softDeleteColumn;
  const table = db.resourceTable(resource);

  await db.transaction("rw", table, db.sync_queue, async () => {
    const existing = await queueEntriesFor(resource, String(row.id));
    const wasLocalCreate = existing.some((entry) => entry.op === "create");

    if (softColumn && !wasLocalCreate) {
      const now = new Date().toISOString();
      const tombstoned: LocalRow = {
        ...row,
        [softColumn]: row[softColumn] ?? now,
        updated_at: now,
        __sync: "pending",
        __localUpdatedAt: now,
        __pendingDelete: false,
        __lastSyncError: null,
      };
      await table.put(tombstoned);
      await coalesce(resource, String(row.id), "update", tombstoned);
      return;
    }

    await dropEntries(existing);

    if (wasLocalCreate) {
      await table.delete(String(row.id));
      return;
    }

    await table.put(row);
    await db.sync_queue.add(newEntry(resource, "delete", String(row.id), null));
  });
  requestSync();
}
