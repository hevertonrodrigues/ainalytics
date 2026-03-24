import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { created, badRequest, forbidden, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { verifyRecaptcha } from "../_shared/verify-recaptcha.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * interest-leads — PUBLIC endpoint (no auth required).
 * Accepts POST with lead info + browser metadata.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req: Request) => {
  const logger = createRequestLogger("interest-leads", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    if (req.method !== "POST") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)));
    }

    const db = createAdminClient();
    const body = await req.json();

    // ── Validate required fields ──
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return logger.done(withCors(req, badRequest("name is required")));
    }
    if (!body.email || typeof body.email !== "string" || !EMAIL_REGEX.test(body.email.trim())) {
      return logger.done(withCors(req, badRequest("A valid email is required")));
    }
    const phoneDigits = (body.phone || "").replace(/\D/g, "");
    if (!body.phone || phoneDigits.length < 10) {
      return logger.done(withCors(req, badRequest("Phone is required (min 10 digits)")));
    }

    // ── Verify reCAPTCHA ──
    const recaptcha = await verifyRecaptcha(body.recaptcha_token, "interest_lead");
    if (!recaptcha.valid) {
      console.warn("[interest-leads] reCAPTCHA rejected — score:", recaptcha.score);
      return logger.done(withCors(req, forbidden("Security verification failed")));
    }

    // ── Extract metadata from headers ──
    const ip_address =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      null;

    const user_agent = req.headers.get("user-agent") || null;
    const referrer = req.headers.get("referer") || null;
    const language = req.headers.get("accept-language") || null;

    // ── Insert lead ──
    const { data, error: dbError } = await db
      .from("interest_leads")
      .insert({
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        phone: body.phone?.trim() || null,
        company: body.company?.trim() || null,
        message: body.message?.trim() || null,
        ip_address,
        user_agent,
        referrer,
        language,
        screen_resolution: body.screen_resolution || null,
        timezone: body.timezone || null,
        page_url: body.page_url || null,
      })
      .select("id, created_at")
      .single();

    if (dbError) {
      console.error("[interest-leads] DB error:", dbError);
      return logger.done(withCors(req, serverError("Failed to save your request")));
    }

    return logger.done(withCors(req, created(data)));
  } catch (err) {
    console.error("[interest-leads]", err);
    return logger.done(withCors(req, serverError("Internal server error")));
  }
});
