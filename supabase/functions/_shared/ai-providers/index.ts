/**
 * AI Provider Registry — extensible adapter router.
 *
 * To add a new platform:
 * 1. Create a new adapter file (e.g., newplatform.ts)
 * 2. Register it in the REGISTRY below
 * 3. Add the corresponding API key env var to .env
 */

import type { AiAdapter, AiRequest, AiResponse, ModelRecord, PlatformRegistryEntry } from "./types.ts";
import { openaiAdapter } from "./openai.ts";
import { anthropicAdapter } from "./anthropic.ts";
import { geminiAdapter } from "./gemini.ts";
import { grokAdapter } from "./grok.ts";
import { perplexityAdapter } from "./perplexity.ts";

// ── Platform Registry ─────────────────────────────────────
// Add new platforms here. Each entry maps a slug to its adapter
// and the environment variable name for its API key.
const REGISTRY: PlatformRegistryEntry[] = [
  { slug: "openai",     adapter: openaiAdapter,     envVar: "OPENAI_API_KEY" },
  { slug: "anthropic",  adapter: anthropicAdapter,   envVar: "ANTHROPIC_API_KEY" },
  { slug: "gemini",     adapter: geminiAdapter,      envVar: "GEMINI_API_KEY" },
  { slug: "grok",       adapter: grokAdapter,        envVar: "XAI_API_KEY" },
  { slug: "perplexity", adapter: perplexityAdapter,  envVar: "PERPLEXITY_API_KEY" },
];

const registryMap = new Map(REGISTRY.map((e) => [e.slug, e]));

/**
 * Get the adapter for a platform slug.
 */
export function getAdapter(slug: string): AiAdapter | null {
  return registryMap.get(slug)?.adapter ?? null;
}

/**
 * Check if a platform's API key is configured.
 */
export function isPlatformConfigured(slug: string): boolean {
  const entry = registryMap.get(slug);
  if (!entry) return false;
  return !!Deno.env.get(entry.envVar);
}

/**
 * Execute a prompt against a specific platform.
 * The model's platformSlug is used to route to the correct adapter.
 */
export async function executePrompt(req: AiRequest): Promise<AiResponse> {
  const adapter = getAdapter(req.model.platformSlug);
  if (!adapter) {
    return {
      text: null,
      model: req.model.slug,
      tokens: null,
      latency_ms: 0,
      error: `Unknown platform: ${req.model.platformSlug}`,
      web_search_enabled: false,
      annotations: null,
      sources: null,
    };
  }
  return adapter(req);
}

/**
 * Execute a prompt against multiple models/platforms in parallel.
 */
export async function executePromptMulti(
  models: ModelRecord[],
  prompt: string,
  systemInstruction?: string,
  webSearchEnabled?: boolean,
  country?: string,
  language?: string,
): Promise<Array<{ slug: string } & AiResponse>> {
  const results = await Promise.allSettled(
    models.map(async (model) => {
      const res = await executePrompt({
        prompt,
        model,
        systemInstruction,
        webSearchEnabled,
        country,
        language,
      });
      return { slug: model.platformSlug, ...res };
    }),
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      slug: models[i].platformSlug,
      text: null,
      model: models[i].slug,
      tokens: null,
      latency_ms: 0,
      error: String(r.reason),
      web_search_enabled: false,
      annotations: null,
      sources: null,
    };
  });
}

// Re-export types
export type { AiRequest, AiResponse, ModelRecord, PlatformRegistryEntry, NormalizedAnnotation, NormalizedSource } from "./types.ts";
