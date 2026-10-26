import { applyFilters, applySorters, paginate } from "../src/data/local/query";
import { parseSelect, projectRow } from "../src/data/local/select";
import { getResourceConfig } from "../src/data/local/resources";
import type { LocalRow } from "../src/data/local/db";
import { TimeoutError, withTimeout } from "../src/auth/network";
import {
  derivePurchasePrices,
  factorToBaseMap,
  formatQuantity,
} from "../src/modules/products/uomConversion";
import { buildGlobalFactorMap } from "../src/modules/uoms/uomGlobalConversion";

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

// --- global conversion trees and per-row overrides -------------------------
const uomCatalog = [
  {
    id: "uom-pcs",
    uom_type: "unit",
    global_parent_uom_id: null,
    global_quantity_in_parent: null,
  },
  {
    id: "uom-pack",
    uom_type: "unit",
    global_parent_uom_id: "uom-pcs",
    global_quantity_in_parent: 6,
  },
  {
    id: "uom-box",
    uom_type: "unit",
    global_parent_uom_id: "uom-pack",
    global_quantity_in_parent: 4,
  },
  {
    id: "uom-g",
    uom_type: "weight",
    global_parent_uom_id: null,
    global_quantity_in_parent: null,
  },
  {
    id: "uom-kg",
    uom_type: "weight",
    global_parent_uom_id: "uom-g",
    global_quantity_in_parent: 1000,
  },
  {
    id: "uom-karung",
    uom_type: "weight",
    global_parent_uom_id: "uom-kg",
    global_quantity_in_parent: 50,
  },
  {
    id: "uom-ml",
    uom_type: "volume",
    global_parent_uom_id: null,
    global_quantity_in_parent: null,
  },
  {
    id: "uom-l",
    uom_type: "volume",
    global_parent_uom_id: "uom-ml",
    global_quantity_in_parent: 1000,
  },
];
const globalFactors = buildGlobalFactorMap(uomCatalog);

check(
  "global unit factors",
  [
    globalFactors.factorToBase("uom-pack", "uom-pcs"),
    globalFactors.factorToBase("uom-box", "uom-pcs"),
    globalFactors.factorToBase("uom-box", "uom-pack"),
  ],
  [6, 24, 4],
);
check(
  "global weight factors",
  [
    globalFactors.factorToBase("uom-kg", "uom-g"),
    globalFactors.factorToBase("uom-g", "uom-kg"),
    globalFactors.factorToBase("uom-karung", "uom-kg"),
    globalFactors.factorToBase("uom-karung", "uom-g"),
  ],
  [1000, 0.001, 50, 50000],
);
check(
  "global volume factors",
  [
    globalFactors.factorToBase("uom-l", "uom-ml"),
    globalFactors.factorToBase("uom-ml", "uom-l"),
  ],
  [1000, 0.001],
);
check(
  "global conversion rejects mixed families",
  globalFactors.factorToBase("uom-kg", "uom-l"),
  null,
);
check("tiny conversion stays visible", formatQuantity(0.0000005), "5e-7");

const cycleFactors = buildGlobalFactorMap([
  {
    id: "cycle-a",
    uom_type: "unit",
    global_parent_uom_id: "cycle-b",
    global_quantity_in_parent: 2,
  },
  {
    id: "cycle-b",
    uom_type: "unit",
    global_parent_uom_id: "cycle-a",
    global_quantity_in_parent: 3,
  },
]);
check(
  "cycles are rejected",
  cycleFactors.factorToBase("cycle-a", "cycle-a"),
  null,
);

const mixedWeightRows = [
  {
    id: "kg",
    uom_id: "uom-kg",
    parent_product_uom_id: null,
    quantity_in_parent: 1,
    conversion_mode: "global",
  },
  {
    id: "g",
    uom_id: "uom-g",
    parent_product_uom_id: "kg",
    // The stored snapshot is deliberately wrong; global mode must ignore it.
    quantity_in_parent: 0.5,
    conversion_mode: "global",
  },
  {
    id: "karung",
    uom_id: "uom-karung",
    parent_product_uom_id: "kg",
    quantity_in_parent: 25,
    conversion_mode: "local",
  },
];
const mixedWeightFactors = factorToBaseMap(mixedWeightRows, globalFactors);
check(
  "global rows ignore stored snapshot and local rows override",
  [
    mixedWeightFactors.get("kg"),
    mixedWeightFactors.get("g"),
    mixedWeightFactors.get("karung"),
  ],
  [1, 0.001, 25],
);

const mixedUnitRows = [
  {
    id: "pcs",
    uom_id: "uom-pcs",
    parent_product_uom_id: null,
    quantity_in_parent: 1,
    conversion_mode: "global",
  },
  {
    id: "pack",
    uom_id: "uom-pack",
    parent_product_uom_id: "pcs",
    quantity_in_parent: 6,
    conversion_mode: "global",
  },
  {
    id: "box",
    uom_id: "uom-box",
    parent_product_uom_id: "pack",
    quantity_in_parent: 2,
    conversion_mode: "local",
  },
];
check(
  "a local row composes with a global parent",
  factorToBaseMap(mixedUnitRows, globalFactors).get("box"),
  12,
);

const partialGlobalRows = [
  {
    id: "kg",
    uom_id: "uom-kg",
    parent_product_uom_id: null,
    quantity_in_parent: 1,
    conversion_mode: "global",
  },
  {
    id: "custom-weight",
    uom_id: "uom-custom-weight",
    parent_product_uom_id: "kg",
    quantity_in_parent: 0.5,
    conversion_mode: "global",
  },
];
check(
  "missing global conversion falls back to the product tree",
  factorToBaseMap(partialGlobalRows, globalFactors).get("custom-weight"),
  0.5,
);

const globalPrices = derivePurchasePrices(
  mixedWeightRows,
  new Map([["kg", 10]]),
  globalFactors,
);
check(
  "global and local factors drive purchase prices",
  [
    globalPrices.get("kg")?.price,
    globalPrices.get("g")?.price,
    globalPrices.get("karung")?.price,
  ],
  [10, 0.01, 250],
);

const siblingRows = [
  {
    id: "pcs",
    uom_id: "uom-pcs",
    parent_product_uom_id: null,
    quantity_in_parent: 1,
    conversion_mode: "global",
  },
  {
    id: "pack",
    uom_id: "uom-pack",
    parent_product_uom_id: "pcs",
    quantity_in_parent: 6,
    conversion_mode: "global",
  },
  {
    id: "box",
    uom_id: "uom-box",
    parent_product_uom_id: "pcs",
    quantity_in_parent: 24,
    conversion_mode: "global",
  },
];
const siblingPrices = derivePurchasePrices(
  siblingRows,
  new Map([["pack", 12]]),
  globalFactors,
);
check(
  "purchase prices derive between global sibling rows",
  [siblingPrices.get("box")?.price, siblingPrices.get("box")?.anchorId],
  [48, "pack"],
);

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
