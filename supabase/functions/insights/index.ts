import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";
import { executePrompt } from "../_shared/ai-providers/index.ts";
import { logAiUsage, resolveModel } from "../_shared/cost-calculator.ts";
import { INSIGHTS_PROMPT, replaceVars } from "../_shared/prompts/load.ts";

/**
 * Insights Edge Function
 *
 * GET:  Retrieve cached insights for the current tenant.
 * POST: Aggregate all tenant data, send to Claude AI, return structured insights.
 */

// ── Language mapping ────────────────────────────────────────
const LANG_MAP: Record<string, string> = {
  "pt-BR": "pt-BR",
  "pt-br": "pt-BR",
  pt: "pt-BR",
  es: "es",
  en: "en",
};

serve(async (req: Request) => {
  const logger = createRequestLogger("insights", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { tenantId, user } = await verifyAuth(req);
    const authCtx = { tenant_id: tenantId, user_id: user.id };
    const db = createAdminClient();

    // ─── GET: Fetch latest cached insights + staleness info ────
    if (req.method === "GET") {
      // Fetch latest insights
      const { data, error: dbErr } = await db
        .from("insights_reports")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbErr) throw dbErr;

      // Fetch plan refresh settings via tenant → plan
      const { data: tenantPlan } = await db
        .from("tenants")
        .select("plan_id, plans:plan_id(prompt_refresh_unit, prompt_refresh_value)")
        .eq("id", tenantId)
        .single();

      // deno-lint-ignore no-explicit-any
      const plan = (tenantPlan?.plans as any) || { prompt_refresh_unit: "month", prompt_refresh_value: 1 };
      const refreshUnit: string = plan.prompt_refresh_unit || "month";
      const refreshValue: number = plan.prompt_refresh_value || 1;

      // Compute staleness
      let isStale = true;
      let nextRefreshAt: string | null = null;

      if (data?.created_at) {
        const createdAt = new Date(data.created_at);
        const now = new Date();
        const nextRefresh = new Date(createdAt);

        switch (refreshUnit) {
          case "day":
            nextRefresh.setDate(nextRefresh.getDate() + refreshValue);
            break;
          case "week":
            nextRefresh.setDate(nextRefresh.getDate() + 7 * refreshValue);
            break;
          case "month":
          default:
            nextRefresh.setMonth(nextRefresh.getMonth() + refreshValue);
            break;
        }

        isStale = now >= nextRefresh;
        nextRefreshAt = nextRefresh.toISOString();
      }

      return logger.done(withCors(req, ok({
        insights: data || null,
        is_stale: isStale,
        next_refresh_at: nextRefreshAt,
      })), authCtx);
    }

    // ─── POST: Generate new insights ─────────────────────────
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      // deno-lint-ignore no-explicit-any
      const inputLang = ((body as any).language || "en").trim();
      const language = LANG_MAP[inputLang] || "en";

      console.log(`[insights] ▶ Generating insights for tenant ${tenantId} (lang: ${language})`);

      // ── Aggregate all tenant data ─────────────────────────
      const accountData = await aggregateTenantData(db, tenantId);

      // ── Build prompt ──────────────────────────────────────
      const prompt = replaceVars(INSIGHTS_PROMPT, {
        LANGUAGE: language,
        ACCOUNT_DATA: JSON.stringify(accountData, null, 2),
      });

      // ── Call Claude AI ────────────────────────────────────
      const insightsModel = await resolveModel(db, "claude-sonnet-4-5-20250929");
      const aiResult = await executePrompt({
        prompt,
        model: insightsModel,
        webSearchEnabled: false,
      });

      if (aiResult.error || !aiResult.text) {
        console.error("[insights] AI error:", aiResult.error);
        throw new Error(aiResult.error || "AI returned empty response.");
      }

      // ── Parse JSON response ───────────────────────────────
      let cleanText = aiResult.text.trim();
      cleanText = cleanText.replace(/^```(?:json)?\n?/gi, "").replace(/\n?```$/g, "");

      // deno-lint-ignore no-explicit-any
      let parsed: any;
      try {
        parsed = JSON.parse(cleanText);
      } catch {
        console.error("[insights] Failed to parse AI JSON:", cleanText.slice(0, 500));
        throw new Error("AI produced invalid JSON output.");
      }

      // ── Save to database ──────────────────────────────────
      const insertData = {
        tenant_id: tenantId,
        overall_health: parsed.overall_health || "good",
        health_score: parsed.health_score != null ? Math.round(parsed.health_score) : null,
        summary: parsed.summary || null,
        checks: parsed.checks || [],
        action_items: parsed.action_items || [],
        highlights: parsed.highlights || [],
        raw_response: aiResult.raw_response ?? null,
      };

      const { error: insertErr } = await db
        .from("insights_reports")
        .insert(insertData);

      if (insertErr) {
        console.error("[insights] Insert error:", JSON.stringify(insertErr, null, 2));
        throw new Error(`Failed to save insights: ${insertErr.message || insertErr.code || "unknown"}`);
      }

      // Log AI usage for cost tracking
      await logAiUsage(db, {
        tenantId,
        userId: user.id,
        callSite: "insights",
        platformSlug: insightsModel.platformSlug,
        modelSlug: insightsModel.slug,
        promptText: prompt,
        requestParams: { webSearchEnabled: false, language },
        rawRequest: aiResult.raw_request,
        answerText: aiResult.text,
        responseParams: { model: aiResult.model },
        rawResponse: aiResult.raw_response,
        error: aiResult.error,
        tokensInput: aiResult.tokens?.input ?? 0,
        tokensOutput: aiResult.tokens?.output ?? 0,
        latencyMs: aiResult.latency_ms,
        webSearchEnabled: false,
      });

      console.log(`[insights] ✓ Insights generated for tenant ${tenantId}. Health: ${parsed.overall_health}, Score: ${parsed.health_score}`);

      // Return the parsed insights data (no need to re-fetch from DB)
      return logger.done(withCors(req, ok({
        ...insertData,
        created_at: new Date().toISOString(),
      })), authCtx);
    }

    return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);

  // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[insights]", err);
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

// ────────────────────────────────────────────────────────────
// Data Aggregation
// ────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function aggregateTenantData(db: any, tenantId: string) {
  // 1. Company info
  const { data: company } = await db
    .from("companies")
    .select("id, domain, company_name, industry, country, tags, llm_txt_status, target_language")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();

  // 2. Tenant info
  const { data: tenant } = await db
    .from("tenants")
    .select("name, main_domain")
    .eq("id", tenantId)
    .single();

  // 3. GEO Analysis (latest completed)
  let geoData = null;
  if (company?.id) {
    const { data: analysis } = await db
      .from("geo_analyses")
      .select("geo_score, readiness_level, pages_crawled, total_pages, ai_report, deep_analyze_score, deep_generic_score, deep_specific_score, deep_metric_scores, deep_improvements, deep_reasoning, deep_confidence, status, completed_at")
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
        category_scores: report?.category_scores ?? null,
        top_recommendations: report?.top_recommendations?.slice(0, 5) ?? [],
        strengths: report?.strengths ?? [],
        weaknesses: report?.weaknesses ?? [],
        content_quality: report?.content_quality ?? null,
        structured_data_coverage: report?.structured_data_coverage ?? null,
        pages_crawled: analysis.pages_crawled,
        deep_analyze_score: analysis.deep_analyze_score,
        deep_metric_scores: analysis.deep_metric_scores,
        deep_improvements: (analysis.deep_improvements || []).slice(0, 5),
      };
    }
  }

  // 4. Prompts & Answers counts
  const [promptsRes, activePromptsRes, answersRes, sourcesRes] = await Promise.all([
    db.from("prompts").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    db.from("prompts").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
    db.from("prompt_answers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("deleted", false),
    db.from("sources").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  // 5. Active platform models
  const { data: platformModels } = await db
    .from("tenant_platform_models")
    .select("platform_id, model_id, platform:platforms(slug, name), model:models(slug, name)")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  // 6. Sources summary (direct view queries — no heavyweight RPC)
  const [mentionCountsRes, allSourcesRes] = await Promise.all([
    db.from("source_mention_counts")
      .select("source_id, mention_count")
      .eq("tenant_id", tenantId)
      .limit(10000),
    db.from("sources")
      .select("id, domain")
      .eq("tenant_id", tenantId)
      .limit(10000),
  ]);

  const sourceIdToDomain = new Map<string, string>();
  for (const s of (allSourcesRes.data || [])) {
    sourceIdToDomain.set(s.id, s.domain);
  }

  // deno-lint-ignore no-explicit-any
  const allSources = (mentionCountsRes.data || [])
    .filter((r: any) => sourceIdToDomain.has(r.source_id))
    .map((r: any) => ({
      domain: sourceIdToDomain.get(r.source_id)!,
      total: r.mention_count || 0,
    }))
    .sort((a: any, b: any) => b.total - a.total);

  const ownDomain = tenant?.main_domain?.toLowerCase() || "";
  // deno-lint-ignore no-explicit-any
  const ownDomainSource = allSources.find((s: any) => s.domain?.toLowerCase() === ownDomain);
  // deno-lint-ignore no-explicit-any
  const ownDomainRank = allSources.findIndex((s: any) => s.domain?.toLowerCase() === ownDomain) + 1;

  // 7. Topics
  const { data: topics } = await db
    .from("topics")
    .select("id, name, is_active")
    .eq("tenant_id", tenantId);

  // 8. Deep Analyze (standalone analyses)
  const { data: deepAnalyses } = await db
    .from("company_ai_analyses")
    .select("final_score, generic_score, specific_score, improvements, high_probability_prompts, status")
    .eq("tenant_id", tenantId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(3);

  // 9. Answer trends (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: recentAnswers } = await db
    .from("prompt_answers")
    .select("searched_at")
    .eq("tenant_id", tenantId)
    .eq("deleted", false)
    .gte("searched_at", thirtyDaysAgo.toISOString());

  const answersByWeek: Record<string, number> = {};
  for (const row of (recentAnswers || [])) {
    const d = new Date(row.searched_at);
    const weekKey = `W${Math.ceil(d.getDate() / 7)}`;
    answersByWeek[weekKey] = (answersByWeek[weekKey] || 0) + 1;
  }

  return {
    company: company ? {
      domain: company.domain,
      company_name: company.company_name,
      industry: company.industry,
      country: company.country,
      tags: company.tags,
      llm_txt_status: company.llm_txt_status,
    } : null,
    tenant_name: tenant?.name || null,
    geo_analysis: geoData,
    monitoring: {
      total_prompts: promptsRes.count ?? 0,
      active_prompts: activePromptsRes.count ?? 0,
      total_answers: answersRes.count ?? 0,
      total_sources: sourcesRes.count ?? 0,
      total_topics: topics?.length ?? 0,
      active_topics: topics?.filter((t: { is_active: boolean }) => t.is_active).length ?? 0,
      answers_by_week: answersByWeek,
    },
    platforms: (platformModels || []).map((pm: { platform?: { slug: string; name: string }; model?: { slug: string; name: string } }) => ({
      platform: pm.platform?.name || pm.platform?.slug,
      model: pm.model?.name || pm.model?.slug,
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
    deep_analyses: (deepAnalyses || []).map((da: { final_score: number; generic_score: number; specific_score: number; improvements: unknown[] }) => ({
      final_score: da.final_score,
      generic_score: da.generic_score,
      specific_score: da.specific_score,
      improvements_count: (da.improvements || []).length,
    })),
  };
}
