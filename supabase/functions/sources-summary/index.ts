import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const auth = await verifyAuth(req);

    if (req.method !== "GET") {
      return withCors(req, badRequest(`Method ${req.method} not allowed`));
    }

    const db = createAdminClient();

    // Query the materialized view filtered by tenant_id
    // Using service_role to bypass REVOKE restrictions
    const { data, error } = await db.rpc("get_sources_summary", {
      p_tenant_id: auth.tenantId,
    });

    if (error) throw error;

    return withCors(req, ok(data));
  } catch (err) {
    console.error("[sources-summary]", err);
    if (err.status) {
      return withCors(
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
      );
    }
    return withCors(req, serverError(err.message || "Internal server error"));
  }
});
