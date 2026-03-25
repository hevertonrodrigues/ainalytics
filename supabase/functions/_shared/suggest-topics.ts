/**
 * Shared Topic & Prompt Suggestion Module
 *
 * Two modes of generating topic/prompt suggestions:
 * 1. Algorithmic — based on GEO category scores (fast, no API call)
 * 2. AI-powered — uses OpenAI via the adapter layer from extracted website data
 *
 * Both return the same output shape for consistent frontend consumption.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { executePrompt } from "./ai-providers/index.ts";
import { logAiUsage } from "./cost-calculator.ts";

// ─── Types ──────────────────────────────────────────────────

export interface SuggestedTopic {
  id: string;
  title: string;
}

export interface SuggestedPrompt {
  id: string;
  title: string;
}

export interface TopicSuggestionResult {
  suggested_topics: SuggestedTopic[];
  suggested_prompts: Record<string, SuggestedPrompt[]>;
}

// ─── Algorithmic suggestions (from GEO category scores) ─────
// Used by the pre-analyze onboarding flow. No API call needed.

interface AlgorithmicSuggestionsInput {
  domain: string;
  websiteTitle: string;
  categoryScores: Record<string, number>;
}

const CATEGORY_TOPIC_MAP: Record<string, { title: string; prompts: (domain: string) => string[] }> = {
  technical: {
    title: "Technical SEO & Performance",
    prompts: (domain) => [
      `Analyze page load speed and Core Web Vitals for ${domain}`,
      `Check mobile responsiveness and cross-device compatibility`,
      `Review structured data and schema markup implementation`,
      `Audit robots.txt and sitemap configuration`,
    ],
  },
  content: {
    title: "Content Quality & Strategy",
    prompts: (domain) => [
      `Evaluate content structure and heading hierarchy for ${domain}`,
      `Assess keyword coverage and topic relevance`,
      `Review meta descriptions and title tags optimization`,
      `Analyze content freshness and update frequency`,
    ],
  },
  authority: {
    title: "Authority & Credibility",
    prompts: (domain) => [
      `Evaluate expertise signals and trust indicators on ${domain}`,
      `Review internal linking structure and content depth`,
      `Assess citation potential and authoritative sourcing`,
      `Analyze brand mentions and digital presence`,
    ],
  },
  semantic: {
    title: "Semantic & AI Readiness",
    prompts: (_domain) => [
      `Review AI bot accessibility and llms.txt configuration`,
      `Analyze semantic markup and entity recognition potential`,
      `Assess FAQ and conversational content coverage`,
      `Evaluate content structure for AI snippet extraction`,
    ],
  },
};

export function generateAlgorithmicSuggestions(
  input: AlgorithmicSuggestionsInput,
): TopicSuggestionResult {
  const { domain, websiteTitle, categoryScores } = input;

  // Sort categories by score (ascending) — weakest areas first
  const sortedCategories = Object.entries(categoryScores).sort((a, b) => a[1] - b[1]);

  // Always include the brand topic first
  const suggestedTopics: SuggestedTopic[] = [
    { id: "topic_brand", title: `Brand Presence: ${websiteTitle}` },
  ];
  const suggestedPrompts: Record<string, SuggestedPrompt[]> = {
    topic_brand: [
      { id: "prompt_brand_0", title: `How is ${websiteTitle} positioned in AI search results?` },
      { id: "prompt_brand_1", title: `What do AI assistants say about ${websiteTitle}?` },
      { id: "prompt_brand_2", title: `Compare ${websiteTitle} visibility across AI platforms` },
    ],
  };

  // Add topics from the weakest categories (max 3 more = 4 total)
  for (const [cat] of sortedCategories) {
    if (suggestedTopics.length >= 4) break;
    const mapping = CATEGORY_TOPIC_MAP[cat];
    if (!mapping) continue;

    const topicId = `topic_${cat}`;
    suggestedTopics.push({ id: topicId, title: mapping.title });
    suggestedPrompts[topicId] = mapping.prompts(domain).slice(0, 3).map((promptTitle, pIdx) => ({
      id: `prompt_${cat}_${pIdx}`,
      title: promptTitle,
    }));
  }

  return { suggested_topics: suggestedTopics, suggested_prompts: suggestedPrompts };
}

// ─── AI-powered suggestions (from extracted website data) ────
// Uses OpenAI via the adapter layer.

interface ExistingTopic {
  name: string;
  prompts: string[];
}

interface AiSuggestionsInput {
  websiteTitle: string | null;
  metatags: string | null;
  extractedContent: string | null;
  sitemapXml: string | null;
  language: string;
  existingTopics?: ExistingTopic[];
  // Optional: provide tenantId and db for usage logging
  tenantId?: string;
  db?: SupabaseClient;
}

interface RawTopic {
  name: string;
  description?: string;
  isExisting?: boolean;
  prompts: Array<{ text: string; description?: string }>;
}

export async function generateAiSuggestions(
  input: AiSuggestionsInput,
): Promise<TopicSuggestionResult & { raw_topics: RawTopic[] }> {
  const { websiteTitle, metatags, extractedContent, sitemapXml, language, existingTopics, tenantId, db } = input;

  if (!extractedContent) {
    throw new Error("Cannot generate suggestions without extracted content.");
  }

  // Build the prompt parts
  const parts: string[] = [];

  parts.push(`You are an expert AI prompt engineer and SEO analyst.
Based on the following extracted details about a website/company, generate a list of topics and prompts that users might ask AI platforms (like ChatGPT or Perplexity) about the services, products, or industry this company operates in.

**CRITICAL INSTRUCTIONS:**
1. The prompts and topics must be **GENERIC** and focused on customer **NECESSITIES** or **SERVICES**.
2. **DO NOT MENTION THE COMPANY NAME** or specific brand names in the prompts or topics.
3. Imagine a client who needs a solution this company provides, but doesn't necessarily know the company yet.
4. You should suggest 3-5 high-value topics. For each topic, suggest 3-5 relevant prompts.
5. **DO NOT** create prompts that are duplicates or very similar to existing ones listed below.
6. If an existing topic could benefit from NEW additional prompts, include it with "is_existing": true and ONLY new prompts (not the ones already listed).
7. For brand-new topics that don't overlap with existing ones, use "is_existing": false.

**LANGUAGE REQUIREMENT:**
- You MUST respond in the following language: ${language}
- All fields in the JSON (name, prompts text) must be in ${language}.

Data:
- Title: ${websiteTitle}
- Meta: ${metatags}
- Overview: ${extractedContent}`);

  if (existingTopics && existingTopics.length > 0) {
    const existingBlock = existingTopics.map(t => {
      const promptList = t.prompts.map(p => `  - "${p}"`).join("\n");
      return `- Topic: "${t.name}"\n  Existing prompts:\n${promptList}`;
    }).join("\n");

    parts.push(`
**EXISTING TOPICS AND PROMPTS (DO NOT DUPLICATE):**
${existingBlock}

IMPORTANT: Avoid generating prompts that are identical to or very similar in meaning to any of the listed existing prompts. If you suggest prompts for an existing topic, set "is_existing": true and only include NEW prompts that complement the existing ones.`);
  }

  parts.push(`
You must respond with ONLY a valid JSON object matching the following structure exactly, with no markdown fences or other text:
{
  "topics": [
    {
      "name": "string (Generic Topic Name in ${language})",
      "is_existing": false,
      "prompts": [
        {
          "text": "string (Generic prompt focused on service/need in ${language})"
        }
      ]
    }
  ]
}`);

  let prompt = parts.join("\n");

  if (sitemapXml) {
    const truncatedSitemap = sitemapXml.slice(0, 15000);
    prompt += `

To assist you, here is the generated sitemap.xml content for the website:
<sitemap_xml>
${truncatedSitemap}
</sitemap_xml>`;
  }

  // Use adapter layer instead of direct fetch
  const aiResult = await executePrompt("openai", {
    prompt,
    model: "gpt-4o",
    webSearchEnabled: false,
  });

  if (aiResult.error || !aiResult.text) {
    throw new Error(aiResult.error || "AI provider returned an empty response.");
  }

  // Log AI usage if tenantId and db are provided
  if (tenantId && db) {
    await logAiUsage(db, {
      tenantId,
      callSite: "suggest_topics",
      platformSlug: "openai",
      modelSlug: aiResult.model || "gpt-4o",
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
      metadata: { websiteTitle },
    });
  }

  // Parse JSON response — strip markdown fences if present
  let suggestionsJson = aiResult.text.trim();
  suggestionsJson = suggestionsJson.replace(/^```(?:json)?\n?/gi, "").replace(/\n?```$/g, "");

  let parsedResult: { topics: Array<{ name: string; description?: string; is_existing?: boolean; prompts: Array<{ text: string; description?: string }> }> };
  try {
    parsedResult = JSON.parse(suggestionsJson);
  } catch {
    throw new Error("AI produced invalid JSON output.");
  }

  // Preserve raw topics for SuggestionsModal (with isExisting flag)
  const rawTopics: RawTopic[] = (parsedResult.topics || []).map(t => ({
    name: t.name,
    description: t.description,
    isExisting: t.is_existing || false,
    prompts: t.prompts || [],
  }));

  // Convert the AI response format into our standard TopicSuggestionResult
  const suggestedTopics: SuggestedTopic[] = [];
  const suggestedPrompts: Record<string, SuggestedPrompt[]> = {};

  for (let tIdx = 0; tIdx < (parsedResult.topics || []).length; tIdx++) {
    const topic = parsedResult.topics[tIdx];
    const topicId = `topic_ai_${tIdx}`;
    suggestedTopics.push({ id: topicId, title: topic.name });
    suggestedPrompts[topicId] = (topic.prompts || []).map((p, pIdx) => ({
      id: `prompt_ai_${tIdx}_${pIdx}`,
      title: p.text,
    }));
  }

  return { suggested_topics: suggestedTopics, suggested_prompts: suggestedPrompts, raw_topics: rawTopics };
}
