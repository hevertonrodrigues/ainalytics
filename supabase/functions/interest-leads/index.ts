import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { created, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

/**
 * interest-leads — PUBLIC endpoint (no auth required).
 * Accepts POST with lead info + browser metadata.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    if (!body.email || typeof body.email !== "string" || !EMAIL_REGEX.test(body.email.trim())) {
      return withCors(req, badRequest("A valid email is required"));
    }
    const phoneDigits = (body.phone || "").replace(/\D/g, "");
    if (!body.phone || phoneDigits.length < 10) {
      return withCors(req, badRequest("Phone is required (min 10 digits)"));
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
    const db = createAdminClient();

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
      return withCors(req, serverError("Failed to save your request"));
    }

    return withCors(req, created(data));
  } catch (err) {
    console.error("[interest-leads]", err);
    return withCors(req, serverError("Internal server error"));
  }
});
