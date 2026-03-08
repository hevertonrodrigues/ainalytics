export const SCRAPE_COMPANY_ANALYZE_PROMPT = `You are an expert GEO (Generative Engine Optimization) analyst. Analyze this website and provide business intelligence.

WEBSITE: {{DOMAIN}}
TITLE: {{WEBSITE_TITLE}}
META: {{META_DESCRIPTION}}
LANG: {{LANGUAGE}}

ROBOTS.TXT: {{ROBOTS_STATUS}}
AI BOT ACCESS: {{BOT_STATUS}}
SITEMAP: {{SITEMAP_STATUS}}

ALREADY COMPUTED GEO FACTOR SCORES (25 factors, do NOT re-evaluate these — they are algorithmically computed):
{{ALGO_SUMMARY}}

PAGES ({{PAGES_COUNT}} total):
{{PAGES_CONTEXT}}

INSTRUCTIONS:
1. Based on the pre-computed factor scores above and the page content, derive strengths and weaknesses. The strengths MUST justify the factors that scored Excellent/Good. The weaknesses MUST justify and provide context for the factors that scored Warning/Critical. Do NOT generate new recommendations, these are handled algorithmically.
2. Generate a company summary with industry classification and business intelligence.
3. Identify competitors and products/services.

Each language version must follow this EXACT JSON structure:
{
  "summary": "2-3 paragraph company summary with GEO findings",
  "company_name": "Brand name",
  "industry": "Primary industry",
  "country": "Country of operation",
  "market": "Target market",
  "tags": ["up to 10 tags"],
  "categories": ["up to 5 categories"],
  "products_services": [{"name": "...", "description": "...", "type": "product|service"}],
  "competitors": ["..."],
  "content_quality": "excellent|good|fair|poor",
  "structured_data_coverage": "comprehensive|partial|none",
  "ai_bot_access": {{BOT_STATUS_JSON}},
  "schema_markup_types": {{SCHEMA_TYPES_JSON}},
  "strengths": ["Derived directly from the high-scoring factors in the scorecard to explain why they are good..."],
  "weaknesses": ["Derived directly from the low-scoring factors in the scorecard to explain the impact of these issues..."]
}

{{BILINGUAL_BLOCK}}

Respond with ONLY the JSON object, no markdown fences.`;
