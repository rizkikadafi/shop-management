import { useEffect, type ReactNode } from "react";
import { useInvalidate, useIsAuthenticated } from "@refinedev/core";

import { syncService } from "./sync.service";

/**
 * Bridges the sync engine into React: starts it while the user is signed in
 * and lets it refresh Refine queries after remote changes are applied.
 */
export function SyncManager({ children }: { children?: ReactNode }) {
  const invalidate = useInvalidate();
  const { data: authenticated } = useIsAuthenticated();

  useEffect(() => {
    syncService.setInvalidator(() => {
      void invalidate({ invalidates: ["all"] });
    });
    return () => syncService.setInvalidator(null);
  }, [invalidate]);

  useEffect(() => {
    if (!authenticated) {
      return undefined;
    }
    syncService.start();
    return () => syncService.stop();
  }, [authenticated]);

  return children ?? null;
}
