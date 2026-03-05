/**
 * Shared Topic & Prompt Suggestion Module
 *
 * Two modes of generating topic/prompt suggestions:
 * 1. Algorithmic — based on GEO category scores (fast, no API call)
 * 2. AI-powered — uses OpenAI GPT-4o from extracted website data
 *
 * Both return the same output shape for consistent frontend consumption.
 */

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
// Uses OpenAI GPT-4o. Returns topics/prompts in the requested language.

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
  const { websiteTitle, metatags, extractedContent, sitemapXml, language, existingTopics } = input;

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

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("[suggest-topics] OPENAI_API_KEY is not set in environment");
    throw new Error("OPENAI_API_KEY is not configured");
  }
  console.log(`[suggest-topics] Using OPENAI_API_KEY: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)} (${apiKey.length} chars)`);

  const chatBody = {
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  };

  console.log(`[suggest-topics] Sending request to OpenAI (model: gpt-4o, prompt length: ${prompt.length} chars)`);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(chatBody),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "Could not read body");
    console.error(`[suggest-topics] OpenAI API error: HTTP ${res.status} ${res.statusText}`);
    console.error(`[suggest-topics] Error body: ${errorBody}`);
    throw new Error(`OpenAI API error: HTTP ${res.status} — ${errorBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const suggestionsJson = data.choices[0]?.message?.content;

  if (!suggestionsJson) {
    throw new Error("AI provider returned an empty response.");
  }

  let parsedResult: { topics: Array<{ name: string; description?: string; is_existing?: boolean; prompts: Array<{ text: string; description?: string }> }> };
  try {
    parsedResult = JSON.parse(suggestionsJson.trim());
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
