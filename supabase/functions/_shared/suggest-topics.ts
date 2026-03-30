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
import { logAiUsage, resolveModel } from "./cost-calculator.ts";

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
      `is ${domain} fast on mobile? it feels slow sometimes`,
      `why does ${domain} take so long to load on my phone`,
      `does ${domain} work well on all devices or just desktop`,
      `how can I check if ${domain} shows up right in google`,
    ],
  },
  content: {
    title: "Content Quality & Strategy",
    prompts: (domain) => [
      `is the content on ${domain} actually useful or is it just filler`,
      `what keywords should a site like ${domain} be ranking for`,
      `how do I know if my website content is outdated`,
      `what's missing from ${domain} content compared to competitors`,
    ],
  },
  authority: {
    title: "Authority & Credibility",
    prompts: (domain) => [
      `does ${domain} look trustworthy to visitors`,
      `how can ${domain} build more credibility online`,
      `what makes a website like ${domain} seem more legit`,
      `is ${domain} being mentioned on other sites or just floating alone`,
    ],
  },
  semantic: {
    title: "Semantic & AI Readiness",
    prompts: (_domain) => [
      `can chatgpt and other AIs actually find and understand my website`,
      `how do I make sure AI assistants recommend my business`,
      `what should I add to my site so AI can pull info from it`,
      `do AI tools like perplexity even know my company exists`,
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
      { id: "prompt_brand_0", title: `if I ask chatgpt about ${websiteTitle}, what does it say?` },
      { id: "prompt_brand_1", title: `does AI even know about ${websiteTitle}? like if someone asks` },
      { id: "prompt_brand_2", title: `is ${websiteTitle} showing up when people use AI to search?` },
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
  // Optional: provide tenantId, userId and db for usage logging
  tenantId?: string;
  userId?: string;
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
  const { websiteTitle, metatags, extractedContent, sitemapXml, language, existingTopics, tenantId, userId, db } = input;

  if (!extractedContent) {
    throw new Error("Cannot generate suggestions without extracted content.");
  }

  // Build the prompt parts
  const parts: string[] = [];

  parts.push(`You are an expert at understanding how real people talk to AI assistants like ChatGPT, Perplexity, and Google Gemini.
Based on the following extracted details about a website/company, generate a list of topics and prompts that **real potential customers** would type into AI platforms when looking for the kind of services or products this company offers.

**CRITICAL INSTRUCTIONS:**
1. The prompts MUST sound like a **real person casually asking an AI for help** — not like a marketer or SEO analyst.
2. Write prompts the way the company's **target audience actually talks**: informal, direct, sometimes with typos-level casualness. Think of someone typing into ChatGPT at 11pm trying to solve a problem.
3. **DO NOT MENTION THE COMPANY NAME** or specific brand names in the prompts or topics.
4. Imagine someone who has a need but doesn't know this company yet — they're describing their problem or what they're looking for in their own words.
5. Mix up the prompt styles:
   - Some should be questions ("what's the best...", "how do I...")
   - Some should be requests ("help me find...", "I need a...")
   - Some should be conversational ("I'm looking for...", "so I have this problem...")
6. **DO NOT** use formal or corporate language. Avoid words like "evaluate", "assess", "analyze", "optimize", "leverage". Use words real people use.
7. You should suggest 3-5 high-value topics. For each topic, suggest 3-5 relevant prompts.
8. **DO NOT** create prompts that are duplicates or very similar to existing ones listed below.
9. If an existing topic could benefit from NEW additional prompts, include it with "is_existing": true and ONLY new prompts (not the ones already listed).
10. For brand-new topics that don't overlap with existing ones, use "is_existing": false.

**EXAMPLES OF GOOD "HUMANIZED" PROMPTS (for reference style only, do not copy):**
- "I need someone to fix my website, it's super slow on phones"
- "what's the best way to get more clients for my boat rental business"
- "help me understand why nobody finds my site on google"
- "is it worth investing in social media ads for a small business"
- "I'm trying to sell more online but idk where to start"

**EXAMPLES OF BAD PROMPTS (too formal, avoid this style):**
- "Evaluate the technical SEO performance metrics"
- "Assess the competitive landscape and market positioning"
- "Analyze content strategy effectiveness and engagement rates"

**LANGUAGE REQUIREMENT:**
- You MUST respond in the following language: ${language}
- All fields in the JSON (name, prompts text) must be in ${language}.
- The informal/conversational tone must match how native speakers of ${language} actually type in chat — use their natural contractions, slang, and casual phrasing.

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

  // Use adapter layer — model must exist in the `models` table
  const model = await resolveModel(db, "gpt-4.1-mini");
  const aiResult = await executePrompt({
    prompt,
    model,
    webSearchEnabled: false,
  });

  if (aiResult.error || !aiResult.text) {
    throw new Error(aiResult.error || "AI provider returned an empty response.");
  }

  // Log AI usage if tenantId and db are provided
  if (tenantId && db) {
    await logAiUsage(db, {
      tenantId,
      userId,
      callSite: "suggest_topics",
      platformSlug: model.platformSlug,
      modelSlug: model.slug,
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
