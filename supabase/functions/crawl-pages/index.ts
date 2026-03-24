import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { ok, serverError, unauthorized } from "../_shared/response.ts";
import { extractFromHtml } from "../scrape-company/geo-extract.ts";
import { fetchWithRedirectChain, extractLinksFromHtml, selectDiversePages, MAX_PAGES_TO_SCRAPE } from "../scrape-company/fetch-utils.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * Crawl Pages Worker Edge Function
 *
 * Invoked by pg_cron (via pg_net) every 1 minute.
 * Processes batches of pending pages from geo_analyses_pages.
 *
 * Flow:
 * 1. Recover stale pages stuck in 'crawling' status
 * 2. Find ONE analysis with status = 'scraping'
 * 3. Checkout a small batch of pending pages
 * 4. Crawl each page, save results
 * 5. Update analysis progress
 * 6. When all pages done → rebuild crawled_pages snapshot, set status = 'scraping_done'
 *
 * IMPORTANT: This function is designed to complete FAST (< 25s wall clock)
 * to avoid Supabase edge function early termination.
 */

const BATCH_SIZE = 3;
const CRAWL_TIMEOUT_MS = 5000;
const CRAWL_DELAY_MS = 200;
const STALE_CRAWLING_MINUTES = 2;

serve(async (req: Request) => {
  const logger = createRequestLogger("crawl-pages", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    // ── Auth: verify cron secret or service-role key ──────────
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("authorization") || "";
    const incomingSecret = req.headers.get("x-cron-secret") || "";

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    const isCronAuth = cronSecret && incomingSecret === cronSecret;

    // Allow unauthenticated in local dev (no CRON_SECRET configured)
    const isLocal = !cronSecret;

    if (!isServiceRole && !isCronAuth && !isLocal) {
      return logger.done(withCors(req, unauthorized("Invalid authorization")));
    }

    const db = createAdminClient();

    // ── Step 0: Recover stale pages stuck in 'crawling' ───────
    // When the function is terminated early (wall clock limit),
    // pages checked out as 'crawling' are never completed.
    // Reset them back to 'pending' so they can be retried.
    const { data: resetResult, error: resetErr } = await db.rpc(
      "reset_stale_crawling_pages",
      { p_stale_minutes: STALE_CRAWLING_MINUTES }
    );

    if (resetErr) {
      // Non-fatal — log and continue
      console.warn("[crawl-pages] Error resetting stale pages:", resetErr.message);
    } else if (resetResult && resetResult > 0) {
      console.log(`[crawl-pages] Reset ${resetResult} stale crawling pages back to pending`);
    }

    // ── Find ONE analysis that needs page crawling ────────────
    // Process only 1 analysis per invocation to stay within wall clock limits
    const { data: activeAnalyses, error: fetchErr } = await db
      .from("geo_analyses")
      .select("id, company_id, status")
      .eq("status", "scraping")
      .order("created_at", { ascending: true })
      .limit(1);

    if (fetchErr) {
      console.error("[crawl-pages] Error fetching active analyses:", fetchErr);
      return logger.done(withCors(req, serverError(fetchErr.message)));
    }

    if (!activeAnalyses || activeAnalyses.length === 0) {
      return logger.done(withCors(req, ok({ message: "No active analyses", processed: 0 })));
    }

    const analysis = activeAnalyses[0];
    const analysisId = analysis.id;
    console.log(`[crawl-pages] Found ${activeAnalyses.length} active analyses`);

    // ── Checkout next batch of pages ─────────────────────────
    const { data: pages, error: checkoutErr } = await db.rpc(
      "checkout_crawl_pages",
      { p_analysis_id: analysisId, p_batch_size: BATCH_SIZE }
    );

    if (checkoutErr) {
      console.error(`[crawl-pages] Checkout error for ${analysisId}:`, checkoutErr);
      return logger.done(withCors(req, ok({ message: "Checkout error", processed: 0 })));
    }

    if (!pages || pages.length === 0) {
      // No pending pages — check if all are done
      const { data: progress } = await db.rpc("get_crawl_progress", { p_analysis_id: analysisId });

      if (progress && progress.length > 0) {
        const p = progress[0];
        if (p.total === 0) {
          // Pages haven't been inserted yet — scrape-company is still running
          console.log(`[crawl-pages] Analysis ${analysisId}: 0 pages found, scrape-company likely still inserting. Skipping.`);
        } else if (p.pending === 0) {
          console.log(`[crawl-pages] Analysis ${analysisId}: All ${p.total} pages done (${p.completed} ok, ${p.errors} errors). Finalizing…`);
          await finalizeAnalysis(db, analysisId, p);
        } else {
          console.log(`[crawl-pages] Analysis ${analysisId}: ${p.pending} pages still pending (likely being crawled by another invocation)`);
        }
      }
      return logger.done(withCors(req, ok({ message: "No pages to process", processed: 0 })));
    }

    console.log(`[crawl-pages] Analysis ${analysisId}: Processing ${pages.length} pages`);

    // ── Crawl each page ────────────────────────────────────
    const crawledPages: { url: string; pageData: any; pageId: string; html: string }[] = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const startTime = Date.now();

      if (i > 0) await sleep(CRAWL_DELAY_MS);

      try {
        const { response: res, redirect_chain } = await fetchWithRedirectChain(page.url, CRAWL_TIMEOUT_MS);
        const loadTime = Date.now() - startTime;

        if (!res) {
          console.log(`[crawl-pages] ${page.url} → timeout (${loadTime}ms)`);
          const { error: rpcErr1 } = await db.rpc("complete_crawl_page", {
            p_page_id: page.id,
            p_status: "error",
            p_load_time_ms: loadTime,
            p_redirect_chain: redirect_chain,
            p_error_message: "Timeout or unreachable",
          });
          if (rpcErr1) console.error(`[crawl-pages] complete_crawl_page error:`, rpcErr1.message);
          continue;
        }

        const statusCode = res.status;
        if (statusCode !== 200) {
          console.log(`[crawl-pages] ${page.url} → HTTP ${statusCode} (${loadTime}ms)`);
          const { error: rpcErr2 } = await db.rpc("complete_crawl_page", {
            p_page_id: page.id,
            p_status: statusCode >= 400 ? "error" : "completed",
            p_status_code: statusCode,
            p_load_time_ms: loadTime,
            p_redirect_chain: redirect_chain,
            p_error_message: `HTTP ${statusCode}`,
          });
          if (rpcErr2) console.error(`[crawl-pages] complete_crawl_page error:`, rpcErr2.message);
          continue;
        }

        const html = await res.text();
        const extracted = extractFromHtml(html, page.url, res.headers);

        const pageData = {
          ...extracted,
          load_time_ms: loadTime,
          ttfb_ms: loadTime,
          status_code: statusCode,
          redirect_chain,
        };

        const { error: rpcErr3 } = await db.rpc("complete_crawl_page", {
          p_page_id: page.id,
          p_status: "completed",
          p_status_code: statusCode,
          p_load_time_ms: loadTime,
          p_redirect_chain: redirect_chain,
          p_page_data: pageData,
        });
        if (rpcErr3) console.error(`[crawl-pages] complete_crawl_page error:`, rpcErr3.message);

        crawledPages.push({ url: page.url, pageData, pageId: page.id, html });
        console.log(`[crawl-pages] ${page.url} → ${loadTime}ms, ${extracted.word_count} words`);

      } catch (err) {
        const loadTime = Date.now() - startTime;
        console.warn(`[crawl-pages] ${page.url} → error: ${(err as Error).message}`);
        const { error: rpcErr4 } = await db.rpc("complete_crawl_page", {
          p_page_id: page.id,
          p_status: "error",
          p_load_time_ms: loadTime,
          p_redirect_chain: [page.url],
          p_error_message: (err as Error).message,
        });
        if (rpcErr4) console.error(`[crawl-pages] complete_crawl_page error:`, rpcErr4.message);
      }
    }

    // ── Discover new links from crawled pages ──────────────
    // Check current total for this analysis
    const { count: currentCount } = await db
      .from("geo_analyses_pages")
      .select("id", { count: "exact", head: true })
      .eq("analysis_id", analysisId);

    const totalNow = currentCount || 0;

    if (totalNow < MAX_PAGES_TO_SCRAPE) {
      // Get all existing URLs to deduplicate
      const { data: existingRows } = await db
        .from("geo_analyses_pages")
        .select("url")
        .eq("analysis_id", analysisId);

      const existingUrls = new Set(
        (existingRows || []).map((r: any) => r.url.replace(/\/$/, ""))
      );

      const newRows: { analysis_id: string; url: string; status: string; page_order: number }[] = [];

      // Collect all discovered links, deduplicate, then pick diverse subset
      let allDiscovered: string[] = [];
      for (const crawled of crawledPages) {
        if (!crawled.html) continue;
        const discovered = extractLinksFromHtml(crawled.html, crawled.url);
        for (const link of discovered) {
          const clean = link.replace(/\/$/, "");
          if (!existingUrls.has(clean)) {
            allDiscovered.push(link);
            existingUrls.add(clean);
          }
        }
      }

      const remaining = MAX_PAGES_TO_SCRAPE - totalNow;
      if (remaining > 0 && allDiscovered.length > 0) {
        const selected = selectDiversePages(allDiscovered, remaining);
        for (const link of selected) {
          newRows.push({
            analysis_id: analysisId,
            url: link,
            status: "pending",
            page_order: totalNow + newRows.length,
          });
        }
      }

      if (newRows.length > 0) {
        console.log(`[crawl-pages] Discovered ${newRows.length} new URLs from crawled pages`);
        const batchSize = 50;
        for (let i = 0; i < newRows.length; i += batchSize) {
          const batch = newRows.slice(i, i + batchSize);
          await db.from("geo_analyses_pages").insert(batch);
        }
        // Update total_pages on the analysis
        await db
          .from("geo_analyses")
          .update({ total_pages: totalNow + newRows.length })
          .eq("id", analysisId);
      }
    }

    // ── Update analysis progress ─────────────────────────
    const { data: progress } = await db.rpc("get_crawl_progress", { p_analysis_id: analysisId });

    if (progress && progress.length > 0) {
      const p = progress[0];
      const pct = p.total > 0
        ? 15 + Math.round(((p.completed + p.errors) / p.total) * 33)
        : 15;




      await db
        .from("geo_analyses")
        .update({
          progress: pct,
          pages_crawled: p.completed + p.errors,
          status_message: p.pending > 0
            ? JSON.stringify({ key: "company.msg.homepageAnalyzed", params: { count: p.pending } })
            : JSON.stringify({ key: "company.msg.scrapingComplete", params: { completed: p.total } }),
        })
        .eq("id", analysisId);

      // Check if all pages are done
      if (p.pending === 0) {
        console.log(`[crawl-pages] Analysis ${analysisId}: All done! Finalizing…`);
        await finalizeAnalysis(db, analysisId, p);
      }
    }

    return logger.done(withCors(req, ok({
      message: `Processed ${pages.length} pages for analysis ${analysisId}`,
      processed: pages.length,
    })));

  } catch (err: unknown) {
    console.error("[crawl-pages] Fatal error:", err);
    const e = err as { message?: string };
    return logger.done(withCors(req, serverError(e.message || "Internal server error")));
  }
});


/**
 * Finalize an analysis after all pages are crawled:
 * 1. Rebuild crawled_pages JSONB snapshot from individual page rows
 * 2. Set status = 'scraping_done'
 */
async function finalizeAnalysis(
  db: any,
  analysisId: string,
  progress: { total: number; completed: number; errors: number },
) {
  // Fetch all page data to rebuild crawled_pages snapshot
  const { data: allPages, error: fetchErr } = await db
    .from("geo_analyses_pages")
    .select("url, status, status_code, load_time_ms, redirect_chain, page_data, headless_data, error_message")
    .eq("analysis_id", analysisId)
    .order("page_order", { ascending: true });

  if (fetchErr) {
    console.error(`[crawl-pages] Failed to fetch pages for snapshot:`, fetchErr);
    return;
  }

  // Build the crawled_pages array (same format as before for compatibility)
  const crawledPages = (allPages || []).map((p: any) => {
    if (p.page_data) {
      const merged = {
        ...p.page_data,
        url: p.url,
        status_code: p.status_code,
        load_time_ms: p.load_time_ms,
        redirect_chain: p.redirect_chain,
      };
      if (p.headless_data) {
        merged.headless = p.headless_data;
      }
      return merged;
    }
    return {
      url: p.url,
      status_code: p.status_code || 0,
      load_time_ms: p.load_time_ms || 0,
      redirect_chain: p.redirect_chain || [p.url],
      error: p.error_message || "Unknown error",
    };
  });

  await db
    .from("geo_analyses")
    .update({
      crawled_pages: crawledPages,
      pages_crawled: progress.completed + progress.errors,
      status: "scraping_done",
      progress: 48,
      status_message: JSON.stringify({ key: "company.msg.scrapingComplete", params: { completed: progress.completed } }),
    })
    .eq("id", analysisId);

  console.log(`[crawl-pages] Analysis ${analysisId}: Finalized with ${crawledPages.length} pages in snapshot`);
}


function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
