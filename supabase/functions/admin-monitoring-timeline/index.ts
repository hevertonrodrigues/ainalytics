import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * Admin Monitoring Timeline
 *
 * All aggregation done via views + JS — no custom DB functions.
 *
 * GET ?view=grouped&group_by=day&months=1&tenant_id= → time-bucketed aggregation
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
      const { data, error } = await db
        .from("tenants")
        .select("id, name")
        .not("name", "is", null)
        .order("name");

      if (error) throw error;
      return logger.done(withCors(req, ok(data || [])), authCtx);
    }

    // ─── GROUPED TIMELINE ────────────────────────────────────
    if (view === "grouped") {
      // Fetch raw answer data from the view
      let query = db
        .from("admin_timeline_answers")
        .select("platform_slug, error, latency_ms, tenant_id, searched_at")
        .gte("searched_at", sinceIso);

      if (tenantId) query = query.eq("tenant_id", tenantId);

      const { data, error } = await query;
      if (error) throw error;

      // Group by time bucket in JS
      const rows = data || [];

      // deno-lint-ignore no-explicit-any
      const bucketMap = new Map<string, any>();

      for (const row of rows) {
        const d = new Date(row.searched_at);
        let bucketKey: string;

        switch (groupBy) {
          case "hour":
            bucketKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}:00:00`;
            break;
          case "week": {
            // Truncate to Monday
            const day = d.getUTCDay();
            const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
            bucketKey = monday.toISOString().split("T")[0];
            break;
          }
          case "month":
            bucketKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
            break;
          default: // day
            bucketKey = d.toISOString().split("T")[0];
        }

        const existing = bucketMap.get(bucketKey);
        if (existing) {
          existing.total_answers++;
          if (row.error == null) existing.success_count++;
          else existing.error_count++;
          existing.latency_sum += row.latency_ms || 0;
          existing.tenants.add(row.tenant_id);
          existing.platforms[row.platform_slug] = (existing.platforms[row.platform_slug] || 0) + 1;
        } else {
          bucketMap.set(bucketKey, {
            period: bucketKey,
            total_answers: 1,
            success_count: row.error == null ? 1 : 0,
            error_count: row.error != null ? 1 : 0,
            latency_sum: row.latency_ms || 0,
            tenants: new Set([row.tenant_id]),
            platforms: { [row.platform_slug]: 1 },
          });
        }
      }

      const result = [...bucketMap.values()]
        .map(b => ({
          period: b.period,
          total_answers: b.total_answers,
          success_count: b.success_count,
          error_count: b.error_count,
          avg_latency_ms: b.total_answers > 0 ? Math.round(b.latency_sum / b.total_answers) : 0,
          tenant_count: b.tenants.size,
          platforms: b.platforms,
        }))
        .sort((a, b) => b.period.localeCompare(a.period));

      return logger.done(withCors(req, ok(result)), authCtx);
    }

    // ─── PAGINATED ANSWERS ───────────────────────────────────
    if (view === "answers") {
      const offset = (page - 1) * perPage;

      // Count total
      let countQuery = db
        .from("admin_timeline_answers")
        .select("*", { count: "exact", head: true })
        .gte("searched_at", sinceIso);

      if (tenantId) countQuery = countQuery.eq("tenant_id", tenantId);

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      // Fetch page
      let dataQuery = db
        .from("admin_timeline_answers")
        .select("*")
        .gte("searched_at", sinceIso)
        .order("searched_at", { ascending: false })
        .range(offset, offset + perPage - 1);

      if (tenantId) dataQuery = dataQuery.eq("tenant_id", tenantId);

      const { data, error } = await dataQuery;
      if (error) throw error;

      return logger.done(withCors(req, ok({
        items: data || [],
        total: count || 0,
        page,
        per_page: perPage,
        total_pages: Math.ceil((count || 0) / perPage),
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
