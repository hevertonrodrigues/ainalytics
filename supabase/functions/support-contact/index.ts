import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { created, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

/**
 * support-contact — Authenticated endpoint.
 * Accepts POST with support message data.
 * Saves to support_messages table.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    if (req.method !== "POST") {
      return withCors(req, badRequest(`Method ${req.method} not allowed`));
    }

    // Verify authentication
    const auth = await verifyAuth(req);

    const body = await req.json();

    // ── Validate required fields ──
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return withCors(req, badRequest("name is required"));
    }
    if (
      !body.email ||
      typeof body.email !== "string" ||
      !EMAIL_REGEX.test(body.email.trim())
    ) {
      return withCors(req, badRequest("A valid email is required"));
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
      return withCors(req, badRequest("subject is required"));
    }

    if (
      !body.message ||
      typeof body.message !== "string" ||
      !body.message.trim()
    ) {
      return withCors(req, badRequest("message is required"));
    }

    // Optional attachments (array of storage paths)
    const attachments: string[] = Array.isArray(body.attachments)
      ? body.attachments.filter((a: unknown) => typeof a === "string")
      : [];

    // ── Insert support message ──
    const db = createAdminClient();

    const { data, error: dbError } = await db
      .from("support_messages")
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
      return withCors(req, serverError("Failed to save your message"));
    }

    console.log("[support-contact] Message saved:", data.id);
    return withCors(req, created(data));
  } catch (err: unknown) {
    console.error("[support-contact]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return withCors(req, serverError(e.message || "Internal server error"));
    }
    return withCors(req, serverError("Internal server error"));
  }
});
