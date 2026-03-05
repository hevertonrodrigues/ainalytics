import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, forbidden, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  if (req.method !== "POST") {
    return withCors(req, badRequest("Method not allowed"));
  }

  try {
    const auth = await verifyAuth(req);
    const db = createAdminClient();

    // Parse optional CSAT data
    let reason: string | undefined;
    let feedback: string | undefined;
    try {
      const body = await req.json();
      reason = body.reason;
      feedback = body.feedback;
    } catch { /* empty body is fine */ }

    // Check if user is owner
    const { data: membership } = await db
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", auth.tenantId)
      .eq("user_id", auth.user.id)
      .eq("is_active", true)
      .single();

    if (!membership || membership.role !== "owner") {
      return withCors(req, forbidden("Only tenant owners can cancel subscriptions"));
    }

    // Find the active subscription
    const { data: subscription } = await db
      .from("subscriptions")
      .select("id, stripe_subscription_id, billing_interval, status")
      .eq("tenant_id", auth.tenantId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!subscription) {
      return withCors(req, badRequest("No active subscription found"));
    }

    // If it's a Stripe subscription, cancel it via Stripe API
    if (subscription.stripe_subscription_id) {
      const res = await fetch(
        `https://api.stripe.com/v1/subscriptions/${subscription.stripe_subscription_id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          },
        }
      );
      const stripeData = await res.json();

      if (!res.ok) {
        console.error("[stripe-cancel] Stripe API error:", stripeData);
        return withCors(req, serverError(stripeData.error?.message || "Failed to cancel on Stripe"));
      }
    }

    // Update local subscription record
    await db
      .from("subscriptions")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancel_at_period_end: false,
        ...(reason ? { cancel_reason: reason } : {}),
        ...(feedback ? { cancel_feedback: feedback } : {}),
      })
      .eq("id", subscription.id);

    console.log(`[stripe-cancel] Subscription ${subscription.id} canceled for tenant ${auth.tenantId}`);

    return withCors(req, ok({ canceled: true }));
  } catch (err: unknown) {
    console.error("[stripe-cancel]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return withCors(req, serverError(message));
  }
});
