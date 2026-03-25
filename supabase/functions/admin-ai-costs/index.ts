import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * Admin AI Costs Edge Function
 *
 * GET ?view=summary     → KPI cards + monthly totals
 * GET ?view=by_tenant   → per-tenant aggregation
 * GET ?view=by_model    → per-model aggregation
 * GET ?view=by_callsite → per-call-site aggregation
 * GET ?view=recent      → recent log entries (paginated)
 * GET ?view=daily       → daily cost breakdown for chart
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

    // ─── SUMMARY: KPI cards ──────────────────────────────────
    if (view === "summary") {
      const { data, error } = await db.rpc("get_ai_costs_summary", { since_date: sinceIso });
      if (error) {
        // Fallback: manual query if RPC doesn't exist
        console.warn("[admin-ai-costs] RPC fallback:", error.message);
        const result = await manualSummary(db, sinceIso);
        return logger.done(withCors(req, ok(result)), authCtx);
      }
      return logger.done(withCors(req, ok(data)), authCtx);
    }

    // ─── BY TENANT ───────────────────────────────────────────
    if (view === "by_tenant") {
      const { data, error } = await db
        .from("ai_usage_log")
        .select("tenant_id, call_site, model_slug, platform_slug, tokens_input, tokens_output, cost_total_usd, created_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Aggregate by tenant
      // deno-lint-ignore no-explicit-any
      const byTenant = new Map<string, any>();
      for (const row of data || []) {
        const tid = row.tenant_id;
        if (!byTenant.has(tid)) {
          byTenant.set(tid, {
            tenant_id: tid,
            total_requests: 0,
            total_tokens_input: 0,
            total_tokens_output: 0,
            total_cost_usd: 0,
            models_used: new Set<string>(),
            call_sites: new Set<string>(),
            first_request: row.created_at,
            last_request: row.created_at,
          });
        }
        const t = byTenant.get(tid)!;
        t.total_requests++;
        t.total_tokens_input += row.tokens_input || 0;
        t.total_tokens_output += row.tokens_output || 0;
        t.total_cost_usd += parseFloat(row.cost_total_usd) || 0;
        t.models_used.add(row.model_slug);
        t.call_sites.add(row.call_site);
        if (row.created_at < t.first_request) t.first_request = row.created_at;
        if (row.created_at > t.last_request) t.last_request = row.created_at;
      }

      // Enrich with tenant names
      const tenantIds = [...byTenant.keys()];
      const { data: tenants } = tenantIds.length > 0
        ? await db.from("tenants").select("id, name").in("id", tenantIds)
        : { data: [] };

      // deno-lint-ignore no-explicit-any
      const tenantMap = new Map((tenants || []).map((t: any) => [t.id, t.name]));

      const result = [...byTenant.values()]
        .map(t => ({
          ...t,
          tenant_name: tenantMap.get(t.tenant_id) || "Unknown",
          models_used: [...t.models_used],
          call_sites: [...t.call_sites],
          total_cost_usd: Math.round(t.total_cost_usd * 1_000_000) / 1_000_000,
        }))
        .sort((a, b) => b.total_cost_usd - a.total_cost_usd);

      return logger.done(withCors(req, ok(result)), authCtx);
    }

    // ─── BY MODEL ────────────────────────────────────────────
    if (view === "by_model") {
      const { data, error } = await db
        .from("ai_usage_log")
        .select("platform_slug, model_slug, tokens_input, tokens_output, cost_total_usd, cost_input_usd, cost_output_usd, latency_ms")
        .gte("created_at", sinceIso);
      if (error) throw error;

      // deno-lint-ignore no-explicit-any
      const byModel = new Map<string, any>();
      for (const row of data || []) {
        const key = `${row.platform_slug}:${row.model_slug}`;
        if (!byModel.has(key)) {
          byModel.set(key, {
            platform_slug: row.platform_slug,
            model_slug: row.model_slug,
            total_requests: 0,
            total_tokens_input: 0,
            total_tokens_output: 0,
            total_cost_usd: 0,
            cost_input_usd: 0,
            cost_output_usd: 0,
            total_latency_ms: 0,
            latency_count: 0,
          });
        }
        const m = byModel.get(key)!;
        m.total_requests++;
        m.total_tokens_input += row.tokens_input || 0;
        m.total_tokens_output += row.tokens_output || 0;
        m.total_cost_usd += parseFloat(row.cost_total_usd) || 0;
        m.cost_input_usd += parseFloat(row.cost_input_usd) || 0;
        m.cost_output_usd += parseFloat(row.cost_output_usd) || 0;
        if (row.latency_ms) {
          m.total_latency_ms += row.latency_ms;
          m.latency_count++;
        }
      }

      const result = [...byModel.values()]
        .map(m => ({
          ...m,
          avg_latency_ms: m.latency_count > 0 ? Math.round(m.total_latency_ms / m.latency_count) : null,
          total_cost_usd: Math.round(m.total_cost_usd * 1_000_000) / 1_000_000,
          cost_input_usd: Math.round(m.cost_input_usd * 1_000_000) / 1_000_000,
          cost_output_usd: Math.round(m.cost_output_usd * 1_000_000) / 1_000_000,
        }))
        .sort((a, b) => b.total_cost_usd - a.total_cost_usd);

      return logger.done(withCors(req, ok(result)), authCtx);
    }

    // ─── BY CALL SITE ────────────────────────────────────────
    if (view === "by_callsite") {
      const { data, error } = await db
        .from("ai_usage_log")
        .select("call_site, platform_slug, model_slug, tokens_input, tokens_output, cost_total_usd, latency_ms, error")
        .gte("created_at", sinceIso);
      if (error) throw error;

      // deno-lint-ignore no-explicit-any
      const bySite = new Map<string, any>();
      for (const row of data || []) {
        const key = row.call_site;
        if (!bySite.has(key)) {
          bySite.set(key, {
            call_site: key,
            total_requests: 0,
            total_errors: 0,
            total_tokens_input: 0,
            total_tokens_output: 0,
            total_cost_usd: 0,
            total_latency_ms: 0,
            latency_count: 0,
            models_used: new Set<string>(),
          });
        }
        const s = bySite.get(key)!;
        s.total_requests++;
        if (row.error) s.total_errors++;
        s.total_tokens_input += row.tokens_input || 0;
        s.total_tokens_output += row.tokens_output || 0;
        s.total_cost_usd += parseFloat(row.cost_total_usd) || 0;
        if (row.latency_ms) {
          s.total_latency_ms += row.latency_ms;
          s.latency_count++;
        }
        s.models_used.add(row.model_slug);
      }

      const result = [...bySite.values()]
        .map(s => ({
          ...s,
          models_used: [...s.models_used],
          error_rate: s.total_requests > 0 ? Math.round((s.total_errors / s.total_requests) * 10000) / 100 : 0,
          avg_latency_ms: s.latency_count > 0 ? Math.round(s.total_latency_ms / s.latency_count) : null,
          total_cost_usd: Math.round(s.total_cost_usd * 1_000_000) / 1_000_000,
        }))
        .sort((a, b) => b.total_cost_usd - a.total_cost_usd);

      return logger.done(withCors(req, ok(result)), authCtx);
    }

    // ─── DAILY BREAKDOWN ─────────────────────────────────────
    if (view === "daily") {
      const { data, error } = await db
        .from("ai_usage_log")
        .select("created_at, cost_total_usd, tokens_input, tokens_output, platform_slug")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // deno-lint-ignore no-explicit-any
      const byDay = new Map<string, any>();
      for (const row of data || []) {
        const day = row.created_at.substring(0, 10); // YYYY-MM-DD
        if (!byDay.has(day)) {
          byDay.set(day, { date: day, total_requests: 0, total_cost_usd: 0, total_tokens: 0, by_platform: {} as Record<string, number> });
        }
        const d = byDay.get(day)!;
        d.total_requests++;
        d.total_cost_usd += parseFloat(row.cost_total_usd) || 0;
        d.total_tokens += (row.tokens_input || 0) + (row.tokens_output || 0);
        d.by_platform[row.platform_slug] = (d.by_platform[row.platform_slug] || 0) + (parseFloat(row.cost_total_usd) || 0);
      }

      const result = [...byDay.values()].map(d => ({
        ...d,
        total_cost_usd: Math.round(d.total_cost_usd * 1_000_000) / 1_000_000,
        by_platform: Object.fromEntries(
          Object.entries(d.by_platform).map(([k, v]) => [k, Math.round((v as number) * 1_000_000) / 1_000_000])
        ),
      }));

      return logger.done(withCors(req, ok(result)), authCtx);
    }

    // ─── RECENT LOGS ─────────────────────────────────────────
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

// ─── Manual summary fallback ─────────────────────────────────
// deno-lint-ignore no-explicit-any
async function manualSummary(db: any, sinceIso: string) {
  const { data, error } = await db
    .from("ai_usage_log")
    .select("tenant_id, call_site, platform_slug, model_slug, tokens_input, tokens_output, cost_total_usd, cost_input_usd, cost_output_usd, latency_ms, error, created_at")
    .gte("created_at", sinceIso);
  if (error) throw error;

  const rows = data || [];
  const uniqueTenants = new Set(rows.map((r: Record<string, unknown>) => r.tenant_id));
  const uniqueModels = new Set(rows.map((r: Record<string, unknown>) => r.model_slug));

  let totalInput = 0, totalOutput = 0, totalCost = 0, totalCostInput = 0, totalCostOutput = 0;
  let totalLatency = 0, latencyCount = 0, errorCount = 0;

  for (const r of rows) {
    totalInput += r.tokens_input || 0;
    totalOutput += r.tokens_output || 0;
    totalCost += parseFloat(r.cost_total_usd) || 0;
    totalCostInput += parseFloat(r.cost_input_usd) || 0;
    totalCostOutput += parseFloat(r.cost_output_usd) || 0;
    if (r.latency_ms) { totalLatency += r.latency_ms; latencyCount++; }
    if (r.error) errorCount++;
  }

  return {
    total_requests: rows.length,
    total_tenants: uniqueTenants.size,
    total_models_used: uniqueModels.size,
    total_tokens_input: totalInput,
    total_tokens_output: totalOutput,
    total_tokens: totalInput + totalOutput,
    total_cost_usd: Math.round(totalCost * 1_000_000) / 1_000_000,
    cost_input_usd: Math.round(totalCostInput * 1_000_000) / 1_000_000,
    cost_output_usd: Math.round(totalCostOutput * 1_000_000) / 1_000_000,
    avg_latency_ms: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null,
    error_count: errorCount,
    error_rate: rows.length > 0 ? Math.round((errorCount / rows.length) * 10000) / 100 : 0,
    avg_cost_per_request: rows.length > 0 ? Math.round((totalCost / rows.length) * 1_000_000) / 1_000_000 : 0,
  };
}
