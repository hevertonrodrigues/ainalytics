import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, notFound, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * admin-inbox — Super Admin only.
 *
 * GET    — List emails (with query params: filter, search, page)
 * PATCH  — Fetch single email + mark as read
 * PUT    — Update email flags (is_read, is_starred, is_archived)
 * DELETE — Permanently delete an email
 * POST   — Send a reply to an email via SendGrid
 */

serve(async (req: Request) => {
  const logger = createRequestLogger("admin-inbox", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { user_id?: string } = {};

  try {
    const { user } = await verifySuperAdmin(req);
    authCtx = { user_id: user.id };

    const db = createAdminClient();
    const url = new URL(req.url);

    // ─── GET: List emails ───────────────────────────────────────────
    if (req.method === "GET") {
      const filter = url.searchParams.get("filter") || "inbox"; // inbox | unread | starred | archived | all
      const search = url.searchParams.get("search") || "";
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "30", 10)));

      let query = db
        .from("sa_inbox_emails")
        .select("id, from_email, from_name, to_email, subject, body_text, is_read, is_starred, is_archived, received_at", { count: "exact" });

      // Apply filters
      switch (filter) {
        case "inbox":
          query = query.eq("is_archived", false);
          break;
        case "unread":
          query = query.eq("is_read", false).eq("is_archived", false);
          break;
        case "starred":
          query = query.eq("is_starred", true).eq("is_archived", false);
          break;
        case "archived":
          query = query.eq("is_archived", true);
          break;
        // "all" — no filter
      }

      // Search
      if (search.trim()) {
        const q = `%${search.trim()}%`;
        query = query.or(`subject.ilike.${q},from_email.ilike.${q},from_name.ilike.${q}`);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order("received_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Also get counts for sidebar badges
      const { count: totalCount } = await db
        .from("sa_inbox_emails")
        .select("id", { count: "exact", head: true });

      const { count: unreadCount } = await db
        .from("sa_inbox_emails")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false)
        .eq("is_archived", false);

      const { count: starredCount } = await db
        .from("sa_inbox_emails")
        .select("id", { count: "exact", head: true })
        .eq("is_starred", true)
        .eq("is_archived", false);

      return logger.done(
        withCors(
          req,
          ok(data || [], {
            page,
            pageSize,
            totalFiltered: count || 0,
            total: totalCount || 0,
            unread: unreadCount || 0,
            starred: starredCount || 0,
          }),
        ),
        authCtx,
      );
    }

    // ─── GET single email (by id query param) ────────────────────────
    // We'll handle this via PUT for reading (mark as read can happen there)
    // But let's also support fetching a single email with full body
    if (req.method === "PATCH") {
      const body = await req.json();
      const { id } = body;

      if (!id) return logger.done(withCors(req, badRequest("id is required")), authCtx);

      const { data, error } = await db
        .from("sa_inbox_emails")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        return logger.done(withCors(req, notFound("Email not found")), authCtx);
      }

      // Auto-mark as read when opening
      if (!data.is_read) {
        await db
          .from("sa_inbox_emails")
          .update({ is_read: true })
          .eq("id", id);
        data.is_read = true;
      }

      return logger.done(withCors(req, ok(data)), authCtx);
    }

    // ─── PUT: Update flags ──────────────────────────────────────────
    if (req.method === "PUT") {
      const body = await req.json();
      const { id, ids, is_read, is_starred, is_archived } = body;

      // Support bulk updates (array of ids) or single id
      const targetIds: string[] = ids || (id ? [id] : []);
      if (targetIds.length === 0) {
        return logger.done(withCors(req, badRequest("id or ids is required")), authCtx);
      }

      const updates: Record<string, boolean> = {};
      if (typeof is_read === "boolean") updates.is_read = is_read;
      if (typeof is_starred === "boolean") updates.is_starred = is_starred;
      if (typeof is_archived === "boolean") updates.is_archived = is_archived;

      if (Object.keys(updates).length === 0) {
        return logger.done(withCors(req, badRequest("No valid fields to update")), authCtx);
      }

      const { error } = await db
        .from("sa_inbox_emails")
        .update(updates)
        .in("id", targetIds);

      if (error) throw error;

      return logger.done(withCors(req, ok({ updated: targetIds.length })), authCtx);
    }

    // ─── DELETE: Remove email permanently ───────────────────────────
    if (req.method === "DELETE") {
      const body = await req.json();
      const { id, ids } = body;

      const targetIds: string[] = ids || (id ? [id] : []);
      if (targetIds.length === 0) {
        return logger.done(withCors(req, badRequest("id or ids is required")), authCtx);
      }

      const { error } = await db
        .from("sa_inbox_emails")
        .delete()
        .in("id", targetIds);

      if (error) throw error;

      return logger.done(withCors(req, ok({ deleted: targetIds.length })), authCtx);
    }

    // ─── POST: Send Reply via SendGrid ──────────────────────────────
    if (req.method === "POST") {
      const body = await req.json();
      const { emailId, content } = body;

      if (!emailId || !content) {
        return logger.done(withCors(req, badRequest("emailId and content are required")), authCtx);
      }

      // 1. Get original email details
      const { data: originalEmail, error: getError } = await db
        .from("sa_inbox_emails")
        .select("from_email, from_name, subject, message_id")
        .eq("id", emailId)
        .single();

      if (getError || !originalEmail) {
        return logger.done(withCors(req, notFound("Original email not found")), authCtx);
      }

      // 2. Prepare SendGrid payload
      const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
      if (!sendgridKey) {
        return logger.done(withCors(req, serverError("SendGrid API key not configured")), authCtx);
      }

      let subject = originalEmail.subject || "";
      if (!subject.toLowerCase().startsWith("re:")) {
        subject = `Re: ${subject}`;
      }

      const payload: any = {
        personalizations: [
          {
            to: [
              {
                email: originalEmail.from_email,
                name: originalEmail.from_name || undefined,
              },
            ],
            subject: subject,
          },
        ],
        from: {
          email: "contato@mail.ainalytics.tech",
          name: "Ainalytics", // Or pull from somewhere else if needed
        },
        content: [
          {
            type: "text/html",
            value: content,
          },
        ],
      };

      // Add In-Reply-To headers if we have a message_id to keep thread intact
      if (originalEmail.message_id) {
        payload.headers = {
          "In-Reply-To": originalEmail.message_id,
          "References": originalEmail.message_id,
        };
      }

      // 3. Send to SendGrid
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
        console.error("[admin-inbox] SendGrid error:", errText);
        return logger.done(withCors(req, serverError("Failed to send email via SendGrid")), authCtx);
      }

      return logger.done(withCors(req, ok({ success: true })), authCtx);
    }

    return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);

    // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[admin-inbox]", err);
    if (err.status) {
      return logger.done(
        withCors(
          req,
          new Response(
            JSON.stringify({
              success: false,
              error: {
                message: err.message,
                code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
              },
            }),
            {
              status: err.status,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
      );
    }
    return logger.done(withCors(req, serverError(err.message || "Internal server error")));
  }
});
