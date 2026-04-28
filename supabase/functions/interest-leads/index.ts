import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { ok, created, badRequest, forbidden, notFound, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { verifyRecaptcha } from "../_shared/verify-recaptcha.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * interest-leads — PUBLIC endpoint (no auth required).
 *
 *   POST /interest-leads
 *     - "Full" mode: { name, email, phone, ... }            → creates a complete lead
 *     - "Partial" mode: { website }                         → creates a website-only lead
 *                                                             (used by /start QuickStart flow)
 *
 *   PATCH /interest-leads/:id
 *     - Updates an existing lead with any subset of:
 *       email, name, phone, company, job_role
 *     - Used by the /start QuickStart flow to progressively
 *       enrich a lead across multiple steps.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isLocalhostOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(origin);
}

function getRequestMetadata(req: Request) {
  const ip_address =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    null;
  return {
    ip_address,
    user_agent: req.headers.get("user-agent") || null,
    referrer: req.headers.get("referer") || null,
    language: req.headers.get("accept-language") || null,
  };
}

serve(async (req: Request) => {
  const logger = createRequestLogger("interest-leads", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const idFromPath = segments[segments.length - 1];
    const isIdInPath = idFromPath && UUID_REGEX.test(idFromPath);

    const db = createAdminClient();
    const meta = getRequestMetadata(req);

    // ─── PATCH /interest-leads/:id — progressive update ───
    if (req.method === "PATCH") {
      if (!isIdInPath) {
        return logger.done(withCors(req, badRequest("Lead id is required in the URL path")));
      }
      const body = await req.json();

      // reCAPTCHA on every step (skipped for localhost dev requests)
      if (!isLocalhostOrigin(req)) {
        const recaptcha = await verifyRecaptcha(body.recaptcha_token, "interest_lead");
        if (!recaptcha.valid) {
          console.warn("[interest-leads] reCAPTCHA rejected on PATCH — score:", recaptcha.score);
          return logger.done(withCors(req, forbidden("Security verification failed")));
        }
      }

      const update: Record<string, unknown> = {};
      if (typeof body.email === "string") {
        const trimmed = body.email.trim();
        if (!EMAIL_REGEX.test(trimmed)) {
          return logger.done(withCors(req, badRequest("A valid email is required")));
        }
        update.email = trimmed.toLowerCase();
      }
      if (typeof body.name === "string" && body.name.trim()) {
        update.name = body.name.trim();
      }
      if (typeof body.phone === "string" && body.phone.trim()) {
        update.phone = body.phone.trim();
      }
      if (typeof body.company === "string" && body.company.trim()) {
        update.company = body.company.trim();
      }
      if (typeof body.job_role === "string" && body.job_role.trim()) {
        update.job_role = body.job_role.trim();
      }
      if (typeof body.website === "string" && body.website.trim()) {
        update.website = body.website.trim();
      }
      if (typeof body.message === "string" && body.message.trim()) {
        update.message = body.message.trim();
      }

      if (Object.keys(update).length === 0) {
        return logger.done(withCors(req, badRequest("No updatable fields provided")));
      }

      const { data, error: dbError } = await db
        .from("interest_leads")
        .update(update)
        .eq("id", idFromPath)
        .select("id, website, email, name, phone, company, job_role, created_at")
        .single();

      if (dbError) {
        // PostgREST "no rows" error code
        if (dbError.code === "PGRST116") {
          return logger.done(withCors(req, notFound("Lead not found")));
        }
        console.error("[interest-leads] DB error on PATCH:", dbError);
        return logger.done(withCors(req, serverError("Failed to update your request")));
      }

      return logger.done(withCors(req, ok(data)));
    }

    // ─── POST /interest-leads — full or partial create ───
    if (req.method === "POST") {
      const body = await req.json();

      if (!isLocalhostOrigin(req)) {
        const recaptcha = await verifyRecaptcha(body.recaptcha_token, "interest_lead");
        if (!recaptcha.valid) {
          console.warn("[interest-leads] reCAPTCHA rejected on POST — score:", recaptcha.score);
          return logger.done(withCors(req, forbidden("Security verification failed")));
        }
      }

      const hasName = typeof body.name === "string" && body.name.trim().length > 0;
      const hasEmail = typeof body.email === "string" && EMAIL_REGEX.test(body.email.trim());
      const phoneDigits = (body.phone || "").replace(/\D/g, "");
      const hasPhone = body.phone && phoneDigits.length >= 10;
      const hasWebsite = typeof body.website === "string" && body.website.trim().length > 0;

      // Partial mode: only website provided. Used by the QuickStart flow.
      const isPartial = hasWebsite && !hasName && !hasEmail && !hasPhone;

      if (!isPartial) {
        // Full mode: enforce required fields like before.
        if (!hasName) return logger.done(withCors(req, badRequest("name is required")));
        if (!hasEmail) return logger.done(withCors(req, badRequest("A valid email is required")));
        if (!hasPhone) return logger.done(withCors(req, badRequest("Phone is required (min 10 digits)")));
      }

      const insertRow: Record<string, unknown> = {
        name: hasName ? body.name.trim() : null,
        email: hasEmail ? body.email.trim().toLowerCase() : null,
        phone: hasPhone ? body.phone.trim() : null,
        company: body.company?.trim() || null,
        job_role: body.job_role?.trim() || null,
        website: hasWebsite ? body.website.trim() : null,
        message: body.message?.trim() || null,
        opt_in: Boolean(body.opt_in),
        ip_address: meta.ip_address,
        user_agent: meta.user_agent,
        referrer: meta.referrer,
        language: meta.language,
        screen_resolution: body.screen_resolution || null,
        timezone: body.timezone || null,
        page_url: body.page_url || null,
      };

      const { data, error: dbError } = await db
        .from("interest_leads")
        .insert(insertRow)
        .select("id, created_at")
        .single();

      if (dbError) {
        console.error("[interest-leads] DB error on POST:", dbError);
        return logger.done(withCors(req, serverError("Failed to save your request")));
      }

      return logger.done(withCors(req, created(data)));
    }

    return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)));
  } catch (err) {
    console.error("[interest-leads]", err);
    return logger.done(withCors(req, serverError("Internal server error")));
  }
});
