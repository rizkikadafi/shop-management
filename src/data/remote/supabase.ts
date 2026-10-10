import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase configuration. Set VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
  );
}

/**
 * Single client instance for the whole app.
 *
 * Only ever use the publishable/anon key here. The service_role key must never
 * reach the browser; Row Level Security is the security boundary.
 */
export const supabaseClient = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
