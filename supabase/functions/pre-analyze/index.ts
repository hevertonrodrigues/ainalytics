import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import {
  extractFromHtml,
  parseRobotsTxt,
  analyzeSitemap,
  type ExtractedPageData,
} from "../scrape-company/geo-extract.ts";
import {
  computeAlgorithmicFactorScores,
  computeCompositeScore,
  computeTopRecommendations,
} from "../scrape-company/geo-scoring.ts";
import { fetchSafe, fetchWithRedirectChain } from "../scrape-company/fetch-utils.ts";
import { generateAiSuggestions, generateAlgorithmicSuggestions } from "../_shared/suggest-topics.ts";

/**
 * Pre-Analyze Edge Function
 * Quick homepage-only crawl + algorithmic GEO scores.
 * Returns everything synchronously, no DB writes.
 * Used by the onboarding flow to show a GEO preview.
 */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { tenantId, user } = await verifyAuth(req);
    const db = createAdminClient();

    if (req.method !== "POST") {
      return withCors(req, badRequest(`Method ${req.method} not allowed`));
    }

    // Verify tenant membership + role
    const { data: tenantUser, error: tuErr } = await db
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .single();

    if (tuErr || !tenantUser) {
      return withCors(req, badRequest("User not found in tenant."));
    }

    if (tenantUser.role !== "owner" && tenantUser.role !== "admin") {
      return withCors(
        req,
        badRequest("Only owners and admins can perform this action."),
      );
    }

    // Find company belonging to tenant
    const { data: company, error: cErr } = await db
      .from("companies")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    if (cErr || !company) {
      return withCors(req, badRequest("No company linked to this tenant."));
    }

    const body = await req.json().catch(() => ({}));
    const domain = (body.domain || company.domain || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const language = body.language || "en";

    if (!domain) {
      return withCors(req, badRequest("Domain is required."));
    }

    const baseUrl = `https://${domain}`;
    console.log(`[pre-analyze] ▶ Starting quick analysis for ${domain}`);

    // 1. robots.txt
    let robotsTxt: string | null = null;
    const robotsRes = await fetchSafe(`${baseUrl}/robots.txt`);
    if (robotsRes?.ok) {
      robotsTxt = await robotsRes.text();
    }

    // 2. sitemap.xml
    let sitemapXml: string | null = null;
    const sitemapRes = await fetchSafe(`${baseUrl}/sitemap.xml`);
    if (sitemapRes?.ok) {
      sitemapXml = await sitemapRes.text();
    }

    // 3. llms.txt
    let llmsTxt: string | null = null;
    const llmsRes = await fetchSafe(`${baseUrl}/llms.txt`);
    if (llmsRes?.ok) {
      llmsTxt = await llmsRes.text();
    }

    // 4. Homepage crawl
    let homePageData: Record<string, unknown> | null = null;
    try {
      const homeStartTime = Date.now();
      const { response: homeRes, redirect_chain: homeRedirects } = await fetchWithRedirectChain(`${baseUrl}/`, 8000);
      const homeLoadTime = Date.now() - homeStartTime;

      if (homeRes?.ok) {
        const homeHtml = await homeRes.text();
        const extracted = extractFromHtml(homeHtml, `${baseUrl}/`, homeRes.headers);
        homePageData = {
          ...extracted,
          load_time_ms: homeLoadTime,
          ttfb_ms: homeLoadTime,
          status_code: homeRes.status,
          redirect_chain: homeRedirects,
        };
      } else {
        homePageData = {
          url: `${baseUrl}/`,
          status_code: homeRes?.status || 0,
          load_time_ms: 0,
          redirect_chain: [],
          error: homeRes ? `HTTP ${homeRes.status}` : "Timeout or unreachable",
        };
      }
    } catch (_err) {
      homePageData = {
        url: `${baseUrl}/`,
        status_code: 0,
        load_time_ms: 0,
        redirect_chain: [`${baseUrl}/`],
        error: "Scraping error",
      };
    }

    // 5. Compute algorithmic factor scores from homepage data
    const extractedPages: ExtractedPageData[] = homePageData && (homePageData as any).headings
      ? [homePageData as unknown as ExtractedPageData]
      : [];

    const robotsAnalysis = parseRobotsTxt(robotsTxt);
    const sitemapAnalysis = analyzeSitemap(
      sitemapXml,
      robotsAnalysis,
      homePageData ? [(homePageData as any).url] : [],
    );

    const algorithmicScores = computeAlgorithmicFactorScores(
      extractedPages,
      homePageData ? [{ load_time_ms: (homePageData as any).load_time_ms || 500 }] : [],
      robotsAnalysis,
      sitemapAnalysis,
    );

    const compositeResult = computeCompositeScore(algorithmicScores);
    const topRecommendations = computeTopRecommendations(algorithmicScores);

    // 6. Generate suggested topics & prompts using AI (with algorithmic fallback)
    const websiteTitle = (homePageData as any)?.title || domain;
    const metaDescription = (homePageData as any)?.meta_description || "";
    const textContent = (homePageData as any)?.text_content || (homePageData as any)?.body_text || "";
    // Build a content overview from the extracted homepage data
    const extractedOverview = [
      websiteTitle,
      metaDescription,
      textContent,
    ].filter(Boolean).join("\n").slice(0, 8000);

    let suggestedTopics;
    let suggestedPrompts;

    try {
      const aiResult = await generateAiSuggestions({
        websiteTitle,
        metatags: metaDescription,
        extractedContent: extractedOverview || null,
        sitemapXml: sitemapXml,
        language,
      });
      suggestedTopics = aiResult.suggested_topics;
      suggestedPrompts = aiResult.suggested_prompts;
      console.log(`[pre-analyze] ✓ AI topic generation complete: ${suggestedTopics.length} topics`);
    } catch (aiErr) {
      // Fallback to algorithmic suggestions if AI fails
      console.warn(`[pre-analyze] AI topic generation failed, using algorithmic fallback:`, (aiErr as any)?.message);
      const fallback = generateAlgorithmicSuggestions({
        domain,
        websiteTitle,
        categoryScores: compositeResult.category_scores,
      });
      suggestedTopics = fallback.suggested_topics;
      suggestedPrompts = fallback.suggested_prompts;
    }

    console.log(`[pre-analyze] ✓ Quick analysis complete. GEO Score: ${compositeResult.composite}/100, ${suggestedTopics.length} topics generated`);

    return withCors(
      req,
      ok({
        domain,
        website_title: (homePageData as any)?.title || null,
        meta_description: (homePageData as any)?.meta_description || null,
        language: (homePageData as any)?.language || null,
        og_image: (homePageData as any)?.og_image || null,
        robots_txt: !!robotsTxt,
        sitemap_xml: !!sitemapXml,
        llms_txt: !!llmsTxt,
        geo_score: compositeResult.composite,
        readiness_level: compositeResult.readiness_level,
        readiness_label: compositeResult.readiness_label,
        category_scores: compositeResult.category_scores,
        points_to_next_level: compositeResult.points_to_next_level,
        next_level: compositeResult.next_level,
        factor_scores: algorithmicScores,
        top_recommendations: topRecommendations,
        home_page: homePageData,
        suggested_topics: suggestedTopics,
        suggested_prompts: suggestedPrompts,
      }),
    );
  } catch (err) {
    console.error("[pre-analyze]", err);
    return withCors(req, serverError((err as any).message || "Internal server error"));
  }
});
