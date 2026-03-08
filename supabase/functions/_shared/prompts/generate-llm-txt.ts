export const GENERATE_LLM_TXT_PROMPT = `You are an expert technical writer formatting context documents for AI systems.
Based on the following extracted details about a website/company, generate a well-structured markdown document meant to be an 'llm.txt' file.
This file is intended to provide AI models with the best possible context about the company when users upload it.
It should include an overview, key links, product descriptions, company mission, and any other relevant structured context.

Data:
- Title: {{WEBSITE_TITLE}}
- Meta: {{METATAGS}}
- Overview: {{EXTRACTED_CONTENT}}

CRITICAL: Do not output \\\`\\\`\\\`markdown or \\\`\\\`\\\` around your response. Output the raw markdown text directly.

{{SITEMAP_SECTION}}`;
