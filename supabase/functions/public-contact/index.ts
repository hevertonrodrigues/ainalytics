import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { created, badRequest, forbidden, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { verifyRecaptcha } from "../_shared/verify-recaptcha.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * public-contact — Unauthenticated endpoint.
 * Accepts POST with public contact form data.
 * Saves to contact_messages table with null tenant_id / user_id.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_SUBJECTS = [
  "general_inquiry",
  "pricing",
  "partnership",
  "demo_request",
  "other",
];

serve(async (req: Request) => {
  const logger = createRequestLogger("public-contact", req);
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
    if (
      !body.email ||
      typeof body.email !== "string" ||
      !EMAIL_REGEX.test(body.email.trim())
    ) {
      return logger.done(withCors(req, badRequest("A valid email is required")));
    }
    if (!body.subject || !VALID_SUBJECTS.includes(body.subject)) {
      return logger.done(withCors(req, badRequest("subject is required")));
    }
    if (
      !body.message ||
      typeof body.message !== "string" ||
      !body.message.trim()
    ) {
      return logger.done(withCors(req, badRequest("message is required")));
    }

    // ── Verify reCAPTCHA ──
    const recaptcha = await verifyRecaptcha(body.recaptcha_token, "public_contact");
    if (!recaptcha.valid) {
      console.warn("[public-contact] reCAPTCHA rejected — score:", recaptcha.score);
      return logger.done(withCors(req, forbidden("Security verification failed")));
    }

    // ── Insert contact message (no tenant, no user) ──
    const { data, error: dbError } = await db
      .from("contact_messages")
      .insert({
        tenant_id: null,
        user_id: null,
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        subject: body.subject.trim(),
        message: body.message.trim(),
      })
      .select("id, created_at")
      .single();

    if (dbError) {
      console.error("[public-contact] DB error:", dbError);
      return logger.done(withCors(req, serverError("Failed to save your message")));
    }

    console.log("[public-contact] Message saved:", data.id);
    return logger.done(withCors(req, created(data)));
  } catch (err: unknown) {
    console.error("[public-contact]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return logger.done(withCors(req, serverError(e.message || "Internal server error")));
    }
    return logger.done(withCors(req, serverError("Internal server error")));
  }
});
