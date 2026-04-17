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
        .from("sa_inbox_threads_view")
        .select("id, thread_id, from_email, from_name, to_email, subject, body_text, is_read, is_starred, is_archived, received_at, message_count", { count: "exact" });

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
        .from("sa_inbox_threads_view")
        .select("id", { count: "exact", head: true });

      const { count: unreadCount } = await db
        .from("sa_inbox_threads_view")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false)
        .eq("is_archived", false);

      const { count: starredCount } = await db
        .from("sa_inbox_threads_view")
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

    // ─── PATCH: Fetch full thread and mark as read ────────────────────────
    if (req.method === "PATCH") {
      const body = await req.json();
      const { id } = body;

      if (!id) return logger.done(withCors(req, badRequest("id is required")), authCtx);

      const { data: targetEmail, error: findErr } = await db
        .from("sa_inbox_emails")
        .select("thread_id")
        .eq("id", id)
        .single();
        
      if (findErr || !targetEmail) {
        return logger.done(withCors(req, notFound("Email not found")), authCtx);
      }

      // Fetch the whole thread
      const { data: thread, error: threadErr } = await db
        .from("sa_inbox_emails")
        .select("*")
        .eq("thread_id", targetEmail.thread_id)
        .order("received_at", { ascending: true }); // older first

      if (threadErr || !thread || thread.length === 0) {
         return logger.done(withCors(req, notFound("Thread not found")), authCtx);
      }

      // Auto-mark any unread emails in the thread as read
      const unreadIds = thread.filter(e => !e.is_read).map(e => e.id);
      if (unreadIds.length > 0) {
        await db
          .from("sa_inbox_emails")
          .update({ is_read: true })
          .in("id", unreadIds);
          
        thread.forEach(e => { if (unreadIds.includes(e.id)) e.is_read = true; });
      }

      return logger.done(withCors(req, ok(thread)), authCtx);
    }

    // ─── PUT: Update flags ──────────────────────────────────────────
    // Accepts { id } / { ids } (per-email) or { thread_id } / { thread_ids } (whole thread).
    if (req.method === "PUT") {
      const body = await req.json();
      const { id, ids, thread_id, thread_ids, is_read, is_starred, is_archived } = body;

      const updates: Record<string, boolean> = {};
      if (typeof is_read === "boolean") updates.is_read = is_read;
      if (typeof is_starred === "boolean") updates.is_starred = is_starred;
      if (typeof is_archived === "boolean") updates.is_archived = is_archived;

      if (Object.keys(updates).length === 0) {
        return logger.done(withCors(req, badRequest("No valid fields to update")), authCtx);
      }

      const threadTargets: string[] = thread_ids || (thread_id ? [thread_id] : []);
      const emailTargets: string[] = ids || (id ? [id] : []);

      if (threadTargets.length === 0 && emailTargets.length === 0) {
        return logger.done(withCors(req, badRequest("id(s) or thread_id(s) is required")), authCtx);
      }

      const update = db.from("sa_inbox_emails").update(updates);
      const { data, error } = threadTargets.length > 0
        ? await update.in("thread_id", threadTargets).select("id")
        : await update.in("id", emailTargets).select("id");
      if (error) throw error;

      return logger.done(withCors(req, ok({ updated: data?.length ?? 0 })), authCtx);
    }

    // ─── DELETE: Remove email permanently ───────────────────────────
    // Accepts { id } / { ids } (per-email) or { thread_id } / { thread_ids } (whole thread).
    if (req.method === "DELETE") {
      const body = await req.json();
      const { id, ids, thread_id, thread_ids } = body;

      const threadTargets: string[] = thread_ids || (thread_id ? [thread_id] : []);
      const emailTargets: string[] = ids || (id ? [id] : []);

      if (threadTargets.length === 0 && emailTargets.length === 0) {
        return logger.done(withCors(req, badRequest("id(s) or thread_id(s) is required")), authCtx);
      }

      const del = db.from("sa_inbox_emails").delete();
      const { data, error } = threadTargets.length > 0
        ? await del.in("thread_id", threadTargets).select("id")
        : await del.in("id", emailTargets).select("id");
      if (error) throw error;

      return logger.done(withCors(req, ok({ deleted: data?.length ?? 0 })), authCtx);
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
        .select("from_email, from_name, subject, message_id, thread_id")
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

      const replyMsgId = crypto.randomUUID();
      // Stored in DB without angle brackets (matches inbound webhook extraction format).
      const storedMessageId = `${replyMsgId}@mail.ainalytics.tech`;
      // Wire-format (headers) must include angle brackets per RFC 5322.
      const wireMessageId = `<${storedMessageId}>`;

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
          name: "Ainalytics",
        },
        content: [
          {
            type: "text/html",
            value: content,
          },
        ],
        headers: {
          "Message-ID": wireMessageId,
        },
      };

      if (originalEmail.message_id) {
        const parentWireId = `<${originalEmail.message_id}>`;
        payload.headers["In-Reply-To"] = parentWireId;
        payload.headers["References"] = parentWireId;
      }

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

      const insertData = {
        id: replyMsgId,
        thread_id: originalEmail.thread_id,
        message_id: storedMessageId,
        from_email: "contato@mail.ainalytics.tech",
        from_name: "Ainalytics",
        to_email: originalEmail.from_email,
        subject: subject,
        body_html: content,
        body_text: content.replace(/<br\/?>/g, "\n").replace(/<[^>]+>/g, ""),
        is_read: true,
        is_starred: false,
        is_archived: false,
        received_at: new Date().toISOString(),
      };

      const { error: dbInsertError } = await db.from("sa_inbox_emails").insert(insertData);
      if (dbInsertError) {
        console.error("[admin-inbox] Failed to save reply to DB:", dbInsertError);
      }

      return logger.done(withCors(req, ok({ success: true, email: insertData })), authCtx);
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
