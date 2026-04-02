import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { runDeepAnalyze } from "../_shared/deep-analyze-core.ts";
import { logAiUsage } from "../_shared/cost-calculator.ts";
import { createRequestLogger } from "../_shared/logger.ts";
import { requireActiveSubscription } from "../_shared/subscription-guard.ts";

/**
 * Deep Analyze Edge Function
 *
 * POST: Submit a URL for deep AI analysis using the shared ai-providers layer.
 * GET:  Retrieve all analyses for the current tenant.
 * GET with ?id=<uuid>: Retrieve a single analysis by ID.
 */

serve(async (req: Request) => {
  const logger = createRequestLogger("deep-analyze", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { tenantId, user } = await verifyAuth(req);
    const authCtx = { tenant_id: tenantId, user_id: user.id };
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
          return logger.done(withCors(req, badRequest("Analysis not found.")), authCtx);
        }
        return logger.done(withCors(req, ok(data)), authCtx);
      }

      // List all analyses for tenant
      const { data, error: dbErr } = await db
        .from("company_ai_analyses")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (dbErr) throw dbErr;
      return logger.done(withCors(req, ok(data || [])), authCtx);
    }

    // ─── POST: Create new analysis ──────────────────────────
    if (req.method === "POST") {
      // Block expired subscriptions from running new analyses
      const guardResponse = await requireActiveSubscription(db, tenantId);
      if (guardResponse) return logger.done(withCors(req, guardResponse), authCtx);

      const body = await req.json().catch(() => ({}));
      // deno-lint-ignore no-explicit-any
      const inputUrl = ((body as any).url || "").trim();
      // deno-lint-ignore no-explicit-any
      const inputLang = ((body as any).language || "en").trim();

      if (!inputUrl) {
        return logger.done(withCors(req, badRequest("URL is required.")), authCtx);
      }

      console.log(`[deep-analyze] ▶ Starting analysis for ${inputUrl} (tenant: ${tenantId})`);

      // Run the shared deep-analyze core
      const result = await runDeepAnalyze(db, inputUrl, inputLang);

      // Log AI usage for cost tracking
      await logAiUsage(db, {
        tenantId,
        userId: user.id,
        callSite: "deep_analyze",
        platformSlug: result.platform_slug,
        modelSlug: result.model_slug,
        promptText: result.prompt_text,
        requestParams: { webSearchEnabled: true, language: inputLang },
        rawRequest: result.raw_request,
        answerText: null,
        annotations: result.annotations,
        sources: result.sources,
        responseParams: { model: result.model_slug },
        rawResponse: result.raw_response,
        tokensInput: result.tokens?.input ?? 0,
        tokensOutput: result.tokens?.output ?? 0,
        latencyMs: result.latency_ms,
        webSearchEnabled: true,
        metadata: { url: inputUrl },
      });

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
      return logger.done(withCors(req, ok(completed)), authCtx);
    }

    return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);

  } catch (err) {
    console.error("[deep-analyze]", err);
    // deno-lint-ignore no-explicit-any
    if ((err as any).status) {
      return logger.done(withCors(req, serverError((err as Error).message)));
    }
    return logger.done(withCors(req, serverError("Internal server error")));
  }
});
