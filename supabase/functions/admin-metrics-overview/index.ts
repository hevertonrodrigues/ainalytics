import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * Admin Metrics Overview Edge Function
 *
 * Serves all computed business metrics from the metrics pipeline views.
 *
 * GET  ?view=funnel          → Funnel / conversion metrics
 * GET  ?view=revenue         → MRR, ARR, ARPU (paid-only)
 * GET  ?view=churn           → Trial churn vs paid churn
 * GET  ?view=pipeline        → Full user classification pipeline
 * GET  ?view=meta_cross      → Meta Ads ↔ subscription cross-metrics
 * GET  ?view=dashboard_access → Dashboard engagement metrics
 * POST ?action=log_access    → Log a dashboard page view
 */

serve(async (req: Request) => {
  const logger = createRequestLogger("admin-metrics-overview", req);
  if (req.method === "OPTIONS") return handleCors(req);

  // deno-lint-ignore no-explicit-any
  let authCtx: any = {};

  try {
    const { user } = await verifySuperAdmin(req);
    authCtx = { user_id: user.id };

    const url = new URL(req.url);
    const db = createAdminClient();

    // ═══════════════════════════════════════════════════════════
    // POST routes
    // ═══════════════════════════════════════════════════════════
    if (req.method === "POST") {
      const action = url.searchParams.get("action");

      // ─── LOG DASHBOARD ACCESS ──────────────────────────────
      if (action === "log_access") {
        const body = await req.json();
        const { tenant_id, user_id, page, referrer, device_type } = body;

        if (!tenant_id || !user_id || !page) {
          return logger.done(
            withCors(req, badRequest("tenant_id, user_id, and page are required")),
            authCtx,
          );
        }

        const { error } = await db
          .from("admin_dashboard_access_log")
          .insert({
            tenant_id,
            user_id,
            page,
            referrer: referrer || null,
            device_type: device_type || "unknown",
          });

        if (error) throw error;
        return logger.done(withCors(req, ok({ logged: true })), authCtx);
      }

      return logger.done(
        withCors(req, badRequest(`Unknown action: ${action}`)),
        authCtx,
      );
    }

    // ═══════════════════════════════════════════════════════════
    // GET routes
    // ═══════════════════════════════════════════════════════════
    if (req.method !== "GET") {
      return logger.done(
        withCors(req, badRequest(`Method ${req.method} not allowed`)),
        authCtx,
      );
    }

    const view = url.searchParams.get("view") || "funnel";

    // ─── FUNNEL / CONVERSION METRICS ─────────────────────────
    if (view === "funnel") {
      const { data, error } = await db
        .from("admin_conversion_metrics")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return logger.done(withCors(req, ok(data || {})), authCtx);
    }

    // ─── REVENUE METRICS ─────────────────────────────────────
    if (view === "revenue") {
      const { data, error } = await db
        .from("admin_revenue_metrics")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      // Also fetch plan distribution separately for better formatting
      const { data: paidSubs } = await db
        .from("subscriptions")
        .select("plan_id, billing_interval, paid_amount, plans!inner(name, price)")
        .eq("status", "active");

      // deno-lint-ignore no-explicit-any
      const planDist = new Map<string, { name: string; count: number; mrr: number }>();
      for (const sub of paidSubs || []) {
        // deno-lint-ignore no-explicit-any
        const plan = sub.plans as any;
        if (!plan || Number(plan.price) <= 0) continue;
        const key = plan.name;
        if (!planDist.has(key)) {
          planDist.set(key, { name: key, count: 0, mrr: 0 });
        }
        const d = planDist.get(key)!;
        d.count++;
        d.mrr += sub.billing_interval === "yearly"
          ? Number(sub.paid_amount || 0) / 12
          : Number(sub.paid_amount || 0);
      }

      return logger.done(
        withCors(req, ok({
          ...data,
          plan_breakdown: Array.from(planDist.values())
            .sort((a, b) => b.mrr - a.mrr),
        })),
        authCtx,
      );
    }

    // ─── CHURN METRICS ───────────────────────────────────────
    if (view === "churn") {
      const { data, error } = await db
        .from("admin_churn_metrics")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      // Fetch recent churned users for detail
      const { data: recentChurned } = await db
        .from("subscriptions")
        .select("tenant_id, status, canceled_at, created_at, plans!inner(name, price)")
        .eq("status", "canceled")
        .order("canceled_at", { ascending: false })
        .limit(20);

      // deno-lint-ignore no-explicit-any
      const recentList = (recentChurned || []).map((s: any) => ({
        tenant_id: s.tenant_id,
        plan_name: s.plans?.name,
        plan_price: s.plans?.price,
        canceled_at: s.canceled_at,
        subscription_created_at: s.created_at,
        churn_type: Number(s.plans?.price || 0) > 0 ? "paid" : "trial",
      }));

      return logger.done(
        withCors(req, ok({ ...data, recent_churned: recentList })),
        authCtx,
      );
    }

    // ─── PIPELINE ────────────────────────────────────────────
    if (view === "pipeline") {
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const perPage = Math.min(parseInt(url.searchParams.get("per_page") || "50", 10), 200);
      const classification = url.searchParams.get("classification"); // paid, trial, free, churned_paid, churned_trial, registered
      const stage = url.searchParams.get("stage");

      let query = db
        .from("admin_subscription_pipeline")
        .select("*", { count: "exact" });

      if (classification) {
        query = query.eq("user_classification", classification);
      }
      if (stage) {
        query = query.eq("pipeline_stage", stage);
      }

      const { data, error, count } = await query
        .order("registered_at", { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1);

      if (error) throw error;

      return logger.done(
        withCors(req, ok({
          items: data || [],
          meta: { page, per_page: perPage, total_count: count || 0 },
        })),
        authCtx,
      );
    }

    // ─── META ADS CROSS METRICS ──────────────────────────────
    if (view === "meta_cross") {
      const { data, error } = await db
        .from("admin_meta_ads_cross_metrics")
        .select("*")
        .order("total_spend", { ascending: false });

      if (error) throw error;

      // Compute totals
      // deno-lint-ignore no-explicit-any
      const totals = (data || []).reduce((acc: any, row: any) => {
        acc.total_spend += Number(row.total_spend || 0);
        acc.total_leads += Number(row.platform_leads || 0);
        acc.total_paid += Number(row.paid_conversions || 0);
        acc.total_trials += Number(row.trial_conversions || 0);
        acc.total_churned += Number(row.churned_leads || 0);
        acc.total_page_views += Number(row.total_page_views || 0);
        return acc;
      }, { total_spend: 0, total_leads: 0, total_paid: 0, total_trials: 0, total_churned: 0, total_page_views: 0 });

      totals.overall_cpl = totals.total_leads > 0
        ? Number((totals.total_spend / totals.total_leads).toFixed(2)) : 0;
      totals.overall_cpa = totals.total_paid > 0
        ? Number((totals.total_spend / totals.total_paid).toFixed(2)) : 0;
      totals.lead_to_paid_pct = totals.total_leads > 0
        ? Number((totals.total_paid / totals.total_leads * 100).toFixed(2)) : 0;

      return logger.done(
        withCors(req, ok({ campaigns: data || [], totals })),
        authCtx,
      );
    }

    // ─── DASHBOARD ACCESS METRICS ────────────────────────────
    if (view === "dashboard_access") {
      const { data, error } = await db
        .from("admin_dashboard_access_metrics")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      // Also fetch top pages
      const { data: pageBreakdown } = await db
        .from("admin_dashboard_access_log")
        .select("page")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // deno-lint-ignore no-explicit-any
      const pageCounts = new Map<string, number>();
      for (const row of pageBreakdown || []) {
        // deno-lint-ignore no-explicit-any
        const p = (row as any).page;
        pageCounts.set(p, (pageCounts.get(p) || 0) + 1);
      }
      const topPages = Array.from(pageCounts.entries())
        .map(([page, count]) => ({ page, views: count }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 20);

      return logger.done(
        withCors(req, ok({ ...data, top_pages_30d: topPages })),
        authCtx,
      );
    }

    return logger.done(
      withCors(req, badRequest(`Unknown view: ${view}. Valid: funnel, revenue, churn, pipeline, meta_cross, dashboard_access`)),
      authCtx,
    );

  // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[admin-metrics-overview]", err);
    if (err.status) {
      return logger.done(withCors(
        req,
        new Response(
          JSON.stringify({
            success: false,
            error: {
              message: err.message,
              code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
            },
          }),
          {
            status: err.status,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ));
    }
    return logger.done(withCors(req, serverError(err.message || "Internal server error")));
  }
});
