import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * track-activity — Dual-mode endpoint (anonymous + authenticated).
 *
 * Accepts POST with a single event or a batch of events.
 * JWT verification is optional: authenticated users get user_id/tenant_id;
 * anonymous visitors use session_id only.
 *
 * Returns 204 No Content immediately (non-blocking for the client).
 */

const MAX_BATCH_SIZE = 25;
const MAX_METADATA_SIZE = 4096; // bytes

interface TrackEvent {
  event_type: string;
  event_action: string;
  event_target?: string;
  metadata?: Record<string, unknown>;
  page_url?: string;
  referrer?: string;
  session_id?: string;
  screen_resolution?: string;
  timezone?: string;
  locale?: string;
}

serve(async (req: Request) => {
  const logger = createRequestLogger("track-activity", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    if (req.method !== "POST") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)));
    }

    const db = createAdminClient();

    // ── Try to extract auth context (optional) ──
    let userId: string | null = null;
    let tenantId: string | null = null;

    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
        try {
          const { data: { user } } = await db.auth.getUser(token);
          if (user) {
            userId = user.id;

            // Try to get tenant from header or first membership
            const explicitTenantId = req.headers.get("x-tenant-id");
            if (explicitTenantId) {
              const { data: membership } = await db
                .from("tenant_users")
                .select("tenant_id")
                .eq("tenant_id", explicitTenantId)
                .eq("user_id", user.id)
                .eq("is_active", true)
                .single();
              if (membership) tenantId = membership.tenant_id;
            } else {
              const { data: firstMembership } = await db
                .from("tenant_users")
                .select("tenant_id")
                .eq("user_id", user.id)
                .eq("is_active", true)
                .limit(1)
                .single();
              if (firstMembership) tenantId = firstMembership.tenant_id;
            }
          }
        } catch {
          // Invalid token — still allow anonymous tracking
        }
      }
    }

    // ── Extract context from headers ──
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      null;

    const userAgent = req.headers.get("user-agent") || null;

    // ── Parse body ──
    const body = await req.json();

    // Support single event or batch
    const events: TrackEvent[] = Array.isArray(body.events)
      ? body.events.slice(0, MAX_BATCH_SIZE)
      : body.event_type
        ? [body as TrackEvent]
        : [];

    if (events.length === 0) {
      return logger.done(withCors(req, badRequest("No events provided")));
    }

    // ── Validate and build rows ──
    const rows = [];
    for (const event of events) {
      if (!event.event_type || !event.event_action) continue;

      // Truncate metadata if too large
      let metadata = event.metadata || {};
      if (JSON.stringify(metadata).length > MAX_METADATA_SIZE) {
        metadata = { _truncated: true, event_type: event.event_type };
      }

      rows.push({
        user_id: userId,
        tenant_id: tenantId,
        session_id: event.session_id || null,
        event_type: event.event_type.slice(0, 100),
        event_action: event.event_action.slice(0, 100),
        event_target: event.event_target?.slice(0, 500) || null,
        metadata,
        page_url: event.page_url?.slice(0, 2000) || null,
        referrer: event.referrer?.slice(0, 2000) || null,
        user_agent: userAgent?.slice(0, 500),
        ip_address: ipAddress,
        screen_resolution: event.screen_resolution?.slice(0, 20) || null,
        timezone: event.timezone?.slice(0, 50) || null,
        locale: event.locale?.slice(0, 10) || null,
      });
    }

    if (rows.length === 0) {
      return logger.done(withCors(req, badRequest("No valid events")));
    }

    // ── Insert (fire-and-forget from client perspective) ──
    const { error: dbError } = await db
      .from("user_activity_log")
      .insert(rows);

    if (dbError) {
      console.error("[track-activity] DB error:", dbError);
      return logger.done(withCors(req, serverError("Failed to track event", {
        functionName: "track-activity",
        userId: userId || undefined,
        tenantId: tenantId || undefined,
        error: dbError,
      })));
    }

    // Return 204 — minimal response for performance
    const noContent = new Response(null, { status: 204 });
    return logger.done(withCors(req, noContent), {
      tenant_id: tenantId || undefined,
      user_id: userId || undefined,
    });
  } catch (err) {
    console.error("[track-activity]", err);
    return logger.done(withCors(req, serverError("Internal server error")));
  }
});
