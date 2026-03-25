import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

serve(async (req: Request) => {
  const logger = createRequestLogger("sources-summary", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { tenant_id?: string; user_id?: string } = {};
  try {
    const auth = await verifyAuth(req);
    authCtx = { tenant_id: auth.tenantId, user_id: auth.user.id };

    if (req.method !== "GET") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);
    }

    // ── Parse pagination & search params ────────────────────
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("per_page") || "50", 10)));
    const search = url.searchParams.get("search") || null;

    const db = createAdminClient();

    // ── Call paginated RPC ───────────────────────────────────
    const { data, error } = await db.rpc("get_sources_summary", {
      p_tenant_id: auth.tenantId,
      p_page: page,
      p_per_page: perPage,
      p_search: search,
    });

    if (error) throw error;

    const sources = data || [];

    // Extract metadata from the first row (same for all rows)
    const meta = sources.length > 0
      ? {
          total_count: sources[0].meta_total_count ?? 0,
          total_answers: sources[0].meta_total_answers ?? 0,
          total_prompts: sources[0].meta_total_prompts ?? 0,
          total_platforms: sources[0].meta_total_platforms ?? 0,
        }
      : { total_count: 0, total_answers: 0, total_prompts: 0, total_platforms: 0 };

    const total = meta.total_answers;
    const prompts = meta.total_prompts;
    const totalPlatforms = meta.total_platforms;

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
        id: source.id,
        tenant_id: source.tenant_id,
        domain: source.domain,
        total: sourceTotal,
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

    const totalPages = Math.ceil(meta.total_count / perPage);

    return logger.done(withCors(req, ok({
      items: enriched,
      meta: {
        page,
        per_page: perPage,
        total_count: meta.total_count,
        total_pages: totalPages,
        has_more: page < totalPages,
      },
    })), authCtx);
  } catch (err: unknown) {
    console.error("[sources-summary]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return logger.done(withCors(
        req,
        new Response(
          JSON.stringify({
            success: false,
            error: {
              message: e.message,
              code: e.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
            },
          }),
          {
            status: e.status,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ));
    }
    return logger.done(withCors(req, serverError(e.message || "Internal server error")));
  }
});
