import { useList } from "@refinedev/core";
import { useMemo } from "react";
import type { Uom } from "./uom.schema";
import { buildGlobalFactorMap } from "./uomGlobalConversion";

/**
 * Loads the UoM catalog and builds the reusable global conversion lookup used
 * by product unit, purchase-price, and UoM editing screens.
 */
export function useUomGlobalFactors() {
  const { query, result } = useList<Uom>({
    resource: "uoms",
    pagination: { pageSize: 1000 },
  });

  const uoms = useMemo(() => result.data ?? [], [result.data]);
  const uomById = useMemo(
    () => new Map(uoms.map((uom) => [uom.id, uom])),
    [uoms],
  );
  const globalFactors = useMemo(
    () => buildGlobalFactorMap(uoms),
    [uoms],
  );

  return {
    uoms,
    uomById,
    globalFactors,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
