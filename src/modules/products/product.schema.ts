import type { Database } from "../../data/remote/database.types";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
export type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

export const PRODUCT_LIMITS = {
  name: 200,
  sku: 64,
  description: 2000,
} as const;

/** Shape used by the Ant Design product form. */
export interface ProductFormValues {
  sku: string | null;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  category_id: string | null;
  base_uom_id: string | null;
}

/** Coerce PostgREST numeric (may arrive as string) into a number. */
export function normalizePrice(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Map a stored product into form values. */
export function toFormValues(product: Product): ProductFormValues {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: normalizePrice(product.price),
    is_active: product.is_active,
    category_id: product.category_id,
    base_uom_id: product.base_uom_id,
  };
}

/** Trim empty strings to null so optional text columns stay clean. */
function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Build the payload for a new product. `user_id` is set from the authenticated
 * session so RLS accepts the insert; `id` is generated to match the DB default.
 */
export function toInsert(
  values: ProductFormValues,
  userId: string,
): ProductInsert {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    sku: blankToNull(values.sku),
    name: values.name.trim(),
    description: blankToNull(values.description),
    price: normalizePrice(values.price),
    is_active: values.is_active,
    category_id: values.category_id,
    base_uom_id: values.base_uom_id ?? "",
  };
}

/** Build the payload for an update (user_id is not mutable through the form). */
export function toUpdate(values: ProductFormValues): ProductUpdate {
  return {
    sku: blankToNull(values.sku),
    name: values.name.trim(),
    description: blankToNull(values.description),
    price: normalizePrice(values.price),
    is_active: values.is_active,
    category_id: values.category_id,
    base_uom_id: values.base_uom_id ?? "",
  };
}
