import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, forbidden, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";
import { getSubscriptionLimits } from "../_shared/limits.ts";

serve(async (req: Request) => {
  const logger = createRequestLogger("plans", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    switch (req.method) {
      case "GET":
        return logger.done(withCors(req, await handleGet(req)));
      case "PUT":
        return logger.done(withCors(req, await handleSelectPlan(req)));
      default:
        return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)));
    }
  } catch (err: any) {
    console.error("[plans]", err);
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

  // Fetch current subscription limits and usage
  const limits = await getSubscriptionLimits(db, auth.tenantId);

  return ok({ plans, current_plan_id: activeSub?.plan_id || null, limits });
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
    .select("id, name, trial")
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

  // 5. Cancel any existing non-canceled subscriptions and deactivate all models
  await db
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("tenant_id", auth.tenantId)
    .not("status", "in", "(canceled,incomplete_expired)");

  await db
    .from("tenant_platform_models")
    .update({ is_active: false })
    .eq("tenant_id", auth.tenantId);

  console.log(`[plans] All models deactivated for tenant ${auth.tenantId} before new subscription`);

  // 6. Create subscription (trial or active based on plan's trial days)
  const now = new Date();
  const trialDays = Number(plan.trial) || 0;
  const periodEnd = new Date(now);
  let subStatus: string;

  if (trialDays > 0) {
    // Start as trialing — period ends after trial days
    periodEnd.setDate(periodEnd.getDate() + trialDays);
    subStatus = "trialing";
  } else {
    // No trial — start as active with 3-month grant
    periodEnd.setMonth(periodEnd.getMonth() + 3);
    subStatus = "active";
  }

  // 5.5 Fetch plan limits to copy into the subscription
  const { data: planDetails } = await db
    .from("plans")
    .select("settings")
    .eq("id", activation.plan_id)
    .single();

  const planSettings = planDetails?.settings || {};

  const { data: subscription, error: subError } = await db
    .from("subscriptions")
    .insert({
      tenant_id: auth.tenantId,
      plan_id: activation.plan_id,
      stripe_subscription_id: null,
      stripe_customer_id: null,
      status: subStatus,
      billing_interval: "unique",
      paid_amount: 0,
      currency: "usd",
      max_prompts: planSettings.max_prompts ?? null,
      max_models: planSettings.max_models ?? null,
      refresh_frequency: planSettings.refresh_rate ?? null,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: true,
    })
    .select()
    .single();

  if (subError) {
    console.error("[plans] Error creating activation subscription:", subError);
    return serverError("Failed to create subscription");
  }

  // 7. Activate the default model on tenant_platform_models immediately
  // (activation code subscriptions are active from the start, unlike Stripe
  //  where the webhook activates the model after payment confirmation)
  try {
    const { data: defaultPlatform } = await db
      .from("platforms")
      .select("id, default_model_id")
      .eq("is_default", true)
      .single();

    if (defaultPlatform?.default_model_id) {
      await db
        .from("tenant_platform_models")
        .upsert(
          {
            tenant_id: auth.tenantId,
            platform_id: defaultPlatform.id,
            model_id: defaultPlatform.default_model_id,
            is_active: true,
          },
          { onConflict: "tenant_id,platform_id,model_id" }
        );

      console.log(
        `[plans] Default model activated for tenant ${auth.tenantId} (platform=${defaultPlatform.id}, model=${defaultPlatform.default_model_id})`
      );
    }
  } catch (modelErr) {
    // Non-fatal: subscription was already created successfully
    console.error("[plans] Error activating default model:", modelErr);
  }

  return ok({ subscription, plan_id: activation.plan_id });
}

