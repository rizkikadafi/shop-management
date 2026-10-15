import type { AuthProvider } from "@refinedev/core";
import type { Session } from "@supabase/supabase-js";
import { supabaseClient } from "../data/remote/supabase";
import { translate } from "../i18n/i18nProvider";
import { clearRoleCache, getCurrentRole } from "./permissions";
import { isOffline, withTimeout } from "./network";
import {
  cacheProfile,
  clearCachedProfile,
  getCachedProfile,
  isNetworkError,
} from "./profileCache";

interface Credentials {
  email?: string;
  password?: string;
}

const authError = (name: string, error: { message: string }) => ({
  name,
  message: error.message,
});

/**
 * Read the stored session without risking a long block. Supabase normally
 * returns the session from storage, but an expired token can trigger a
 * refresh that goes to the network; the timeout turns a stalled refresh into a
 * fast `null` so callers can fall back to the cached profile.
 */
async function readSession(): Promise<Session | null> {
  try {
    const { data } = await withTimeout(supabaseClient.auth.getSession());
    return data.session;
  } catch {
    return null;
  }
}

function cachedRoleOrNull(userId?: string) {
  const cached = getCachedProfile(userId);
  return cached && cached.isActive ? cached.role : null;
}

/**
 * Refine auth provider backed by Supabase Auth (email + password).
 *
 * Self sign-up is intentionally unsupported: staff accounts are provisioned by
 * an admin. Access requires an active row in public.profiles.
 *
 * Offline behaviour: sign-in still requires a connection, but once signed in a
 * stored session plus the cached profile keep the app usable offline. When the
 * device is offline we never wait on the network — the cached profile is trusted
 * immediately so the app renders from IndexedDB instead of blocking behind a
 * request that only fails after a long timeout. An explicit inactive/denied
 * response always wins; only unreachable-network failures fall back to the
 * cache.
 */
export const authProvider: AuthProvider = {
  login: async ({ email, password }: Credentials) => {
    if (!email || !password) {
      return {
        success: false,
        error: {
          name: "LoginError",
          message: translate("auth.emailRequired"),
        },
      };
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return {
        success: false,
        error: authError(
          "LoginError",
          error ?? { message: translate("auth.loginFailed") },
        ),
      };
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      await supabaseClient.auth.signOut();
      clearRoleCache();
      clearCachedProfile();
      return {
        success: false,
        error: {
          name: "LoginError",
          message: translate("auth.inactive"),
        },
      };
    }

    cacheProfile({
      userId: data.user.id,
      role: profile.role,
      isActive: profile.is_active,
      email: data.user.email ?? null,
      savedAt: Date.now(),
    });
    clearRoleCache();
    return { success: true, redirectTo: "/products" };
  },

  logout: async () => {
    const { error } = await supabaseClient.auth.signOut();
    clearRoleCache();
    clearCachedProfile();

    if (error) {
      return { success: false, error: authError("LogoutError", error) };
    }

    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const inactive = {
      authenticated: false,
      logout: true,
      redirectTo: "/login",
      error: {
        name: "Unauthorized",
        message: translate("auth.inactive"),
      },
    } as const;

    const unauthenticated = {
      authenticated: false,
      logout: true,
      redirectTo: "/login",
      error: {
        name: "Unauthorized",
        message: translate("auth.sessionRequired"),
      },
    } as const;

    // Offline: trust the cached profile (cleared on logout) instead of waiting
    // on a request that cannot succeed. This is what keeps the app from
    // rendering a blank screen until a fetch times out.
    if (isOffline()) {
      const cached = getCachedProfile();
      if (!cached) {
        return unauthenticated;
      }
      if (!cached.isActive) {
        clearRoleCache();
        clearCachedProfile();
        return inactive;
      }
      return { authenticated: true };
    }

    const session = await readSession();
    if (!session) {
      const cached = getCachedProfile();
      if (cached && cached.isActive) {
        return { authenticated: true };
      }
      clearRoleCache();
      return unauthenticated;
    }

    const userId = session.user.id;
    try {
      const { data: profile, error } = await withTimeout(
        supabaseClient
          .from("profiles")
          .select("role, is_active")
          .eq("id", userId)
          .maybeSingle(),
      );

      if (error) {
        throw error;
      }

      if (!profile || !profile.is_active) {
        await supabaseClient.auth.signOut();
        clearRoleCache();
        clearCachedProfile();
        return inactive;
      }

      cacheProfile({
        userId,
        role: profile.role,
        isActive: profile.is_active,
        email: session.user.email ?? null,
        savedAt: Date.now(),
      });
      return { authenticated: true };
    } catch (error) {
      if (isNetworkError(error)) {
        const cached = getCachedProfile(userId);
        if (cached && !cached.isActive) {
          return inactive;
        }
        // Unreachable server: trust the stored session and cached role.
        return { authenticated: true };
      }
      clearRoleCache();
      return unauthenticated;
    }
  },

  getIdentity: async () => {
    const cached = getCachedProfile();
    const offlineIdentity = async () => ({
      id: cached!.userId,
      name: cached!.email ?? cached!.userId,
      email: cached!.email ?? null,
      role: (await getCurrentRole()) ?? cached!.role ?? null,
    });

    if (isOffline() && cached) {
      return offlineIdentity();
    }

    const session = await readSession();
    const user = session?.user;

    if (!user) {
      if (cached) {
        return offlineIdentity();
      }
      return null;
    }

    return {
      id: user.id,
      name: user.email ?? user.id,
      email: user.email,
      role: (await getCurrentRole()) ?? cachedRoleOrNull(user.id),
    };
  },

  onError: async (error: any) => {
    if (error?.status === 401 || error?.statusCode === 401) {
      return { logout: true, error };
    }

    return { error };
  },

  getPermissions: async () => {
    return (await getCurrentRole()) ?? undefined;
  },
};
