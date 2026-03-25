-- ═══════════════════════════════════════════════════════════════
-- Backfill: ai_usage_log ← prompt_answers
-- 
-- Generates ai_usage_log entries for ALL existing prompt_answers
-- (15,675 records across openai, gemini, anthropic, grok).
--
-- Token structure: tokens_used = { "input": N, "output": N }
-- Cost is calculated using model pricing from the models table.
-- 
-- Safe to re-run: uses NOT EXISTS to skip already-backfilled rows.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_usage_log (
  tenant_id,
  user_id,
  call_site,
  platform_slug,
  model_slug,
  model_id,
  prompt_text,
  system_instruction,
  request_params,
  raw_request,
  answer_text,
  annotations,
  sources,
  response_params,
  raw_response,
  error,
  tokens_input,
  tokens_output,
  price_per_input,
  price_per_output,
  cost_input_usd,
  cost_output_usd,
  cost_total_usd,
  latency_ms,
  web_search_enabled,
  prompt_answer_id,
  metadata,
  created_at
)
SELECT
  pa.tenant_id,
  NULL::uuid                              AS user_id,
  'prompt_execution'                      AS call_site,
  pa.platform_slug,
  COALESCE(m.slug, 'unknown')             AS model_slug,
  pa.model_id,
  NULL                                    AS prompt_text,
  NULL                                    AS system_instruction,
  jsonb_build_object(
    'web_search_enabled', pa.web_search_enabled
  )                                       AS request_params,
  pa.raw_request,
  pa.answer_text,
  pa.annotations,
  pa.sources,
  NULL::jsonb                             AS response_params,
  pa.raw_response,
  pa.error,
  -- Token counts from tokens_used JSONB { input, output }
  COALESCE((pa.tokens_used->>'input')::integer, 0)   AS tokens_input,
  COALESCE((pa.tokens_used->>'output')::integer, 0)  AS tokens_output,
  -- Pricing snapshot from models table
  COALESCE(m.price_per_input_token,  0)  AS price_per_input,
  COALESCE(m.price_per_output_token, 0)  AS price_per_output,
  -- Calculated costs (input_tokens × price + output_tokens × price)
  COALESCE((pa.tokens_used->>'input')::integer, 0)
    * COALESCE(m.price_per_input_token, 0)            AS cost_input_usd,
  COALESCE((pa.tokens_used->>'output')::integer, 0)
    * COALESCE(m.price_per_output_token, 0)           AS cost_output_usd,
  (COALESCE((pa.tokens_used->>'input')::integer, 0)
    * COALESCE(m.price_per_input_token, 0))
  + (COALESCE((pa.tokens_used->>'output')::integer, 0)
    * COALESCE(m.price_per_output_token, 0))          AS cost_total_usd,
  pa.latency_ms,
  pa.web_search_enabled,
  pa.id                                  AS prompt_answer_id,
  jsonb_build_object(
    'backfill', true,
    'source',  'prompt_answers'
  )                                       AS metadata,
  pa.created_at
FROM prompt_answers pa
LEFT JOIN models m ON m.id = pa.model_id
WHERE pa.deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM ai_usage_log aul
    WHERE aul.prompt_answer_id = pa.id
  )
ORDER BY pa.created_at ASC;
