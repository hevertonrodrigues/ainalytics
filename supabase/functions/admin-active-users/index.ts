import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

serve(async (req: Request) => {
  const logger = createRequestLogger("admin-active-users", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { user_id?: string } = {};

  try {
    const { user } = await verifySuperAdmin(req);
    authCtx = { user_id: user.id };

    if (req.method !== "GET") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);
    }

    const db = createAdminClient();

    // Query the view directly instead of using a DB function
    const { data, error } = await db
      .from("admin_active_users")
      .select("*")
      .order("progress_percent", { ascending: false });

    if (error) throw error;

    return logger.done(withCors(req, ok(data || [])), authCtx);

  // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[admin-active-users]", err);
    if (err.status) {
      return logger.done(withCors(
        req,
        new Response(
          JSON.stringify({ success: false, error: { message: err.message, code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" } }),
          { status: err.status, headers: { "Content-Type": "application/json" } },
        ),
      ));
    }
    return logger.done(withCors(req, serverError(err.message || "Internal server error")));
  }
});
