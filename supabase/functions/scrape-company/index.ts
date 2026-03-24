import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { createRequestLogger } from "../_shared/logger.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import {
  extractFromHtml,
  parseRobotsTxt,
  analyzeSitemap,
  type ExtractedPageData,
} from "./geo-extract.ts";
import {
  fetchHeadlessBatch,
  computeSsrRatio,
  computeMobileParity,
} from "./headless-fetch.ts";
import {
  computeAlgorithmicFactorScores,
  computeCompositeScore,
  computeTopRecommendations,
} from "./geo-scoring.ts";
import { SCRAPE_COMPANY_ANALYZE_PROMPT, replaceVars } from "../_shared/prompts/load.ts";
import { executePrompt } from "../_shared/ai-providers/index.ts";
import { runDeepAnalyze } from "../_shared/deep-analyze-core.ts";


// ─── Helpers ────────────────────────────────────────────────

import { fetchSafe, fetchWithRedirectChain, extractLinksFromHtml, selectDiversePages, MAX_PAGES_TO_SCRAPE } from "./fetch-utils.ts";

// extractLinksFromHtml is imported from fetch-utils.ts


function extractUrlsFromSitemap(xml: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>([\s\S]*?)<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url.endsWith(".xml") || url.endsWith(".xml.gz")) continue;
    if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|mp4|mp3)$/i.test(url)) continue;
    urls.push(url);
  }
  return urls;
}

async function updateCompany(
  db: any,
  companyId: string,
  data: Record<string, unknown>,
) {
  const { error } = await db
    .from("companies")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", companyId);
  if (error) console.error("[scrape-company] DB company update error:", error);
}

async function updateAnalysis(
  db: any,
  analysisId: string,
  data: Record<string, unknown>,
) {
  const { error } = await db
    .from("geo_analyses")
    .update(data)
    .eq("id", analysisId);
  if (error) console.error("[scrape-company] DB analysis update error:", error);
}

async function createAnalysis(
  db: any,
  companyId: string,
): Promise<string> {
  const { data, error } = await db
    .from("geo_analyses")
    .insert({ company_id: companyId, status: "pending", progress: 0 })
    .select("id")
    .single();
  if (error) {
    console.error("[scrape-company] Failed to create analysis:", error);
    throw new Error("Failed to create analysis record");
  }
  return data.id;
}

async function getLatestAnalysis(
  db: any,
  companyId: string,
): Promise<any | null> {
  const { data, error } = await db
    .from("geo_analyses")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data;
}

// ─── Main Handler ───────────────────────────────────────────

serve(async (req: Request) => {
  const logger = createRequestLogger("scrape-company", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { tenant_id?: string; user_id?: string } = {};
  try {
    const { tenantId, user } = await verifyAuth(req);
    authCtx = { tenant_id: tenantId, user_id: user.id };
    const db = createAdminClient();

    if (req.method !== "POST") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);
    }

    // Verify tenant membership + role
    const { data: tenantUser, error: tuErr } = await db
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .single();

    if (tuErr || !tenantUser) {
      return logger.done(withCors(req, badRequest("User not found in tenant.")), authCtx);
    }

    if (tenantUser.role !== "owner" && tenantUser.role !== "admin") {
      return logger.done(withCors(
        req,
        badRequest("Only owners and admins can perform this action."),
      ), authCtx);
    }

    // Find company belonging to tenant
    const { data: company, error: cErr } = await db
      .from("companies")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    if (cErr || !company) {
      return logger.done(withCors(req, badRequest("No company linked to this tenant.")), authCtx);
    }

    const body = await req.json().catch(() => ({ action: "scrape" }));
    const { action } = body;

    if (action !== "scrape" && action !== "analyze" && action !== "reset") {
      return logger.done(withCors(
        req,
        badRequest("Invalid action. Must be 'scrape', 'analyze', or 'reset'."),
      ), authCtx);
    }

    const domain = company.domain;

    // ─── ACTION: RESET ────────────────────────────────────
    // Clears all extracted data so analysis can restart from scratch.
    // SA-only access is enforced on the frontend.

    if (action === "reset") {

      // Reset company profile fields
      await updateCompany(db, company.id, {
        website_title: null,
        meta_description: null,
        meta_keywords: null,
        og_image: null,
        favicon_url: null,
        language: null,
        company_name: null,
        industry: null,
        country: null,
        tags: [],
      });

      // Create a fresh analysis record
      await createAnalysis(db, company.id);

      return logger.done(withCors(
        req,
        ok({
          success: true,
          message: "Company data reset successfully. Ready for re-analysis.",
        }),
      ), authCtx);
    }

    // ─── ACTION: SCRAPE ───────────────────────────────────
    // Foreground-only: homepage + URL discovery.
    // Background crawling of remaining pages is handled by crawl-pages cron.

    if (action === "scrape") {
      const t0 = Date.now();
      console.log(`[scrape] ▶ Starting foreground scrape for ${domain}`);

      // Create or reuse a pending analysis record
      const analysis = await getLatestAnalysis(db, company.id);
      
      // Enforce 7-day cooldown for non-admins if an analysis exists and is completed
      if (analysis && analysis.status === 'completed' && analysis.completed_at) {
        // Query the profile to check for system administrator access
        const { data: profile } = await db
          .from("profiles")
          .select("is_sa")
          .eq("id", user.id)
          .single();
          
        const isSuperadmin = profile?.is_sa === true;
        const msSinceAnalysis = Date.now() - new Date(analysis.completed_at).getTime();
        const daysSinceAnalysis = msSinceAnalysis / (1000 * 60 * 60 * 24);
        
        if (daysSinceAnalysis < 7 && !isSuperadmin) {
          return logger.done(withCors(
            req,
            badRequest("Please wait at least 7 days between analyses.")
          ), authCtx);
        }
      }

      let analysisId: string;
      if (!analysis || analysis.status === 'completed' || analysis.status === 'error') {
        analysisId = await createAnalysis(db, company.id);
        console.log(`[scrape] Created new analysis record: ${analysisId}`);
      } else {
        analysisId = analysis.id;
        console.log(`[scrape] Reusing analysis record: ${analysisId}`);
      }

      // NOTE: Do NOT set status to 'scraping' yet!
      // The cron worker (crawl-pages) watches for status='scraping'.
      // If we set it now, the cron may fire before pages are inserted
      // and finalize with 0 pages. We keep status='pending' during
      // the discovery phase and only switch to 'scraping' after pages
      // are saved to the database.
      await updateAnalysis(db, analysisId, {
        progress: 2,
        error_message: null,
        status_message: JSON.stringify({ key: "company.msg.starting", params: { domain } }),
      });

      const baseUrl = `https://${domain}`;

      // ── Step 1: robots.txt ─────────────────────────────
      console.log(`[scrape] Step 1: Fetching robots.txt…`);
      await updateAnalysis(db, analysisId, {
        progress: 3,
        status_message: JSON.stringify({ key: "company.msg.checkingRobots" }),
      });
      let robotsTxt: string | null = null;
      const robotsRes = await fetchSafe(`${baseUrl}/robots.txt`);
      if (robotsRes?.ok) {
        robotsTxt = await robotsRes.text();
        console.log(`[scrape] robots.txt found (${robotsTxt.length} bytes)`);
      } else {
        console.log(`[scrape] robots.txt not found`);
      }
      await updateAnalysis(db, analysisId, {
        robots_txt: robotsTxt,
        progress: 5,
        status_message: robotsTxt
          ? JSON.stringify({ key: "company.msg.robotsFound" })
          : JSON.stringify({ key: "company.msg.robotsMissing" }),
      });

      // ── Step 2: sitemap.xml ────────────────────────────
      console.log(`[scrape] Step 2: Fetching sitemap.xml…`);
      await updateAnalysis(db, analysisId, {
        progress: 6,
        status_message: JSON.stringify({ key: "company.msg.lookingSitemap" }),
      });
      let sitemapXml: string | null = null;
      const sitemapRes = await fetchSafe(`${baseUrl}/sitemap.xml`);
      if (sitemapRes?.ok) {
        sitemapXml = await sitemapRes.text();
        console.log(`[scrape] sitemap.xml found (${sitemapXml.length} bytes)`);
      } else {
        console.log(`[scrape] sitemap.xml not found`);
      }
      await updateAnalysis(db, analysisId, {
        sitemap_xml: sitemapXml,
        progress: 8,
        status_message: sitemapXml
          ? JSON.stringify({ key: "company.msg.sitemapFound" })
          : JSON.stringify({ key: "company.msg.sitemapMissing" }),
      });

      // ── Step 3: llms.txt ───────────────────────────────
      console.log(`[scrape] Step 3: Fetching llms.txt…`);
      let llmsTxt: string | null = null;
      const llmsRes = await fetchSafe(`${baseUrl}/llms.txt`);
      if (llmsRes?.ok) {
        llmsTxt = await llmsRes.text();
        console.log(`[scrape] llms.txt found (${llmsTxt.length} bytes)`);
      }
      await updateAnalysis(db, analysisId, {
        llms_txt: llmsTxt,
        progress: 10,
        status_message: llmsTxt
          ? JSON.stringify({ key: "company.msg.llmsTxtFound" })
          : JSON.stringify({ key: "company.msg.llmsTxtMissing" }),
      });

      // ── Step 4: Homepage crawl + URL discovery ─────────
      console.log(`[scrape] Step 4: Crawling homepage for URL discovery…`);
      await updateAnalysis(db, analysisId, {
        progress: 12,
        status_message: JSON.stringify({ key: "company.msg.analyzingHomepage" }),
      });

      let pageUrls: string[] = [];
      // Start with sitemap URLs — capped at MAX_PAGES_TO_SCRAPE
      if (sitemapXml) {
        const allSitemapUrls = extractUrlsFromSitemap(sitemapXml);
        pageUrls = selectDiversePages(allSitemapUrls, MAX_PAGES_TO_SCRAPE);
        // Log group distribution for debugging
        const groups = new Map<string, number>();
        for (const u of pageUrls) {
          try {
            const segs = new URL(u).pathname.split("/").filter(Boolean);
            const g = segs.length > 0 ? segs[0] : "_root";
            groups.set(g, (groups.get(g) || 0) + 1);
          } catch { /* skip */ }
        }
        const distrib = Array.from(groups.entries()).map(([k, v]) => `${k}:${v}`).join(", ");
        console.log(`[scrape] Extracted ${allSitemapUrls.length} URLs from sitemap, selected ${pageUrls.length} diverse pages (${distrib})`);
      }
      // Ensure homepage is first
      if (
        !pageUrls.includes(baseUrl) &&
        !pageUrls.includes(`${baseUrl}/`)
      ) {
        pageUrls.unshift(`${baseUrl}/`);
      }

      // Crawl homepage directly to extract links
      let homePageData: Record<string, unknown> | null = null;
      let homeHtml: string | null = null;
      try {
        const homeStartTime = Date.now();
        const { response: homeRes, redirect_chain: homeRedirects } = await fetchWithRedirectChain(`${baseUrl}/`, 8000);
        const homeLoadTime = Date.now() - homeStartTime;
        console.log(`[scrape] Homepage direct fetch: ${homeLoadTime}ms, status=${homeRes?.status || 'timeout'}`);

        if (homeRes?.ok) {
          homeHtml = await homeRes.text();
          const extracted = extractFromHtml(homeHtml, `${baseUrl}/`, homeRes.headers);

          // Save company profile from homepage
          await updateCompany(db, company.id, {
            website_title: extracted.title,
            meta_description: extracted.meta_description,
            meta_keywords: extracted.meta_keywords,
            og_image: extracted.og_image,
            favicon_url: null,
            language: extracted.language,
          });

          homePageData = {
            ...extracted,
            load_time_ms: homeLoadTime,
            ttfb_ms: homeLoadTime,
            status_code: homeRes.status,
            redirect_chain: homeRedirects,
          };

          // Discover links from homepage (capped at MAX_PAGES_TO_SCRAPE total)
          const discoveredLinks = extractLinksFromHtml(homeHtml, baseUrl);
          console.log(`[scrape] Discovered ${discoveredLinks.length} links from homepage`);
          const existing = new Set(pageUrls.map(u => u.replace(/\/$/, "")));
          for (const link of discoveredLinks) {
            if (pageUrls.length >= MAX_PAGES_TO_SCRAPE) break;
            const clean = link.replace(/\/$/, "");
            if (!existing.has(clean)) {
              pageUrls.push(link);
              existing.add(clean);
            }
          }
        } else {
          homePageData = {
            url: `${baseUrl}/`,
            status_code: homeRes?.status || 0,
            load_time_ms: homeLoadTime,
            redirect_chain: homeRedirects,
            error: homeRes ? `HTTP ${homeRes.status}` : "Timeout or unreachable",
          };
        }
      } catch (err) {
        console.warn(`[scrape] Homepage fetch failed:`, (err as Error).message);
        homePageData = {
          url: `${baseUrl}/`,
          status_code: 0,
          load_time_ms: 0,
          redirect_chain: [`${baseUrl}/`],
          error: "Scraping error",
        };
      }

      // Also try homepage via Browserless for link discovery + SSR comparison
      const browserlessKey = Deno.env.get("BROWSERLESS_API_KEY");
      if (browserlessKey && homeHtml) {
        console.log(`[scrape] Fetching homepage via Browserless for SSR comparison…`);
        try {
          const headlessResults = await fetchHeadlessBatch([`${baseUrl}/`], browserlessKey, 1);
          const hr = headlessResults.get(`${baseUrl}/`);
          if (hr?.desktop_html) {
            const rawTextLen = homeHtml.length;
            const ssrRatio = computeSsrRatio(homeHtml, hr.desktop_html);
            const mobileParity = computeMobileParity(hr.desktop_text_length, hr.mobile_text_length);
            (homePageData as any).headless = {
              ssr_ratio: ssrRatio,
              mobile_parity: mobileParity,
              rendered_text_length: hr.desktop_text_length,
              raw_text_length: rawTextLen,
              mobile_text_length: hr.mobile_text_length,
            };
            console.log(`[scrape] Homepage SSR ratio: ${ssrRatio.toFixed(2)}`);

            // Discover links from rendered HTML too
            const renderedLinks = extractLinksFromHtml(hr.desktop_html, baseUrl);
            console.log(`[scrape] Discovered ${renderedLinks.length} links from rendered homepage`);
            const existingSet = new Set(pageUrls.map(u => u.replace(/\/$/, "")));
            for (const link of renderedLinks) {
              if (pageUrls.length >= MAX_PAGES_TO_SCRAPE) break;
              const clean = link.replace(/\/$/, "");
              if (!existingSet.has(clean)) {
                pageUrls.push(link);
                existingSet.add(clean);
              }
            }
          }
        } catch (err) {
          console.warn(`[scrape] Browserless homepage failed (non-fatal):`, (err as Error).message);
        }
      }

      // Final cap — ensure we never exceed MAX_PAGES_TO_SCRAPE
      pageUrls = pageUrls.slice(0, MAX_PAGES_TO_SCRAPE);
      const totalPages = pageUrls.length;
      console.log(`[scrape] Total pages to scrape: ${totalPages} (max ${MAX_PAGES_TO_SCRAPE})`);

      // ── Step 6: Insert all URLs into geo_analyses_pages ──
      console.log(`[scrape] Step 6: Saving ${totalPages} page URLs to database…`);
      await updateAnalysis(db, analysisId, {
        progress: 14,
        status_message: JSON.stringify({ key: "company.msg.discoveredPages", params: { count: totalPages } }),
      });

      // Insert homepage as completed (page_order = 0)
      await db.from("geo_analyses_pages").insert({
        analysis_id: analysisId,
        url: pageUrls[0],
        status: "completed",
        page_order: 0,
        status_code: (homePageData as any)?.status_code || 0,
        load_time_ms: (homePageData as any)?.load_time_ms || 0,
        redirect_chain: (homePageData as any)?.redirect_chain || [pageUrls[0]],
        page_data: homePageData,
        headless_data: (homePageData as any)?.headless || null,
        error_message: (homePageData as any)?.error || null,
        crawled_at: new Date().toISOString(),
      });

      // Insert remaining URLs as pending
      if (pageUrls.length > 1) {
        const pendingRows = pageUrls.slice(1).map((url, idx) => ({
          analysis_id: analysisId,
          url,
          status: "pending",
          page_order: idx + 1,
        }));
        const batchSize = 50;
        for (let i = 0; i < pendingRows.length; i += batchSize) {
          const batch = pendingRows.slice(i, i + batchSize);
          const { error: insertErr } = await db.from("geo_analyses_pages").insert(batch);
          if (insertErr) console.error(`[scrape] Error inserting page batch:`, insertErr);
        }
      }

      // ── Step 7: Update analysis and return fast ────────
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[scrape] ✓ Foreground scrape complete in ${elapsed}s. ${totalPages} pages queued.`);

      // NOW set status to 'scraping' — pages are safely in the DB
      await updateAnalysis(db, analysisId, {
        status: "scraping",
        crawled_pages: homePageData ? [homePageData] : [],
        pages_crawled: 1,
        total_pages: totalPages,
        progress: 15,
        status_message: totalPages > 1
          ? JSON.stringify({ key: "company.msg.homepageAnalyzed", params: { count: totalPages - 1 } })
          : JSON.stringify({ key: "company.msg.homepageOnlyDone" }),
      });

      // If only homepage, go straight to scraping_done
      if (totalPages <= 1) {
        await updateAnalysis(db, analysisId, {
          status: "scraping_done",
          progress: 48,
          status_message: JSON.stringify({ key: "company.msg.homepageOnlyDone" }),
        });
      }

      return logger.done(withCors(
        req,
        ok({
          success: true,
          message: `Homepage analyzed. ${totalPages - 1} pages queued for background crawling.`,
          data: { total_pages: totalPages, pages_scraped: 1 },
        }),
      ), authCtx);
    }

    // ─── ACTION: ANALYZE ──────────────────────────────────

    if (action === "analyze") {
      // Find the latest analysis record
      const analysis = await getLatestAnalysis(db, company.id);
      if (!analysis) {
        return logger.done(withCors(req, badRequest("No analysis record found. Run 'scrape' first.")), authCtx);
      }

      // Allow retry from 'error' or stale 'analyzing' (edge function timeout)
      if (
        analysis.status !== "scraping_done" &&
        analysis.status !== "error" &&
        analysis.status !== "analyzing"
      ) {
        return logger.done(withCors(
          req,
          badRequest(
            "Analysis must be in 'scraping_done' or 'error' status to analyze.",
          ),
        ), authCtx);
      }

      const analysisId = analysis.id;

      // ── Safety check: verify all pages are done before analyzing ──
      // Prevents incomplete analysis when crawl-pages hasn't finished yet
      const { data: crawlProgress } = await db.rpc("get_crawl_progress", { p_analysis_id: analysisId });
      if (crawlProgress && crawlProgress.length > 0) {
        const cp = crawlProgress[0];
        if (cp.pending > 0) {
          console.warn(`[analyze] Analysis ${analysisId}: ${cp.pending} pages still pending/crawling. Rejecting analyze request.`);
          return logger.done(withCors(
            req,
            badRequest(`Pages are still being crawled (${cp.pending} remaining). Please wait for all pages to complete.`),
          ), authCtx);
        }
      }

      await updateAnalysis(db, analysisId, {
        status: "analyzing",
        progress: 50,
        error_message: null,
        status_message: JSON.stringify({ key: "company.msg.computingFactors" }),
      });
      console.log(`[analyze] ▶ Starting AI analysis for ${domain}`);
      // 1. Compute algorithmic factor scores for all 25 GEO factors

      const pagesData = Array.isArray(analysis.crawled_pages) ? analysis.crawled_pages : [];
      const extractedPages: ExtractedPageData[] = pagesData
        .filter((p: any) => !p.error && p.headings)
        .map((p: any) => p as ExtractedPageData);

      const robotsAnalysis = parseRobotsTxt(analysis.robots_txt);
      const sitemapAnalysis = analyzeSitemap(
        analysis.sitemap_xml,
        robotsAnalysis,
        pagesData.map((p: any) => p.url),
      );

      const algorithmicScores = computeAlgorithmicFactorScores(
        extractedPages,
        pagesData.map((p: any) => ({
          load_time_ms: p.load_time_ms || 500,
        })),
        robotsAnalysis,
        sitemapAnalysis,
      );

      await updateAnalysis(db, analysisId, {
        progress: 58,
        status_message: JSON.stringify({ key: "company.msg.factorsComputed", params: { count: algorithmicScores.length } }),
      });
      console.log(`[analyze] Computed ${algorithmicScores.length} algorithmic factor scores`);

      // 2. Build AI prompt for content-quality factors + business intelligence
      const targetLang = company.target_language || "en";
      const langNames: Record<string, string> = {
        en: "English", pt: "Portuguese", es: "Spanish", fr: "French",
        de: "German", it: "Italian", nl: "Dutch", pl: "Polish",
        ru: "Russian", ja: "Japanese", ko: "Korean", zh: "Chinese",
        ar: "Arabic", hi: "Hindi", tr: "Turkish", sv: "Swedish",
        da: "Danish", no: "Norwegian", fi: "Finnish",
      };
      const targetLangName = langNames[targetLang] || targetLang;

      const pagesContext = pagesData
        .slice(0, 10)
        .map((p: any) => {
          return `URL: ${p.url}\nTitle: ${p.title || "N/A"}\nH1: ${p.h1 || "N/A"}\nMeta: ${p.meta_description || "N/A"}\nContent: ${(p.content_summary || "").slice(0, 1000)}\nWord Count: ${p.word_count || 0}\nStructured Data: ${p.has_structured_data ? "Yes" : "No"}`;
        })
        .join("\n---\n");

      // Pre-computed scores summary for AI context
      const algoSummary = algorithmicScores
        .map(
          (f) =>
            `${f.name}: ${f.score}/100 (${f.status})`,
        )
        .join("\n");

      const bilingualBlock =
        targetLang === "en"
          ? `All text fields must be in English. Output format: { "en": { <full response> } }`
          : `Output in TWO languages. ALL text fields (summary, strengths, weaknesses) must be fully translated.\nOutput format: { "en": { <response in English> }, "${targetLang}": { <response in ${targetLangName}> } }`;

      const prompt = replaceVars(SCRAPE_COMPANY_ANALYZE_PROMPT, {
        DOMAIN: company.domain,
        WEBSITE_TITLE: company.website_title || "N/A",
        META_DESCRIPTION: company.meta_description || "N/A",
        LANGUAGE: company.language || "N/A",
        ROBOTS_STATUS: analysis.robots_txt ? "Present" : "Not found",
        BOT_STATUS: JSON.stringify(robotsAnalysis.bot_status, null, 2),
        SITEMAP_STATUS: analysis.sitemap_xml ? "Present" : "Not found",
        ALGO_SUMMARY: algoSummary,
        PAGES_COUNT: String(pagesData.length),
        PAGES_CONTEXT: pagesContext,
        BOT_STATUS_JSON: JSON.stringify(robotsAnalysis.bot_status),
        SCHEMA_TYPES_JSON: JSON.stringify([...new Set(extractedPages.flatMap((p) => p.schema.detected_types))]),
        BILINGUAL_BLOCK: bilingualBlock,
      });

      await updateAnalysis(db, analysisId, {
        progress: 62,
        status_message: JSON.stringify({ key: "company.msg.sendingToAi" }),
      });
      console.log(`[analyze] Sending prompt via ai-providers (anthropic)…`);

      try {
        const aiResult = await executePrompt("anthropic", {
          prompt,
          model: "claude-sonnet-4-20250514",
          webSearchEnabled: false,
        });

        if (aiResult.error || !aiResult.text) {
          console.error("[scrape-company] AI error:", aiResult.error);
          await updateAnalysis(db, analysisId, {
            status: "error",
            error_message: "AI analysis failed",
          });
          return logger.done(withCors(req, serverError(aiResult.error || "AI analysis failed.")), authCtx);
        }

        const assistantMsg = aiResult.text;

        await updateAnalysis(db, analysisId, {
          progress: 78,
          status_message: JSON.stringify({ key: "company.msg.aiResponseReceived" }),
        });
        console.log(`[analyze] AI response received, parsing…`);

        let bilingualReport: any;
        try {
          bilingualReport = JSON.parse(assistantMsg.trim());
        } catch {
          const jsonMatch = assistantMsg.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            bilingualReport = JSON.parse(jsonMatch[0]);
          } else {
            await updateAnalysis(db, analysisId, {
              status: "error",
              error_message: "AI produced invalid JSON",
            });
            return logger.done(withCors(
              req,
              serverError("AI produced invalid JSON output."),
            ), authCtx);
          }
        }

        // Extract English report
        const enReport = bilingualReport.en || bilingualReport;
        if (!bilingualReport.en) {
          bilingualReport = { en: bilingualReport };
          if (targetLang !== "en") {
            bilingualReport[targetLang] = bilingualReport.en;
          }
        }

        await updateAnalysis(db, analysisId, {
          progress: 85,
          status_message: JSON.stringify({ key: "company.msg.computingScore" }),
        });

        // 4. All 25 factor scores are algorithmically computed
        const allFactorScores = algorithmicScores;

        const compositeResult = computeCompositeScore(allFactorScores);
        const topRecommendations =
          computeTopRecommendations(allFactorScores);

        // ─── 5. Run Deep Analyze ────────────────────────────
        await updateAnalysis(db, analysisId, {
          progress: 88,
          status_message: JSON.stringify({ key: "company.msg.deepAnalyze" }),
        });
        console.log(`[analyze] Running deep-analyze for ${domain}…`);

        let deepResult: Awaited<ReturnType<typeof runDeepAnalyze>> | null = null;
        let deepAnalyzeId: string | null = null;
        try {
          deepResult = await runDeepAnalyze(
            `https://${domain}`,
            targetLang,
          );
          console.log(`[analyze] Deep-analyze complete. Score: ${deepResult.final_score}`);

          // Save to company_ai_analyses table and get the ID
          const { data: deepRow, error: deepInsErr } = await db
            .from("company_ai_analyses")
            .insert({
              tenant_id: tenantId,
              status: "completed",
              company_name: deepResult.company_name,
              url: deepResult.url,
              analysis_scope: deepResult.analysis_scope,
              final_score: deepResult.final_score,
              generic_score: deepResult.generic_score,
              specific_score: deepResult.specific_score,
              semantic_score: deepResult.metric_scores.semantic ?? null,
              content_score: deepResult.metric_scores.content ?? null,
              authority_score: deepResult.metric_scores.authority ?? null,
              technical_score: deepResult.metric_scores.technical ?? null,
              competitive_position_score: deepResult.metric_scores.competitive_position ?? null,
              reasoning: deepResult.reasoning,
              high_probability_prompts: deepResult.high_probability_prompts,
              improvements: deepResult.improvements,
              confidence: deepResult.confidence,
              raw_response: deepResult.raw_response,
            })
            .select("id")
            .single();
          if (!deepInsErr && deepRow) {
            deepAnalyzeId = deepRow.id;
          }
        } catch (deepErr: any) {
          console.warn(`[analyze] Deep-analyze failed (non-fatal):`, deepErr?.message || deepErr);
        }

        // ─── 6. Merge Scores ────────────────────────────────
        let mergedGeoScore = compositeResult.composite;
        let mergedCategoryScores = { ...compositeResult.category_scores };

        if (deepResult && deepResult.final_score != null) {
          // GEO = (geo_composite + final + generic + specific) / 4
          mergedGeoScore = Math.round(
            ((compositeResult.composite +
              (deepResult.final_score ?? 0) +
              (deepResult.generic_score ?? 0) +
              (deepResult.specific_score ?? 0)) / 4) * 10
          ) / 10;

          // Category averages: avg GEO category with matching deep metric
          const dm = deepResult.metric_scores;
          if (dm.semantic != null) {
            mergedCategoryScores.semantic = Math.round(((mergedCategoryScores.semantic || 0) + dm.semantic) / 2 * 10) / 10;
          }
          if (dm.content != null) {
            mergedCategoryScores.content = Math.round(((mergedCategoryScores.content || 0) + dm.content) / 2 * 10) / 10;
          }
          if (dm.authority != null) {
            mergedCategoryScores.authority = Math.round(((mergedCategoryScores.authority || 0) + dm.authority) / 2 * 10) / 10;
          }
          if (dm.technical != null) {
            mergedCategoryScores.technical = Math.round(((mergedCategoryScores.technical || 0) + dm.technical) / 2 * 10) / 10;
          }
          if (dm.competitive_position != null) {
            (mergedCategoryScores as any).competitive_position = dm.competitive_position;
          }
        }

        // ─── 7. Inject factor scores into bilingual report ──
        for (const lang of Object.keys(bilingualReport)) {
          if (bilingualReport[lang]) {
            bilingualReport[lang].geo_score = mergedGeoScore;
            bilingualReport[lang].factor_scores = allFactorScores;
            bilingualReport[lang].composite_score = mergedGeoScore;
            bilingualReport[lang].readiness_level =
              compositeResult.readiness_level;
            bilingualReport[lang].readiness_label =
              compositeResult.readiness_label;
            bilingualReport[lang].category_scores = mergedCategoryScores;
            bilingualReport[lang].points_to_next_level =
              compositeResult.points_to_next_level;
            bilingualReport[lang].next_level =
              compositeResult.next_level;
            bilingualReport[lang].top_recommendations =
              topRecommendations;
          }
        }

        await updateAnalysis(db, analysisId, {
          progress: 95,
          status_message: JSON.stringify({ key: "company.msg.finalizingReport" }),
        });

        // ─── 8. Save analysis results ───────────────────────
        const saveData: Record<string, unknown> = {
          ai_report: bilingualReport,
          geo_score: mergedGeoScore,
          readiness_level: compositeResult.readiness_level,
          status: "completed",
          progress: 100,
          completed_at: new Date().toISOString(),
          status_message: JSON.stringify({ key: "company.msg.analysisComplete", params: { score: mergedGeoScore } }),
        };

        // Store deep-analyze results in geo_analyses
        if (deepResult) {
          saveData.deep_analyze_id = deepAnalyzeId;
          saveData.deep_analyze_score = deepResult.final_score;
          saveData.deep_generic_score = deepResult.generic_score;
          saveData.deep_specific_score = deepResult.specific_score;
          saveData.deep_metric_scores = deepResult.metric_scores;
          saveData.deep_improvements = deepResult.improvements;
          saveData.deep_prompts = deepResult.high_probability_prompts;
          saveData.deep_analyzed_pages = deepResult.analysis_scope?.relevant_pages_used || [];
          saveData.deep_reasoning = deepResult.reasoning;
          saveData.deep_confidence = deepResult.confidence;
        }

        await updateAnalysis(db, analysisId, saveData);
        console.log(`[analyze] ✓ Analysis complete. Merged GEO Score: ${mergedGeoScore}/100`);

        // Auto-fill LLM columns from analyzed data (no extra API calls)
        if (company.domain && !company.llm_txt) {
          try {
            console.log(`[analyze] Building LLM data from analysis results for ${company.domain}...`);

            // Build metatags from company metadata
            const metaParts: string[] = [];
            if (company.meta_description) metaParts.push(`Description: ${company.meta_description}`);
            if (company.meta_keywords) metaParts.push(`Keywords: ${company.meta_keywords}`);
            if (enReport.tags?.length) metaParts.push(`Tags: ${enReport.tags.join(', ')}`);
            if (enReport.categories?.length) metaParts.push(`Categories: ${enReport.categories.join(', ')}`);
            const metatags = metaParts.join('\n') || null;

            // Build extracted_content from AI report + page summaries
            const contentParts: string[] = [];
            if (enReport.summary) contentParts.push(enReport.summary);
            if (enReport.products_services?.length) {
              const psList = enReport.products_services
                .map((ps: any) => `- ${ps.name}: ${ps.description} (${ps.type})`)
                .join('\n');
              contentParts.push(`\nProducts & Services:\n${psList}`);
            }
            if (enReport.strengths?.length) {
              contentParts.push(`\nStrengths: ${enReport.strengths.join(', ')}`);
            }
            // Add top page content summaries
            const pageSummaries = pagesData
              .filter((p: any) => p.content_summary && !p.error)
              .slice(0, 10)
              .map((p: any) => `- ${p.title || p.url}: ${p.content_summary}`)
              .join('\n');
            if (pageSummaries) contentParts.push(`\nKey Pages:\n${pageSummaries}`);
            const extracted_content = contentParts.join('\n') || null;

            // Build llms.txt markdown from all available data
            const llmParts: string[] = [];
            llmParts.push(`# ${enReport.company_name || company.website_title || company.domain}`);
            llmParts.push('');
            if (enReport.summary) {
              llmParts.push(`> ${enReport.summary}`);
              llmParts.push('');
            }
            llmParts.push(`- **Website**: https://${company.domain}`);
            if (enReport.industry) llmParts.push(`- **Industry**: ${enReport.industry}`);
            if (enReport.country) llmParts.push(`- **Country**: ${enReport.country}`);
            if (enReport.market) llmParts.push(`- **Market**: ${enReport.market}`);
            llmParts.push('');

            if (enReport.products_services?.length) {
              llmParts.push('## Products & Services');
              llmParts.push('');
              for (const ps of enReport.products_services) {
                llmParts.push(`### ${ps.name}`);
                llmParts.push(`${ps.description}`);
                llmParts.push('');
              }
            }

            if (enReport.strengths?.length) {
              llmParts.push('## Strengths');
              llmParts.push('');
              for (const s of enReport.strengths) llmParts.push(`- ${s}`);
              llmParts.push('');
            }

            if (enReport.categories?.length) {
              llmParts.push('## Categories');
              llmParts.push('');
              for (const c of enReport.categories) llmParts.push(`- ${c}`);
              llmParts.push('');
            }

            // Key pages section
            const topPages = pagesData
              .filter((p: any) => p.title && !p.error)
              .slice(0, 15);
            if (topPages.length > 0) {
              llmParts.push('## Key Pages');
              llmParts.push('');
              for (const p of topPages) {
                llmParts.push(`- [${p.title}](${p.url}): ${p.meta_description || p.content_summary || ''}`);
              }
              llmParts.push('');
            }

            if (enReport.tags?.length) {
              llmParts.push(`## Tags`);
              llmParts.push('');
              llmParts.push(enReport.tags.join(', '));
              llmParts.push('');
            }

            const llm_txt = llmParts.join('\n');

            // Save all LLM data to companies table
            await updateCompany(db, company.id, {
              metatags,
              extracted_content,
              llm_txt,
              llm_txt_status: 'outdated',
            });
            console.log(`[analyze] ✓ LLM data filled for company ${company.id}`);
          } catch (llmErr: any) {
            console.error(`[analyze] LLM data generation failed (non-fatal):`, llmErr?.message || llmErr);
          }
        }

        // Update company profile with denormalized fields
        await updateCompany(db, company.id, {
          company_name: enReport.company_name || null,
          industry: enReport.industry || null,
          country: enReport.country || null,
          tags: enReport.tags || [],
        });

        return logger.done(withCors(
          req,
          ok({
            success: true,
            message: "AI analysis completed successfully.",
            data: bilingualReport,
          }),
        ), authCtx);
      } catch (err) {
        console.error("[scrape-company] AI analysis error:", err);
        // Fallback: save algorithmic scores even if AI fails
        console.log(`[analyze] AI failed, saving algorithmic scores as fallback…`);
        try {
          const compositeResult = computeCompositeScore(algorithmicScores);
          const topRecs = computeTopRecommendations(algorithmicScores);
          const fallbackReport = {
            en: {
              summary: `AI analysis timed out. The 25 GEO factor scores were computed algorithmically.`,
              geo_score: compositeResult.composite,
              factor_scores: algorithmicScores,
              composite_score: compositeResult.composite,
              readiness_level: compositeResult.readiness_level,
              readiness_label: compositeResult.readiness_label,
              category_scores: compositeResult.category_scores,
              points_to_next_level: compositeResult.points_to_next_level,
              next_level: compositeResult.next_level,
              top_recommendations: topRecs,
              strengths: [],
              weaknesses: [],
            },
          };
          await updateAnalysis(db, analysisId, {
            ai_report: fallbackReport,
            geo_score: compositeResult.composite,
            readiness_level: compositeResult.readiness_level,
            status: "completed",
            progress: 100,
            completed_at: new Date().toISOString(),
            status_message: JSON.stringify({ key: "company.msg.analysisCompleteLimited", params: { score: compositeResult.composite } }),
          });

          // Auto-fill basic LLM data on fallback path (limited without AI insights)
          if (company.domain && !company.llm_txt) {
            try {
              const metaParts: string[] = [];
              if (company.meta_description) metaParts.push(`Description: ${company.meta_description}`);
              if (company.meta_keywords) metaParts.push(`Keywords: ${company.meta_keywords}`);
              const metatags = metaParts.join('\n') || null;

              const pageSummaries = pagesData
                .filter((p: any) => p.content_summary && !p.error)
                .slice(0, 10)
                .map((p: any) => `- ${p.title || p.url}: ${p.content_summary}`)
                .join('\n');
              const extracted_content = pageSummaries || null;

              const llmParts: string[] = [];
              llmParts.push(`# ${company.website_title || company.domain}`);
              llmParts.push('');
              llmParts.push(`- **Website**: https://${company.domain}`);
              llmParts.push('');
              if (pageSummaries) {
                llmParts.push('## Key Pages');
                llmParts.push('');
                const topPages = pagesData.filter((p: any) => p.title && !p.error).slice(0, 15);
                for (const p of topPages) {
                  llmParts.push(`- [${p.title}](${p.url}): ${p.meta_description || p.content_summary || ''}`);
                }
              }
              const llm_txt = llmParts.join('\n');

              await updateCompany(db, company.id, { metatags, extracted_content, llm_txt, llm_txt_status: 'outdated' });
              console.log(`[analyze] ✓ LLM data filled for company ${company.id} (fallback)`);
            } catch (llmErr: any) {
              console.error(`[analyze] LLM data generation failed on fallback (non-fatal):`, llmErr?.message || llmErr);
            }
          }

          return logger.done(withCors(req, ok({
            success: true,
            message: "Analysis completed with algorithmic scores (AI timed out).",
            data: fallbackReport,
          })), authCtx);
        } catch (fallbackErr) {
          console.error("[analyze] Fallback save also failed:", fallbackErr);
        }
        await updateAnalysis(db, analysisId, {
          status: "error",
          error_message: "Analysis failed unexpectedly",
        });
        return logger.done(withCors(
          req,
          serverError("Analysis failed unexpectedly."),
        ), authCtx);
      }
    }
  } catch (err: unknown) {
    console.error("[scrape-company]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return logger.done(withCors(
        req,
        new Response(
          JSON.stringify({
            success: false,
            error: {
              message: e.message,
              code:
                e.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
            },
          }),
          {
            status: e.status,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ), authCtx);
    }
    return logger.done(withCors(
      req,
      serverError(e.message || "Internal server error"),
    ), authCtx);
  }
});
