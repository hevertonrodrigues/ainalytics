/**
 * Shared prompt registry — re-exports all prompts and provides a helper
 * to replace `{{KEY}}` placeholders with runtime values.
 *
 * Example:
 *   const text = replaceVars(DEEP_ANALYZE_PROMPT, { URL: "https://..." });
 */

// Re-export every prompt constant
export { DEEP_ANALYZE_PROMPT } from "./deep-analyze.ts";
export { SCRAPE_COMPANY_ANALYZE_PROMPT } from "./scrape-company-analyze.ts";
export { EXTRACT_WEBSITE_INFO_PROMPT } from "./extract-website-info.ts";
export { GENERATE_LLM_TXT_PROMPT } from "./generate-llm-txt.ts";
export { INSIGHTS_PROMPT } from "./insights.ts";

/**
 * Replaces `{{KEY}}` placeholders in a prompt string with values.
 */
export function replaceVars(
  prompt: string,
  vars: Record<string, string>,
): string {
  let text = prompt;
  for (const [key, value] of Object.entries(vars)) {
    text = text.replaceAll(`{{${key}}}`, value);
  }
  return text;
}
