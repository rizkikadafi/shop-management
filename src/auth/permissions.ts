import { supabaseClient } from "../data/remote/supabase";
import { isOffline, withTimeout } from "./network";
import {
  cacheProfile,
  getCachedProfile,
  isNetworkError,
  type AppRole,
} from "./profileCache";

let cachedRole: AppRole | null | undefined;

function cachedRoleOrNull(userId?: string): AppRole | null {
  const cached = getCachedProfile(userId);
  return cached && cached.isActive ? cached.role : null;
}

/**
 * Resolve the signed-in user's active role from public.profiles.
 *
 * Result is memoized for the session; call `clearRoleCache` on sign-in/out so
 * permission checks do not hit the network repeatedly. When the device is
 * offline (or the network is unreachable) the last cached role is used so read
 * access keeps working — importantly, we do not await the network at all when
 * the browser reports no connectivity, so menus and routes do not block behind
 * a request that only fails after a long timeout.
 */
export async function getCurrentRole(force = false): Promise<AppRole | null> {
  if (!force && cachedRole !== undefined) {
    return cachedRole;
  }

  // Offline: use the cached role but do NOT memoize it, so that the next call
  // after connectivity returns performs a real check instead of being stuck on
  // a stale (possibly null) value.
  if (isOffline()) {
    return cachedRoleOrNull();
  }

  let userId = getCachedProfile()?.userId ?? null;
  try {
    const {
      data: { user },
    } = await withTimeout(supabaseClient.auth.getUser());
    if (user?.id) {
      userId = user.id;
    }
  } catch {
    // Offline / unreachable / timed out: fall back to the cached user id.
  }

  if (!userId) {
    cachedRole = null;
    return null;
  }

  try {
    const { data, error } = await withTimeout(
      supabaseClient
        .from("profiles")
        .select("role, is_active")
        .eq("id", userId)
        .maybeSingle(),
    );

    if (error) {
      throw error;
    }

    cachedRole = data && data.is_active ? data.role : null;
    if (data) {
      cacheProfile({
        userId,
        role: data.role,
        isActive: data.is_active,
        email: getCachedProfile(userId)?.email ?? null,
        savedAt: Date.now(),
      });
    }
    return cachedRole;
  } catch (error) {
    if (isNetworkError(error)) {
      // Unreachable server: return the cached role without memoizing it.
      return cachedRoleOrNull(userId);
    }
    cachedRole = null;
    return null;
  }
}

export function clearRoleCache(): void {
  cachedRole = undefined;
}
