import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";

/**
 * Get Website Information Edge Function
 * - POST /
 * Uses the tenant's main_domain to scrape and extract:
 * 1. website_title
 * 2. metatags
 * 3. extracted_content
 * 4. llm_txt
 * 
 * Uses OpenAI gpt-4o with web search capability.
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

    // 2. Fetch tenant's main_domain
    const { data: tenant, error: tErr } = await sb
      .from("tenants")
      .select("id, main_domain")
      .eq("id", tenantId)
      .single();
    
    if (tErr || !tenant) {
      return withCors(req, badRequest("Tenant not found."));
    }

    if (!tenant.main_domain) {
      return withCors(req, badRequest("The tenant does not have a main domain configured."));
    }

    const domain = tenant.main_domain;

    // 3. Build the prompt
    const prompt = `
      You are an expert web researcher and data extractor. 
      I need you to search the internet for the domain "${domain}" and explore its main pages and content.
      Based on your research, please extract the following:
      1. website_title: The main title of the website or company name.
      2. metatags: A summary of the core keywords, description, and meta information you can deduce.
      3. extracted_content: A detailed summary of what the company does, their products/services, target audience, and any other relevant public information found on their website.
      4. llm_txt: A well-structured markdown document meant to be an 'llm.txt' file. This file is intended to provide AI models with the best possible context about the company when users upload it. It should include an overview, key links, product descriptions, company mission, and any other relevant structured context.
      
      You must respond with ONLY a valid JSON object matching the following structure exactly, with no markdown fences or other text:
      {
        "website_title": "string",
        "metatags": "string",
        "extracted_content": "string",
        "llm_txt": "string"
      }
    `;

    // 4. Call OpenAI API using the tool we already have logic for (or direct fetch)
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return withCors(req, serverError("OPENAI_API_KEY is not configured"));
    }

    const body = {
      model: "gpt-4o",
      input: prompt,
      tools: [{ type: "web_search" }],
      tool_choice: "required"
    };

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[get-website-information] OpenAI error:", errText);
      return withCors(req, serverError("Failed to fetch information from AI provider."));
    }

    const data = await res.json();
    
    let answerText: string | null = null;

    // Parse text from completions format
    for (const item of (data.output ?? [])) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block.type === "output_text") {
            if (!answerText && block.text) answerText = block.text;
          }
        }
      }
    }

    if (!answerText) {
      return withCors(req, serverError("AI provider returned an empty response."));
    }

    // 5. Parse JSON
    let parsedResult;
    try {
      parsedResult = JSON.parse(answerText.trim());
    } catch (e) {
      console.error("[get-website-information] Failed to parse JSON:", answerText);
      return withCors(req, serverError("AI produced invalid JSON output."));
    }

    const { website_title, metatags, extracted_content, llm_txt } = parsedResult;

    // 6. Update database
    const { error: updateErr } = await sb
      .from("tenants")
      .update({
        website_title: website_title || null,
        metatags: metatags || null,
        extracted_content: extracted_content || null,
        llm_txt: llm_txt || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", tenantId);

    if (updateErr) {
      console.error("[get-website-information] DB update error:", updateErr);
      return withCors(req, serverError("Failed to save the extracted information to the database."));
    }

    // 7. Return success
    return withCors(req, ok({ 
      success: true, 
      message: "Information extracted and saved successfully.",
      data: parsedResult
    }));

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
