import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import {
  ok,
  created,
  badRequest,
  notFound,
  forbidden,
  serverError,
} from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { verifyRecaptcha } from "../_shared/verify-recaptcha.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * public-careers — Unauthenticated endpoint.
 *
 * GET  /public-careers              → list published opportunities
 * GET  /public-careers/:slug        → opportunity detail + questions
 * POST /public-careers/:slug/apply  → submit application (JSON with base64 resume)
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_RESUME_SIZE = 10 * 1024 * 1024; // 10 MB

serve(async (req: Request) => {
  const logger = createRequestLogger("public-careers", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const db = createAdminClient();
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    // segments: ["public-careers"] or ["public-careers", ":slug"] or ["public-careers", ":slug", "apply"]

    const slug = segments[1] || null;
    const action = segments[2] || null;

    // ─── GET /public-careers — List published opportunities ──────────
    if (req.method === "GET" && !slug) {
      const { data, error: dbError } = await db
        .from("job_opportunities")
        .select("id, slug, title, department, location, contract_type, compensation, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false });

      if (dbError) {
        console.error("[public-careers] list error:", dbError);
        return logger.done(withCors(req, serverError("Failed to load opportunities")));
      }

      return logger.done(withCors(req, ok(data || [])));
    }

    // ─── GET /public-careers/:slug — Opportunity detail + questions ──
    if (req.method === "GET" && slug && !action) {
      const { data: opp, error: oppError } = await db
        .from("job_opportunities")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();

      if (oppError || !opp) {
        return logger.done(withCors(req, notFound("Opportunity not found")));
      }

      const { data: questions, error: qError } = await db
        .from("job_opportunity_questions")
        .select("id, question_text, question_type, options, is_required, sort_order")
        .eq("opportunity_id", opp.id)
        .order("sort_order", { ascending: true });

      if (qError) {
        console.error("[public-careers] questions error:", qError);
      }

      return logger.done(
        withCors(req, ok({ ...opp, questions: questions || [] }))
      );
    }

    // ─── POST /public-careers/:slug/apply — Submit application ──────
    if (req.method === "POST" && slug && action === "apply") {
      // Parse JSON body (resume sent as base64)
      const body = await req.json();

      // ── Validate required fields ──
      if (!body.full_name || typeof body.full_name !== "string" || !body.full_name.trim()) {
        return logger.done(withCors(req, badRequest("full_name is required")));
      }
      if (!body.email || typeof body.email !== "string" || !EMAIL_REGEX.test(body.email.trim())) {
        return logger.done(withCors(req, badRequest("A valid email is required")));
      }
      if (!body.phone || typeof body.phone !== "string" || !body.phone.trim()) {
        return logger.done(withCors(req, badRequest("phone is required")));
      }

      // ── Verify reCAPTCHA ──
      const recaptcha = await verifyRecaptcha(body.recaptcha_token, "careers_apply");
      if (!recaptcha.valid) {
        console.warn("[public-careers] reCAPTCHA rejected — score:", recaptcha.score);
        return logger.done(withCors(req, forbidden("Security verification failed")));
      }

      // ── Fetch opportunity ──
      const { data: opp, error: oppError } = await db
        .from("job_opportunities")
        .select("id")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();

      if (oppError || !opp) {
        return logger.done(withCors(req, notFound("Opportunity not found")));
      }

      // ── Handle resume upload (base64) ──
      let resume_url: string | null = null;

      if (body.resume_base64 && body.resume_filename && body.resume_content_type) {
        // Validate file type
        if (!ALLOWED_RESUME_TYPES.includes(body.resume_content_type)) {
          return logger.done(
            withCors(req, badRequest("Resume must be PDF, DOC, or DOCX"))
          );
        }

        // Decode base64
        const binaryStr = atob(body.resume_base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        // Validate size
        if (bytes.length > MAX_RESUME_SIZE) {
          return logger.done(
            withCors(req, badRequest("Resume file must be under 10 MB"))
          );
        }

        // Build storage path
        const ext = body.resume_filename.split(".").pop() || "pdf";
        const storagePath = `${opp.id}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await db.storage
          .from("job-resumes")
          .upload(storagePath, bytes, {
            contentType: body.resume_content_type,
            upsert: false,
          });

        if (uploadError) {
          console.error("[public-careers] Upload error:", uploadError);
          return logger.done(
            withCors(req, serverError("Failed to upload resume"))
          );
        }

        // Get public URL
        const { data: urlData } = db.storage
          .from("job-resumes")
          .getPublicUrl(storagePath);

        resume_url = urlData?.publicUrl || null;
      }

      // ── Validate answers against required questions ──
      const { data: questions } = await db
        .from("job_opportunity_questions")
        .select("id, is_required")
        .eq("opportunity_id", opp.id);

      const answers = body.answers || {};
      if (questions) {
        for (const q of questions) {
          if (q.is_required && (!answers[q.id] || !String(answers[q.id]).trim())) {
            return logger.done(
              withCors(req, badRequest(`Answer to question ${q.id} is required`))
            );
          }
        }
      }

      // ── Insert application ──
      const { data: application, error: insertError } = await db
        .from("job_applications")
        .insert({
          opportunity_id: opp.id,
          full_name: body.full_name.trim(),
          email: body.email.trim().toLowerCase(),
          phone: body.phone.trim(),
          linkedin_url: body.linkedin_url?.trim() || null,
          resume_url,
          answers,
          status: "new",
        })
        .select("id, created_at")
        .single();

      if (insertError) {
        console.error("[public-careers] Insert error:", insertError);
        return logger.done(
          withCors(req, serverError("Failed to submit application"))
        );
      }

      console.log("[public-careers] Application submitted:", application.id);
      return logger.done(withCors(req, created(application)));
    }

    // ─── Fallback ───────────────────────────────────────────────────
    return logger.done(
      withCors(req, badRequest(`${req.method} ${url.pathname} not allowed`))
    );
  } catch (err: unknown) {
    console.error("[public-careers]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return logger.done(withCors(req, serverError(e.message || "Internal server error")));
    }
    return logger.done(withCors(req, serverError("Internal server error")));
  }
});
