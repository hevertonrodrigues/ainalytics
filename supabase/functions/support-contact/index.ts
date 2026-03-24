import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { created, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * support-contact — Authenticated endpoint.
 * Accepts POST with support message data.
 * Saves to contact_messages table.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req: Request) => {
  const logger = createRequestLogger("support-contact", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { tenant_id?: string; user_id?: string } = {};
  try {
    if (req.method !== "POST") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)));
    }

    // Verify authentication
    const auth = await verifyAuth(req);
    authCtx = { tenant_id: auth.tenantId, user_id: auth.user.id };

    const body = await req.json();

    // ── Validate required fields ──
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return logger.done(withCors(req, badRequest("name is required")), authCtx);
    }
    if (
      !body.email ||
      typeof body.email !== "string" ||
      !EMAIL_REGEX.test(body.email.trim())
    ) {
      return logger.done(withCors(req, badRequest("A valid email is required")), authCtx);
    }

    const VALID_SUBJECTS = [
      "bug_report",
      "account_billing",
      "feature_request",
      "data_results",
      "integrations",
      "other",
    ];
    if (!body.subject || !VALID_SUBJECTS.includes(body.subject)) {
      return logger.done(withCors(req, badRequest("subject is required")), authCtx);
    }

    if (
      !body.message ||
      typeof body.message !== "string" ||
      !body.message.trim()
    ) {
      return logger.done(withCors(req, badRequest("message is required")), authCtx);
    }

    // Optional attachments (array of storage paths)
    const attachments: string[] = Array.isArray(body.attachments)
      ? body.attachments.filter((a: unknown) => typeof a === "string")
      : [];

    // ── Insert support message ──
    const db = createAdminClient();

    const { data, error: dbError } = await db
      .from("contact_messages")
      .insert({
        tenant_id: auth.tenantId,
        user_id: auth.user.id,
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        subject: body.subject.trim(),
        message: body.message.trim(),
        attachments: attachments.length > 0 ? attachments : null,
      })
      .select("id, created_at")
      .single();

    if (dbError) {
      console.error("[support-contact] DB error:", dbError);
      return logger.done(withCors(req, serverError("Failed to save your message")), authCtx);
    }

    console.log("[support-contact] Message saved:", data.id);
    return logger.done(withCors(req, created(data)), authCtx);
  } catch (err: unknown) {
    console.error("[support-contact]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return logger.done(withCors(req, serverError(e.message || "Internal server error")));
    }
    return logger.done(withCors(req, serverError("Internal server error")));
  }
});
