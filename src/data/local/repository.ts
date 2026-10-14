import type { DataProvider } from "@refinedev/core";
import { db, localMeta, stripLocalMeta, type LocalRow } from "./db";
import {
  applyFilters,
  applySearch,
  applySorters,
  paginate,
} from "./query";
import {
  getResourceConfig,
  type SyncResourceConfig,
} from "./resources";
import { embedResources, parseSelect, projectRow } from "./select";
import {
  saveLocalCreate,
  saveLocalDelete,
  saveLocalUpdate,
} from "../sync/queue";

/**
 * Offline-aware data provider.
 *
 * Every read is served from IndexedDB; every write is committed locally and
 * queued for the sync engine. Refine's pages consume this through hooks and
 * never touch Supabase directly, so swapping the storage engine does not
 * change any product page.
 */

function httpError(message: string, statusCode = 400): Error {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function requireConfig(resource: string): SyncResourceConfig {
  const config = getResourceConfig(resource);
  if (!config) {
    throw httpError(`Unknown resource: ${resource}`, 404);
  }
  return config;
}

function requireWritable(config: SyncResourceConfig): void {
  if (!config.offlineWrites) {
    throw httpError(
      `${config.name} can only be changed while online.`,
      403,
    );
  }
}

/** Load the related rows needed to resolve a projection's embeddings. */
async function loadEmbedMaps(
  config: SyncResourceConfig,
  select: string | undefined,
): Promise<Record<string, Map<string, LocalRow>>> {
  const parsed = parseSelect(select);
  const maps: Record<string, Map<string, LocalRow>> = {};
  for (const name of embedResources(config, parsed)) {
    const rows = await db.resourceTable(name).toArray();
    maps[name] = new Map(
      rows
        .filter((row) => !row.__pendingDelete)
        .map((row) => [String(row.id), row]),
    );
  }
  return maps;
}

export const localDataProvider: DataProvider = {
  getApiUrl: () => "",

  getList: async ({ resource, pagination, filters, sorters, meta }) => {
    const config = requireConfig(resource);
    const table = db.resourceTable(resource);

    const stored = await table.toArray();
    const visible = stored.filter((row) => !row.__pendingDelete);
    const searched = applySearch(
      visible,
      typeof meta?.q === "string" ? meta.q : "",
      config,
    );
    const filtered = applyFilters(searched, filters);
    const sorted = applySorters(filtered, sorters);
    const { rows, total } = paginate(sorted, pagination);

    const parsed = parseSelect(meta?.select);
    const embedMaps = await loadEmbedMaps(config, meta?.select);

    return {
      data: rows.map(
        (row) => projectRow(row, parsed, config, embedMaps) as never,
      ),
      total,
    };
  },

  getMany: async ({ resource, ids, meta }) => {
    const config = requireConfig(resource);
    const table = db.resourceTable(resource);
    const wanted = new Set(ids.map(String));
    const rows = (await table.toArray()).filter(
      (row) => !row.__pendingDelete && wanted.has(String(row.id)),
    );
    const parsed = parseSelect(meta?.select);
    const embedMaps = await loadEmbedMaps(config, meta?.select);
    return {
      data: rows.map(
        (row) => projectRow(row, parsed, config, embedMaps) as never,
      ),
    };
  },

  getOne: async ({ resource, id, meta }) => {
    const config = requireConfig(resource);
    const row = await db.resourceTable(resource).get(String(id));
    if (!row || row.__pendingDelete) {
      throw httpError(`${resource} ${String(id)} was not found`, 404);
    }
    const parsed = parseSelect(meta?.select);
    const embedMaps = await loadEmbedMaps(config, meta?.select);
    return { data: projectRow(row, parsed, config, embedMaps) as never };
  },

  create: async ({ resource, variables }) => {
    const config = requireConfig(resource);
    requireWritable(config);

    const values = (variables ?? {}) as Record<string, unknown>;
    const now = new Date().toISOString();
    const row: LocalRow = {
      ...values,
      id: String(values.id ?? crypto.randomUUID()),
      created_at: values.created_at ?? now,
      updated_at: values.updated_at ?? now,
      ...localMeta("pending"),
    };

    await saveLocalCreate(resource, row);
    return { data: stripLocalMeta(row) as never };
  },

  createMany: async ({ resource, variables }) => {
    const config = requireConfig(resource);
    requireWritable(config);
    const created: Array<Record<string, unknown>> = [];
    for (const item of variables as Array<Record<string, unknown>>) {
      const now = new Date().toISOString();
      const row: LocalRow = {
        ...item,
        id: String(item.id ?? crypto.randomUUID()),
        created_at: item.created_at ?? now,
        updated_at: item.updated_at ?? now,
        ...localMeta("pending"),
      };
      await saveLocalCreate(resource, row);
      created.push(stripLocalMeta(row));
    }
    return { data: created as never };
  },

  update: async ({ resource, id, variables }) => {
    const config = requireConfig(resource);
    requireWritable(config);

    const values = (variables ?? {}) as Record<string, unknown>;
    const table = db.resourceTable(resource);
    const existing = await table.get(String(id));
    const now = new Date().toISOString();

    const row: LocalRow = {
      ...(existing ?? { id: String(id) }),
      ...values,
      id: String(id),
      updated_at: now,
      ...localMeta("pending", existing?.__baseUpdatedAt ?? null),
    };

    await saveLocalUpdate(resource, row);
    return { data: stripLocalMeta(row) as never };
  },

  updateMany: async ({ resource, ids, variables }) => {
    const config = requireConfig(resource);
    requireWritable(config);
    const table = db.resourceTable(resource);
    const values = (variables ?? {}) as Record<string, unknown>;
    const updated: Array<Record<string, unknown>> = [];

    for (const id of ids) {
      const existing = await table.get(String(id));
      const now = new Date().toISOString();
      const row: LocalRow = {
        ...(existing ?? { id: String(id) }),
        ...values,
        id: String(id),
        updated_at: now,
        ...localMeta("pending", existing?.__baseUpdatedAt ?? null),
      };
      await saveLocalUpdate(resource, row);
      updated.push(stripLocalMeta(row));
    }
    return { data: updated as never };
  },

  deleteOne: async ({ resource, id }) => {
    const config = requireConfig(resource);
    requireWritable(config);

    const table = db.resourceTable(resource);
    const existing = await table.get(String(id));
    if (existing) {
      const row: LocalRow = {
        ...existing,
        __sync: "pending",
        __localUpdatedAt: new Date().toISOString(),
        __pendingDelete: true,
        __lastSyncError: null,
      };
      await saveLocalDelete(resource, row);
    }
    return { data: { id } as never };
  },

  deleteMany: async ({ resource, ids }) => {
    const config = requireConfig(resource);
    requireWritable(config);
    const table = db.resourceTable(resource);
    const removed: Array<{ id: string }> = [];
    for (const id of ids) {
      const existing = await table.get(String(id));
      if (existing) {
        await saveLocalDelete(resource, {
          ...existing,
          __sync: "pending",
          __localUpdatedAt: new Date().toISOString(),
          __pendingDelete: true,
          __lastSyncError: null,
        });
      }
      removed.push({ id: String(id) });
    }
    return { data: removed as never };
  },
};
