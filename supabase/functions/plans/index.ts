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
  } catch (err: any) {
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
// GET /plans — list all active plans + current active plan from subscriptions
// ────────────────────────────────────────────────────────────

async function handleGet(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const db = createAdminClient();

  // Fetch all active plans
  const { data: plans, error: plansError } = await db
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (plansError) return serverError(plansError.message);

  // Fetch current active subscription's plan_id
  const { data: activeSub } = await db
    .from("subscriptions")
    .select("plan_id")
    .eq("tenant_id", auth.tenantId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return ok({ plans, current_plan_id: activeSub?.plan_id || null });
}

// ────────────────────────────────────────────────────────────
// PUT /plans — assign a plan using an activation code
// The activation code itself defines which plan to apply
// (from activation_plans.plan_id)
// ────────────────────────────────────────────────────────────

interface SelectPlanBody {
  activation_code: string;
}

async function handleSelectPlan(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const body: SelectPlanBody = await req.json();

  if (!body.activation_code || body.activation_code.trim().length === 0) {
    return badRequest("activation_code is required");
  }

  const code = body.activation_code.trim();
  const db = createAdminClient();

  // 1. Check if user is owner of the current tenant
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

  // 2. Validate activation code
  const { data: activation, error: activationError } = await db
    .from("activation_plans")
    .select("*")
    .ilike("code", code)
    .single();

  if (activationError || !activation) {
    return badRequest("Invalid activation code");
  }

  // Code must be active
  if (!activation.is_active) {
    return badRequest("This activation code is no longer active");
  }

  // Code must not already be used (tenant_id must be null)
  if (activation.tenant_id !== null) {
    return badRequest("This activation code has already been used");
  }

  // Code must have a plan assigned
  if (!activation.plan_id) {
    return badRequest("This activation code does not have a plan assigned");
  }

  // 3. Verify the code's plan exists and is active
  const { data: plan } = await db
    .from("plans")
    .select("id, name")
    .eq("id", activation.plan_id)
    .eq("is_active", true)
    .single();

  if (!plan) {
    return badRequest("The plan associated with this code is no longer available");
  }

  // 4. Claim the activation code — set tenant_id
  const { error: claimError } = await db
    .from("activation_plans")
    .update({ tenant_id: auth.tenantId, updated_at: new Date().toISOString() })
    .eq("id", activation.id)
    .is("tenant_id", null); // Double-check to prevent race conditions

  if (claimError) {
    return serverError("Failed to claim activation code");
  }

  // 5. Cancel any existing active subscriptions for this tenant
  await db
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("tenant_id", auth.tenantId)
    .in("status", ["active", "trialing"]);

  // 6. Create a free 3-month subscription (activation code grant)
  const now = new Date();
  const threeMonthsLater = new Date(now);
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

  const { data: subscription, error: subError } = await db
    .from("subscriptions")
    .insert({
      tenant_id: auth.tenantId,
      plan_id: activation.plan_id,
      stripe_subscription_id: null,
      stripe_customer_id: null,
      status: "active",
      billing_interval: "unique",
      paid_amount: 0,
      currency: "usd",
      current_period_start: now.toISOString(),
      current_period_end: threeMonthsLater.toISOString(),
      cancel_at_period_end: true, // auto-cancels after 3 months
    })
    .select()
    .single();

  if (subError) {
    console.error("[plans] Error creating activation subscription:", subError);
    return serverError("Failed to create subscription");
  }

  return ok({ subscription, plan_id: activation.plan_id });
}

