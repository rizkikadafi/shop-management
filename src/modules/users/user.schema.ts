import type { Database } from "../../data/remote/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
];

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
