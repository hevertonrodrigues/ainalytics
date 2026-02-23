/**
 * Model Fetcher — fetches available models from each platform's API.
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
    .map((m: { id: string }) => ({ slug: m.id, name: m.id }))
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
    .map((m: { id: string; display_name?: string }) => ({
      slug: m.id,
      name: m.display_name || m.id,
    }))
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
    .map((m: { name: string; displayName?: string }) => ({
      slug: m.name.replace("models/", ""),
      name: m.displayName || m.name.replace("models/", ""),
    }))
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
    .map((m: { id: string }) => ({ slug: m.id, name: m.id }))
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
