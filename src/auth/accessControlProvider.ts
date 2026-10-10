import type { AccessControlProvider } from "@refinedev/core";
import { getCurrentRole } from "./permissions";

/**
 * Role-based access control.
 *
 * admin   -> everything, including user management
 * manager -> product create/edit
 * cashier -> product read only
 */
export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    const role = await getCurrentRole();

    if (!role) {
      return { can: false };
    }

    if (resource === "profiles") {
      return { can: role === "admin" };
    }

    if (resource === "products") {
      if (action === "list" || action === "show") {
        return { can: true };
      }
      return { can: role === "admin" || role === "manager" };
    }

    return { can: true };
  },
};
