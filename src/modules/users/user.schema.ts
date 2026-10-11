import type { Database } from "../../data/remote/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const ROLES: { value: AppRole; labelKey: string }[] = [
  { value: "admin", labelKey: "users.roles.admin" },
  { value: "manager", labelKey: "users.roles.manager" },
  { value: "cashier", labelKey: "users.roles.cashier" },
];

export const ROLE_LABEL_KEYS = ROLES.reduce<Record<AppRole, string>>(
  (keys, role) => {
    keys[role.value] = role.labelKey;
    return keys;
  },
  {} as Record<AppRole, string>,
);

export const ROLE_COLORS: Record<AppRole, string> = {
  admin: "red",
  manager: "blue",
  cashier: "green",
};

export interface CreateUserValues {
  email: string;
  full_name?: string;
  role: AppRole;
  password: string;
}

export interface UpdateUserValues {
  role: AppRole;
  is_active: boolean;
}
