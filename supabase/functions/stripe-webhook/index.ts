import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

// ────────────────────────────────────────────────────────────
// Stripe signature verification (HMAC SHA-256)
// ────────────────────────────────────────────────────────────

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  const parts = sigHeader.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key === "t") acc.timestamp = value;
      if (key === "v1") acc.signatures.push(value);
      return acc;
    },
    { timestamp: "", signatures: [] as string[] }
  );

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  // Check timestamp tolerance (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(parts.timestamp)) > 300) return false;

  const signedPayload = `${parts.timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return parts.signatures.some((sig) => sig === expectedSig);
}

// ────────────────────────────────────────────────────────────
// CORS — webhook needs permissive CORS since Stripe calls it
// ────────────────────────────────────────────────────────────

function webhookResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ────────────────────────────────────────────────────────────
// Stripe API helper
// ────────────────────────────────────────────────────────────

async function stripeGet(endpoint: string) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    },
  });
  return res.json();
}

// ────────────────────────────────────────────────────────────
// Event Handlers
// ────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(event: any) {
  const session = event.data.object;
  const metadata = session.metadata || {};
  const tenantId = metadata.tenant_id;
  const planId = metadata.plan_id;
  const billingInterval = metadata.billing_interval || "monthly";

  if (!tenantId || !planId) {
    console.warn("[stripe-webhook] Missing metadata in checkout session:", session.id);
    return;
  }

  const db = createAdminClient();

  // Get subscription details from Stripe
  const stripeSubscription = session.subscription
    ? await stripeGet(`/subscriptions/${session.subscription}`)
    : null;

  const paidAmount = session.amount_total ? session.amount_total / 100 : 0;
  const currency = session.currency || "usd";

  // Determine subscription status — Stripe sets 'trialing' when trial_period_days is used
  const subscriptionStatus = stripeSubscription?.status === "trialing" ? "trialing" : "active";

  // Create subscription record
  const { data: subscription, error: subError } = await db
    .from("subscriptions")
    .insert({
      tenant_id: tenantId,
      plan_id: planId,
      stripe_subscription_id: session.subscription || null,
      stripe_customer_id: session.customer || null,
      status: subscriptionStatus,
      billing_interval: billingInterval,
      paid_amount: paidAmount,
      currency,
      current_period_start: stripeSubscription?.current_period_start
        ? new Date(stripeSubscription.current_period_start * 1000).toISOString()
        : new Date().toISOString(),
      current_period_end: stripeSubscription?.current_period_end
        ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
        : null,
    })
    .select()
    .single();

  if (subError) {
    console.error("[stripe-webhook] Error creating subscription:", subError);
    return;
  }

  // Update the pending payment_attempt (created at checkout click) → succeeded
  const { data: existingPA } = await db
    .from("payment_attempts")
    .select("id")
    .eq("stripe_payment_intent_id", session.id)
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .single();

  if (existingPA) {
    await db
      .from("payment_attempts")
      .update({
        subscription_id: subscription?.id || null,
        stripe_invoice_id: stripeSubscription?.latest_invoice || null,
        amount: paidAmount,
        currency,
        status: "succeeded",
        stripe_event_type: event.type,
        raw_event: event,
      })
      .eq("id", existingPA.id);
  } else {
    // Fallback: create if no pending record found
    await db.from("payment_attempts").insert({
      tenant_id: tenantId,
      subscription_id: subscription?.id || null,
      stripe_payment_intent_id: session.payment_intent || session.id,
      stripe_invoice_id: stripeSubscription?.latest_invoice || null,
      amount: paidAmount,
      currency,
      status: "succeeded",
      stripe_event_type: event.type,
      raw_event: event,
    });
  }

  // ── Activate the default model on tenant_platform_models ──
  try {
    const { data: defaultPlatform } = await db
      .from("platforms")
      .select("id, default_model_id")
      .eq("is_default", true)
      .single();

    if (defaultPlatform?.default_model_id) {
      // Upsert: if the row exists set is_active=true, otherwise insert it active
      await db
        .from("tenant_platform_models")
        .upsert(
          {
            tenant_id: tenantId,
            platform_id: defaultPlatform.id,
            model_id: defaultPlatform.default_model_id,
            is_active: true,
          },
          { onConflict: "tenant_id,platform_id,model_id" }
        );

      console.log(
        `[stripe-webhook] Default model activated for tenant ${tenantId} (platform=${defaultPlatform.id}, model=${defaultPlatform.default_model_id})`
      );
    }
  } catch (modelErr) {
    // Non-fatal: subscription was already created successfully
    console.error("[stripe-webhook] Error activating default model:", modelErr);
  }

  console.log(`[stripe-webhook] Subscription created for tenant ${tenantId}, plan ${planId}`);
}

async function handleInvoicePaymentSucceeded(event: any) {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) return;

  const db = createAdminClient();

  // Find subscription by Stripe ID
  const { data: subscription } = await db
    .from("subscriptions")
    .select("id, tenant_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!subscription) {
    console.warn("[stripe-webhook] No subscription found for:", subscriptionId);
    return;
  }

  // Try to find an existing pending payment_attempt for this invoice
  const { data: existingPA } = await db
    .from("payment_attempts")
    .select("id")
    .eq("tenant_id", subscription.tenant_id)
    .eq("subscription_id", subscription.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existingPA) {
    await db
      .from("payment_attempts")
      .update({
        stripe_payment_intent_id: invoice.payment_intent || null,
        stripe_invoice_id: invoice.id,
        amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
        currency: invoice.currency || "usd",
        status: "succeeded",
        stripe_event_type: event.type,
        raw_event: event,
      })
      .eq("id", existingPA.id);
  } else {
    // Recurring payment (not the first one) — insert new record
    await db.from("payment_attempts").insert({
      tenant_id: subscription.tenant_id,
      subscription_id: subscription.id,
      stripe_payment_intent_id: invoice.payment_intent || null,
      stripe_invoice_id: invoice.id,
      amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
      currency: invoice.currency || "usd",
      status: "succeeded",
      stripe_event_type: event.type,
      raw_event: event,
    });
  }

  console.log(`[stripe-webhook] Payment succeeded for subscription ${subscription.id}`);
}

async function handleInvoicePaymentFailed(event: any) {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) return;

  const db = createAdminClient();

  const { data: subscription } = await db
    .from("subscriptions")
    .select("id, tenant_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!subscription) return;

  // Update subscription status
  await db
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("id", subscription.id);

  // Try to find an existing pending payment_attempt
  const { data: existingPA } = await db
    .from("payment_attempts")
    .select("id")
    .eq("tenant_id", subscription.tenant_id)
    .eq("subscription_id", subscription.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existingPA) {
    await db
      .from("payment_attempts")
      .update({
        stripe_payment_intent_id: invoice.payment_intent || null,
        stripe_invoice_id: invoice.id,
        amount: invoice.amount_due ? invoice.amount_due / 100 : 0,
        currency: invoice.currency || "usd",
        status: "failed",
        failure_reason: invoice.last_finalization_error?.message || "Payment failed",
        stripe_event_type: event.type,
        raw_event: event,
      })
      .eq("id", existingPA.id);
  } else {
    await db.from("payment_attempts").insert({
      tenant_id: subscription.tenant_id,
      subscription_id: subscription.id,
      stripe_payment_intent_id: invoice.payment_intent || null,
      stripe_invoice_id: invoice.id,
      amount: invoice.amount_due ? invoice.amount_due / 100 : 0,
      currency: invoice.currency || "usd",
      status: "failed",
      failure_reason: invoice.last_finalization_error?.message || "Payment failed",
      stripe_event_type: event.type,
      raw_event: event,
    });
  }

  console.log(`[stripe-webhook] Payment failed for subscription ${subscription.id}`);
}

async function handleSubscriptionUpdated(event: any) {
  const stripeSub = event.data.object;
  const db = createAdminClient();

  const { data: subscription } = await db
    .from("subscriptions")
    .select("id, tenant_id")
    .eq("stripe_subscription_id", stripeSub.id)
    .single();

  if (!subscription) return;

  const updates: Record<string, unknown> = {
    status: stripeSub.status,
    cancel_at_period_end: stripeSub.cancel_at_period_end || false,
  };

  if (stripeSub.current_period_start) {
    updates.current_period_start = new Date(stripeSub.current_period_start * 1000).toISOString();
  }
  if (stripeSub.current_period_end) {
    updates.current_period_end = new Date(stripeSub.current_period_end * 1000).toISOString();
  }
  if (stripeSub.canceled_at) {
    updates.canceled_at = new Date(stripeSub.canceled_at * 1000).toISOString();
  }

  await db
    .from("subscriptions")
    .update(updates)
    .eq("id", subscription.id);

  // If canceled, deactivate all tenant models
  if (stripeSub.status === "canceled") {
    await db
      .from("tenant_platform_models")
      .update({ is_active: false })
      .eq("tenant_id", subscription.tenant_id);

    console.log(`[stripe-webhook] All models deactivated for tenant ${subscription.tenant_id}`);
  }

  console.log(`[stripe-webhook] Subscription ${subscription.id} updated to status: ${stripeSub.status}`);
}

async function handleSubscriptionDeleted(event: any) {
  const stripeSub = event.data.object;
  const db = createAdminClient();

  const { data: subscription } = await db
    .from("subscriptions")
    .select("id, tenant_id")
    .eq("stripe_subscription_id", stripeSub.id)
    .single();

  if (!subscription) return;

  await db
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  // Deactivate all tenant models
  await db
    .from("tenant_platform_models")
    .update({ is_active: false })
    .eq("tenant_id", subscription.tenant_id);

  console.log(`[stripe-webhook] All models deactivated for tenant ${subscription.tenant_id}`);
  console.log(`[stripe-webhook] Subscription ${subscription.id} canceled`);
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const logger = createRequestLogger("stripe-webhook", req);

  // Only accept POST
  if (req.method !== "POST") {
    return logger.done(webhookResponse({ error: "Method not allowed" }, 405));
  }

  try {
    const body = await req.text();
    const sigHeader = req.headers.get("stripe-signature");

    if (!sigHeader) {
      return logger.done(webhookResponse({ error: "Missing stripe-signature header" }, 400));
    }

    // Verify webhook signature
    if (STRIPE_WEBHOOK_SECRET) {
      const isValid = await verifyStripeSignature(body, sigHeader, STRIPE_WEBHOOK_SECRET);
      if (!isValid) {
        console.error("[stripe-webhook] Invalid signature");
        return logger.done(webhookResponse({ error: "Invalid signature" }, 400));
      }
    }

    const event = JSON.parse(body);
    console.log(`[stripe-webhook] Received event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event);
        break;
      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    return logger.done(webhookResponse({ received: true }));
  } catch (err) {
    console.error("[stripe-webhook] Error:", err);
    return logger.done(webhookResponse({ error: "Webhook handler failed" }, 500));
  }
});
