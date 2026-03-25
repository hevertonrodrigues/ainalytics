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
import type { ModelRecord } from "./ai-providers/types.ts";

// ── Types ────────────────────────────────────────────────────

export interface ModelPricing {
  modelId: string | null;
  pricePerInputToken: number;
  pricePerOutputToken: number;
}

/** Resolved model info from the DB `models` table. */
export interface ModelInfo {
  id: string;
  slug: string;
  platformSlug: string;
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

// ── In-memory model cache ────────────────────────────────────

const pricingCache = new Map<string, ModelPricing>();
const modelInfoCache = new Map<string, ModelInfo>();
let cacheLoaded = false;

/**
 * Load all model pricing into memory (once per invocation).
 * Caches by `platform_slug:model_slug` key.
 */
async function ensureModelCache(db: SupabaseClient): Promise<void> {
  if (cacheLoaded) return;

  // Use two simple queries instead of PostgREST join (which can fail
  // if PostgREST's schema cache hasn't picked up the FK yet).
  const [modelsRes, platformsRes] = await Promise.all([
    db.from("models")
      .select("id, slug, platform_id, price_per_input_token, price_per_output_token")
      .order("slug"),
    db.from("platforms")
      .select("id, slug"),
  ]);

  if (modelsRes.error) {
    console.error("[cost-calculator] Failed to load models:", modelsRes.error.message);
    cacheLoaded = true;
    return;
  }
  if (platformsRes.error) {
    console.error("[cost-calculator] Failed to load platforms:", platformsRes.error.message);
    cacheLoaded = true;
    return;
  }

  // Build platform lookup map
  const platformMap = new Map<string, string>();
  for (const p of (platformsRes.data || [])) {
    platformMap.set(p.id, p.slug);
  }

  for (const m of (modelsRes.data || [])) {
    const platformSlug = platformMap.get(m.platform_id);
    if (!platformSlug) continue;

    const key = `${platformSlug}:${m.slug}`;
    pricingCache.set(key, {
      modelId: m.id,
      pricePerInputToken: Number(m.price_per_input_token) || 0,
      pricePerOutputToken: Number(m.price_per_output_token) || 0,
    });
    modelInfoCache.set(key, {
      id: m.id,
      slug: m.slug,
      platformSlug,
      pricePerInputToken: Number(m.price_per_input_token) || 0,
      pricePerOutputToken: Number(m.price_per_output_token) || 0,
    });
  }

  cacheLoaded = true;
  console.log(`[cost-calculator] Loaded pricing for ${pricingCache.size} models`);
}

// ── Public API ───────────────────────────────────────────────

/**
 * Resolve a model from the DB by platform slug and model slug.
 * Returns the model info including its UUID, slug, and pricing.
 * Throws if the model is not found — fail-fast to prevent silent zero-cost logs.
 */
export async function getModelBySlug(
  db: SupabaseClient,
  platformSlug: string,
  modelSlug: string,
): Promise<ModelInfo> {
  await ensureModelCache(db);

  const key = `${platformSlug}:${modelSlug}`;
  const cached = modelInfoCache.get(key);
  if (cached) return cached;

  // Fallback: try finding by model slug across all platforms
  for (const [k, v] of modelInfoCache.entries()) {
    if (k.endsWith(`:${modelSlug}`)) return v;
  }

  // List available slugs for the platform to help debug
  const available = Array.from(modelInfoCache.keys())
    .filter(k => k.startsWith(`${platformSlug}:`))
    .map(k => k.split(":")[1]);
  throw new Error(
    `[cost-calculator] Model "${modelSlug}" not found for platform "${platformSlug}". ` +
    `Available: [${available.join(", ")}]`
  );
}

/**
 * Resolve a model from the DB by slug alone (no platform needed).
 * Returns a `ModelRecord` compatible with `AiRequest.model`.
 * Throws if the model is not found in the models table.
 */
export async function resolveModel(
  db: SupabaseClient,
  modelSlug: string,
): Promise<ModelRecord> {
  await ensureModelCache(db);

  // Search across all platforms for a matching slug
  for (const [, v] of modelInfoCache.entries()) {
    if (v.slug === modelSlug) {
      return { id: v.id, slug: v.slug, platformSlug: v.platformSlug };
    }
  }

  const available = Array.from(modelInfoCache.values()).map(v => v.slug);
  throw new Error(
    `[cost-calculator] Model "${modelSlug}" not found. Available: [${available.join(", ")}]`
  );
}

/**
 * Look up pricing for a specific model.
 * Returns default zero pricing if model not found.
 */
export async function lookupModelPricing(
  db: SupabaseClient,
  platformSlug: string,
  modelSlug: string,
): Promise<ModelPricing> {
  await ensureModelCache(db);

  const key = `${platformSlug}:${modelSlug}`;
  const cached = pricingCache.get(key);
  if (cached) return cached;

  // Try stripping version date suffix (e.g. "gpt-4o-2024-08-06" → "gpt-4o")
  const baseSlug = modelSlug.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  if (baseSlug !== modelSlug) {
    const baseKey = `${platformSlug}:${baseSlug}`;
    const baseCached = pricingCache.get(baseKey);
    if (baseCached) return baseCached;
  }

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
