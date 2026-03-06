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

    // Get total prompt_answers for this tenant
    const { count: totalAnswers, error: countErr } = await db
      .from("prompt_answers")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", auth.tenantId);

    if (countErr) throw countErr;

    // Get total active prompts for this tenant
    const { count: totalPrompts, error: promptErr } = await db
      .from("prompts")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", auth.tenantId)
      .eq("is_active", true);

    if (promptErr) throw promptErr;

    // Get total unique active platforms for this tenant
    const { data: tenantPlatformModels, error: modelErr } = await db
      .from("tenant_platform_models")
      .select("platform_id")
      .eq("tenant_id", auth.tenantId)
      .eq("is_active", true);

    if (modelErr) throw modelErr;

    const uniquePlatformIds = new Set(
      (tenantPlatformModels || [])
        .map((tpm: any) => tpm.platform_id)
        .filter(Boolean)
    );
    const totalPlatforms = uniquePlatformIds.size;

    const total = totalAnswers ?? 0;
    const prompts = totalPrompts ?? 0;
    const sources = data || [];

    // Pre-compute max mention percent for relative scoring
    const maxPercent = sources.reduce((max: number, s: any) => {
      const pct = total > 0 ? (s.total || 0) / total : 0;
      return Math.max(max, pct);
    }, 0);

    // ── Scoring helpers ──────────────────────────────────────────
    function mentionRateScore(sourceTotal: number): number {
      if (total === 0 || maxPercent === 0) return 0;
      const pct = sourceTotal / total;
      // Log-scaled relative to top source
      return Math.min(100, (Math.log(1 + pct) / Math.log(1 + maxPercent)) * 100);
    }

    function platformBreadthScore(platformCount: number): number {
      if (totalPlatforms === 0) return 0;
      return (platformCount / totalPlatforms) * 100;
    }

    function promptCoverageScore(promptCount: number): number {
      if (prompts === 0) return 0;
      return (promptCount / prompts) * 100;
    }

    function distributionScore(platformCounts: any[]): number {
      if (!platformCounts || platformCounts.length <= 1) return 0;
      const counts = platformCounts.map((p: any) => p.count || 0);
      const totalCounts = counts.reduce((s: number, c: number) => s + c, 0);
      if (totalCounts === 0) return 0;

      // Shannon entropy
      let entropy = 0;
      for (const c of counts) {
        if (c > 0) {
          const p = c / totalCounts;
          entropy -= p * Math.log(p);
        }
      }
      // Normalize by max possible entropy (uniform distribution)
      const maxEntropy = Math.log(platformCounts.length);
      return maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0;
    }

    // ── Weights ──────────────────────────────────────────────────
    const W_MENTION   = 0.35;
    const W_PLATFORM  = 0.25;
    const W_PROMPT    = 0.20;
    const W_DISTRIB   = 0.20;

    // ── Enrich each source ───────────────────────────────────────
    const enriched = sources.map((source: any) => {
      const sourceTotal = source.total || 0;
      const sourcePercent = total > 0
        ? Math.round((sourceTotal / total) * 100 * 100) / 100
        : 0;

      const platforms = source.total_by_platform || [];
      const promptsList = source.total_by_prompt || [];

      const platformsWithPct = platforms.map((p: any) => ({
        ...p,
        percent: total > 0
          ? Math.round((p.count / total) * 100 * 100) / 100
          : 0,
      }));

      const promptsWithPct = promptsList.map((p: any) => ({
        ...p,
        percent: sourceTotal > 0
          ? Math.round((p.count / sourceTotal) * 100 * 100) / 100
          : 0,
      }));

      // Compute component scores
      const mention  = Math.round(mentionRateScore(sourceTotal) * 10) / 10;
      const breadth  = Math.round(platformBreadthScore(platforms.length) * 10) / 10;
      const coverage = Math.round(promptCoverageScore(promptsList.length) * 10) / 10;
      const distrib  = Math.round(distributionScore(platforms) * 10) / 10;

      const score = Math.round(
        (mention * W_MENTION + breadth * W_PLATFORM + coverage * W_PROMPT + distrib * W_DISTRIB) * 10
      ) / 10;

      return {
        ...source,
        percent: sourcePercent,
        score,
        score_breakdown: {
          mention_rate: mention,
          platform_breadth: breadth,
          prompt_coverage: coverage,
          distribution: distrib,
        },
        total_by_platform: platformsWithPct,
        total_by_prompt: promptsWithPct,
      };
    });

    // Sort by score descending
    enriched.sort((a: any, b: any) => b.score - a.score);

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
