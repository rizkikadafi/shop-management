// Admin-only user management.
// Requires a valid JWT (verify_jwt = true) AND an active profile with role
// 'admin'. Uses the service role key internally, which never reaches the
// browser. Invoke from the app via supabase.functions.invoke("admin-users").
import { createClient } from "jsr:@supabase/supabase-js@2";

const ROLES = ["admin", "manager", "cashier"] as const;
type Role = (typeof ROLES)[number];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Server is misconfigured." }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return json({ error: "Missing authorization header." }, 401);
    }

    // Identify the caller from their JWT.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: callerData, error: callerError } =
      await callerClient.auth.getUser();

    if (callerError || !callerData.user) {
      return json({ error: "Unauthorized." }, 401);
    }

    // Service-role client bypasses RLS for privileged operations.
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", callerData.user.id)
      .maybeSingle();

    if (
      !callerProfile ||
      !callerProfile.is_active ||
      callerProfile.role !== "admin"
    ) {
      return json({ error: "Forbidden. Admin role required." }, 403);
    }

    const callerId = callerData.user.id;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    switch (action) {
      case "create": {
        const email = String(body.email ?? "").trim();
        const password = String(body.password ?? "");
        const fullName = body.full_name ? String(body.full_name).trim() : null;
        const role = body.role;

        if (!email || password.length < 6 || !isRole(role)) {
          return json(
            { error: "Email, a password of at least 6 characters, and a valid role are required." },
            400,
          );
        }

        const { data: created, error: createError } =
          await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
          });

        if (createError || !created.user) {
          return json(
            { error: createError?.message ?? "Could not create user." },
            400,
          );
        }

        const { error: profileError } = await adminClient
          .from("profiles")
          .update({ role, full_name: fullName })
          .eq("id", created.user.id);

        if (profileError) {
          return json({ error: profileError.message }, 400);
        }

        return json({
          user: {
            id: created.user.id,
            email,
            full_name: fullName,
            role,
            is_active: true,
          },
        });
      }

      case "update-role": {
        const userId = body.user_id;
        const role = body.role;
        if (!userId || !isRole(role)) {
          return json({ error: "A user id and valid role are required." }, 400);
        }
        if (userId === callerId) {
          return json({ error: "You cannot change your own role." }, 400);
        }

        const { error } = await adminClient
          .from("profiles")
          .update({ role })
          .eq("id", userId);
        if (error) {
          return json({ error: error.message }, 400);
        }
        return json({ ok: true });
      }

      case "set-active": {
        const userId = body.user_id;
        const isActive = body.is_active;
        if (!userId || typeof isActive !== "boolean") {
          return json({ error: "A user id and is_active flag are required." }, 400);
        }
        if (userId === callerId) {
          return json({ error: "You cannot change your own active status." }, 400);
        }

        const { error } = await adminClient
          .from("profiles")
          .update({ is_active: isActive })
          .eq("id", userId);
        if (error) {
          return json({ error: error.message }, 400);
        }

        // Ban/unban so the account cannot sign in while inactive.
        const { error: banError } = await adminClient.auth.admin.updateUserById(
          userId,
          { ban_duration: isActive ? "none" : "876000h" },
        );
        if (banError) {
          return json({ error: banError.message }, 400);
        }
        return json({ ok: true });
      }

      case "reset-password": {
        const userId = body.user_id;
        const password = String(body.password ?? "");
        if (!userId || password.length < 6) {
          return json(
            { error: "A user id and a password of at least 6 characters are required." },
            400,
          );
        }

        const { error } = await adminClient.auth.admin.updateUserById(userId, {
          password,
        });
        if (error) {
          return json({ error: error.message }, 400);
        }
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action: ${String(action)}` }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
});
