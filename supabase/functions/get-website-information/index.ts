import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";

const TENANT_FETCH_TIMEOUT_MS = 10_000;

function isBlockedTenantHost(host: string): boolean {
  const h = host.toLowerCase();

  // Disallow localhost / local-only names / IP literals / private ranges.
  if (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.endsWith(".localhost") ||
    /^[0-9.]+$/.test(h) ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)
  ) {
    return true;
  }

  return false;
}

function normalizeTenantHost(raw: string): string {
  const input = raw.trim().toLowerCase();
  if (!input) throw new Error("Missing tenant domain");

  // Accept legacy values that may have been stored with a scheme, but reject
  // credentials, ports, paths, queries, and fragments.
  let host = input;
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const parsed = new URL(input);
    if (parsed.username || parsed.password) throw new Error("Invalid domain");
    if (parsed.port) throw new Error("Ports are not allowed");
    if (parsed.pathname && parsed.pathname !== "/") throw new Error("Paths are not allowed");
    if (parsed.search || parsed.hash) throw new Error("Query strings/fragments are not allowed");
    host = parsed.hostname.toLowerCase();
  }

  if (host.endsWith(".")) host = host.slice(0, -1);

  if (
    host.length === 0 ||
    host.length > 253 ||
    !host.includes(".") ||
    host.includes("..") ||
    /[^a-z0-9.-]/.test(host) ||
    host.startsWith("-") ||
    host.endsWith("-") ||
    host.startsWith(".") ||
    host.endsWith(".")
  ) {
    throw new Error("Invalid domain");
  }

  // Validate each label (1..63 chars, no leading/trailing hyphen)
  for (const label of host.split(".")) {
    if (
      label.length === 0 ||
      label.length > 63 ||
      label.startsWith("-") ||
      label.endsWith("-")
    ) {
      throw new Error("Invalid domain");
    }
  }

  if (isBlockedTenantHost(host)) {
    throw new Error("Private/internal domains are not allowed");
  }

  return host;
}

function buildTenantHttpsUrl(host: string, path: string): string {
  return new URL(path, `https://${host}`).toString();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = TENANT_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get Website Information Edge Function
 * - POST /
 * Actions:
 * - 'extract': Uses the tenant's main_domain to scrape and extract: website_title, metatags, extracted_content, sitemap_xml.
 * - 'generate': Uses the extracted data to generate the llm_txt document.
 * - 'verify': Fetches the deployed llm.txt and compares it to the database version.
 * 
 * Uses OpenAI gpt-4o with web search capability for extraction, and standard generations for llm_txt.
 */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { tenantId, user } = await verifyAuth(req);

    if (req.method !== "POST") {
      return withCors(req, badRequest(`Method ${req.method} not allowed`));
    }

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

    // 2. Fetch tenant's data
    const { data: tenant, error: tErr } = await sb
      .from("tenants")
      .select("id, main_domain, sitemap_xml, llm_txt")
      .eq("id", tenantId)
      .single();
    
    if (tErr || !tenant) {
      return withCors(req, badRequest("Tenant not found."));
    }

    if (!tenant.main_domain) {
      return withCors(req, badRequest("The tenant does not have a main domain configured."));
    }

    let domain: string;
    try {
      domain = normalizeTenantHost(tenant.main_domain);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid tenant domain";
      return withCors(req, badRequest(msg));
    }

    let sitemapXml = tenant.sitemap_xml;

    // --- ACTION: EXTRACT ---
    if (action === 'extract') {
      // Try to fetch sitemap.xml automatically if we don't have one saved
      if (!sitemapXml) {
        try {
          const sitemapUrl = buildTenantHttpsUrl(domain, "/sitemap.xml");
          const sitemapRes = await fetchWithTimeout(
            sitemapUrl,
            { method: "GET", headers: { Accept: "application/xml, text/xml" } },
          );
          if (sitemapRes.ok) {
            sitemapXml = await sitemapRes.text();
          }
        } catch (err) {
          console.warn("[get-website-information] Failed fetching automatic sitemap for domain:", domain, err);
        }
      }

      const prompt = `
        You are an expert web researcher and data extractor. 
        I need you to search the internet for the domain "${domain}" and explore its main pages and content.
        Based on your research, please extract the following:
        1. website_title: The main title of the website or company name.
        2. metatags: A summary of the core keywords, description, and meta information you can deduce.
        3. extracted_content: A detailed summary of what the company does, their products/services, target audience, and any other relevant public information found on their website.
        
        You must respond with ONLY a valid JSON object matching the following structure exactly, with no markdown fences or other text:
        {
          "website_title": "string",
          "metatags": "string",
          "extracted_content": "string"
        }
      `;

      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) return withCors(req, serverError("OPENAI_API_KEY is not configured"));

      const body = {
        model: "gpt-4o",
        input: prompt,
        tools: [{ type: "web_search" }],
        tool_choice: "required"
      };

      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) return withCors(req, serverError("Failed to fetch information from AI provider."));
      
      const data = await res.json();
      let answerText: string | null = null;
      for (const item of (data.output ?? [])) {
        if (item.type === "message" && Array.isArray(item.content)) {
          for (const block of item.content) {
            if (block.type === "output_text") {
              if (!answerText && block.text) answerText = block.text;
            }
          }
        }
      }

      if (!answerText) return withCors(req, serverError("AI provider returned an empty response."));

      let parsedResult;
      try {
        parsedResult = JSON.parse(answerText.trim());
      } catch (e) {
        return withCors(req, serverError("AI produced invalid JSON output."));
      }

      const { error: updateErr } = await sb
        .from("tenants")
        .update({
          website_title: parsedResult.website_title || null,
          metatags: parsedResult.metatags || null,
          extracted_content: parsedResult.extracted_content || null,
          sitemap_xml: sitemapXml || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", tenantId);

      if (updateErr) return withCors(req, serverError("Failed to save the extracted information to the database."));

      return withCors(req, ok({ success: true, message: "Information extracted and saved successfully.", data: parsedResult }));
    }

    // --- ACTION: VERIFY ---
    if (action === 'verify') {
      let status = 'missing';
      
      try {
        const llmUrl = buildTenantHttpsUrl(domain, "/llm.txt");
        const res = await fetchWithTimeout(llmUrl, { method: "GET" });
        
        if (res.ok) {
          const liveText = await res.text();
          if (!tenant.llm_txt) {
             status = 'outdated';
          } else {
             // Basic comparison
             if (liveText.trim() === tenant.llm_txt.trim()) {
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
        .from("tenants")
        .update({
          llm_txt_status: status,
          updated_at: new Date().toISOString()
        })
        .eq("id", tenantId);
        
      if (updateErr) return withCors(req, serverError("Failed to save verification status to database."));

      return withCors(req, ok({ success: true, message: `Status verified as ${status}`, data: { status } }));
    }

    // --- ACTION: SUGGEST TOPICS ---
    if (action === 'suggest_topics') {
      const { data: tenantData, error: tdErr } = await sb
        .from("tenants")
        .select("website_title, metatags, extracted_content, sitemap_xml")
        .eq("id", tenantId)
        .single();

      if (tdErr || !tenantData) return withCors(req, badRequest("Failed to load extracted data."));
      if (!tenantData.extracted_content) return withCors(req, badRequest("Cannot generate suggestions without extracting information first."));

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
        - Title: ${tenantData.website_title}
        - Meta: ${tenantData.metatags}
        - Overview: ${tenantData.extracted_content}
        
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

      if (tenantData.sitemap_xml) {
        const truncatedSitemap = tenantData.sitemap_xml.slice(0, 15000);
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
      const { data: tenantData, error: tdErr } = await sb
        .from("tenants")
        .select("website_title, metatags, extracted_content, sitemap_xml")
        .eq("id", tenantId)
        .single();

      if (tdErr || !tenantData) return withCors(req, badRequest("Failed to load extracted data."));
      if (!tenantData.extracted_content) return withCors(req, badRequest("Cannot generate LLM.txt without extracting information first."));

      let prompt = `
        You are an expert technical writer formatting context documents for AI systems.
        Based on the following extracted details about a website/company, generate a well-structured markdown document meant to be an 'llm.txt' file. 
        This file is intended to provide AI models with the best possible context about the company when users upload it. 
        It should include an overview, key links, product descriptions, company mission, and any other relevant structured context.
        
        Data:
        - Title: ${tenantData.website_title}
        - Meta: ${tenantData.metatags}
        - Overview: ${tenantData.extracted_content}
        
        CRITICAL: Do not output \`\`\`markdown or \`\`\` around your response. Output the raw markdown text directly.
      `;

      if (tenantData.sitemap_xml) {
        const truncatedSitemap = tenantData.sitemap_xml.slice(0, 15000);
        prompt += `
        
        To assist you, here is the generated sitemap.xml content for the website. Use the structure and paths provided here to understand the website's hierarchy, find key pages, and formulate the best llm_txt file!
        <sitemap_xml>
        ${truncatedSitemap}
        </sitemap_xml>
        `;
      }

      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) return withCors(req, serverError("OPENAI_API_KEY is not configured"));

      const body = {
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
      };

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) return withCors(req, serverError("Failed to generate LLM txt from AI provider."));
      
      const data = await res.json();
      let llmTxt = data.choices[0]?.message?.content;

      if (!llmTxt) return withCors(req, serverError("AI provider returned an empty response."));

      // Strip markdown fences just in case the LLM ignored instructions
      llmTxt = llmTxt.replace(/^```markdown\n?/gi, '').replace(/^```\n?/g, '').replace(/\n?```$/g, '');

      const { error: updateErr } = await sb
        .from("tenants")
        .update({
          llm_txt: llmTxt,
          updated_at: new Date().toISOString()
        })
        .eq("id", tenantId);

      if (updateErr) return withCors(req, serverError("Failed to save the generated LLM text to the database."));

      return withCors(req, ok({ success: true, message: "LLM.txt generated successfully.", data: { llm_txt: llmTxt } }));
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
