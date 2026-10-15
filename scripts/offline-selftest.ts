import { applyFilters, applySorters, paginate } from "../src/data/local/query";
import { parseSelect, projectRow } from "../src/data/local/select";
import { getResourceConfig } from "../src/data/local/resources";
import type { LocalRow } from "../src/data/local/db";
import { TimeoutError, withTimeout } from "../src/auth/network";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures += 1;
    console.error(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

const meta = (extra: Partial<LocalRow> = {}): LocalRow =>
  ({
    __sync: "synced",
    __localUpdatedAt: "t",
    __baseUpdatedAt: null,
    __lastSyncError: null,
    __pendingDelete: false,
    ...extra,
  }) as LocalRow;

// --- select parsing + embed projection -------------------------------------
const select =
  "id, name, deleted_at, category:category_id(name), base_uom:base_uom_id(name, symbol)";
const parsed = parseSelect(select);
check("parse fields", parsed.fields.map((f) => f.key), ["id", "name", "deleted_at"]);
check("parse embeds", parsed.embeds.map((e) => [e.alias, e.relation]), [
  ["category", "category_id"],
  ["base_uom", "base_uom_id"],
]);
check("parse all", parseSelect(undefined).all, true);

const config = getResourceConfig("products");
const embedMaps = {
  categories: new Map([["cat-1", meta({ id: "cat-1", name: "Drinks" })]]),
  uoms: new Map([["uom-1", meta({ id: "uom-1", name: "Bottle", symbol: "btl" })]]),
};
const projected = projectRow(
  meta({
    id: "p1",
    name: "Cola",
    deleted_at: null,
    category_id: "cat-1",
    base_uom_id: "uom-1",
    secret: "should-not-leak",
  }),
  parsed,
  config,
  embedMaps,
);
check("project shape", projected, {
  id: "p1",
  name: "Cola",
  deleted_at: null,
  category: { name: "Drinks" },
  base_uom: { name: "Bottle", symbol: "btl" },
});
check("project missing embed is null", projectRow(meta({ id: "p2" }), parsed, config, embedMaps).category, null);

// --- filter parity ---------------------------------------------------------
const rows = [
  meta({ id: "a", name: "Apple", price: 10, deleted_at: null }),
  meta({ id: "b", name: "banana", price: 5, deleted_at: "2024-01-01" }),
  meta({ id: "c", name: "Cherry", price: 20, deleted_at: null }),
];

check("eq id", applyFilters(rows, [{ field: "id", operator: "eq", value: "b" }]).map((r) => r.id), ["b"]);
check("in ids", applyFilters(rows, [{ field: "id", operator: "in", value: ["a", "c"] }]).map((r) => r.id), ["a", "c"]);
check(
  "contains case-insensitive",
  applyFilters(rows, [{ field: "name", operator: "contains", value: "AN" }]).map((r) => r.id),
  ["b"],
);
check("gte price", applyFilters(rows, [{ field: "price", operator: "gte", value: 10 }]).map((r) => r.id), ["a", "c"]);
check("lte price", applyFilters(rows, [{ field: "price", operator: "lte", value: 10 }]).map((r) => r.id), ["a", "b"]);
check("null deleted_at", applyFilters(rows, [{ field: "deleted_at", operator: "null", value: true }]).map((r) => r.id), ["a", "c"]);
check("nnull deleted_at", applyFilters(rows, [{ field: "deleted_at", operator: "nnull", value: true }]).map((r) => r.id), ["b"]);
check("or conditional", applyFilters(rows, [{ operator: "or", value: [{ field: "id", operator: "eq", value: "a" }, { field: "price", operator: "gte", value: 20 }] }]).map((r) => r.id), ["a", "c"]);

// --- sort + paginate -------------------------------------------------------
const sortedDesc = applySorters(rows, [{ field: "price", order: "desc" }]).map((r) => r.id);
check("sort price desc", sortedDesc, ["c", "a", "b"]);
const { rows: page, total } = paginate(rows, { current: 2, pageSize: 2 });
check("paginate total", total, 3);
check("paginate page2", page.map((r) => r.id), ["c"]);

// --- network timeout helper ------------------------------------------------
const resolved = await withTimeout(Promise.resolve("ok"), 1000);
check("withTimeout resolves before deadline", resolved, "ok");

let timedOut = false;
try {
  await withTimeout(new Promise(() => {}), 20);
} catch (error) {
  timedOut = error instanceof TimeoutError;
}
check("withTimeout rejects with TimeoutError", timedOut, true);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall self-tests passed");
