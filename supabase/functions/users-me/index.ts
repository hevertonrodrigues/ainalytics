import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

serve(async (req: Request) => {
  const logger = createRequestLogger("users-me", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    switch (req.method) {
      case "GET":
        return logger.done(withCors(req, await handleGet(req)));
      case "PUT":
        return logger.done(withCors(req, await handleUpdate(req)));
      default:
        return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)));
    }
  } catch (err: any) {
    console.error("[users-me]", err);
    if (err.status) {
      return logger.done(withCors(
        req,
        new Response(
          JSON.stringify({ success: false, error: { message: err.message, code: "UNAUTHORIZED" } }),
          { status: err.status, headers: { "Content-Type": "application/json" } },
        ),
      ));
    }
    return logger.done(withCors(req, serverError(err.message || "Internal server error")));
  }
});

// ────────────────────────────────────────────────────────────
// GET /users-me — get own profile + tenants (no public.users)
// ────────────────────────────────────────────────────────────

async function handleGet(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const db = createAdminClient();

  // Get profile for current tenant
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("tenant_id", auth.tenantId)
    .single();

  // Get all tenants
  const { data: memberships } = await db
    .from("tenant_users")
    .select("tenant_id, role, tenants(id, name, slug, main_domain, created_at, updated_at)")
    .eq("user_id", auth.user.id)
    .eq("is_active", true);

  const tenantsList = (memberships || []).map((m: any) => m.tenants).filter(Boolean);

  // For each tenant, fetch latest subscription info
  const tenants = await Promise.all(
    tenantsList.map(async (t: any) => {
      // First, check for active/trialing subscription
      const { data: activeSub } = await db
        .from("subscriptions")
        .select("plan_id, status")
        .eq("tenant_id", t.id)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeSub) {
        return {
          ...t,
          active_plan_id: activeSub.plan_id,
          subscription_status: activeSub.status,
        };
      }

      // No active sub — fetch the latest subscription of any status for context
      const { data: latestSub } = await db
        .from("subscriptions")
        .select("plan_id, status")
        .eq("tenant_id", t.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...t,
        active_plan_id: null,
        subscription_status: latestSub?.status || null,
      };
    })
  );

  return ok({ profile, tenants });
}

// ────────────────────────────────────────────────────────────
// PUT /users-me — update own profile
// ────────────────────────────────────────────────────────────

interface UpdateProfileBody {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  locale?: string;
  has_seen_onboarding?: boolean;
  tutorial_views?: Record<string, boolean>;
  sa_customizations?: Record<string, unknown>;
}

async function handleUpdate(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const body: UpdateProfileBody = await req.json();
  const db = createAdminClient();

  // Update profile table (full_name, phone, avatar_url, locale)
  const profileUpdate: Record<string, unknown> = {};
  if (body.full_name !== undefined) profileUpdate.full_name = body.full_name;
  if (body.phone !== undefined) profileUpdate.phone = body.phone;
  if (body.avatar_url !== undefined) profileUpdate.avatar_url = body.avatar_url;
  if (body.locale !== undefined) profileUpdate.locale = body.locale;
  if (body.has_seen_onboarding !== undefined) profileUpdate.has_seen_onboarding = body.has_seen_onboarding;
  if (body.tutorial_views !== undefined) profileUpdate.tutorial_views = body.tutorial_views;
  if (body.sa_customizations !== undefined) profileUpdate.sa_customizations = body.sa_customizations;

  if (Object.keys(profileUpdate).length > 0) {
    const { error: profileError } = await db
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", auth.user.id)
      .eq("tenant_id", auth.tenantId);

    if (profileError) return serverError(profileError.message);
  }

  // Return updated profile
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("tenant_id", auth.tenantId)
    .single();

  return ok({ profile });
}
