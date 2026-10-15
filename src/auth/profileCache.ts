import type { Database } from "../data/remote/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface CachedProfile {
  userId: string;
  role: AppRole;
  isActive: boolean;
  /** Last known email, used to render identity while offline. */
  email?: string | null;
  savedAt: number;
}

const STORAGE_KEY = "shop-management.profile";

/**
 * Small localStorage cache of the signed-in user's role.
 *
 * Auth must keep working with no network, so the last known role is kept
 * outside IndexedDB (which the sync engine owns and may clear). It only holds
 * the caller's own profile, which RLS already lets them read.
 */
export function cacheProfile(profile: CachedProfile): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage may be unavailable (private mode); offline role checks then
    // fall back to denying writes, which is safe.
  }
}

export function getCachedProfile(userId?: string): CachedProfile | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedProfile;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.role !== "string" ||
      typeof parsed.isActive !== "boolean"
    ) {
      return null;
    }
    if (userId && parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCachedProfile(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Heuristic: was this failure caused by being offline / unreachable? */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }
  const message = (
    error instanceof Error
      ? error.message
      : String((error as { message?: unknown } | null)?.message ?? "")
  ).toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("load failed") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("fetch failed")
  );
}
