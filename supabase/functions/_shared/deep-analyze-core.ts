/**
 * Deep Analyze Core — reusable logic for running a deep AI analysis.
 *
 * Used by:
 *  - deep-analyze/index.ts (standalone endpoint)
 *  - scrape-company/index.ts (integrated into GEO analysis flow)
 */

import { executePrompt } from "./ai-providers/index.ts";
import { resolveModel } from "./cost-calculator.ts";
import { DEEP_ANALYZE_PROMPT, replaceVars } from "./prompts/load.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const MODEL_SLUG = "gpt-5.2-pro";

// ─── Language → Country mapping ─────────────────────────────
const LANG_MAP: Record<string, { language: string; country: string }> = {
  "pt-BR": { language: "pt-BR", country: "Brasil" },
  "pt-br": { language: "pt-BR", country: "Brasil" },
  pt:      { language: "pt-BR", country: "Brasil" },
  es:      { language: "es",    country: "España" },
  en:      { language: "en",    country: "USA" },
};

export interface DeepAnalyzeResult {
  company_name: string | null;
  url: string;
  analysis_scope: {
    primary_url: string;
    relevant_pages_used: Array<{ url: string; page_type: string; reason_used: string }>;
  } | null;
  final_score: number | null;
  generic_score: number | null;
  specific_score: number | null;
  metric_scores: Record<string, number>;
  reasoning: Record<string, unknown> | null;
  high_probability_prompts: unknown[];
  improvements: unknown[];
  confidence: number | null;
  raw_response: unknown | null;
  // ── Token tracking (for cost logging by callers) ────────
  tokens: { input: number; output: number } | null;
  latency_ms: number;
  platform_slug: string;
  model_slug: string;
  prompt_text: string;
  raw_request: unknown | null;
  annotations: unknown | null;
  sources: unknown | null;
}

/**
 * Runs the deep-analyze AI call and returns structured results.
 * Does NOT save to the database — callers are responsible for persistence.
 */
export async function runDeepAnalyze(
  db: SupabaseClient,
  url: string,
  language: string,
): Promise<DeepAnalyzeResult> {
  const langConfig = LANG_MAP[language] || LANG_MAP["en"];

  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  console.log(`[deep-analyze-core] ▶ Starting analysis for ${normalizedUrl} (lang: ${langConfig.language}, country: ${langConfig.country})`);

  // Build prompt
  const prompt = replaceVars(DEEP_ANALYZE_PROMPT, {
    URL: normalizedUrl,
    TARGET_LANGUAGE: langConfig.language,
    TARGET_COUNTRY: langConfig.country,
  });

  const modelRecord = await resolveModel(db, MODEL_SLUG);

  // Call AI
  const aiResult = await executePrompt({
    prompt,
    model: modelRecord,
    webSearchEnabled: true,
    country: langConfig.country,
  });

  if (aiResult.error || !aiResult.text) {
    throw new Error(aiResult.error || "AI returned empty response.");
  }

  // Parse JSON (strip markdown fences if present)
  let cleanText = aiResult.text.trim();
  cleanText = cleanText.replace(/^```(?:json)?\n?/gi, "").replace(/\n?```$/g, "");

  // deno-lint-ignore no-explicit-any
  let parsed: any;
  try {
    parsed = JSON.parse(cleanText);
  } catch {
    console.error("[deep-analyze-core] Failed to parse AI JSON:", cleanText.slice(0, 500));
    throw new Error("AI produced invalid JSON output.");
  }

  const scores = parsed.scores || {};
  const metricScores = scores.metric_scores || {};

  return {
    company_name: parsed.company_name || null,
    url: parsed.url || normalizedUrl,
    analysis_scope: parsed.analysis_scope || null,
    final_score: scores.final_score ?? null,
    generic_score: scores.generic_score ?? null,
    specific_score: scores.specific_score ?? null,
    metric_scores: metricScores,
    reasoning: parsed.reasoning || null,
    high_probability_prompts: parsed.high_probability_prompts || [],
    improvements: parsed.improvements || [],
    confidence: parsed.confidence ?? null,
    raw_response: aiResult.raw_response ?? null,
    // Token tracking for callers to log usage
    tokens: aiResult.tokens,
    latency_ms: aiResult.latency_ms,
    platform_slug: modelRecord.platformSlug,
    model_slug: MODEL_SLUG,
    prompt_text: prompt,
    raw_request: aiResult.raw_request ?? null,
    annotations: aiResult.annotations,
    sources: aiResult.sources,
  };
}
