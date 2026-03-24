import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, forbidden, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:5173";

// Map user locale to Stripe currency
const LOCALE_CURRENCY_MAP: Record<string, string> = {
  "pt-br": "brl",
  "pt": "brl",
  "en": "usd",
  "es": "usd",
};

interface CheckoutBody {
  plan_id: string;
  billing_interval: "monthly" | "yearly";
  locale?: string; // e.g. "pt-br", "en", "es"
}

async function stripeRequest(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(flattenObject(body)).toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("[stripe-checkout] Stripe API error:", data);
    throw new Error(data.error?.message || "Stripe API error");
  }
  return data;
}

/**
 * Flatten nested objects into Stripe-compatible bracket notation:
 * { line_items: [{ price_data: { currency: "usd" } }] }
 * → "line_items[0][price_data][currency]" = "usd"
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
  result: Record<string, string> = {}
): Record<string, string> {
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "object" && item !== null) {
          flattenObject(item as Record<string, unknown>, `${newKey}[${index}]`, result);
        } else {
          result[`${newKey}[${index}]`] = String(item);
        }
      });
    } else if (typeof value === "object" && value !== null) {
      flattenObject(value as Record<string, unknown>, newKey, result);
    } else {
      result[newKey] = String(value);
    }
  }
  return result;
}

serve(async (req: Request) => {
  const logger = createRequestLogger("stripe-checkout", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { tenant_id?: string; user_id?: string } = {};
  try {
    // ─── PATCH: cancel the latest pending payment attempt ──
    if (req.method === "PATCH") {
      const auth = await verifyAuth(req);
      authCtx = { tenant_id: auth.tenantId, user_id: auth.user.id };
      const db = createAdminClient();

      // Find the most recent pending payment attempt for this tenant
      const { data: pending } = await db
        .from("payment_attempts")
        .select("id")
        .eq("tenant_id", auth.tenantId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (pending) {
        const { error: updateErr } = await db
          .from("payment_attempts")
          .update({ status: "canceled" })
          .eq("id", pending.id);

        if (updateErr) {
          console.error("[stripe-checkout] Error canceling payment_attempt:", updateErr);
          return logger.done(withCors(req, serverError("Failed to cancel payment attempt")), authCtx);
        }
      }

      return logger.done(withCors(req, ok({ canceled: true })), authCtx);
    }

    if (req.method !== "POST") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)));
    }

    const auth = await verifyAuth(req);
    authCtx = { tenant_id: auth.tenantId, user_id: auth.user.id };
    const body: CheckoutBody = await req.json();

    // Validate input
    if (!body.plan_id) {
      return logger.done(withCors(req, badRequest("plan_id is required")), authCtx);
    }
    if (!body.billing_interval || !["monthly", "yearly"].includes(body.billing_interval)) {
      return logger.done(withCors(req, badRequest("billing_interval must be 'monthly' or 'yearly'")), authCtx);
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
      return logger.done(withCors(req, forbidden("Only tenant owners can subscribe to a plan")), authCtx);
    }

    // Fetch plan
    const { data: plan, error: planError } = await db
      .from("plans")
      .select("*")
      .eq("id", body.plan_id)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      return logger.done(withCors(req, badRequest("Invalid or inactive plan")), authCtx);
    }

    // Check for custom pricing plans — those should go through contact sales
    if (plan.settings?.custom_pricing) {
      return logger.done(withCors(req, badRequest("This plan requires contacting sales")), authCtx);
    }

    // Determine currency from user locale
    const locale = (body.locale || "en").toLowerCase();
    const currency = LOCALE_CURRENCY_MAP[locale] || "usd";

    // Map locale to Stripe-supported locale codes
    const STRIPE_LOCALE_MAP: Record<string, string> = {
      "pt-br": "pt-BR",
      "pt": "pt-BR",
      "en": "en",
      "es": "es",
    };
    const stripeLocale = STRIPE_LOCALE_MAP[locale] || "auto";

    // Map currency to the exchange rate key in general_settings
    const CURRENCY_RATE_KEY: Record<string, string> = {
      brl: "USD_BRL",
      eur: "USD_EUR",
    };

    // Fetch exchange rate from general_settings if needed
    let exchangeRate = 1; // USD → USD = 1
    const rateKey = CURRENCY_RATE_KEY[currency];
    if (rateKey) {
      const { data: rateSetting } = await db
        .from("general_settings")
        .select("value")
        .eq("key", rateKey)
        .single();

      if (rateSetting?.value) {
        exchangeRate = parseFloat(rateSetting.value) || 1;
      }
    }

    // Plan price is stored in USD — convert to target currency
    const monthlyPriceUSD = plan.price;
    const monthlyPriceLocal = monthlyPriceUSD * exchangeRate;

    // Calculate price in smallest currency unit (cents/centavos)
    let unitAmountSmallest: number;
    let interval: string;

    if (body.billing_interval === "yearly") {
      // Yearly: 50% discount on monthly price → discounted monthly × exchange rate × 12
      const discountedMonthlyLocal = monthlyPriceUSD * 0.5 * exchangeRate;
      unitAmountSmallest = Math.round(discountedMonthlyLocal * 12 * 100);
      interval = "year";
    } else {
      // Monthly: full monthly price in local currency
      unitAmountSmallest = Math.round(monthlyPriceLocal * 100);
      interval = "month";
    }

    if (unitAmountSmallest <= 0) {
      return logger.done(withCors(req, badRequest("Free plans do not require checkout")), authCtx);
    }

    // Fetch tenant info for the session
    const { data: tenant } = await db
      .from("tenants")
      .select("name")
      .eq("id", auth.tenantId)
      .single();

    // ─── Extract localized plan details ───────────────────────
    // Plan description from settings (keyed by locale)
    const planSettings = (plan.settings || {}) as Record<string, unknown>;
    const descriptionMap = planSettings.description as Record<string, string> | string | undefined;
    let localizedDescription = "";
    if (typeof descriptionMap === "string") {
      localizedDescription = descriptionMap;
    } else if (typeof descriptionMap === "object" && descriptionMap) {
      localizedDescription = descriptionMap[locale] || descriptionMap["en"] || "";
    }

    // Plan features (keyed by locale)
    const featuresMap = (plan.features || {}) as Record<string, string[]>;
    const localizedFeatures = featuresMap[locale] || featuresMap["en"] || [];

    // Build a rich product description with features
    const featuresList = localizedFeatures.length > 0
      ? localizedFeatures.map((f: string) => `✓ ${f}`).join(" | ")
      : "";

    const productDescription = [localizedDescription, featuresList]
      .filter(Boolean)
      .join("\n")
      .slice(0, 500); // Stripe limits description to 500 chars

    // Build product name in user's language
    const PLAN_LABEL: Record<string, string> = {
      "pt-br": "Plano",
      "pt": "Plano",
      "en": "Plan",
      "es": "Plan",
    };
    const planLabel = PLAN_LABEL[locale] || "Plan";
    const productName = `${plan.name} ${planLabel}`;

    // Create Stripe Checkout Session
    const session = await stripeRequest("/checkout/sessions", {
      mode: "subscription",
      locale: stripeLocale,
      success_url: `${SITE_URL}/dashboard/plans?checkout=success`,
      cancel_url: `${SITE_URL}/dashboard/plans?checkout=canceled`,
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: unitAmountSmallest,
            product_data: {
              name: productName,
              description: productDescription || `${productName} – ${tenant?.name || ""}`,
            },
            recurring: {
              interval,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        tenant_id: auth.tenantId,
        plan_id: body.plan_id,
        user_id: auth.user.id,
        billing_interval: body.billing_interval,
        currency,
      },
      subscription_data: {
        metadata: {
          tenant_id: auth.tenantId,
          plan_id: body.plan_id,
          billing_interval: body.billing_interval,
        },
        ...(plan.trial > 0 ? { trial_period_days: plan.trial } : {}),
      },
    });

    // Create a pending payment_attempt record immediately
    const { error: paError } = await db.from("payment_attempts").insert({
      tenant_id: auth.tenantId,
      stripe_payment_intent_id: session.id, // checkout session ID as reference
      amount: unitAmountSmallest / 100,
      currency,
      status: "pending",
      stripe_event_type: "checkout.session.created",
      raw_event: {
        checkout_session_id: session.id,
        plan_id: body.plan_id,
        billing_interval: body.billing_interval,
        plan_name: plan.name,
      },
    });

    if (paError) {
      console.error("[stripe-checkout] Error creating payment_attempt:", paError);
    }

    return logger.done(withCors(req, ok({ url: session.url })), authCtx);
  } catch (err: unknown) {
    console.error("[stripe-checkout]", err);
    const error = err as Record<string, unknown>;
    if (error.status) {
      return logger.done(withCors(
        req,
        new Response(
          JSON.stringify({
            success: false,
            error: {
              message: error.message,
              code: error.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
            },
          }),
          { status: error.status as number, headers: { "Content-Type": "application/json" } }
        )
      ));
    }
    return logger.done(withCors(req, serverError((error.message as string) || "Internal server error")));
  }
});
