import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * Dashboard Overview Edge Function
 *
 * GET: Aggregates all tenant data into a single response for the dashboard.
 *      No AI calls — pure database aggregation for fast loading.
 */

serve(async (req: Request) => {
  const logger = createRequestLogger("dashboard-overview", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { tenant_id?: string; user_id?: string } = {};
  try {
    const { tenantId, user } = await verifyAuth(req);
    authCtx = { tenant_id: tenantId, user_id: user.id };

    if (req.method !== "GET") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);
    }

    const db = createAdminClient();

    // ── Run all queries in parallel for speed ────────────────
    const [
      companyRes,
      tenantRes,
      topicsRes,
      promptsCountRes,
      activePromptsCountRes,
      answersCountRes,
      sourcesCountRes,
      platformModelsRes,
      sourcesSummaryRes,
      recentPromptsRes,
      recentAnswersRes,
      insightsRes,
      deepAnalysesRes,
    ] = await Promise.all([
      // 1. Company
      db.from("companies")
        .select("id, domain, company_name, industry, country, tags, llm_txt_status, target_language, favicon_url")
        .eq("tenant_id", tenantId)
        .limit(1)
        .maybeSingle(),

      // 2. Tenant + Plan
      db.from("tenants")
        .select("name, main_domain, plan_id, plans:plan_id(name, settings, features)")
        .eq("id", tenantId)
        .single(),

      // 3. Topics
      db.from("topics")
        .select("id, name, is_active")
        .eq("tenant_id", tenantId),

      // 4. Total prompts
      db.from("prompts")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId),

      // 5. Active prompts
      db.from("prompts")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_active", true),

      // 6. Total answers
      db.from("prompt_answers")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("deleted", false),

      // 7. Total sources
      db.from("sources")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId),

      // 8. Active platform models
      db.from("tenant_platform_models")
        .select("platform_id, model_id, platform:platforms(slug, name), model:models(slug, name)")
        .eq("tenant_id", tenantId)
        .eq("is_active", true),

      // 9. Sources summary (RPC)
      db.rpc("get_sources_summary", { p_tenant_id: tenantId }),

      // 10. Recent prompts (last 5)
      db.from("prompts")
        .select("id, text, is_active, topic_id, topics:topic_id(name), created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(5),

      // 11. Recent answers (last 5)
      db.from("prompt_answers")
        .select("id, prompt_id, platform_slug, model:models(slug, name), searched_at, prompts:prompt_id(text)")
        .eq("tenant_id", tenantId)
        .eq("deleted", false)
        .order("searched_at", { ascending: false })
        .limit(5),

      // 12. Latest insights
      db.from("insights_reports")
        .select("overall_health, health_score, summary, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 13. Latest deep analyses
      db.from("company_ai_analyses")
        .select("final_score, generic_score, specific_score, improvements, status, created_at")
        .eq("tenant_id", tenantId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    // ── Fetch GEO analysis (depends on company ID) ──────────
    const company = companyRes.data;
    // deno-lint-ignore no-explicit-any
    const tenant = tenantRes.data as any;

    let geoData = null;
    if (company?.id) {
      const { data: analysis } = await db
        .from("geo_analyses")
        .select("geo_score, readiness_level, pages_crawled, total_pages, ai_report, deep_analyze_score, deep_generic_score, deep_specific_score, deep_metric_scores, status, completed_at")
        .eq("company_id", company.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (analysis) {
        const aiReport = typeof analysis.ai_report === "string"
          ? JSON.parse(analysis.ai_report)
          : analysis.ai_report;
        // deno-lint-ignore no-explicit-any
        const report = aiReport?.en || aiReport?.pt || (Object.values(aiReport || {}) as any[])[0];

        geoData = {
          geo_score: report?.composite_score ?? analysis.geo_score ?? 0,
          readiness_level: report?.readiness_level ?? analysis.readiness_level ?? 0,
          readiness_label: report?.readiness_label ?? null,
          category_scores: report?.category_scores ?? null,
          strengths: (report?.strengths ?? []).slice(0, 3),
          weaknesses: (report?.weaknesses ?? []).slice(0, 3),
          content_quality: report?.content_quality ?? null,
          structured_data_coverage: report?.structured_data_coverage ?? null,
          pages_crawled: analysis.pages_crawled,
          total_pages: analysis.total_pages,
          deep_analyze_score: analysis.deep_analyze_score,
          deep_generic_score: analysis.deep_generic_score,
          deep_specific_score: analysis.deep_specific_score,
          completed_at: analysis.completed_at,
        };
      }
    }

    // ── Build sources ranking ─────────────────────────────────
    const allSources = sourcesSummaryRes.data || [];
    const ownDomain = tenant?.main_domain?.toLowerCase() || "";
    // deno-lint-ignore no-explicit-any
    const ownDomainSource = allSources.find((s: any) => s.domain?.toLowerCase() === ownDomain);
    // deno-lint-ignore no-explicit-any
    const ownDomainRank = allSources.findIndex((s: any) => s.domain?.toLowerCase() === ownDomain) + 1;

    // ── Topics summary ────────────────────────────────────────
    const topics = topicsRes.data || [];

    // ── Recent prompts with answer counts ─────────────────────
    const recentPrompts = (recentPromptsRes.data || []).map((p: {
      id: string;
      text: string;
      is_active: boolean;
      // deno-lint-ignore no-explicit-any
      topics: any;
      created_at: string;
    }) => ({
      id: p.id,
      text: p.text,
      is_active: p.is_active,
      topic_name: p.topics?.name ?? null,
      created_at: p.created_at,
    }));

    // ── Recent answers ────────────────────────────────────────
    const recentAnswers = (recentAnswersRes.data || []).map((a: {
      id: string;
      platform_slug: string;
      // deno-lint-ignore no-explicit-any
      model: any;
      searched_at: string;
      // deno-lint-ignore no-explicit-any
      prompts: any;
    }) => ({
      id: a.id,
      prompt_text: a.prompts?.text ?? "—",
      platform_slug: a.platform_slug,
      model_name: a.model?.name ?? a.model?.slug ?? null,
      searched_at: a.searched_at,
    }));

    // ── Plan info ─────────────────────────────────────────────
    // deno-lint-ignore no-explicit-any
    const plan = (tenant?.plans as any) || null;

    // ── Build response ───────────────────────────────────────
    const data = {
      company: company ? {
        domain: company.domain,
        company_name: company.company_name,
        industry: company.industry,
        country: company.country,
        tags: company.tags,
        llm_txt_status: company.llm_txt_status,
        favicon_url: company.favicon_url,
      } : null,
      tenant_name: tenant?.name || null,
      plan: plan ? {
        name: plan.name,
      } : null,
      geo_analysis: geoData,
      monitoring: {
        total_topics: topics.length,
        active_topics: topics.filter((t: { is_active: boolean }) => t.is_active).length,
        total_prompts: promptsCountRes.count ?? 0,
        active_prompts: activePromptsCountRes.count ?? 0,
        total_answers: answersCountRes.count ?? 0,
        total_sources: sourcesCountRes.count ?? 0,
      },
      platforms: (platformModelsRes.data || []).map((pm: {
        platform?: { slug: string; name: string };
        model?: { slug: string; name: string };
      }) => ({
        platform: pm.platform?.name || pm.platform?.slug,
        platform_slug: pm.platform?.slug,
        model: pm.model?.name || pm.model?.slug,
        model_slug: pm.model?.slug,
      })),
      sources: {
        own_domain: ownDomain || null,
        own_domain_rank: ownDomainRank || null,
        own_domain_total_mentions: ownDomainSource?.total || 0,
        total_sources_tracked: allSources.length,
        // deno-lint-ignore no-explicit-any
        top_competitors: allSources.filter((s: any) => s.domain?.toLowerCase() !== ownDomain).slice(0, 5).map((s: any) => ({
          domain: s.domain,
          mentions: s.total,
        })),
      },
      recent_prompts: recentPrompts,
      recent_answers: recentAnswers,
      insights: insightsRes.data ? {
        overall_health: insightsRes.data.overall_health,
        health_score: insightsRes.data.health_score,
        summary: insightsRes.data.summary,
        created_at: insightsRes.data.created_at,
      } : null,
      deep_analyses: (deepAnalysesRes.data || []).map((da: {
        final_score: number;
        generic_score: number;
        specific_score: number;
        improvements: unknown[];
        created_at: string;
      }) => ({
        final_score: da.final_score,
        generic_score: da.generic_score,
        specific_score: da.specific_score,
        improvements_count: (da.improvements || []).length,
        created_at: da.created_at,
      })),
    };

    return logger.done(withCors(req, ok(data)), authCtx);

  // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[dashboard-overview]", err);
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
