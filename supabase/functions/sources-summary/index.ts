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
    const { data, error } = await db.rpc("get_sources_summary", {
      p_tenant_id: auth.tenantId,
    });

    if (error) throw error;

    // Get total prompt_answers for this tenant (for percentage calculation)
    const { count: totalAnswers, error: countErr } = await db
      .from("prompt_answers")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", auth.tenantId);

    if (countErr) throw countErr;

    const total = totalAnswers ?? 0;

    // Compute all percentages server-side
    const enriched = (data || []).map((source: any) => {
      const sourceTotal = source.total || 0;
      const sourcePercent = total > 0
        ? Math.round((sourceTotal / total) * 100 * 100) / 100
        : 0;

      const platformsWithPct = (source.total_by_platform || []).map((p: any) => ({
        ...p,
        percent: total > 0
          ? Math.round((p.count / total) * 100 * 100) / 100
          : 0,
      }));

      const promptsWithPct = (source.total_by_prompt || []).map((p: any) => ({
        ...p,
        percent: sourceTotal > 0
          ? Math.round((p.count / sourceTotal) * 100 * 100) / 100
          : 0,
      }));

      return {
        ...source,
        percent: sourcePercent,
        total_by_platform: platformsWithPct,
        total_by_prompt: promptsWithPct,
      };
    });

    return withCors(req, ok(enriched));
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
