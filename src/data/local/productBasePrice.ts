import type { LocalRow } from "./db";
import { db, localMeta } from "./db";
import { saveLocalUpdate } from "../sync/queue";
import { isBasePriceRule } from "../../modules/products/basePrice";

/**
 * Cross-table links for the product's base price.
 *
 * `products.price` and the retail/base-unit rule in `product_prices` are two
 * views of the same number. The offline data provider writes both rows when
 * either side changes, so the link works before the rows reach Supabase.
 *
 * Missing price rules are not created here: the database migration installs
 * triggers that guarantee one exists for every product base unit. Creating a
 * second one from an offline cache that is still catching up would race with
 * that trigger and fail the unique constraint.
 */

interface ProductUomLinkRow extends LocalRow {
  id: string;
  product_id: string;
  uom_id: string;
  parent_product_uom_id: string | null;
}

async function findBaseProductUom(
  productId: string,
  baseUomId: string | null,
): Promise<string | null> {
  const rows = (await db
    .resourceTable("product_uoms")
    .where("product_id")
    .equals(productId)
    .toArray()) as ProductUomLinkRow[];

  const visible = rows.filter((row) => !row.__pendingDelete);
  if (!baseUomId) {
    return visible.find((row) => row.parent_product_uom_id === null)?.id ?? null;
  }

  const exact = visible.find((row) => row.uom_id === baseUomId);
  return exact?.id ?? null;
}

async function findBasePriceRule(productId: string, baseProductUomId: string) {
  const rows = await db
    .resourceTable("product_prices")
    .where("product_id")
    .equals(productId)
    .toArray();

  return rows.find(
    (row) =>
      !row.__pendingDelete &&
      isBasePriceRule(
        {
          product_uom_id: String(row.product_uom_id),
          price_list: String(row.price_list),
          min_quantity: row.min_quantity as number | string,
        },
        baseProductUomId,
      ),
  );
}

/**
 * Mirror a saved product price into its linked price rule.
 *
 * If the rule has not reached the local cache yet the server trigger will
 * create or update it; the next pull fills the cache.
 */
export async function syncBasePriceFromProduct(
  product: LocalRow,
): Promise<void> {
  const productId = String(product.id);
  const price = Number(product.price);
  if (!Number.isFinite(price)) {
    return;
  }

  const baseUomId = product.base_uom_id
    ? String(product.base_uom_id)
    : null;
  const baseProductUomId = await findBaseProductUom(productId, baseUomId);
  if (!baseProductUomId) {
    return;
  }

  const rule = await findBasePriceRule(productId, baseProductUomId);
  if (!rule) {
    return;
  }

  if (
    Number(rule.package_price) === price &&
    Number(rule.package_quantity) === 1
  ) {
    return;
  }

  const now = new Date().toISOString();
  const updated: LocalRow = {
    ...rule,
    package_quantity: 1,
    package_price: price,
    updated_at: now,
    ...localMeta("pending", rule.__baseUpdatedAt ?? null),
  };
  await saveLocalUpdate("product_prices", updated);
}

/** Mirror an edited base-unit price rule back into its product. */
export async function syncProductPriceFromRule(
  rule: LocalRow,
): Promise<void> {
  const productId = String(rule.product_id);
  const product = await db.resourceTable("products").get(productId);
  if (!product || product.__pendingDelete) {
    return;
  }

  const baseUomId = product.base_uom_id
    ? String(product.base_uom_id)
    : null;
  const baseProductUomId = await findBaseProductUom(productId, baseUomId);
  if (
    !baseProductUomId ||
    !isBasePriceRule(
      {
        product_uom_id: String(rule.product_uom_id),
        price_list: String(rule.price_list),
        min_quantity: rule.min_quantity as number | string,
      },
      baseProductUomId,
    )
  ) {
    return;
  }

  const price = Number(rule.package_price);
  if (!Number.isFinite(price) || Number(product.price) === price) {
    return;
  }

  const now = new Date().toISOString();
  const updated: LocalRow = {
    ...product,
    price,
    updated_at: now,
    ...localMeta("pending", product.__baseUpdatedAt ?? null),
  };
  await saveLocalUpdate("products", updated);
}
