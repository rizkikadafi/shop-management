import type { AuthProvider } from "@refinedev/core";
import { supabaseClient } from "../data/remote/supabase";
import { translate } from "../i18n/i18nProvider";
import { clearRoleCache, getCurrentRole } from "./permissions";
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
 * Refine auth provider backed by Supabase Auth (email + password).
 *
 * Self sign-up is intentionally unsupported: staff accounts are provisioned by
 * an admin. Access requires an active row in public.profiles.
 *
 * Offline behaviour: sign-in still requires a connection, but once signed in a
 * stored session plus the cached profile keep the app usable offline. An
 * explicit inactive/denied response always wins; only unreachable-network
 * failures fall back to the cache.
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
    const { data } = await supabaseClient.auth.getSession();
    const session = data.session;

    if (!session) {
      clearRoleCache();
      return {
        authenticated: false,
        logout: true,
        redirectTo: "/login",
        error: {
          name: "Unauthorized",
          message: translate("auth.sessionRequired"),
        },
      };
    }

    const userId = session.user.id;
    const inactive = {
      authenticated: false,
      logout: true,
      redirectTo: "/login",
      error: {
        name: "Unauthorized",
        message: translate("auth.inactive"),
      },
    } as const;

    try {
      const { data: profile, error } = await supabaseClient
        .from("profiles")
        .select("role, is_active")
        .eq("id", userId)
        .maybeSingle();

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
        savedAt: Date.now(),
      });
      return { authenticated: true };
    } catch (error) {
      if (isNetworkError(error)) {
        const cached = getCachedProfile(userId);
        if (cached && !cached.isActive) {
          return inactive;
        }
        // Offline: trust the stored session. Write access is still gated by
        // the cached role through the access-control provider.
        return { authenticated: true };
      }
      clearRoleCache();
      return {
        authenticated: false,
        logout: true,
        redirectTo: "/login",
        error: {
          name: "Unauthorized",
          message: translate("auth.sessionRequired"),
        },
      };
    }
  },

  getIdentity: async () => {
    const { data } = await supabaseClient.auth.getSession();
    const user = data.session?.user;

    if (!user) {
      return null;
    }

    const cached = getCachedProfile(user.id);
    return {
      id: user.id,
      name: user.email ?? user.id,
      email: user.email,
      role: (await getCurrentRole()) ?? cached?.role ?? null,
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
