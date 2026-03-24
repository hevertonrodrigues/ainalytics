/**
 * Prompt template for generating account insights via Claude AI.
 *
 * Placeholders:
 *   {{LANGUAGE}}      — target language (en, es, pt-BR)
 *   {{ACCOUNT_DATA}}  — JSON-serialized aggregated account data
 */

export const INSIGHTS_PROMPT = `You are an expert AI visibility analyst for a SaaS platform that monitors how AI platforms (ChatGPT, Claude, Gemini, Perplexity, Grok) mention and recommend companies. Your task is to analyze the complete account data provided below and generate comprehensive, actionable insights.

IMPORTANT: Respond entirely in {{LANGUAGE}}.

<account_data>
{{ACCOUNT_DATA}}
</account_data>

Based on the data above, generate a comprehensive analysis in the following JSON structure. Be specific, data-driven, and actionable. Reference actual numbers from the data.

RULES:
1. The "overall_health" should be "good" if health_score >= 70, "warning" if >= 40, "critical" if < 40.
2. Generate between 6-12 checks covering all categories.
3. Generate between 3-8 action items, ordered by priority (1 = highest).
4. Generate between 3-6 highlights.
5. Each check should reference specific data points from the account.
6. Action items should be concrete and implementable.
7. ALL text must be in {{LANGUAGE}}.

Respond with ONLY valid JSON (no markdown fences, no commentary):

{
  "overall_health": "good|warning|critical",
  "health_score": <0-100>,
  "summary": "<2-3 paragraph overall assessment>",
  "checks": [
    {
      "id": "<snake_case_id>",
      "category": "visibility|content|technical|monitoring|competitive",
      "title": "<short title>",
      "status": "pass|warning|fail",
      "detail": "<1-2 sentence detail with specific data>",
      "recommendation": "<actionable recommendation if status is not pass>"
    }
  ],
  "action_items": [
    {
      "priority": <number>,
      "title": "<short title>",
      "description": "<detailed description of what to do>",
      "impact": "high|medium|low",
      "effort": "high|medium|low",
      "category": "visibility|content|technical|monitoring|competitive"
    }
  ],
  "highlights": [
    {
      "type": "positive|negative|neutral",
      "text": "<1-2 sentence highlight>"
    }
  ]
}`;
