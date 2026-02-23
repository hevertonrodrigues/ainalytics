/**
 * Shared normalization helpers for AI provider adapters.
 *
 * Every adapter should use these helpers to build consistent responses.
 */

import type { AiRequest, AiResponse, NormalizedAnnotation, NormalizedSource } from "./types.ts";

// ── Source helpers ─────────────────────────────────────────

/** Convert a sources Map to a deduplicated NormalizedSource array. */
export function toSourcesArray(map: Map<string, { url: string; title: string }>): NormalizedSource[] {
  return [...map.values()];
}

// ── Response builders ─────────────────────────────────────

/** Build a standard error AiResponse. */
export function buildErrorResponse(
  req: AiRequest,
  start: number,
  error: string,
  rawReq?: unknown,
  rawRes?: unknown,
): AiResponse {
  return {
    text: null,
    model: req.model,
    tokens: null,
    latency_ms: Date.now() - start,
    raw_request: rawReq,
    raw_response: rawRes,
    error,
    web_search_enabled: false,
    annotations: null,
    sources: null,
  };
}

/** Build a standard success AiResponse with all normalized fields. */
export function buildSuccessResponse(fields: {
  text: string | null;
  model: string;
  tokens: { input: number; output: number } | null;
  latency_ms: number;
  raw_request: unknown;
  raw_response: unknown;
  web_search_enabled: boolean;
  annotations: NormalizedAnnotation[];
  sources: NormalizedSource[];
}): AiResponse {
  return {
    text: fields.text,
    model: fields.model,
    tokens: fields.tokens,
    latency_ms: fields.latency_ms,
    raw_request: fields.raw_request,
    raw_response: fields.raw_response,
    web_search_enabled: fields.web_search_enabled,
    annotations: fields.annotations.length > 0 ? fields.annotations : null,
    sources: fields.sources.length > 0 ? fields.sources : null,
  };
}

/** Log a warning and mark web search as false if enabled but no results returned. */
export function verifyWebSearchResults(
  platform: string,
  model: string,
  webSearchEnabled: boolean,
  annotations: NormalizedAnnotation[],
  sourcesMap: Map<string, { url: string; title: string }>,
): boolean {
  if (webSearchEnabled && annotations.length === 0 && sourcesMap.size === 0) {
    console.warn(`[${platform}] web search was enabled but no citations returned for ${model} — marking web_search_enabled as false`);
    return false;
  }
  return webSearchEnabled;
}
