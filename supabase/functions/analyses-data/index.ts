import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

serve(async (req: Request) => {
  const logger = createRequestLogger("analyses-data", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { tenant_id?: string; user_id?: string } = {};
  try {
    const auth = await verifyAuth(req);
    authCtx = { tenant_id: auth.tenantId, user_id: auth.user.id };

    if (req.method !== "GET") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);
    }

    const db = createAdminClient();
    const tenantId = auth.tenantId;

    // ── 1. Base counts ─────────────────────────────────────────
    const [
      promptsRes,
      activePromptsRes,
      answersRes,
      sourcesRes,
      platformModelsRes,
    ] = await Promise.all([
      db.from("prompts")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      db.from("prompts")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_active", true),
      db.from("prompt_answers")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("deleted", false),
      db.from("sources")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      db.from("tenant_platform_models")
        .select("platform_id, model_id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true),
    ]);

    const totalPrompts = promptsRes.count ?? 0;
    const activePrompts = activePromptsRes.count ?? 0;
    const totalAnswers = answersRes.count ?? 0;
    const totalSources = sourcesRes.count ?? 0;

    const uniquePlatforms = new Set(
      (platformModelsRes.data || []).map((r: any) => r.platform_id).filter(Boolean)
    );

    // ── 2. Sources summary (the heart of the dashboard) ───────
    const { data: sourcesSummaryData } = await db.rpc("get_sources_summary", {
      p_tenant_id: tenantId,
    });

    const allSources = sourcesSummaryData || [];
    const totalCitations = allSources.reduce(
      (sum: number, s: any) => sum + (s.total || 0),
      0,
    );

    // Get tenant domain for own-domain detection
    const { data: tenantData } = await db
      .from("tenants")
      .select("main_domain")
      .eq("id", tenantId)
      .single();

    const ownDomainStr = (tenantData?.main_domain || "").toLowerCase();

    // Get platform info for names
    const { data: allPlatforms } = await db
      .from("platforms")
      .select("id, name, slug");

    const platformNameMap = new Map<string, string>();
    const platformSlugMap = new Map<string, string>();
    for (const p of (allPlatforms || [])) {
      platformNameMap.set(p.id, p.name);
      platformNameMap.set(p.slug, p.name);
      platformSlugMap.set(p.id, p.slug);
    }

    // ── Scoring helpers (same as sources-summary) ─────────────
    const maxPercent = allSources.reduce((max: number, s: any) => {
      const pct = totalCitations > 0 ? (s.total || 0) / totalCitations : 0;
      return Math.max(max, pct);
    }, 0);

    function mentionRateScore(sourceTotal: number): number {
      if (totalCitations === 0 || maxPercent === 0) return 0;
      const pct = sourceTotal / totalCitations;
      return Math.min(100, (Math.log(1 + pct) / Math.log(1 + maxPercent)) * 100);
    }

    function platformBreadthScore(platformCount: number): number {
      if (uniquePlatforms.size === 0) return 0;
      return (platformCount / uniquePlatforms.size) * 100;
    }

    function promptCoverageScore(promptCount: number): number {
      if (activePrompts === 0) return 0;
      return (promptCount / activePrompts) * 100;
    }

    function distributionScore(platformCounts: any[]): number {
      if (!platformCounts || platformCounts.length <= 1) return 0;
      const counts = platformCounts.map((p: any) => p.count || 0);
      const tc = counts.reduce((s: number, c: number) => s + c, 0);
      if (tc === 0) return 0;
      let entropy = 0;
      for (const c of counts) {
        if (c > 0) {
          const p = c / tc;
          entropy -= p * Math.log(p);
        }
      }
      const maxE = Math.log(platformCounts.length);
      return maxE > 0 ? (entropy / maxE) * 100 : 0;
    }

    // ── Enrich each source ────────────────────────────────────
    const enriched = allSources.map((source: any) => {
      const sourceTotal = source.total || 0;
      const sourcePercent = totalCitations > 0
        ? Math.round((sourceTotal / totalCitations) * 100 * 100) / 100
        : 0;

      const platforms = source.total_by_platform || [];
      const prompts = source.total_by_prompt || [];

      const mention = Math.round(mentionRateScore(sourceTotal) * 10) / 10;
      const breadth = Math.round(platformBreadthScore(platforms.length) * 10) / 10;
      const coverage = Math.round(promptCoverageScore(prompts.length) * 10) / 10;
      const distrib = Math.round(distributionScore(platforms) * 10) / 10;

      const score = Math.round(
        (mention * 0.35 + breadth * 0.25 + coverage * 0.20 + distrib * 0.20) * 10
      ) / 10;

      // Enrich platform names
      const platformsWithNames = platforms.map((p: any) => ({
        platform_slug: p.platform_slug || platformSlugMap.get(p.platform_id) || p.platform_id,
        platform_name: p.platform_name || platformNameMap.get(p.platform_id) || platformNameMap.get(p.platform_slug) || p.platform_slug,
        count: p.count,
        percent: totalCitations > 0
          ? Math.round((p.count / totalCitations) * 100 * 100) / 100
          : 0,
      }));

      return {
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
        total_by_platform: platformsWithNames,
        total_by_prompt: (prompts || []).map((p: any) => ({
          prompt_id: p.prompt_id,
          prompt_text: p.prompt_text || "",
          count: p.count,
        })),
      };
    });

    enriched.sort((a: any, b: any) => b.score - a.score);

    // ── Own domain data ───────────────────────────────────────
    const ownDomainIdx = ownDomainStr
      ? enriched.findIndex((s: any) => s.domain?.toLowerCase() === ownDomainStr)
      : -1;

    const ownDomain = ownDomainIdx >= 0
      ? {
          ...enriched[ownDomainIdx],
          rank: ownDomainIdx + 1,
          total_sources: enriched.length,
          platforms_mentioning: enriched[ownDomainIdx].total_by_platform.length,
          platforms_total: uniquePlatforms.size,
        }
      : null;

    // Top 10 competitors (excluding own domain)
    const topCompetitors = enriched
      .filter((_: any, i: number) => i !== ownDomainIdx)
      .slice(0, 10);

    // ── 3. Answers timeline (last 30 days) ────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: timelineRaw } = await db
      .from("prompt_answers")
      .select("searched_at")
      .eq("tenant_id", tenantId)
      .eq("deleted", false)
      .gte("searched_at", thirtyDaysAgo.toISOString());

    const dayMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of (timelineRaw || [])) {
      const day = (row.searched_at || "").slice(0, 10);
      if (day && dayMap.has(day)) {
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
    }
    const answersTimeline = Array.from(dayMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    // ── 4. GEO score data ─────────────────────────────────────
    let geo = null;
    try {
      const { data: companyData } = await db
        .from("companies")
        .select("id")
        .eq("tenant_id", tenantId)
        .limit(1)
        .single();

      if (companyData) {
        const { data: analysisData } = await db
          .from("geo_analyses")
          .select("*")
          .eq("company_id", companyData.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (analysisData) {
          const aiReport = typeof analysisData.ai_report === "string"
            ? JSON.parse(analysisData.ai_report)
            : analysisData.ai_report;

          const report = aiReport?.en || aiReport?.pt || Object.values(aiReport || {})[0] as any;

          if (report) {
            geo = {
              composite_score: report.composite_score ?? analysisData.geo_score ?? 0,
              readiness_level: report.readiness_level ?? analysisData.readiness_level ?? 0,
              category_scores: report.category_scores ?? null,
              pages_crawled: analysisData.pages_crawled ?? 0,
            };
          }
        }
      }
    } catch {
      // GEO data is optional
    }

    // ── 5. Source score distribution ───────────────────────────
    const scoreRanges = [
      { range: "0–20", min: 0, max: 20, count: 0 },
      { range: "20–40", min: 20, max: 40, count: 0 },
      { range: "40–60", min: 40, max: 60, count: 0 },
      { range: "60–80", min: 60, max: 80, count: 0 },
      { range: "80–100", min: 80, max: 101, count: 0 },
    ];
    for (const s of enriched) {
      for (const r of scoreRanges) {
        if (s.score >= r.min && s.score < r.max) {
          r.count++;
          break;
        }
      }
    }

    // ── 6. Platform × Source heatmap ──────────────────────────
    const heatmapSources = enriched.slice(0, 5).map((s: any) => ({
      domain: s.domain,
      platforms: Object.fromEntries(
        (s.total_by_platform || []).map((p: any) => [p.platform_slug, p.count])
      ),
    }));

    const heatmapPlatforms = [...uniquePlatforms].map((pid: string) => ({
      platform_slug: platformSlugMap.get(pid) || pid,
      platform_name: platformNameMap.get(pid) || pid,
    }));

    // ── Response ──────────────────────────────────────────────
    const result = {
      overview: {
        total_prompts: totalPrompts,
        active_prompts: activePrompts,
        total_answers: totalAnswers,
        total_sources: totalSources,
        total_citations: totalCitations,
        unique_platforms: uniquePlatforms.size,
      },
      own_domain: ownDomain,
      top_competitors: topCompetitors,
      answers_timeline: answersTimeline,
      geo,
      source_score_distribution: scoreRanges.map((r) => ({
        range: r.range,
        count: r.count,
      })),
      own_domain_score_range: ownDomain
        ? scoreRanges.find((r) => ownDomain.score >= r.min && ownDomain.score < r.max)?.range || null
        : null,
      heatmap: {
        sources: heatmapSources,
        platforms: heatmapPlatforms,
      },
    };

    return logger.done(withCors(req, ok(result)), authCtx);
  } catch (err: any) {
    console.error("[analyses-data]", err);
    if (err.status) {
      return logger.done(withCors(
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
      ));
    }
    return logger.done(withCors(req, serverError(err.message || "Internal server error")));
  }
});
