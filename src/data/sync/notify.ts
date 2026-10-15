/**
 * Tiny decoupling channel between the data layer and the sync engine.
 *
 * The repository calls `requestSync()` after a local write; the sync service
 * subscribes. This avoids a circular import (repository <-> sync service).
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function requestSync(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function onSyncRequested(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
