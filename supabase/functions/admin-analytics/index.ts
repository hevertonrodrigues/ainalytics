import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * admin-analytics — SA-only endpoint for user activity tracking analytics.
 *
 * GET /admin-analytics              → full dashboard data (funnel, engagement, dropoffs, stats, recentEvents)
 * GET /admin-analytics?user_id=UUID → timeline events for a specific user
 * GET /admin-analytics?days=30      → filter stats window (default 30)
 *
 * Stats are aggregated server-side via get_admin_analytics_stats(p_days) so the
 * total event count and distinct counts reflect every row in the window — not
 * just the first 1000 (PostgREST's max-rows cap on table reads).
 */

serve(async (req: Request) => {
  const logger = createRequestLogger("admin-analytics", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { user_id?: string } = {};

  try {
    const { user } = await verifySuperAdmin(req);
    authCtx = { user_id: user.id };

    if (req.method !== "GET") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);
    }

    const db = createAdminClient();
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    const days = parseInt(url.searchParams.get("days") || "30", 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDate = cutoff.toISOString().split("T")[0]; // YYYY-MM-DD for date comparisons

    // ──────────────────────────────────────────────
    // Per-user timeline
    // ──────────────────────────────────────────────
    if (userId) {
      const { data: timeline, error: timelineErr } = await db
        .from("admin_user_activity_timeline")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (timelineErr) throw timelineErr;
      return logger.done(withCors(req, ok(timeline || [])), authCtx);
    }

    // ──────────────────────────────────────────────
    // Dashboard: parallel queries
    // ──────────────────────────────────────────────
    const [funnelRes, engagementRes, dropoffsRes, statsRes, recentEventsRes] = await Promise.all([
      // 1. Onboarding funnel
      db.from("admin_onboarding_funnel")
        .select("*")
        .order("signup_at", { ascending: false }),

      // 2. Feature engagement (last N days)
      db.from("admin_feature_engagement")
        .select("*")
        .gte("log_date", cutoffDate)
        .order("event_count", { ascending: false })
        .limit(200),

      // 3. Onboarding dropoffs
      db.from("admin_onboarding_dropoffs")
        .select("*")
        .order("signup_at", { ascending: false })
        .limit(50),

      // 4. Aggregated stats — server-side via RPC (bypasses PostgREST 1000-row cap)
      db.rpc("get_admin_analytics_stats", { p_days: days }),

      // 5. Recent events with user info (last 50)
      db.from("admin_user_activity_timeline")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (funnelRes.error) throw funnelRes.error;
    if (engagementRes.error) throw engagementRes.error;
    if (dropoffsRes.error) throw dropoffsRes.error;
    if (statsRes.error) throw statsRes.error;
    if (recentEventsRes.error) throw recentEventsRes.error;

    return logger.done(withCors(req, ok({
      funnel: funnelRes.data || [],
      engagement: engagementRes.data || [],
      dropoffs: dropoffsRes.data || [],
      stats: statsRes.data ?? null,
      recentEvents: recentEventsRes.data || [],
    })), authCtx);

  // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[admin-analytics]", err);
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
