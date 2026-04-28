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
 * POST /admin-careers              → send email to selected applications via SendGrid (one per recipient)
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
          last_email_sent_at,
          last_email_opened_at,
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
          last_email_sent_at,
          last_email_opened_at,
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

    // ─── POST — Send email to selected applications via SendGrid ────
    if (req.method === "POST") {
      const body = await req.json();
      const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
      const subject: string = typeof body.subject === "string" ? body.subject.trim() : "";
      const content: string = typeof body.content === "string" ? body.content : "";

      if (ids.length === 0) {
        return logger.done(withCors(req, badRequest("ids is required")), authCtx);
      }
      if (!subject) {
        return logger.done(withCors(req, badRequest("subject is required")), authCtx);
      }
      if (!content.trim()) {
        return logger.done(withCors(req, badRequest("content is required")), authCtx);
      }

      const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
      if (!sendgridKey) {
        return logger.done(withCors(req, serverError("SendGrid API key not configured")), authCtx);
      }

      const { data: recipients, error: fetchErr } = await db
        .from("job_applications")
        .select(`
          id,
          full_name,
          email,
          opportunity:job_opportunities!opportunity_id ( title )
        `)
        .in("id", ids);

      if (fetchErr) {
        console.error("[admin-careers] recipient fetch error:", fetchErr);
        return logger.done(withCors(req, serverError("Failed to load recipients")), authCtx);
      }

      type Recipient = {
        id: string;
        full_name: string | null;
        email: string;
        opportunity: { title: string | null } | { title: string | null }[] | null;
      };

      const getOpportunityTitle = (opp: Recipient["opportunity"]): string => {
        if (!opp) return "";
        if (Array.isArray(opp)) return opp[0]?.title ?? "";
        return opp.title ?? "";
      };

      const escapeHtml = (s: string): string =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

      const buildVariables = (r: Recipient, forHtml: boolean): Record<string, string> => {
        const fullName = r.full_name?.trim() || "";
        const firstName = fullName.split(/\s+/)[0] || "";
        const opportunity = getOpportunityTitle(r.opportunity);
        const map = {
          NAME: fullName,
          FIRST_NAME: firstName,
          EMAIL: r.email || "",
          OPPORTUNITY: opportunity,
        };
        if (!forHtml) return map;
        return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, escapeHtml(v)]));
      };

      const applyVariables = (template: string, vars: Record<string, string>): string =>
        template.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (match, key: string) =>
          Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
        );

      const valid = ((recipients || []) as unknown as Recipient[]).filter((r) => Boolean(r.email));
      const hasHtml = /<[a-z][\s\S]*>/i.test(content);
      const baseHtml = hasHtml ? content : content.replace(/\n/g, "<br/>");
      const baseText = hasHtml
        ? content.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim()
        : content;

      const replyTo = { email: "contato@mail.ainalytics.tech", name: "Ainalytics" };

      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

      const results = await Promise.allSettled(
        valid.map(async (r) => {
          const textVars = buildVariables(r, false);
          const htmlVars = buildVariables(r, true);

          const personalizedSubject = applyVariables(subject, textVars);
          const personalizedText = applyVariables(baseText, textVars);
          const personalizedHtml = applyVariables(baseHtml, htmlVars);

          const trackingPixel = supabaseUrl
            ? `<img src="${supabaseUrl}/functions/v1/careers-email-track?id=${encodeURIComponent(r.id)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px" />`
            : "";
          const htmlContent = personalizedHtml + trackingPixel;

          const payload = {
            personalizations: [
              {
                to: [{ email: r.email, name: r.full_name || undefined }],
                subject: personalizedSubject,
              },
            ],
            from: { email: "contato@mail.ainalytics.tech", name: "Ainalytics" },
            reply_to: replyTo,
            content: [
              { type: "text/plain", value: personalizedText },
              { type: "text/html", value: htmlContent },
            ],
          };

          const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${sendgridKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!sgRes.ok) {
            const errText = await sgRes.text();
            throw new Error(`SendGrid ${sgRes.status}: ${errText}`);
          }
          return r.id;
        }),
      );

      const sentIds = results
        .map((r, i) => (r.status === "fulfilled" ? valid[i].id : null))
        .filter((v): v is string => v !== null);
      const sent = sentIds.length;
      const failed = results.length - sent;
      if (failed > 0) {
        const firstErr = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        console.error("[admin-careers] send failures:", failed, firstErr?.reason);
      }

      if (sentIds.length > 0) {
        const { error: stampErr } = await db
          .from("job_applications")
          .update({
            last_email_sent_at: new Date().toISOString(),
            last_email_opened_at: null,
          })
          .in("id", sentIds);
        if (stampErr) console.error("[admin-careers] stamp sent_at error:", stampErr);
      }

      return logger.done(withCors(req, ok({ sent, failed, total: results.length })), authCtx);
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
