import type { Database } from "../data/remote/database.types";
import { supabaseClient } from "../data/remote/supabase";

export type AppRole = Database["public"]["Enums"]["app_role"];

let cachedRole: AppRole | null | undefined;

/**
 * Resolve the signed-in user's active role from public.profiles.
 *
 * Result is memoized for the session; call `clearRoleCache` on sign-in/out so
 * permission checks do not hit the network repeatedly.
 */
export async function getCurrentRole(force = false): Promise<AppRole | null> {
  if (!force && cachedRole !== undefined) {
    return cachedRole;
  }

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    cachedRole = null;
    return null;
  }

  const { data } = await supabaseClient
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  cachedRole = data && data.is_active ? data.role : null;
  return cachedRole;
}

export function clearRoleCache(): void {
  cachedRole = undefined;
}
