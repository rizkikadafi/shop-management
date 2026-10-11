import type { Database } from "../../data/remote/database.types";

export type Uom = Database["public"]["Tables"]["uoms"]["Row"];
export type UomInsert = Database["public"]["Tables"]["uoms"]["Insert"];
export type UomUpdate = Database["public"]["Tables"]["uoms"]["Update"];

export const UOM_LIMITS = {
  name: 50,
  symbol: 16,
} as const;

export const UOM_TYPES = [
  { value: "unit", labelKey: "uoms.types.unit" },
  { value: "weight", labelKey: "uoms.types.weight" },
  { value: "volume", labelKey: "uoms.types.volume" },
] as const;

export type UomType = (typeof UOM_TYPES)[number]["value"];

export const UOM_TYPE_LABEL_KEYS = UOM_TYPES.reduce<Record<UomType, string>>(
  (keys, type) => {
    keys[type.value] = type.labelKey;
    return keys;
  },
  {} as Record<UomType, string>,
);

export const UOM_TYPE_COLORS: Record<UomType, string> = {
  unit: "blue",
  weight: "orange",
  volume: "cyan",
};

/** Shape used by the Ant Design UoM form. */
export interface UomFormValues {
  name: string;
  symbol: string;
  uom_type: UomType;
}

/** Map a stored UoM into form values. */
export function toFormValues(uom: Uom): UomFormValues {
  return {
    name: uom.name,
    symbol: uom.symbol,
    uom_type: uom.uom_type as UomType,
  };
}

/** Build the payload for a new UoM. */
export function toInsert(values: UomFormValues): UomInsert {
  return {
    id: crypto.randomUUID(),
    name: values.name.trim(),
    symbol: values.symbol.trim(),
    uom_type: values.uom_type,
  };
}

/** Build the payload for an update. */
export function toUpdate(values: UomFormValues): UomUpdate {
  return {
    name: values.name.trim(),
    symbol: values.symbol.trim(),
    uom_type: values.uom_type,
  };
}
