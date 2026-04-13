import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * admin-careers — Authenticated, Super-Admin only.
 *
 * GET  /admin-careers              → list all applications (with opportunity title)
 * PUT  /admin-careers              → update application status
 */

const ALLOWED_STATUSES = ["new", "reviewing", "interview", "rejected", "hired"];

async function requireSuperAdmin(userId: string, tenantId: string): Promise<void> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("profiles")
    .select("is_sa")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_sa", true)
    .limit(1);

  if (error) throw { status: 500, message: "Failed to verify superadmin access" };
  if (!data || data.length === 0) throw { status: 403, message: "Superadmin access required" };
}

serve(async (req: Request) => {
  const logger = createRequestLogger("admin-careers", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { tenant_id?: string; user_id?: string } = {};
  try {
    const { tenantId, user } = await verifyAuth(req);
    authCtx = { tenant_id: tenantId, user_id: user.id };
    await requireSuperAdmin(user.id, tenantId);

    const db = createAdminClient();

    // ─── GET — List all applications ────────────────────────────────
    if (req.method === "GET") {
      const { data, error: dbError } = await db
        .from("job_applications")
        .select(`
          id,
          full_name,
          email,
          phone,
          linkedin_url,
          resume_url,
          answers,
          status,
          created_at,
          opportunity:job_opportunities!opportunity_id (
            id,
            title,
            slug,
            department
          )
        `)
        .order("created_at", { ascending: false });

      if (dbError) {
        console.error("[admin-careers] list error:", dbError);
        return logger.done(withCors(req, serverError("Failed to load applications")), authCtx);
      }

      // Also fetch questions for answer labels
      const { data: questions } = await db
        .from("job_opportunity_questions")
        .select("id, question_text, opportunity_id")
        .order("sort_order", { ascending: true });

      return logger.done(withCors(req, ok({
        applications: data || [],
        questions: questions || [],
      })), authCtx);
    }

    // ─── PUT — Update application status ────────────────────────────
    if (req.method === "PUT") {
      const body = await req.json();

      if (!body.id || typeof body.id !== "string") {
        return logger.done(withCors(req, badRequest("id is required")), authCtx);
      }
      if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
        return logger.done(
          withCors(req, badRequest(`status must be one of: ${ALLOWED_STATUSES.join(", ")}`)),
          authCtx,
        );
      }

      const { data, error: updateError } = await db
        .from("job_applications")
        .update({ status: body.status })
        .eq("id", body.id)
        .select(`
          id,
          full_name,
          email,
          phone,
          linkedin_url,
          resume_url,
          answers,
          status,
          created_at,
          opportunity:job_opportunities!opportunity_id (
            id,
            title,
            slug,
            department
          )
        `)
        .single();

      if (updateError) {
        console.error("[admin-careers] update error:", updateError);
        return logger.done(withCors(req, serverError("Failed to update application")), authCtx);
      }

      return logger.done(withCors(req, ok(data)), authCtx);
    }

    return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);
  } catch (err: unknown) {
    console.error("[admin-careers]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return logger.done(
        withCors(req, new Response(
          JSON.stringify({ success: false, error: { message: e.message, code: e.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" } }),
          { status: e.status, headers: { "Content-Type": "application/json" } },
        )),
        authCtx,
      );
    }
    return logger.done(withCors(req, serverError(e.message || "Internal server error")), authCtx);
  }
});
