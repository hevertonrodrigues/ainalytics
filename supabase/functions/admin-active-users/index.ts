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

    // Use SQL RPC to aggregate all stats in a single query
    // This avoids the PostgREST 1000-row limit on large tables
    const { data, error } = await db.rpc("get_admin_active_users");

    if (error) throw error;

    const users = (data || []) as Record<string, unknown>[];

    // Enrich with plan_end_date from subscriptions (current_period_end)
    if (users.length > 0) {
      const tenantIds = [...new Set(users.map((u) => u.tenant_id as string))];
      const { data: subs } = await db
        .from("subscriptions")
        .select("tenant_id, current_period_end")
        .in("tenant_id", tenantIds)
        .in("status", ["active", "trialing"]);

      const endDateMap = new Map<string, string>();
      if (subs) {
        for (const s of subs) {
          endDateMap.set(s.tenant_id, s.current_period_end);
        }
      }

      for (const user of users) {
        user.plan_end_date = endDateMap.get(user.tenant_id as string) ?? null;
      }
    }

    return logger.done(withCors(req, ok(users)), authCtx);

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
