import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { runDeepAnalyze } from "../_shared/deep-analyze-core.ts";

/**
 * Deep Analyze Edge Function
 *
 * POST: Submit a URL for deep AI analysis using the shared ai-providers layer.
 * GET:  Retrieve all analyses for the current tenant.
 * GET with ?id=<uuid>: Retrieve a single analysis by ID.
 */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { tenantId } = await verifyAuth(req);
    const db = createAdminClient();

    // ─── GET: Fetch analyses ────────────────────────────────
    if (req.method === "GET") {
      const url = new URL(req.url);
      const analysisId = url.searchParams.get("id");

      if (analysisId) {
        const { data, error: dbErr } = await db
          .from("company_ai_analyses")
          .select("*")
          .eq("id", analysisId)
          .eq("tenant_id", tenantId)
          .single();

        if (dbErr || !data) {
          return withCors(req, badRequest("Analysis not found."));
        }
        return withCors(req, ok(data));
      }

      // List all analyses for tenant
      const { data, error: dbErr } = await db
        .from("company_ai_analyses")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (dbErr) throw dbErr;
      return withCors(req, ok(data || []));
    }

    // ─── POST: Create new analysis ──────────────────────────
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      // deno-lint-ignore no-explicit-any
      const inputUrl = ((body as any).url || "").trim();
      // deno-lint-ignore no-explicit-any
      const inputLang = ((body as any).language || "en").trim();

      if (!inputUrl) {
        return withCors(req, badRequest("URL is required."));
      }

      console.log(`[deep-analyze] ▶ Starting analysis for ${inputUrl} (tenant: ${tenantId})`);

      // Run the shared deep-analyze core
      const result = await runDeepAnalyze(inputUrl, inputLang);

      // Save to database
      const insertData = {
        tenant_id: tenantId,
        status: "completed",
        company_name: result.company_name,
        url: result.url,
        analysis_scope: result.analysis_scope,
        final_score: result.final_score,
        generic_score: result.generic_score,
        specific_score: result.specific_score,
        semantic_score: result.metric_scores.semantic ?? null,
        content_score: result.metric_scores.content ?? null,
        authority_score: result.metric_scores.authority ?? null,
        technical_score: result.metric_scores.technical ?? null,
        competitive_position_score: result.metric_scores.competitive_position ?? null,
        reasoning: result.reasoning,
        high_probability_prompts: result.high_probability_prompts,
        improvements: result.improvements,
        confidence: result.confidence,
        raw_response: result.raw_response,
      };

      const { data: completed, error: insertErr } = await db
        .from("company_ai_analyses")
        .insert(insertData)
        .select()
        .single();

      if (insertErr || !completed) {
        console.error("[deep-analyze] Insert error:", insertErr);
        throw new Error("Failed to save analysis results.");
      }

      console.log(`[deep-analyze] ✓ Analysis complete for ${result.url}. Score: ${result.final_score}`);
      return withCors(req, ok(completed));
    }

    return withCors(req, badRequest(`Method ${req.method} not allowed`));

  } catch (err) {
    console.error("[deep-analyze]", err);
    // deno-lint-ignore no-explicit-any
    if ((err as any).status) {
      return withCors(req, serverError((err as Error).message));
    }
    return withCors(req, serverError("Internal server error"));
  }
});
