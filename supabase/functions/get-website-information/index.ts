import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { extractWebsiteInformation, generateLlmText, normalizeTenantHost, buildTenantHttpsUrl, fetchWithTimeout } from "../_shared/llm-generation.ts";

/**
 * Get Website Information Edge Function
 * 
 * Actions:
 * - 'extract': Uses the company's domain to scrape and extract: website_title, metatags, extracted_content, sitemap_xml.
 * - 'generate': Uses the extracted data to generate the llm_txt document.
 * - 'verify': Checks the live /llm.txt against the stored version.
 * - 'suggest_topics': Uses OpenAI to suggest AI monitoring topics based on extracted data.
 *
 * Uses OpenAI gpt-4o with web search capability for extraction, and standard generations for llm_txt.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { tenantId, user } = await verifyAuth(req);
    const sb = createAdminClient();

    // 1. Verify access to tenant
    const { data: tenantUser, error: tuErr } = await sb
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .single();

    if (tuErr || !tenantUser) {
      return withCors(req, badRequest("User not found in tenant."));
    }

    if (tenantUser.role !== 'owner' && tenantUser.role !== 'admin') {
      return withCors(req, badRequest("Only owners and admins can perform this action."));
    }

    const body = await req.json().catch(() => ({ action: 'extract' }));
    const { action, language = 'en' } = body;
    
    if (action !== 'extract' && action !== 'generate' && action !== 'verify' && action !== 'suggest_topics') {
       return withCors(req, badRequest("Invalid action. Must be 'extract', 'generate', 'verify', or 'suggest_topics'."));
    }

    // 2. Find company belonging to tenant
    const { data: company, error: cErr } = await sb
      .from("companies")
      .select("id, domain, sitemap_xml, llm_txt, website_title, metatags, extracted_content")
      .eq("tenant_id", tenantId)
      .single();

    if (cErr || !company) {
      return withCors(req, badRequest("No company linked to this tenant."));
    }

    const companyId = company.id;

    if (!company.domain) {
      return withCors(req, badRequest("The company does not have a domain configured."));
    }

    let domain: string;
    try {
      domain = normalizeTenantHost(company.domain);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid company domain";
      return withCors(req, badRequest(msg));
    }

    // --- ACTION: EXTRACT ---
    if (action === 'extract') {
      try {
        const parsedResult = await extractWebsiteInformation(companyId, sb);
        return withCors(req, ok({ success: true, message: "Information extracted and saved successfully.", data: parsedResult }));
      } catch (err: any) {
        return withCors(req, serverError(err.message || "Failed to extract information."));
      }
    }

    // --- ACTION: VERIFY ---
    if (action === 'verify') {
      let status = 'missing';
      
      try {
        const llmUrl = buildTenantHttpsUrl(domain, "/llm.txt");
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
        
      if (updateErr) return withCors(req, serverError("Failed to save verification status to database."));

      return withCors(req, ok({ success: true, message: `Status verified as ${status}`, data: { status } }));
    }

    // --- ACTION: SUGGEST TOPICS ---
    if (action === 'suggest_topics') {
      if (!company.extracted_content) return withCors(req, badRequest("Cannot generate suggestions without extracting information first."));

      let prompt = `
        You are an expert AI prompt engineer and SEO analyst.
        Based on the following extracted details about a website/company, generate a list of topics and prompts that users might ask AI platforms (like ChatGPT or Perplexity) about the services, products, or industry this company operates in.
        
        **CRITICAL INSTRUCTIONS:**
        1. The prompts and topics must be **GENERIC** and focused on customer **NECESSITIES** or **SERVICES**.
        2. **DO NOT MENTION THE COMPANY NAME** or specific brand names in the prompts or topics.
        3. Imagine a client who needs a solution this company provides, but doesn't necessarily know the company yet.
        4. You should suggest 3-5 high-value topics. For each topic, suggest 3-5 relevant prompts.
        
        **LANGUAGE REQUIREMENT:**
        - You MUST respond in the following language: ${language}
        - All fields in the JSON (name, description, text) must be in ${language}.
        
        Data:
        - Title: ${company.website_title}
        - Meta: ${company.metatags}
        - Overview: ${company.extracted_content}
        
        You must respond with ONLY a valid JSON object matching the following structure exactly, with no markdown fences or other text:
        {
          "topics": [
            {
              "name": "string (Generic Topic Name in ${language})",
              "description": "string (Short description in ${language})",
              "prompts": [
                {
                  "text": "string (Generic prompt focused on service/need in ${language})",
                  "description": "string (Why this prompt is useful in ${language})"
                }
              ]
            }
          ]
        }
      `;

      if (company.sitemap_xml) {
        const truncatedSitemap = company.sitemap_xml.slice(0, 15000);
        prompt += `
        
        To assist you, here is the generated sitemap.xml content for the website:
        <sitemap_xml>
        ${truncatedSitemap}
        </sitemap_xml>
        `;
      }

      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) return withCors(req, serverError("OPENAI_API_KEY is not configured"));

      const chatBody = {
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      };

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(chatBody),
      });

      if (!res.ok) return withCors(req, serverError("Failed to generate suggestions from AI provider."));
      
      const data = await res.json();
      let suggestionsJson = data.choices[0]?.message?.content;

      if (!suggestionsJson) return withCors(req, serverError("AI provider returned an empty response."));

      let parsedResult;
      try {
        parsedResult = JSON.parse(suggestionsJson.trim());
      } catch (e) {
        return withCors(req, serverError("AI produced invalid JSON output."));
      }

      return withCors(req, ok(parsedResult));
    }

    // --- ACTION: GENERATE ---
    if (action === 'generate') {
      try {
        const llmTxt = await generateLlmText(companyId, sb);
        return withCors(req, ok({ success: true, message: "LLM.txt generated successfully.", data: { llm_txt: llmTxt } }));
      } catch (err: any) {
        return withCors(req, serverError(err.message || "Failed to generate LLM text."));
      }
    }



  } catch (err: unknown) {
    console.error("[get-website-information]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return withCors(
        req,
        new Response(
          JSON.stringify({ success: false, error: { message: e.message, code: e.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" } }),
          { status: e.status, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return withCors(req, serverError(e.message || "Internal server error"));
  }
});
