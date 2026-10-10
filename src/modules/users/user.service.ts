import { supabaseClient } from "../../data/remote/supabase";
import type { AppRole, CreateUserValues } from "./user.schema";

/**
 * User-management boundary.
 *
 * All privileged operations (create user, change role, deactivate, reset
 * password) go through the `admin-users` Edge Function, which verifies the
 * caller is an active admin using the service-role key server-side. No page
 * talks to the Auth admin API directly.
 */
async function invoke(body: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabaseClient.functions.invoke("admin-users", {
    body,
  });

  if (error) {
    throw new Error(await extractError(error));
  }

  const message = (data as { error?: string } | null)?.error;
  if (message) {
    throw new Error(message);
  }
}

async function extractError(error: unknown): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === "function") {
    try {
      const payload = (await context.json()) as { error?: string };
      if (payload?.error) {
        return payload.error;
      }
    } catch {
      // fall through to the generic message
    }
  }
  return (error as { message?: string }).message ?? "Request failed.";
}

export const userService = {
  create(values: CreateUserValues): Promise<void> {
    return invoke({ action: "create", ...values });
  },

  updateRole(userId: string, role: AppRole): Promise<void> {
    return invoke({ action: "update-role", user_id: userId, role });
  },

  setActive(userId: string, isActive: boolean): Promise<void> {
    return invoke({ action: "set-active", user_id: userId, is_active: isActive });
  },

  resetPassword(userId: string, password: string): Promise<void> {
    return invoke({ action: "reset-password", user_id: userId, password });
  },
};
