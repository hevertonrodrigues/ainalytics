import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createAdminClient } from "../_shared/supabase.ts";

/**
 * sendgrid-inbound-webhook — Public endpoint (NO JWT auth).
 *
 * Receives POST requests from SendGrid Inbound Parse.
 * SendGrid sends multipart/form-data with parsed email fields.
 *
 * Security: validates a secret token in the query string.
 * URL format: /functions/v1/sendgrid-inbound-webhook?token=<SENDGRID_WEBHOOK_SECRET>
 */

function parseEmailAddress(raw: string): { name: string | null; email: string } {
  // Handles: "John Doe <john@example.com>" or just "john@example.com"
  const match = raw.match(/^(?:"?([^"]*?)"?\s*)?<?([^\s<>]+@[^\s<>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || null,
      email: match[2].trim().toLowerCase(),
    };
  }
  return { name: null, email: raw.trim().toLowerCase() };
}

serve(async (req: Request) => {
  // SendGrid only sends POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // ── Validate webhook secret ──
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const expectedToken = Deno.env.get("SENDGRID_WEBHOOK_SECRET");

    if (!expectedToken || token !== expectedToken) {
      console.warn("[sendgrid-inbound-webhook] Invalid or missing token");
      return new Response("Unauthorized", { status: 401 });
    }

    // ── Parse multipart form data ──
    const formData = await req.formData();

    const fromRaw = formData.get("from")?.toString() || "";
    const toRaw = formData.get("to")?.toString() || "";
    const subject = formData.get("subject")?.toString() || "(no subject)";
    const text = formData.get("text")?.toString() || null;
    const html = formData.get("html")?.toString() || null;
    const headersRaw = formData.get("headers")?.toString() || null;
    const envelopeRaw = formData.get("envelope")?.toString() || null;

    const sender = parseEmailAddress(fromRaw);
    const recipient = parseEmailAddress(toRaw);

    // Parse envelope JSON if available
    let envelope = null;
    if (envelopeRaw) {
      try {
        envelope = JSON.parse(envelopeRaw);
      } catch {
        // ignore malformed envelope
      }
    }

    // Try to extract Message-ID, In-Reply-To, and References from headers for threading
    let messageId: string | null = null;
    let inReplyTo: string | null = null;
    let references: string[] = [];
    
    if (headersRaw) {
      const msgIdMatch = headersRaw.match(/^Message-ID:\s*<?(.+?)>?\s*$/mi);
      if (msgIdMatch) {
        messageId = msgIdMatch[1].trim();
      }
      const inReplyToMatch = headersRaw.match(/^In-Reply-To:\s*<?(.+?)>?\s*$/mi);
      if (inReplyToMatch) {
        inReplyTo = inReplyToMatch[1].trim();
      }
      const refMatch = headersRaw.match(/^References:\s*(.+)$/im);
      if (refMatch) {
        const refs = refMatch[1].match(/<[^>]+>/g);
        if (refs) {
          references = refs.map(r => r.replace(/[<>]/g, '').trim());
        }
      }
    }

    // Parse headers into a simple object for storage
    let headersJson = null;
    if (headersRaw) {
      try {
        // Store raw headers as a JSON string for display
        headersJson = { raw: headersRaw };
      } catch {
        // ignore
      }
    }

    // ── Insert into database ──
    const db = createAdminClient();

    // Generate an ID for this email
    const emailId = crypto.randomUUID();
    let threadId = emailId; // Default thread_id to the email's own ID

    // Collect message IDs to check for parent thread: In-Reply-To + all References
    const threadLookupIds: string[] = [];
    if (inReplyTo) threadLookupIds.push(inReplyTo);
    threadLookupIds.push(...references);

    if (threadLookupIds.length > 0) {
      // Find parent's thread_id matching any of these references
      const { data: parent } = await db
        .from("sa_inbox_emails")
        .select("thread_id")
        .in("message_id", threadLookupIds)
        .not("thread_id", "is", null)
        .limit(1)
        .maybeSingle();
        
      if (parent && parent.thread_id) {
        threadId = parent.thread_id;
      }
    }

    const { error: dbError } = await db
      .from("sa_inbox_emails")
      .upsert(
        {
          id: emailId,
          thread_id: threadId,
          message_id: messageId,
          from_email: sender.email,
          from_name: sender.name,
          to_email: recipient.email,
          subject: subject.slice(0, 1000), // cap subject length
          body_text: text,
          body_html: html,
          envelope,
          headers: headersJson,
        },
        { onConflict: "message_id", ignoreDuplicates: true },
      );

    if (dbError) {
      console.error("[sendgrid-inbound-webhook] DB error:", dbError);
      // Still return 200 to prevent SendGrid from retrying on DB errors
      // Log the error for debugging
      return new Response("OK", { status: 200 });
    }

    console.log(
      `[sendgrid-inbound-webhook] Email saved: "${subject}" from ${sender.email}`,
    );

    // SendGrid REQUIRES a 2xx response — otherwise it retries
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[sendgrid-inbound-webhook] Unexpected error:", err);
    // Return 200 even on error to prevent infinite retries from SendGrid
    return new Response("OK", { status: 200 });
  }
});
