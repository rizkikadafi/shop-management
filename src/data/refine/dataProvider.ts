import type { DataProvider } from "@refinedev/core";
import { dataProvider as supabaseDataProvider } from "@refinedev/supabase";
import { supabaseClient } from "../remote/supabase";

/**
 * Offline-aware data provider boundary.
 *
 * Phase 1 delegates directly to the Supabase data provider so the CRUD screens
 * can be built and validated online. Product pages must never import Supabase
 * or this provider directly for data access; Refine's hooks consume it.
 *
 * Phase 2 replaces the internals here with the local (Dexie) repository without
 * changing any product page.
 */
export const dataProvider: DataProvider = supabaseDataProvider(supabaseClient);
