import { createAdminClient } from "./supabase.ts";
import { EXTRACT_WEBSITE_INFO_PROMPT, GENERATE_LLM_TXT_PROMPT, replaceVars } from "./prompts/load.ts";
import { executePrompt } from "./ai-providers/index.ts";
import { logAiUsage, resolveModel } from "./cost-calculator.ts";

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
 * Resolves tenant_id from a company_id.
 */
async function resolveTenantId(sb: ReturnType<typeof createAdminClient>, companyId: string): Promise<string | null> {
  const { data } = await sb
    .from("companies")
    .select("tenant_id")
    .eq("id", companyId)
    .single();
  return data?.tenant_id || null;
}

/**
 * Extracts website information using OpenAI with web search via the adapter layer.
 */
export async function extractWebsiteInformation(companyId: string, dbClient?: ReturnType<typeof createAdminClient>, tenantId?: string): Promise<ReturnType<typeof JSON.parse>> {
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

  const prompt = replaceVars(EXTRACT_WEBSITE_INFO_PROMPT, {
    DOMAIN: domain,
  });

  // Use adapter layer — model must exist in the `models` table
  const model = await resolveModel(sb, "gpt-4.1-mini");
  const aiResult = await executePrompt({
    prompt,
    model,
    webSearchEnabled: true,
  });

  if (aiResult.error || !aiResult.text) {
    throw new Error(aiResult.error || "Failed to fetch information from AI provider.");
  }

  let parsedResult;
  try {
    parsedResult = JSON.parse(aiResult.text.trim());
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

  // Log AI usage
  const resolvedTenantId = tenantId || await resolveTenantId(sb, companyId);
  if (resolvedTenantId) {
    await logAiUsage(sb, {
      tenantId: resolvedTenantId,
      callSite: "llm_extract_website",
      platformSlug: model.platformSlug,
      modelSlug: model.slug,
      promptText: prompt,
      requestParams: { webSearchEnabled: true },
      rawRequest: aiResult.raw_request,
      answerText: aiResult.text,
      annotations: aiResult.annotations,
      sources: aiResult.sources,
      responseParams: { model: aiResult.model, web_search_enabled: aiResult.web_search_enabled },
      rawResponse: aiResult.raw_response,
      error: aiResult.error,
      tokensInput: aiResult.tokens?.input ?? 0,
      tokensOutput: aiResult.tokens?.output ?? 0,
      latencyMs: aiResult.latency_ms,
      webSearchEnabled: aiResult.web_search_enabled,
      metadata: { company_id: companyId },
    });
  }

  return parsedResult;
}

/**
 * Generates the llms.txt content using OpenAI via the adapter layer.
 */
export async function generateLlmText(companyId: string, dbClient?: ReturnType<typeof createAdminClient>, tenantId?: string): Promise<string> {
  const sb = dbClient || createAdminClient();
  const { data: companyData, error: cdErr } = await sb
    .from("companies")
    .select("website_title, metatags, extracted_content, sitemap_xml")
    .eq("id", companyId)
    .single();

  if (cdErr || !companyData) throw new Error("Failed to load extracted data.");
  if (!companyData.extracted_content) throw new Error("Cannot generate LLMs.txt without extracting information first.");

  let sitemapSection = "";
  if (companyData.sitemap_xml) {
    const truncatedSitemap = companyData.sitemap_xml.slice(0, 15000);
    sitemapSection = `\nTo assist you, here is the generated sitemap.xml content for the website. Use the structure and paths provided here to understand the website's hierarchy, find key pages, and formulate the best llms_txt file!\n<sitemap_xml>\n${truncatedSitemap}\n</sitemap_xml>`;
  }

  const prompt = replaceVars(GENERATE_LLM_TXT_PROMPT, {
    WEBSITE_TITLE: companyData.website_title,
    METATAGS: companyData.metatags,
    EXTRACTED_CONTENT: companyData.extracted_content,
    SITEMAP_SECTION: sitemapSection,
  });

  // Use adapter layer — model must exist in the `models` table
  const model2 = await resolveModel(sb, "gpt-4.1-mini");
  const aiResult = await executePrompt({
    prompt,
    model: model2,
    webSearchEnabled: false,
  });

  if (aiResult.error || !aiResult.text) {
    throw new Error(aiResult.error || "Failed to generate LLM txt from AI provider.");
  }

  // Strip markdown fences
  let llmTxt = aiResult.text;
  llmTxt = llmTxt.replace(/^```markdown\n?/gi, '').replace(/^```\n?/g, '').replace(/\n?```$/g, '');

  const { error: updateErr } = await sb
    .from("companies")
    .update({
      llm_txt: llmTxt,
      updated_at: new Date().toISOString()
    })
    .eq("id", companyId);

  if (updateErr) throw new Error("Failed to save the generated LLM text to the database.");

  // Log AI usage
  const resolvedTenantId = tenantId || await resolveTenantId(sb, companyId);
  if (resolvedTenantId) {
    await logAiUsage(sb, {
      tenantId: resolvedTenantId,
      callSite: "llm_generate_text",
      platformSlug: model2.platformSlug,
      modelSlug: model2.slug,
      promptText: prompt,
      requestParams: { webSearchEnabled: false },
      rawRequest: aiResult.raw_request,
      answerText: aiResult.text,
      responseParams: { model: aiResult.model },
      rawResponse: aiResult.raw_response,
      error: aiResult.error,
      tokensInput: aiResult.tokens?.input ?? 0,
      tokensOutput: aiResult.tokens?.output ?? 0,
      latencyMs: aiResult.latency_ms,
      webSearchEnabled: false,
      metadata: { company_id: companyId },
    });
  }

  return llmTxt;
}

/**
 * Runs both extraction and generation sequentially.
 */
export async function autoGenerateAllLlmData(companyId: string, dbClient?: ReturnType<typeof createAdminClient>, tenantId?: string): Promise<void> {
  try {
    const sb = dbClient || createAdminClient();
    console.log(`[llm-generation] Starting auto-generation for company ${companyId}`);
    await extractWebsiteInformation(companyId, sb, tenantId);
    console.log(`[llm-generation] Extraction complete for company ${companyId}`);
    await generateLlmText(companyId, sb, tenantId);
    console.log(`[llm-generation] LLMs.txt generation complete for company ${companyId}`);
  } catch (err) {
    console.error(`[llm-generation] Auto-generation failed for company ${companyId}:`, err);
  }
}
