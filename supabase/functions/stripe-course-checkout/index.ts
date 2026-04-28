// =====================================================================
// stripe-course-checkout — UNAUTHENTICATED endpoint.
//
// Creates a Stripe Checkout Session for a one-time COURSE purchase.
// This is intentionally separate from `stripe-checkout` (which handles
// recurring subscriptions). Differences:
//
//   • mode = "payment"  (one-time)            vs. "subscription"
//   • metadata.payment_type = "course"        ← hard flag for routing
//   • writes a `course_purchases` row         (separate ledger)
//   • does NOT touch subscriptions / payments / payment_attempts
//   • does NOT require auth or x-tenant-id    (prospects, not tenants)
// =====================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { ok, badRequest, notFound, forbidden, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";
import { verifyRecaptcha } from "../_shared/verify-recaptcha.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:5173";

const STRIPE_LOCALE_MAP: Record<string, string> = {
  "pt-br": "pt-BR",
  "pt": "pt-BR",
  "en": "en",
  "es": "es",
};

const LOCALE_CURRENCY_MAP: Record<string, string> = {
  "pt-br": "brl",
  "pt": "brl",
  "en": "usd",
  "es": "usd",
};

interface CourseCheckoutBody {
  course_slug: string;
  customer_email: string;
  customer_name?: string;
  customer_phone?: string;
  locale?: string;
  recaptcha_token?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  referrer?: string;
}

// ─── Stripe API helper (form-encoded, identical pattern to stripe-checkout) ──
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
    console.error("[stripe-course-checkout] Stripe API error:", data);
    throw new Error(data.error?.message || "Stripe API error");
  }
  return data;
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
  result: Record<string, string> = {},
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
    } else if (value !== undefined && value !== null) {
      result[newKey] = String(value);
    }
  }
  return result;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req: Request) => {
  const logger = createRequestLogger("stripe-course-checkout", req);

  if (req.method === "OPTIONS") return handleCors(req);
  if (req.method !== "POST") {
    return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)));
  }

  try {
    if (!STRIPE_SECRET_KEY) {
      console.error("[stripe-course-checkout] STRIPE_SECRET_KEY is not configured");
      return logger.done(withCors(req, serverError("Checkout is not configured")));
    }

    const body: CourseCheckoutBody = await req.json();

    // ─── Validate input ─────────────────────────────────────
    if (!body.course_slug || typeof body.course_slug !== "string") {
      return logger.done(withCors(req, badRequest("course_slug is required")));
    }
    if (!body.customer_email || !EMAIL_REGEX.test(body.customer_email)) {
      return logger.done(withCors(req, badRequest("Valid customer_email is required")));
    }

    // ─── reCAPTCHA (public endpoint, bot protection) ────────
    const recaptcha = await verifyRecaptcha(body.recaptcha_token, "course_checkout");
    if (!recaptcha.valid) {
      console.warn("[stripe-course-checkout] reCAPTCHA rejected — score:", recaptcha.score);
      return logger.done(withCors(req, forbidden("Security verification failed")));
    }

    const db = createAdminClient();

    // ─── Look up course (must exist + be active) ────────────
    const { data: course, error: courseErr } = await db
      .from("courses")
      .select("id, slug, name, description, price_brl, price_usd, price_eur, is_active")
      .eq("slug", body.course_slug)
      .eq("is_active", true)
      .single();

    if (courseErr || !course) {
      return logger.done(withCors(req, notFound("Course not found or inactive")));
    }

    // ─── Currency selection ─────────────────────────────────
    const locale = (body.locale || "pt-br").toLowerCase();
    const currency = LOCALE_CURRENCY_MAP[locale] || "usd";

    let unitAmount: number | null = null;
    if (currency === "brl") unitAmount = course.price_brl;
    else if (currency === "eur") unitAmount = course.price_eur;
    else unitAmount = course.price_usd;

    if (!unitAmount || unitAmount <= 0) {
      return logger.done(withCors(req, badRequest(`Course is not priced in ${currency.toUpperCase()}`)));
    }

    const unitAmountSmallest = Math.round(unitAmount * 100); // smallest currency unit
    const stripeLocale = STRIPE_LOCALE_MAP[locale] || "auto";

    // ─── Create pending course_purchase row FIRST ───────────
    // We have its UUID before calling Stripe so the session can carry it
    // in metadata for the webhook to update the same row.
    const { data: purchase, error: insertErr } = await db
      .from("course_purchases")
      .insert({
        course_id: course.id,
        course_slug: course.slug,
        course_name: course.name,
        customer_email: body.customer_email.trim().toLowerCase(),
        customer_name: body.customer_name?.trim() || null,
        customer_phone: body.customer_phone?.trim() || null,
        customer_locale: locale,
        amount: unitAmount,
        currency,
        status: "pending",
        utm_source: body.utm?.source || null,
        utm_medium: body.utm?.medium || null,
        utm_campaign: body.utm?.campaign || null,
        utm_term: body.utm?.term || null,
        utm_content: body.utm?.content || null,
        referrer: body.referrer || null,
      })
      .select("id")
      .single();

    if (insertErr || !purchase) {
      console.error("[stripe-course-checkout] Error creating course_purchase row:", insertErr);
      return logger.done(withCors(req, serverError("Failed to initialise course purchase")));
    }

    // ─── Build Stripe Checkout Session (mode=payment) ───────
    const successPath = `/curso-geo-essencial?checkout=success&purchase_id=${purchase.id}`;
    const cancelPath = `/curso-geo-essencial?checkout=canceled`;

    const session = await stripeRequest("/checkout/sessions", {
      mode: "payment",
      locale: stripeLocale,
      success_url: `${SITE_URL}${successPath}`,
      cancel_url: `${SITE_URL}${cancelPath}`,
      customer_email: body.customer_email.trim().toLowerCase(),
      // Brazil is the primary market for this course → enable card + boleto
      // (Pix is enabled at the Stripe account level and rendered automatically
      // when the locale is pt-BR, so we don't list it explicitly here)
      payment_method_types: currency === "brl" ? ["card"] : ["card"],
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: unitAmountSmallest,
            product_data: {
              name: course.name,
              description: (course.description || "").slice(0, 500),
              metadata: {
                course_id: course.id,
                course_slug: course.slug,
              },
            },
          },
          quantity: 1,
        },
      ],
      // ── METADATA — flag this session as a COURSE purchase ──
      // The webhook routes by `metadata.payment_type`. Subscriptions never
      // set this flag, so the two flows can never bleed into each other.
      metadata: {
        payment_type: "course",
        course_id: course.id,
        course_slug: course.slug,
        course_purchase_id: purchase.id,
      },
      payment_intent_data: {
        metadata: {
          payment_type: "course",
          course_id: course.id,
          course_slug: course.slug,
          course_purchase_id: purchase.id,
        },
        // Statement descriptor visible on the buyer's card statement
        statement_descriptor_suffix: "GEO ESS",
      },
    });

    // Persist the Stripe session id on the pending row so the webhook
    // can reconcile by either course_purchase_id (metadata) or session id.
    await db
      .from("course_purchases")
      .update({ stripe_session_id: session.id })
      .eq("id", purchase.id);

    return logger.done(withCors(req, ok({ url: session.url, purchase_id: purchase.id })));
  } catch (err: unknown) {
    console.error("[stripe-course-checkout]", err);
    return logger.done(withCors(req, serverError("Failed to initialise checkout", {
      functionName: "stripe-course-checkout",
      error: err,
    })));
  }
});
