import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { created, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

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
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    if (req.method !== "POST") {
      return withCors(req, badRequest(`Method ${req.method} not allowed`));
    }

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

    // ── Insert contact message (no tenant, no user) ──
    const db = createAdminClient();

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
      return withCors(req, serverError("Failed to save your message"));
    }

    console.log("[public-contact] Message saved:", data.id);
    return withCors(req, created(data));
  } catch (err: unknown) {
    console.error("[public-contact]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return withCors(req, serverError(e.message || "Internal server error"));
    }
    return withCors(req, serverError("Internal server error"));
  }
});
