import { useSyncExternalStore } from "react";

import { syncService, type SyncState } from "./sync.service";

/** Subscribe a component to the sync engine's state. */
export function useSyncStatus(): SyncState {
  return useSyncExternalStore(
    syncService.subscribe,
    syncService.getState,
    syncService.getState,
  );
}

/** Track the browser's connectivity through the sync engine. */
export function useOnline(): boolean {
  return useSyncStatus().online;
}
