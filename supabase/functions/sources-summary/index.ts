import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";
import { fetchAllRows } from "../_shared/paginate.ts";
import {
  mentionRateScore, platformBreadthScore, promptCoverageScore,
  distributionScore, computeCompositeScore,
} from "../_shared/scoring.ts";

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

    // ── Parse params ────────────────────────────────────────
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("per_page") || "50", 10)));
    const search = url.searchParams.get("search")?.trim() || null;

    const db = createAdminClient();
    const tenantId = auth.tenantId;

    // ── 1. Parallel data fetch ──────────────────────────────
    const [answersRes, promptsRes, platformsRes, mentionsData, sourcesData] = await Promise.all([
      // Total non-deleted answers (the denominator for %)
      db.from("prompt_answers")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("deleted", false),

      // Total active prompts
      db.from("prompts")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_active", true),

      // Active platform IDs
      db.from("tenant_platform_models")
        .select("platform_id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true),

      // Mention counts — paginated (Supabase hard-caps at 1000/request)
      fetchAllRows(() =>
        db.from("source_mention_counts")
          .select("source_id, mention_count")
          .eq("tenant_id", tenantId)
      ),

      // Source domains — paginated
      fetchAllRows(() =>
        db.from("sources")
          .select("id, domain")
          .eq("tenant_id", tenantId)
      ),
    ]);

    const totalAnswers = answersRes.count ?? 0;
    const totalPrompts = promptsRes.count ?? 0;
    const totalPlatforms = new Set(
      (platformsRes.data || []).map((p: any) => p.platform_id).filter(Boolean),
    ).size;

    // ── 2. Join sources + mention counts ────────────────────
    const mentionMap = new Map<string, number>();
    for (const m of mentionsData) {
      mentionMap.set(m.source_id, m.mention_count);
    }

    let allSources = sourcesData
      .filter((s: any) => mentionMap.has(s.id))
      .map((s: any) => {
        const mc = mentionMap.get(s.id) || 0;
        return {
          id: s.id,
          domain: s.domain,
          mention_count: mc,
          percent: totalAnswers > 0
            ? Math.round((mc / totalAnswers) * 100 * 100) / 100
            : 0,
        };
      });

    // ── 3. Search filter (in memory) ────────────────────────
    if (search) {
      const lower = search.toLowerCase();
      allSources = allSources.filter((s: any) =>
        s.domain.toLowerCase().includes(lower),
      );
    }

    // ── 4. Sort by % mentions descending ────────────────────
    allSources.sort(
      (a: any, b: any) => b.percent - a.percent || a.domain.localeCompare(b.domain),
    );

    const totalCount = allSources.length;
    const totalPages = Math.ceil(totalCount / perPage);

    // ── 5. Paginate ─────────────────────────────────────────
    const start = (page - 1) * perPage;
    const pageSources = allSources.slice(start, start + perPage);

    if (pageSources.length === 0) {
      return logger.done(withCors(req, ok({
        items: [],
        meta: { page, per_page: perPage, total_count: totalCount, total_pages: totalPages, has_more: false },
      })), authCtx);
    }

    // ── 6. Fetch breakdowns for this page's sources ─────────
    const pageSourceIds = pageSources.map((s: any) => s.id);

    const [promptBkData, platformBkData] = await Promise.all([
      fetchAllRows(() =>
        db.from("source_prompt_counts")
          .select("source_id, prompt_id, prompt_text, cnt")
          .eq("tenant_id", tenantId)
          .in("source_id", pageSourceIds)
      ),

      fetchAllRows(() =>
        db.from("source_platform_counts")
          .select("source_id, platform_id, platform_name, platform_slug, cnt")
          .eq("tenant_id", tenantId)
          .in("source_id", pageSourceIds)
      ),
    ]);

    // Index breakdowns by source_id
    const promptsBySource = new Map<string, any[]>();
    for (const row of promptBkData) {
      if (!promptsBySource.has(row.source_id)) promptsBySource.set(row.source_id, []);
      promptsBySource.get(row.source_id)!.push(row);
    }

    const platformsBySource = new Map<string, any[]>();
    for (const row of platformBkData) {
      if (!platformsBySource.has(row.source_id)) platformsBySource.set(row.source_id, []);
      platformsBySource.get(row.source_id)!.push(row);
    }

    // ── 7. Score + enrich ───────────────────────────────────
    const maxPercent = pageSources.reduce(
      (max: number, s: any) => Math.max(max, s.percent),
      0,
    );

    const enriched = pageSources.map((source: any) => {
      const platforms = platformsBySource.get(source.id) || [];
      const promptsList = promptsBySource.get(source.id) || [];

      const totalCitations = platforms.reduce((s: number, p: any) => s + (p.cnt || 0), 0);

      const platformsWithPct = platforms.map((p: any) => ({
        platform_id: p.platform_id,
        platform_name: p.platform_name,
        platform_slug: p.platform_slug,
        count: p.cnt,
        percent: totalCitations > 0
          ? Math.round((p.cnt / totalCitations) * 100 * 100) / 100
          : 0,
      }));

      const promptsWithPct = promptsList.map((p: any) => ({
        prompt_id: p.prompt_id,
        prompt_text: p.prompt_text,
        count: p.cnt,
        percent: source.mention_count > 0
          ? Math.round((p.cnt / source.mention_count) * 100 * 100) / 100
          : 0,
      }));

      const mention = Math.round(mentionRateScore(source.percent, maxPercent) * 10) / 10;
      const breadth = Math.round(platformBreadthScore(platforms.length, totalPlatforms) * 10) / 10;
      const coverage = Math.round(promptCoverageScore(promptsList.length, totalPrompts) * 10) / 10;
      const distrib = Math.round(distributionScore(platforms) * 10) / 10;

      const score = computeCompositeScore(mention, breadth, coverage, distrib);

      return {
        id: source.id,
        tenant_id: tenantId,
        domain: source.domain,
        total: source.mention_count,
        percent: source.percent,
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

    // ── 8. Return ───────────────────────────────────────────
    return logger.done(withCors(req, ok({
      items: enriched,
      meta: {
        page,
        per_page: perPage,
        total_count: totalCount,
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
