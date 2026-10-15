import { supabaseClient } from "../data/remote/supabase";
import {
  cacheProfile,
  getCachedProfile,
  isNetworkError,
  type AppRole,
} from "./profileCache";

let cachedRole: AppRole | null | undefined;

/**
 * Resolve the signed-in user's active role from public.profiles.
 *
 * Result is memoized for the session; call `clearRoleCache` on sign-in/out so
 * permission checks do not hit the network repeatedly. When the device is
 * offline the last cached role is used so read access keeps working.
 */
export async function getCurrentRole(force = false): Promise<AppRole | null> {
  if (!force && cachedRole !== undefined) {
    return cachedRole;
  }

  let userId = getCachedProfile()?.userId ?? null;
  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (user?.id) {
      userId = user.id;
    }
  } catch {
    // Offline / unreachable: fall back to the cached profile's user id.
  }

  if (!userId) {
    cachedRole = null;
    return null;
  }

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    cachedRole = data && data.is_active ? data.role : null;
    if (data) {
      cacheProfile({
        userId,
        role: data.role,
        isActive: data.is_active,
        savedAt: Date.now(),
      });
    }
    return cachedRole;
  } catch (error) {
    if (isNetworkError(error)) {
      const cached = getCachedProfile(userId);
      cachedRole = cached && cached.isActive ? cached.role : null;
      return cachedRole;
    }
    cachedRole = null;
    return null;
  }
}

export function clearRoleCache(): void {
  cachedRole = undefined;
}
