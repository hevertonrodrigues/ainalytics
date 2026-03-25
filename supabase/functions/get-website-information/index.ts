import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { extractWebsiteInformation, generateLlmText, normalizeTenantHost, buildTenantHttpsUrl, fetchWithTimeout } from "../_shared/llm-generation.ts";
import { generateAiSuggestions } from "../_shared/suggest-topics.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * Get Website Information Edge Function
 * 
 * Actions:
 * - 'extract': Uses the company's domain to scrape and extract: website_title, metatags, extracted_content, sitemap_xml.
 * - 'generate': Uses the extracted data to generate the llms_txt document.
 * - 'verify': Checks the live /llms.txt against the stored version.
 * - 'suggest_topics': Uses OpenAI to suggest AI monitoring topics based on extracted data.
 *
 * Uses OpenAI gpt-4.1-mini with web search capability for extraction, and standard generations for llm_txt.
 */
serve(async (req: Request) => {
  const logger = createRequestLogger("get-website-information", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { tenantId, user } = await verifyAuth(req);
    const authCtx = { tenant_id: tenantId, user_id: user.id };
    const sb = createAdminClient();

    // 1. Verify access to tenant
    const { data: tenantUser, error: tuErr } = await sb
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .single();

    if (tuErr || !tenantUser) {
      return logger.done(withCors(req, badRequest("User not found in tenant.")));
    }

    if (tenantUser.role !== 'owner' && tenantUser.role !== 'admin') {
      return logger.done(withCors(req, badRequest("Only owners and admins can perform this action.")));
    }

    const body = await req.json().catch(() => ({ action: 'extract' }));
    const { action, language = 'en' } = body;
    
    if (action !== 'extract' && action !== 'generate' && action !== 'verify' && action !== 'suggest_topics') {
       return logger.done(withCors(req, badRequest("Invalid action. Must be 'extract', 'generate', 'verify', or 'suggest_topics'.")));
    }

    // 2. Find company belonging to tenant
    const { data: company, error: cErr } = await sb
      .from("companies")
      .select("id, domain, llm_txt, website_title, metatags, extracted_content")
      .eq("tenant_id", tenantId)
      .single();

    if (cErr || !company) {
      return logger.done(withCors(req, badRequest("No company linked to this tenant.")));
    }

    const companyId = company.id;

    if (!company.domain) {
      return logger.done(withCors(req, badRequest("The company does not have a domain configured.")));
    }

    let domain: string;
    try {
      domain = normalizeTenantHost(company.domain);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid company domain";
      return logger.done(withCors(req, badRequest(msg)));
    }

    // --- ACTION: EXTRACT ---
    if (action === 'extract') {
      try {
        const parsedResult = await extractWebsiteInformation(companyId, sb, tenantId, user.id);
        return logger.done(withCors(req, ok({ success: true, message: "Information extracted and saved successfully.", data: parsedResult })));
      } catch (err: any) {
        return logger.done(withCors(req, serverError(err.message || "Failed to extract information.")));
      }
    }

    // --- ACTION: VERIFY ---
    if (action === 'verify') {
      let status = 'missing';
      
      try {
        const llmUrl = buildTenantHttpsUrl(domain, "/llms.txt");
        const res = await fetchWithTimeout(llmUrl, { method: "GET" });
        
        if (res.ok) {
          const liveText = await res.text();
          if (!company.llm_txt) {
             status = 'outdated';
          } else {
             // Basic comparison
             if (liveText.trim() === company.llm_txt.trim()) {
                status = 'updated';
             } else {
                status = 'outdated';
             }
          }
        }
      } catch (err) {
        console.warn("[get-website-information] verify failed:", err);
      }

      const { error: updateErr } = await sb
        .from("companies")
        .update({
          llm_txt_status: status,
          updated_at: new Date().toISOString()
        })
        .eq("id", companyId);
        
      if (updateErr) return logger.done(withCors(req, serverError("Failed to save verification status to database.")));

      return logger.done(withCors(req, ok({ success: true, message: `Status verified as ${status}`, data: { status } })));
    }

    // --- ACTION: SUGGEST TOPICS ---
    if (action === 'suggest_topics') {
      if (!company.extracted_content) {
        return logger.done(withCors(req, badRequest("Cannot generate suggestions without extracting information first.")));
      }

      // Fetch sitemap_xml from the latest analysis if available
      let sitemapXml: string | null = null;
      const { data: latestAnalysis } = await sb
        .from("geo_analyses")
        .select("sitemap_xml")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (latestAnalysis) sitemapXml = latestAnalysis.sitemap_xml;

      // Fetch existing topics and prompts for deduplication
      const { data: existingTopicsData } = await sb
        .from("topics")
        .select("id, name, prompts(text)")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      const existingTopics = (existingTopicsData || []).map((t: any) => ({
        name: t.name,
        prompts: (t.prompts || []).map((p: any) => p.text),
      }));

      console.log(`[get-website-information] Found ${existingTopics.length} existing topics for context`);

      try {
        const result = await generateAiSuggestions({
          websiteTitle: company.website_title,
          metatags: company.metatags,
          extractedContent: company.extracted_content,
          sitemapXml,
          language,
          existingTopics,
          tenantId,
          userId: user.id,
          db: sb,
        });
        return logger.done(withCors(req, ok(result)));
      } catch (err: any) {
        return logger.done(withCors(req, serverError(err.message || "Failed to generate suggestions.")));
      }
    }

    // --- ACTION: GENERATE ---
    if (action === 'generate') {
      try {
        const llmTxt = await generateLlmText(companyId, sb, tenantId, user.id);
        return logger.done(withCors(req, ok({ success: true, message: "LLMs.txt generated successfully.", data: { llm_txt: llmTxt } })));
      } catch (err: any) {
        return logger.done(withCors(req, serverError(err.message || "Failed to generate LLM text.")));
      }
    }



  } catch (err: unknown) {
    console.error("[get-website-information]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return logger.done(withCors(
        req,
        new Response(
          JSON.stringify({ success: false, error: { message: e.message, code: e.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" } }),
          { status: e.status, headers: { "Content-Type": "application/json" } },
        ),
      ));
    }
    return logger.done(withCors(req, serverError(e.message || "Internal server error")));
  }
});
