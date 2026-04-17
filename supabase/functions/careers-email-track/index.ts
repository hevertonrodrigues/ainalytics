import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createAdminClient } from "../_shared/supabase.ts";

/**
 * careers-email-track — Public, unauthenticated tracking pixel.
 *
 * GET /careers-email-track?id=<application_id>
 *   → Records the first open timestamp on job_applications.last_email_opened_at
 *     and returns a 1x1 transparent GIF with no-cache headers.
 *
 * Deployed with --no-verify-jwt so it is reachable by email clients.
 */

// 43-byte 1x1 transparent GIF
const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0),
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const pixelResponse = () =>
  new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.byteLength),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });

serve(async (req: Request) => {
  // Always return the pixel, regardless of success/failure — never break image rendering
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (id && UUID_RE.test(id)) {
      const db = createAdminClient();
      // Only set the timestamp on the first open so we keep the "opened at" stable
      await db
        .from("job_applications")
        .update({ last_email_opened_at: new Date().toISOString() })
        .eq("id", id)
        .is("last_email_opened_at", null);
    }
  } catch (err) {
    console.error("[careers-email-track] open log error:", err);
  }

  return pixelResponse();
});
