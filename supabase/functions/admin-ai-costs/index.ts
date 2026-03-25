import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * Admin AI Costs Edge Function
 *
 * All aggregation views use SQL RPC functions to bypass the Supabase
 * client 1000-row limit. Data is aggregated server-side in Postgres.
 *
 * GET ?view=summary     → KPI cards (single JSONB object)
 * GET ?view=by_tenant   → per-tenant aggregation
 * GET ?view=by_model    → per-model aggregation
 * GET ?view=by_callsite → per-call-site aggregation
 * GET ?view=daily       → daily cost breakdown for chart
 * GET ?view=recent      → recent log entries (paginated, uses .range())
 */

serve(async (req: Request) => {
  const logger = createRequestLogger("admin-ai-costs", req);
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
    const view = url.searchParams.get("view") || "summary";
    const months = parseInt(url.searchParams.get("months") || "1", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const perPage = Math.min(parseInt(url.searchParams.get("per_page") || "50", 10), 100);

    const db = createAdminClient();

    // Date filter: last N months
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const sinceIso = since.toISOString();

    // ─── SUMMARY: KPI cards (SQL RPC) ────────────────────────
    if (view === "summary") {
      const { data, error } = await db.rpc("get_ai_costs_summary", { since_date: sinceIso });
      if (error) throw error;
      return logger.done(withCors(req, ok(data)), authCtx);
    }

    // ─── BY TENANT (SQL RPC) ─────────────────────────────────
    if (view === "by_tenant") {
      const { data, error } = await db.rpc("get_ai_costs_by_tenant", { since_date: sinceIso });
      if (error) throw error;
      return logger.done(withCors(req, ok(data)), authCtx);
    }

    // ─── BY MODEL (SQL RPC) ──────────────────────────────────
    if (view === "by_model") {
      const { data, error } = await db.rpc("get_ai_costs_by_model", { since_date: sinceIso });
      if (error) throw error;
      return logger.done(withCors(req, ok(data)), authCtx);
    }

    // ─── BY CALL SITE (SQL RPC) ──────────────────────────────
    if (view === "by_callsite") {
      const { data, error } = await db.rpc("get_ai_costs_by_callsite", { since_date: sinceIso });
      if (error) throw error;
      return logger.done(withCors(req, ok(data)), authCtx);
    }

    // ─── DAILY BREAKDOWN (SQL RPC) ───────────────────────────
    if (view === "daily") {
      const { data, error } = await db.rpc("get_ai_costs_daily", { since_date: sinceIso });
      if (error) throw error;
      return logger.done(withCors(req, ok(data)), authCtx);
    }

    // ─── RECENT LOGS (paginated via .range(), safe within 1000) ──
    if (view === "recent") {
      const offset = (page - 1) * perPage;
      const tenantFilter = url.searchParams.get("tenant_id");
      const callSiteFilter = url.searchParams.get("call_site");

      let query = db
        .from("ai_usage_log")
        .select("id, tenant_id, user_id, call_site, platform_slug, model_slug, tokens_input, tokens_output, cost_total_usd, latency_ms, error, web_search_enabled, created_at", { count: "exact" })
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .range(offset, offset + perPage - 1);

      if (tenantFilter) query = query.eq("tenant_id", tenantFilter);
      if (callSiteFilter) query = query.eq("call_site", callSiteFilter);

      const { data, error, count } = await query;
      if (error) throw error;

      // Enrich with tenant names
      const tenantIds = [...new Set((data || []).map(r => r.tenant_id).filter(Boolean))];
      const { data: tenants } = tenantIds.length > 0
        ? await db.from("tenants").select("id, name").in("id", tenantIds)
        : { data: [] };

      // deno-lint-ignore no-explicit-any
      const tenantMap = new Map((tenants || []).map((t: any) => [t.id, t.name]));

      const enriched = (data || []).map(r => ({
        ...r,
        tenant_name: tenantMap.get(r.tenant_id) || "Unknown",
      }));

      return logger.done(withCors(req, ok({
        items: enriched,
        total: count || 0,
        page,
        per_page: perPage,
        total_pages: Math.ceil((count || 0) / perPage),
      })), authCtx);
    }

    return logger.done(withCors(req, badRequest(`Unknown view: ${view}`)), authCtx);

  // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[admin-ai-costs]", err);
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
