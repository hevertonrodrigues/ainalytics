import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, forbidden, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    switch (req.method) {
      case "GET":
        return withCors(req, await handleGet(req));
      case "PUT":
        return withCors(req, await handleSelectPlan(req));
      default:
        return withCors(req, badRequest(`Method ${req.method} not allowed`));
    }
  } catch (err) {
    console.error("[plans]", err);
    if (err.status) {
      return withCors(
        req,
        new Response(
          JSON.stringify({ success: false, error: { message: err.message, code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" } }),
          { status: err.status, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return withCors(req, serverError(err.message || "Internal server error"));
  }
});

// ────────────────────────────────────────────────────────────
// GET /plans — list all active plans
// ────────────────────────────────────────────────────────────

async function handleGet(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const db = createAdminClient();

  // Fetch all active plans
  const { data: plans, error: plansError } = await db
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (plansError) return serverError(plansError.message);

  // Fetch current tenant's plan_id
  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .select("plan_id")
    .eq("id", auth.tenantId)
    .single();

  if (tenantError) return serverError(tenantError.message);

  return ok({ plans, current_plan_id: tenant?.plan_id || null });
}

// ────────────────────────────────────────────────────────────
// PUT /plans — assign a plan to the current tenant (owner-only)
// ────────────────────────────────────────────────────────────

interface SelectPlanBody {
  plan_id: string;
}

async function handleSelectPlan(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const body: SelectPlanBody = await req.json();

  if (!body.plan_id) {
    return badRequest("plan_id is required");
  }

  const db = createAdminClient();

  // Check if user is owner of the current tenant
  const { data: membership } = await db
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", auth.tenantId)
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .single();

  if (!membership || membership.role !== "owner") {
    return forbidden("Only tenant owners can change the plan");
  }

  // Verify plan exists and is active
  const { data: plan } = await db
    .from("plans")
    .select("id")
    .eq("id", body.plan_id)
    .eq("is_active", true)
    .single();

  if (!plan) {
    return badRequest("Invalid or inactive plan");
  }

  // Update tenant's plan
  const { data: updated, error: updateError } = await db
    .from("tenants")
    .update({ plan_id: body.plan_id })
    .eq("id", auth.tenantId)
    .select("id, name, slug, plan_id, created_at, updated_at")
    .single();

  if (updateError) return serverError(updateError.message);

  return ok(updated);
}
