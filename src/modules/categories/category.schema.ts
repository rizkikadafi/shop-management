import type { Database } from "../../data/remote/database.types";

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];
export type CategoryUpdate = Database["public"]["Tables"]["categories"]["Update"];

export const CATEGORY_LIMITS = {
  name: 100,
} as const;

/** Shape used by the Ant Design category form. */
export interface CategoryFormValues {
  name: string;
}

/** Map a stored category into form values. */
export function toFormValues(category: Category): CategoryFormValues {
  return { name: category.name };
}

/** Build the payload for a new category. */
export function toInsert(values: CategoryFormValues): CategoryInsert {
  return {
    id: crypto.randomUUID(),
    name: values.name.trim(),
  };
}

/** Build the payload for an update. */
export function toUpdate(values: CategoryFormValues): CategoryUpdate {
  return {
    name: values.name.trim(),
  };
}
