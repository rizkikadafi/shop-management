import type { AuthProvider } from "@refinedev/core";
import { supabaseClient } from "../data/remote/supabase";
import { translate } from "../i18n/i18nProvider";
import { clearRoleCache, getCurrentRole } from "./permissions";

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
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      await supabaseClient.auth.signOut();
      clearRoleCache();
      return {
        success: false,
        error: {
          name: "LoginError",
          message: translate("auth.inactive"),
        },
      };
    }

    clearRoleCache();
    return { success: true, redirectTo: "/products" };
  },

  logout: async () => {
    const { error } = await supabaseClient.auth.signOut();
    clearRoleCache();

    if (error) {
      return { success: false, error: authError("LogoutError", error) };
    }

    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const { data } = await supabaseClient.auth.getSession();

    if (!data.session) {
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

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("is_active")
      .eq("id", data.session.user.id)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      await supabaseClient.auth.signOut();
      clearRoleCache();
      return {
        authenticated: false,
        logout: true,
        redirectTo: "/login",
        error: {
          name: "Unauthorized",
          message: translate("auth.inactive"),
        },
      };
    }

    return { authenticated: true };
  },

  getIdentity: async () => {
    const { data } = await supabaseClient.auth.getUser();

    if (!data.user) {
      return null;
    }

    return {
      id: data.user.id,
      name: data.user.email ?? data.user.id,
      email: data.user.email,
      role: await getCurrentRole(),
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
