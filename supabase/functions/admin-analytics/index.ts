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
 */

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

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
    const [funnelRes, engagementRes, dropoffsRes, rawEventsRes, recentEventsRes] = await Promise.all([
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

      // 4. Raw events for stats computation (last N days)
      db.from("user_activity_log")
        .select("event_type, event_action, event_target, user_id, tenant_id, session_id, created_at")
        .gte("created_at", cutoff.toISOString())
        .order("created_at", { ascending: false })
        .limit(5000),

      // 5. Recent events with user info (last 50)
      db.from("admin_user_activity_timeline")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (funnelRes.error) throw funnelRes.error;
    if (engagementRes.error) throw engagementRes.error;
    if (dropoffsRes.error) throw dropoffsRes.error;
    if (rawEventsRes.error) throw rawEventsRes.error;
    if (recentEventsRes.error) throw recentEventsRes.error;

    // ──────────────────────────────────────────────
    // Compute stats in-memory from raw events
    // ──────────────────────────────────────────────
    const rawEvents: Row[] = rawEventsRes.data || [];
    const stats = computeStats(rawEvents, days);

    return logger.done(withCors(req, ok({
      funnel: funnelRes.data || [],
      engagement: engagementRes.data || [],
      dropoffs: dropoffsRes.data || [],
      stats,
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

/* ──────────────────────────────────────────────────────────────
   In-memory stats aggregation
   ────────────────────────────────────────────────────────────── */

function computeStats(events: Row[], _days: number) {
  const uniqueUsers = new Set<string>();
  const uniqueSessions = new Set<string>();
  const uniqueTenants = new Set<string>();
  let anonymousEvents = 0;
  let authenticatedEvents = 0;

  const todayStr = new Date().toISOString().split("T")[0];
  let eventsToday = 0;
  const usersToday = new Set<string>();
  const sessionsToday = new Set<string>();

  // For daily breakdown
  const dailyMap = new Map<string, { events: number; users: Set<string>; sessions: Set<string> }>();

  // For top events
  const eventTypeMap = new Map<string, number>();

  // For top pages
  const pageMap = new Map<string, number>();

  for (const ev of events) {
    // Global counts
    if (ev.user_id) {
      uniqueUsers.add(ev.user_id);
      authenticatedEvents++;
    } else {
      anonymousEvents++;
    }
    if (ev.session_id) uniqueSessions.add(ev.session_id);
    if (ev.tenant_id) uniqueTenants.add(ev.tenant_id);

    // Today
    const evDate = (ev.created_at as string).split("T")[0];
    if (evDate === todayStr) {
      eventsToday++;
      if (ev.user_id) usersToday.add(ev.user_id);
      if (ev.session_id) sessionsToday.add(ev.session_id);
    }

    // Daily breakdown
    if (!dailyMap.has(evDate)) {
      dailyMap.set(evDate, { events: 0, users: new Set(), sessions: new Set() });
    }
    const day = dailyMap.get(evDate)!;
    day.events++;
    if (ev.user_id) day.users.add(ev.user_id);
    if (ev.session_id) day.sessions.add(ev.session_id);

    // Top events
    const evKey = `${ev.event_type}||${ev.event_action}`;
    eventTypeMap.set(evKey, (eventTypeMap.get(evKey) || 0) + 1);

    // Top pages
    if (ev.event_type === "page_view" && ev.event_action === "entered" && ev.event_target) {
      pageMap.set(ev.event_target, (pageMap.get(ev.event_target) || 0) + 1);
    }
  }

  // Build sorted arrays
  const daily = Array.from(dailyMap.entries())
    .map(([date, d]) => ({
      log_date: date,
      events: d.events,
      users: d.users.size,
      sessions: d.sessions.size,
    }))
    .sort((a, b) => a.log_date.localeCompare(b.log_date));

  const topEvents = Array.from(eventTypeMap.entries())
    .map(([key, cnt]) => {
      const [event_type, event_action] = key.split("||");
      return { event_type, event_action, cnt };
    })
    .sort((a, b) => b.cnt - a.cnt)
    .slice(0, 15);

  const topPages = Array.from(pageMap.entries())
    .map(([page, views]) => ({ page, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return {
    total_events: events.length,
    unique_users: uniqueUsers.size,
    unique_sessions: uniqueSessions.size,
    unique_tenants: uniqueTenants.size,
    anonymous_events: anonymousEvents,
    authenticated_events: authenticatedEvents,
    events_today: eventsToday,
    users_today: usersToday.size,
    sessions_today: sessionsToday.size,
    top_events: topEvents,
    daily,
    top_pages: topPages,
  };
}
