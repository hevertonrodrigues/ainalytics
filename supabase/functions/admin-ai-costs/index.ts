import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * Admin AI Costs Edge Function
 *
 * All aggregation is done via lightweight views + JS aggregation.
 * No custom DB functions are used.
 *
 * GET ?view=summary     → KPI cards
 * GET ?view=by_tenant   → per-tenant aggregation
 * GET ?view=by_model    → per-model aggregation
 * GET ?view=by_callsite → per-call-site aggregation
 * GET ?view=daily       → daily cost breakdown for chart
 * GET ?view=recent      → recent log entries (paginated)
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
    const sinceDate = sinceIso.split("T")[0]; // YYYY-MM-DD for date comparisons

    // ─── SUMMARY: KPI cards ─────────────────────────────────
    if (view === "summary") {
      const { data, error } = await db
        .from("ai_usage_log")
        .select("tokens_input, tokens_output, cost_total_usd, cost_input_usd, cost_output_usd, latency_ms, error, tenant_id, model_slug")
        .gte("created_at", sinceIso);

      if (error) throw error;

      const rows = data || [];
      const totalRequests = rows.length;
      const tenants = new Set(rows.map(r => r.tenant_id).filter(Boolean));
      const models = new Set(rows.map(r => r.model_slug).filter(Boolean));
      const totalTokensInput = rows.reduce((s, r) => s + (r.tokens_input || 0), 0);
      const totalTokensOutput = rows.reduce((s, r) => s + (r.tokens_output || 0), 0);
      const totalCost = rows.reduce((s, r) => s + (r.cost_total_usd || 0), 0);
      const costInput = rows.reduce((s, r) => s + (r.cost_input_usd || 0), 0);
      const costOutput = rows.reduce((s, r) => s + (r.cost_output_usd || 0), 0);
      const avgLatency = totalRequests > 0
        ? Math.round(rows.reduce((s, r) => s + (r.latency_ms || 0), 0) / totalRequests)
        : 0;
      const errorCount = rows.filter(r => r.error != null).length;

      const summary = {
        total_requests: totalRequests,
        total_tenants: tenants.size,
        total_models_used: models.size,
        total_tokens_input: totalTokensInput,
        total_tokens_output: totalTokensOutput,
        total_tokens: totalTokensInput + totalTokensOutput,
        total_cost_usd: Math.round(totalCost * 1e6) / 1e6,
        cost_input_usd: Math.round(costInput * 1e6) / 1e6,
        cost_output_usd: Math.round(costOutput * 1e6) / 1e6,
        avg_latency_ms: avgLatency,
        error_count: errorCount,
        error_rate: totalRequests > 0
          ? Math.round((errorCount / totalRequests) * 100 * 100) / 100
          : 0,
        avg_cost_per_request: totalRequests > 0
          ? Math.round((totalCost / totalRequests) * 1e6) / 1e6
          : 0,
      };

      return logger.done(withCors(req, ok(summary)), authCtx);
    }

    // ─── BY TENANT ──────────────────────────────────────────
    if (view === "by_tenant") {
      const { data, error } = await db
        .from("admin_ai_costs_by_tenant")
        .select("*")
        .gte("log_date", sinceDate);

      if (error) throw error;

      // Aggregate across dates in JS (view is pre-grouped by tenant+date)
      // deno-lint-ignore no-explicit-any
      const tenantMap = new Map<string, any>();
      for (const row of (data || [])) {
        const key = row.tenant_id || "null";
        const existing = tenantMap.get(key);
        if (existing) {
          existing.total_requests += row.total_requests;
          existing.total_tokens_input += Number(row.total_tokens_input);
          existing.total_tokens_output += Number(row.total_tokens_output);
          existing.total_cost_usd += Number(row.total_cost_usd);
          if (row.first_request < existing.first_request) existing.first_request = row.first_request;
          if (row.last_request > existing.last_request) existing.last_request = row.last_request;
        } else {
          tenantMap.set(key, {
            tenant_id: row.tenant_id,
            tenant_name: row.tenant_name || "Unknown",
            total_requests: row.total_requests,
            total_tokens_input: Number(row.total_tokens_input),
            total_tokens_output: Number(row.total_tokens_output),
            total_cost_usd: Number(row.total_cost_usd),
            first_request: row.first_request,
            last_request: row.last_request,
          });
        }
      }

      const result = [...tenantMap.values()]
        .map(r => ({ ...r, total_cost_usd: Math.round(r.total_cost_usd * 1e6) / 1e6 }))
        .sort((a, b) => b.total_cost_usd - a.total_cost_usd);

      return logger.done(withCors(req, ok(result)), authCtx);
    }

    // ─── BY MODEL ───────────────────────────────────────────
    if (view === "by_model") {
      const { data, error } = await db
        .from("admin_ai_costs_by_model")
        .select("*")
        .gte("log_date", sinceDate);

      if (error) throw error;

      // Aggregate across dates in JS
      // deno-lint-ignore no-explicit-any
      const modelMap = new Map<string, any>();
      for (const row of (data || [])) {
        const key = `${row.platform_slug}:${row.model_slug}`;
        const existing = modelMap.get(key);
        if (existing) {
          existing.total_requests += row.total_requests;
          existing.total_tokens_input += Number(row.total_tokens_input);
          existing.total_tokens_output += Number(row.total_tokens_output);
          existing.total_cost_usd += Number(row.total_cost_usd);
          existing.cost_input_usd += Number(row.cost_input_usd);
          existing.cost_output_usd += Number(row.cost_output_usd);
          existing.latency_sum += row.avg_latency_ms * row.total_requests;
        } else {
          modelMap.set(key, {
            platform_slug: row.platform_slug,
            model_slug: row.model_slug,
            total_requests: row.total_requests,
            total_tokens_input: Number(row.total_tokens_input),
            total_tokens_output: Number(row.total_tokens_output),
            total_cost_usd: Number(row.total_cost_usd),
            cost_input_usd: Number(row.cost_input_usd),
            cost_output_usd: Number(row.cost_output_usd),
            latency_sum: row.avg_latency_ms * row.total_requests,
          });
        }
      }

      const result = [...modelMap.values()]
        .map(r => ({
          ...r,
          total_cost_usd: Math.round(r.total_cost_usd * 1e6) / 1e6,
          cost_input_usd: Math.round(r.cost_input_usd * 1e6) / 1e6,
          cost_output_usd: Math.round(r.cost_output_usd * 1e6) / 1e6,
          avg_latency_ms: r.total_requests > 0 ? Math.round(r.latency_sum / r.total_requests) : 0,
          latency_sum: undefined,
        }))
        .sort((a, b) => b.total_cost_usd - a.total_cost_usd);

      return logger.done(withCors(req, ok(result)), authCtx);
    }

    // ─── BY CALL SITE ───────────────────────────────────────
    if (view === "by_callsite") {
      const { data, error } = await db
        .from("admin_ai_costs_by_callsite")
        .select("*")
        .gte("log_date", sinceDate);

      if (error) throw error;

      // Aggregate across dates in JS
      // deno-lint-ignore no-explicit-any
      const siteMap = new Map<string, any>();
      for (const row of (data || [])) {
        const key = row.call_site || "unknown";
        const existing = siteMap.get(key);
        if (existing) {
          existing.total_requests += row.total_requests;
          existing.total_errors += row.total_errors;
          existing.total_tokens_input += Number(row.total_tokens_input);
          existing.total_tokens_output += Number(row.total_tokens_output);
          existing.total_cost_usd += Number(row.total_cost_usd);
          existing.latency_sum += row.avg_latency_ms * row.total_requests;
        } else {
          siteMap.set(key, {
            call_site: row.call_site,
            total_requests: row.total_requests,
            total_errors: row.total_errors,
            total_tokens_input: Number(row.total_tokens_input),
            total_tokens_output: Number(row.total_tokens_output),
            total_cost_usd: Number(row.total_cost_usd),
            latency_sum: row.avg_latency_ms * row.total_requests,
          });
        }
      }

      const result = [...siteMap.values()]
        .map(r => ({
          ...r,
          total_cost_usd: Math.round(r.total_cost_usd * 1e6) / 1e6,
          error_rate: r.total_requests > 0
            ? Math.round((r.total_errors / r.total_requests) * 100 * 100) / 100
            : 0,
          avg_latency_ms: r.total_requests > 0 ? Math.round(r.latency_sum / r.total_requests) : 0,
          latency_sum: undefined,
        }))
        .sort((a, b) => b.total_cost_usd - a.total_cost_usd);

      return logger.done(withCors(req, ok(result)), authCtx);
    }

    // ─── DAILY BREAKDOWN ────────────────────────────────────
    if (view === "daily") {
      const { data, error } = await db
        .from("admin_ai_costs_by_model")
        .select("platform_slug, total_requests, total_cost_usd, total_tokens_input, total_tokens_output, log_date")
        .gte("log_date", sinceDate);

      if (error) throw error;

      // Group by date, then by platform within each date
      // deno-lint-ignore no-explicit-any
      const dayMap = new Map<string, any>();
      for (const row of (data || [])) {
        const dateKey = String(row.log_date);
        const existing = dayMap.get(dateKey);
        if (existing) {
          existing.total_requests += row.total_requests;
          existing.total_cost_usd += Number(row.total_cost_usd);
          existing.total_tokens += Number(row.total_tokens_input) + Number(row.total_tokens_output);
          existing.by_platform[row.platform_slug] =
            (existing.by_platform[row.platform_slug] || 0) + Number(row.total_cost_usd);
        } else {
          dayMap.set(dateKey, {
            date: dateKey,
            total_requests: row.total_requests,
            total_cost_usd: Number(row.total_cost_usd),
            total_tokens: Number(row.total_tokens_input) + Number(row.total_tokens_output),
            by_platform: { [row.platform_slug]: Number(row.total_cost_usd) },
          });
        }
      }

      const result = [...dayMap.values()]
        .map(r => ({
          ...r,
          total_cost_usd: Math.round(r.total_cost_usd * 1e6) / 1e6,
          by_platform: Object.fromEntries(
            Object.entries(r.by_platform).map(([k, v]) => [k, Math.round((v as number) * 1e6) / 1e6]),
          ),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return logger.done(withCors(req, ok(result)), authCtx);
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
