/**
 * Cost Calculator & AI Usage Logger
 *
 * Provides:
 *  - Model pricing lookup (with in-memory cache per invocation)
 *  - Cost calculation from token counts
 *  - Centralized logging to ai_usage_log table
 *
 * Usage:
 *   import { logAiUsage } from "../_shared/cost-calculator.ts";
 *   await logAiUsage(db, { tenantId, callSite, ... });
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ── Types ────────────────────────────────────────────────────

export interface ModelPricing {
  modelId: string | null;
  pricePerInputToken: number;
  pricePerOutputToken: number;
}

export interface CostResult {
  costInput: number;
  costOutput: number;
  costTotal: number;
}

export interface AiUsageLogParams {
  tenantId: string;
  userId?: string;
  callSite: string;
  platformSlug: string;
  modelSlug: string;
  // Request
  promptText?: string;
  systemInstruction?: string;
  requestParams?: Record<string, unknown>;
  rawRequest?: unknown;
  // Response
  answerText?: string | null;
  annotations?: unknown;
  sources?: unknown;
  responseParams?: Record<string, unknown>;
  rawResponse?: unknown;
  error?: string | null;
  // Tokens
  tokensInput?: number;
  tokensOutput?: number;
  // Performance
  latencyMs?: number;
  webSearchEnabled?: boolean;
  // References
  promptAnswerId?: string;
  metadata?: Record<string, unknown>;
}

// ── In-memory pricing cache ──────────────────────────────────

const pricingCache = new Map<string, ModelPricing>();
let cacheLoaded = false;

/**
 * Load all model pricing into memory (once per invocation).
 * Caches by `platform_slug:model_slug` key.
 */
async function ensurePricingCache(db: SupabaseClient): Promise<void> {
  if (cacheLoaded) return;

  const { data: models, error } = await db
    .from("models")
    .select("id, slug, platform_id, price_per_input_token, price_per_output_token, platforms!inner(slug)")
    .order("slug");

  if (error) {
    console.error("[cost-calculator] Failed to load model pricing:", error.message);
    cacheLoaded = true; // Don't retry on every call
    return;
  }

  for (const m of (models || [])) {
    // deno-lint-ignore no-explicit-any
    const platformSlug = (m as any).platforms?.slug;
    if (!platformSlug) continue;

    const key = `${platformSlug}:${m.slug}`;
    pricingCache.set(key, {
      modelId: m.id,
      pricePerInputToken: Number(m.price_per_input_token) || 0,
      pricePerOutputToken: Number(m.price_per_output_token) || 0,
    });
  }

  cacheLoaded = true;
  console.log(`[cost-calculator] Loaded pricing for ${pricingCache.size} models`);
}

// ── Public API ───────────────────────────────────────────────

/**
 * Look up pricing for a specific model.
 * Returns default zero pricing if model not found.
 */
export async function lookupModelPricing(
  db: SupabaseClient,
  platformSlug: string,
  modelSlug: string,
): Promise<ModelPricing> {
  await ensurePricingCache(db);

  const key = `${platformSlug}:${modelSlug}`;
  const cached = pricingCache.get(key);
  if (cached) return cached;

  // Try partial match (e.g. "claude-sonnet-4-20250514" may match "claude-sonnet*")
  // Fallback: try finding by model slug only across all platforms
  for (const [k, v] of pricingCache.entries()) {
    if (k.endsWith(`:${modelSlug}`)) return v;
  }

  console.warn(`[cost-calculator] No pricing found for ${key}, using zero`);
  return { modelId: null, pricePerInputToken: 0, pricePerOutputToken: 0 };
}

/**
 * Calculate cost from token counts and pricing.
 */
export function calculateCost(
  tokensInput: number,
  tokensOutput: number,
  pricing: ModelPricing,
): CostResult {
  const costInput = tokensInput * pricing.pricePerInputToken;
  const costOutput = tokensOutput * pricing.pricePerOutputToken;
  return {
    costInput,
    costOutput,
    costTotal: costInput + costOutput,
  };
}

/**
 * Truncate a string or JSON to a max byte size for storage.
 */
function truncateForStorage(value: unknown, maxBytes = 50_000): unknown {
  if (value == null) return null;
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (str.length <= maxBytes) return value;
  if (typeof value === "string") return str.slice(0, maxBytes);
  return { _truncated: true, byte_length: str.length, preview: str.slice(0, maxBytes) };
}

/**
 * Log an AI usage event to the ai_usage_log table.
 * This is the main entry point — call this after every AI API invocation.
 *
 * Will not throw on failure — logs a warning instead.
 */
export async function logAiUsage(
  db: SupabaseClient,
  params: AiUsageLogParams,
): Promise<void> {
  try {
    const pricing = await lookupModelPricing(db, params.platformSlug, params.modelSlug);
    const tokensInput = params.tokensInput ?? 0;
    const tokensOutput = params.tokensOutput ?? 0;
    const cost = calculateCost(tokensInput, tokensOutput, pricing);

    const row = {
      tenant_id: params.tenantId,
      user_id: params.userId || null,
      call_site: params.callSite,
      platform_slug: params.platformSlug,
      model_slug: params.modelSlug,
      model_id: pricing.modelId,
      // Request
      prompt_text: truncateForStorage(params.promptText, 50_000),
      system_instruction: truncateForStorage(params.systemInstruction, 10_000),
      request_params: params.requestParams || null,
      raw_request: truncateForStorage(params.rawRequest, 30_000),
      // Response
      answer_text: truncateForStorage(params.answerText, 50_000),
      annotations: params.annotations || null,
      sources: params.sources || null,
      response_params: params.responseParams || null,
      raw_response: truncateForStorage(params.rawResponse, 30_000),
      error: params.error || null,
      // Tokens & Cost
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      price_per_input: pricing.pricePerInputToken,
      price_per_output: pricing.pricePerOutputToken,
      cost_input_usd: cost.costInput,
      cost_output_usd: cost.costOutput,
      cost_total_usd: cost.costTotal,
      // Performance
      latency_ms: params.latencyMs ?? null,
      web_search_enabled: params.webSearchEnabled ?? false,
      // References
      prompt_answer_id: params.promptAnswerId || null,
      metadata: params.metadata || null,
    };

    const { error } = await db.from("ai_usage_log").insert(row);

    if (error) {
      console.error("[cost-calculator] Failed to log AI usage:", error.message);
    }
  } catch (err) {
    console.error("[cost-calculator] Unexpected error logging AI usage:", err);
  }
}
