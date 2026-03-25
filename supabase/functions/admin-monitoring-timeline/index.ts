import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * Admin Monitoring Timeline
 *
 * GET ?view=grouped&group_by=day&months=1&tenant_id=  → time-bucketed aggregation
 * GET ?view=answers&page=1&per_page=50&months=1&tenant_id= → paginated detail list
 * GET ?view=tenants → tenant list for filter dropdown
 */

serve(async (req: Request) => {
  const logger = createRequestLogger("admin-monitoring-timeline", req);
  if (req.method === "OPTIONS") return handleCors(req);

  // deno-lint-ignore no-explicit-any
  let authCtx: any = {};

  try {
    const { user } = await verifySuperAdmin(req);
    authCtx = { user_id: user.id };

    if (req.method !== "GET") {
      return logger.done(withCors(req, badRequest("Only GET allowed")), authCtx);
    }

    const url = new URL(req.url);
    const view = url.searchParams.get("view") || "grouped";
    const months = parseInt(url.searchParams.get("months") || "1", 10);
    const groupBy = url.searchParams.get("group_by") || "day";
    const tenantId = url.searchParams.get("tenant_id") || null;
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const perPage = Math.min(parseInt(url.searchParams.get("per_page") || "50", 10), 100);

    const db = createAdminClient();

    // Date filter
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const sinceIso = since.toISOString();

    // ─── TENANTS LIST (for dropdown) ─────────────────────────
    if (view === "tenants") {
      const { data, error } = await db.rpc("get_admin_tenants_list");
      if (error) throw error;
      return logger.done(withCors(req, ok(data)), authCtx);
    }

    // ─── GROUPED TIMELINE ────────────────────────────────────
    if (view === "grouped") {
      const { data, error } = await db.rpc("get_admin_timeline_grouped", {
        since_date: sinceIso,
        group_by: groupBy,
        tenant_filter: tenantId,
      });
      if (error) throw error;
      return logger.done(withCors(req, ok(data)), authCtx);
    }

    // ─── PAGINATED ANSWERS ───────────────────────────────────
    if (view === "answers") {
      const offset = (page - 1) * perPage;
      const { data, error } = await db.rpc("get_admin_timeline_answers", {
        since_date: sinceIso,
        tenant_filter: tenantId,
        p_limit: perPage,
        p_offset: offset,
      });
      if (error) throw error;

      const result = data as { items: unknown[]; total: number; limit: number; offset: number };
      return logger.done(withCors(req, ok({
        items: result.items,
        total: result.total,
        page,
        per_page: perPage,
        total_pages: Math.ceil(result.total / perPage),
      })), authCtx);
    }

    return logger.done(withCors(req, badRequest(`Unknown view: ${view}`)), authCtx);

  // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[admin-monitoring-timeline]", err);
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
