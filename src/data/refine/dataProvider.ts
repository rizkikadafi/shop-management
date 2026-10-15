import type { DataProvider } from "@refinedev/core";
import { localDataProvider } from "../local/repository";

/**
 * Offline-aware data provider boundary.
 *
 * The app reads and writes through IndexedDB; the sync engine reconciles with
 * Supabase in the background. Product pages consume this through Refine's
 * hooks and never import Supabase or this provider directly, so the storage
 * and sync internals can change without touching any page.
 */
export const dataProvider: DataProvider = localDataProvider;
