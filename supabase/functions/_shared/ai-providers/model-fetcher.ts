/**
 * Model Fetcher — fetches available models from each platform's API
 * and includes pricing data (per-token input/output prices in USD).
 *
 * Pricing source: hardcoded map based on official pricing pages.
 * None of the AI APIs expose pricing in their model list endpoints,
 * so we maintain a reference map and fall back to pattern matching.
 *
 * Supported:
 *   - OpenAI:    GET https://api.openai.com/v1/models
 *   - Anthropic: GET https://api.anthropic.com/v1/models
 *   - Gemini:    GET https://generativelanguage.googleapis.com/v1beta/models?key=KEY
 *   - Grok/xAI:  GET https://api.x.ai/v1/models
 *
 * NOT supported (no list endpoint):
 *   - Perplexity: no model listing API
 */

export interface FetchedModel {
  slug: string;
  name: string;
  pricePerInputToken: number;
  pricePerOutputToken: number;
}

// ═══════════════════════════════════════════════════════════════
// Pricing Reference Maps (USD per token)
// Source: official pricing pages, updated 2026-03
// ═══════════════════════════════════════════════════════════════

interface PricingEntry {
  input: number;
  output: number;
}

// OpenAI pricing — https://openai.com/api/pricing/
const OPENAI_PRICING: Record<string, PricingEntry> = {
  // GPT-4.1 family
  "gpt-4.1":                { input: 0.000002,    output: 0.000008   },
  "gpt-4.1-mini":           { input: 0.0000004,   output: 0.0000016  },
  "gpt-4.1-nano":           { input: 0.0000001,   output: 0.0000004  },
  // GPT-4o family
  "gpt-4o":                 { input: 0.0000025,   output: 0.000010   },
  "gpt-4o-mini":            { input: 0.00000015,  output: 0.0000006  },
  // GPT-4.5 / 5 family
  "gpt-4.5-preview":        { input: 0.000075,    output: 0.00015    },
  "gpt-5.2-pro":            { input: 0.000010,    output: 0.000040   },
  // o-series reasoning
  "o1":                     { input: 0.000015,    output: 0.000060   },
  "o1-mini":                { input: 0.000001,    output: 0.000004   },
  "o1-pro":                 { input: 0.00015,     output: 0.0006     },
  "o3":                     { input: 0.000010,    output: 0.000040   },
  "o3-mini":                { input: 0.0000011,   output: 0.0000044  },
  "o3-pro":                 { input: 0.00002,     output: 0.00008    },
  "o4-mini":                { input: 0.0000011,   output: 0.0000044  },
  // ChatGPT
  "chatgpt-4o-latest":      { input: 0.000005,    output: 0.000015   },
};

// Anthropic pricing — https://www.anthropic.com/pricing
const ANTHROPIC_PRICING: Record<string, PricingEntry> = {
  "claude-opus-4":          { input: 0.000015,    output: 0.000075   },
  "claude-sonnet-4":        { input: 0.000003,    output: 0.000015   },
  "claude-sonnet-4-5":      { input: 0.000003,    output: 0.000015   },
  "claude-haiku-4":         { input: 0.0000008,   output: 0.000004   },
  "claude-haiku-4-5":       { input: 0.0000008,   output: 0.000004   },
};

// Gemini pricing — https://ai.google.dev/pricing
const GEMINI_PRICING: Record<string, PricingEntry> = {
  "gemini-2.5-pro":         { input: 0.00000125,  output: 0.000010   },
  "gemini-2.5-flash":       { input: 0.00000015,  output: 0.0000006  },
  "gemini-2.5-flash-lite":  { input: 0.00000015,  output: 0.0000006  },
  "gemini-2.0-flash":       { input: 0.0000001,   output: 0.0000004  },
  "gemini-2.0-flash-lite":  { input: 0.000000075, output: 0.0000003  },
  "gemini-1.5-pro":         { input: 0.00000125,  output: 0.000005   },
  "gemini-1.5-flash":       { input: 0.000000075, output: 0.0000003  },
};

// Grok/xAI pricing — https://docs.x.ai/docs/models
const GROK_PRICING: Record<string, PricingEntry> = {
  "grok-3":                 { input: 0.000003,    output: 0.000015   },
  "grok-3-fast":            { input: 0.000005,    output: 0.000025   },
  "grok-3-mini":            { input: 0.0000003,   output: 0.0000005  },
  "grok-3-mini-fast":       { input: 0.0000006,   output: 0.000004   },
  "grok-4-1":               { input: 0.000003,    output: 0.000015   },
  "grok-4-1-fast":          { input: 0.000005,    output: 0.000025   },
};

const PLATFORM_PRICING: Record<string, Record<string, PricingEntry>> = {
  openai: OPENAI_PRICING,
  anthropic: ANTHROPIC_PRICING,
  gemini: GEMINI_PRICING,
  grok: GROK_PRICING,
};

/**
 * Look up pricing for a model slug.
 * Strategy:
 *   1. Exact match
 *   2. Strip date suffix (e.g. "claude-sonnet-4-5-20250929" → try "claude-sonnet-4-5")
 *   3. Progressive prefix match (longest prefix wins)
 *   4. Default: zero (admin must set manually)
 */
function lookupPricing(platformSlug: string, modelSlug: string): PricingEntry {
  const map = PLATFORM_PRICING[platformSlug];
  if (!map) return { input: 0, output: 0 };

  // 1. Exact match
  if (map[modelSlug]) return map[modelSlug];

  // 2. Strip date suffix (YYYYMMDD or YYYY-MM-DD)
  const stripped = modelSlug
    .replace(/-\d{8}$/, "")
    .replace(/-\d{4}-\d{2}-\d{2}$/, "");
  if (stripped !== modelSlug && map[stripped]) return map[stripped];

  // 3. Progressive prefix match (longest wins)
  let bestMatch = "";
  let bestPricing: PricingEntry = { input: 0, output: 0 };
  for (const [key, pricing] of Object.entries(map)) {
    if (modelSlug.startsWith(key) && key.length > bestMatch.length) {
      bestMatch = key;
      bestPricing = pricing;
    }
  }
  if (bestMatch) return bestPricing;

  return { input: 0, output: 0 };
}

// ── OpenAI ──────────────────────────────────────────────────

export async function fetchOpenAIModels(): Promise<FetchedModel[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return [];

  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.data || [])
    .filter((m: { id: string }) =>
      /^(gpt-|o[0-9]|chatgpt-)/.test(m.id) && !/^(gpt-image|gpt-.*preview)/.test(m.id),
    )
    .map((m: { id: string }) => {
      const pricing = lookupPricing("openai", m.id);
      return { slug: m.id, name: m.id, pricePerInputToken: pricing.input, pricePerOutputToken: pricing.output };
    })
    .sort((a: FetchedModel, b: FetchedModel) => a.slug.localeCompare(b.slug));
}

// ── Anthropic ───────────────────────────────────────────────

export async function fetchAnthropicModels(): Promise<FetchedModel[]> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return [];

  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.data || [])
    .map((m: { id: string; display_name?: string }) => {
      const pricing = lookupPricing("anthropic", m.id);
      return {
        slug: m.id,
        name: m.display_name || m.id,
        pricePerInputToken: pricing.input,
        pricePerOutputToken: pricing.output,
      };
    })
    .sort((a: FetchedModel, b: FetchedModel) => a.slug.localeCompare(b.slug));
}

// ── Gemini ──────────────────────────────────────────────────

export async function fetchGeminiModels(): Promise<FetchedModel[]> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return [];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
  );
  if (!res.ok) return [];

  const data = await res.json();
  return (data.models || [])
    .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes("generateContent"),
    )
    .map((m: { name: string; displayName?: string }) => {
      const slug = m.name.replace("models/", "");
      const pricing = lookupPricing("gemini", slug);
      return {
        slug,
        name: m.displayName || slug,
        pricePerInputToken: pricing.input,
        pricePerOutputToken: pricing.output,
      };
    })
    .sort((a: FetchedModel, b: FetchedModel) => a.slug.localeCompare(b.slug));
}

// ── Grok (xAI) ──────────────────────────────────────────────

export async function fetchGrokModels(): Promise<FetchedModel[]> {
  const apiKey = Deno.env.get("XAI_API_KEY");
  if (!apiKey) return [];

  const res = await fetch("https://api.x.ai/v1/models", {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.data || [])
    .filter((m: { id: string }) => /^grok-/.test(m.id))
    .map((m: { id: string }) => {
      const pricing = lookupPricing("grok", m.id);
      return { slug: m.id, name: m.id, pricePerInputToken: pricing.input, pricePerOutputToken: pricing.output };
    })
    .sort((a: FetchedModel, b: FetchedModel) => a.slug.localeCompare(b.slug));
}

// ── Registry ────────────────────────────────────────────────

const FETCHERS: Record<string, () => Promise<FetchedModel[]>> = {
  openai: fetchOpenAIModels,
  anthropic: fetchAnthropicModels,
  gemini: fetchGeminiModels,
  grok: fetchGrokModels,
  // perplexity: no list models API
};

/**
 * Fetch models for a platform by slug.
 * Returns empty array if no fetcher exists or API key is missing.
 */
export async function fetchModelsForPlatform(slug: string): Promise<FetchedModel[]> {
  const fetcher = FETCHERS[slug];
  if (!fetcher) return [];
  try {
    return await fetcher();
  } catch (err) {
    console.error(`[model-fetcher] Error fetching ${slug} models:`, err);
    return [];
  }
}

/**
 * Check if a platform supports model listing.
 */
export function supportsModelListing(slug: string): boolean {
  return slug in FETCHERS;
}
