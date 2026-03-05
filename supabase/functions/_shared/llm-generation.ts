import { createAdminClient } from "./supabase.ts";

const TENANT_FETCH_TIMEOUT_MS = 10_000;

function isBlockedTenantHost(host: string): boolean {
  const h = host.toLowerCase();
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

export function normalizeTenantHost(raw: string): string {
  const input = raw.trim().toLowerCase();
  if (!input) throw new Error("Missing tenant domain");

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

export function buildTenantHttpsUrl(host: string, path: string): string {
  return new URL(path, `https://${host}`).toString();
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = TENANT_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extracts website information using GPT-4o search and updates the company record.
 */
export async function extractWebsiteInformation(companyId: string, dbClient?: any): Promise<any> {
  const sb = dbClient || createAdminClient();
  const { data: company, error: cErr } = await sb
    .from("companies")
    .select("domain, sitemap_xml, llm_txt")
    .eq("id", companyId)
    .single();

  if (cErr || !company) throw new Error("Company not found.");
  if (!company.domain) throw new Error("The company does not have a domain configured.");

  const domain = normalizeTenantHost(company.domain);
  let sitemapXml = company.sitemap_xml;

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
      console.warn("[llm-generation] Failed fetching automatic sitemap for domain:", domain, err);
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
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

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

  if (!res.ok) throw new Error("Failed to fetch information from AI provider.");
  
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

  if (!answerText) throw new Error("AI provider returned an empty response.");

  let parsedResult;
  try {
    parsedResult = JSON.parse(answerText.trim());
  } catch {
    throw new Error("AI produced invalid JSON output.");
  }

  const { error: updateErr } = await sb
    .from("companies")
    .update({
      website_title: parsedResult.website_title || null,
      metatags: parsedResult.metatags || null,
      extracted_content: parsedResult.extracted_content || null,
      sitemap_xml: sitemapXml || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", companyId);

  if (updateErr) throw new Error("Failed to save the extracted information to the database.");

  return parsedResult;
}

/**
 * Generates the llm.txt content based on previously extracted website information.
 */
export async function generateLlmText(companyId: string, dbClient?: any): Promise<string> {
  const sb = dbClient || createAdminClient();
  const { data: companyData, error: cdErr } = await sb
    .from("companies")
    .select("website_title, metatags, extracted_content, sitemap_xml")
    .eq("id", companyId)
    .single();

  if (cdErr || !companyData) throw new Error("Failed to load extracted data.");
  if (!companyData.extracted_content) throw new Error("Cannot generate LLM.txt without extracting information first.");

  let prompt = `
    You are an expert technical writer formatting context documents for AI systems.
    Based on the following extracted details about a website/company, generate a well-structured markdown document meant to be an 'llm.txt' file. 
    This file is intended to provide AI models with the best possible context about the company when users upload it. 
    It should include an overview, key links, product descriptions, company mission, and any other relevant structured context.
    
    Data:
    - Title: ${companyData.website_title}
    - Meta: ${companyData.metatags}
    - Overview: ${companyData.extracted_content}
    
    CRITICAL: Do not output \`\`\`markdown or \`\`\` around your response. Output the raw markdown text directly.
  `;

  if (companyData.sitemap_xml) {
    const truncatedSitemap = companyData.sitemap_xml.slice(0, 15000);
    prompt += `
    
    To assist you, here is the generated sitemap.xml content for the website. Use the structure and paths provided here to understand the website's hierarchy, find key pages, and formulate the best llm_txt file!
    <sitemap_xml>
    ${truncatedSitemap}
    </sitemap_xml>
    `;
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const genBody = {
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(genBody),
  });

  if (!res.ok) throw new Error("Failed to generate LLM txt from AI provider.");
  
  const data = await res.json();
  let llmTxt = data.choices[0]?.message?.content;

  if (!llmTxt) throw new Error("AI provider returned an empty response.");

  // Strip markdown fences
  llmTxt = llmTxt.replace(/^```markdown\n?/gi, '').replace(/^```\n?/g, '').replace(/\n?```$/g, '');

  const { error: updateErr } = await sb
    .from("companies")
    .update({
      llm_txt: llmTxt,
      updated_at: new Date().toISOString()
    })
    .eq("id", companyId);

  if (updateErr) throw new Error("Failed to save the generated LLM text to the database.");

  return llmTxt;
}

/**
 * Runs both extraction and generation sequentially.
 */
export async function autoGenerateAllLlmData(companyId: string, dbClient?: any): Promise<void> {
  try {
    const sb = dbClient || createAdminClient();
    console.log(`[llm-generation] Starting auto-generation for company ${companyId}`);
    await extractWebsiteInformation(companyId, sb);
    console.log(`[llm-generation] Extraction complete for company ${companyId}`);
    await generateLlmText(companyId, sb);
    console.log(`[llm-generation] LLM.txt generation complete for company ${companyId}`);
  } catch (err) {
    console.error(`[llm-generation] Auto-generation failed for company ${companyId}:`, err);
  }
}
