/**
 * GEO Factor Definitions — Single Source of Truth
 *
 * This file defines all 25 GEO optimization factors with their:
 *   - ID, name, category, weight
 *   - Scoring rules (formula description, optimal ranges, thresholds)
 *   - Score interpretation by range
 *   - Recommendations per status level
 *
 * Weights are calibrated from the GEO Analyzer Implementation Guide
 * based on cross-platform AI consensus (how many AI platforms mentioned
 * the factor) and average importance rating.
 *
 * Total weight sum = 1.000 (100%)
 *
 * To add a new factor:
 *   1. Add a new entry to GEO_FACTORS below
 *   2. Create the scorer function in geo-scoring.ts or nlp-analysis.ts
 *   3. Wire it into computeAlgorithmicFactorScores()
 */

export type GeoFactorId =
  | "ssr_detection"
  | "robots_txt_ai"
  | "schema_jsonld"
  | "heading_hierarchy"
  | "faq_detection"
  | "xml_sitemap"
  | "answer_first"
  | "page_speed"
  | "semantic_html"
  | "internal_linking"
  | "alt_text"
  | "canonical_urls"
  | "clean_urls"
  | "content_freshness"
  | "meta_descriptions"
  | "https_security"
  | "mobile_responsive"
  | "html_tables"
  | "paragraph_quality"
  | "html_lists"
  | "js_dependency"
  | "status_codes"
  | "open_graph"
  | "readability"
  | "entity_consistency";

export type GeoCategory = "Technical" | "Content" | "Authority" | "Semantic";

export interface ScoreInterpretation {
  range: [number, number]; // [min, max] inclusive
  status: "excellent" | "good" | "warning" | "critical";
  meaning: string;
}

export interface GeoFactorDefinition {
  id: GeoFactorId;
  name: string;
  category: GeoCategory;
  weight: number; // Decimal, e.g. 0.080 = 8.0%
  crossPlatformWeight: number; // Out of 10
  platformsMentioned: number; // Out of 5 AI platforms

  description: string;
  scoringRules: string; // Human-readable formula description
  optimalRange?: string;

  interpretations: ScoreInterpretation[];

  criticalRecommendations: string[]; // When score < 40
  warningRecommendations: string[];  // When score 40-69
  generalRecommendations: string[];  // When score 70-89
}

// ─── All 25 GEO Factors ──────────────────────────────────────

export const GEO_FACTORS: GeoFactorDefinition[] = [
  // ═══════════════════════════════════════════════════════════
  // TECHNICAL INFRASTRUCTURE (14 factors)
  // ═══════════════════════════════════════════════════════════

  {
    id: "ssr_detection",
    name: "Server-Side Rendering",
    category: "Technical",
    weight: 0.080,
    crossPlatformWeight: 9.9,
    platformsMentioned: 5,
    description: "Measures whether content is available in the initial HTML response without requiring JavaScript execution. Critical because AI crawlers (GPTBot, ClaudeBot, etc.) do NOT execute JavaScript.",
    scoringRules: "SSR text ratio (raw text / rendered text) × 40 + % pages fully rendered × 35 + critical content presence check × 25. A site with 0% SSR gets near-zero score.",
    optimalRange: "SSR ratio ≥ 0.90",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Full SSR — 90%+ of content visible without JS" },
      { range: [70, 89], status: "good", meaning: "Mostly SSR — some JS-dependent elements" },
      { range: [40, 69], status: "warning", meaning: "Partial SSR — significant content hidden behind JS" },
      { range: [0, 39], status: "critical", meaning: "No SSR — site is nearly invisible to AI crawlers" },
    ],
    criticalRecommendations: [
      "Implement server-side rendering (SSR) or static site generation (SSG) immediately.",
      "Ensure H1, paragraph content, and <main>/<article> elements appear in the initial HTML payload.",
      "Consider Next.js, Nuxt.js, or similar SSR frameworks.",
    ],
    warningRecommendations: [
      "Move critical content above the fold into the initial HTML response.",
      "Ensure key product/service descriptions render server-side.",
    ],
    generalRecommendations: [
      "Audit remaining JS-dependent content sections and consider pre-rendering.",
    ],
  },

  {
    id: "robots_txt_ai",
    name: "robots.txt AI Crawlers",
    category: "Technical",
    weight: 0.075,
    crossPlatformWeight: 9.4,
    platformsMentioned: 5,
    description: "Evaluates whether AI search and training crawlers are permitted to access the website via robots.txt directives.",
    scoringRules: "Search bot accessibility × 45 + training bot policy × 20 + file existence × 10 + sitemap reference × 10 + blanket block penalty × 15.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "All search bots allowed, deliberate training bot policy" },
      { range: [70, 89], status: "good", meaning: "Most bots accessible" },
      { range: [40, 69], status: "warning", meaning: "Some important bots blocked" },
      { range: [0, 39], status: "critical", meaning: "Major crawlers blocked or blanket disallow" },
    ],
    criticalRecommendations: [
      "Remove blanket 'User-agent: * Disallow: /' if present.",
      "Explicitly allow AI search bots: OAI-SearchBot, Claude-SearchBot, PerplexityBot.",
    ],
    warningRecommendations: [
      "Review blocked bots and ensure search-oriented AI bots have access.",
      "Add a 'Sitemap:' directive pointing to your XML sitemap.",
    ],
    generalRecommendations: [
      "Add explicit Allow rules for AI bots to signal intentional access.",
    ],
  },

  {
    id: "schema_jsonld",
    name: "Schema.org / JSON-LD",
    category: "Technical",
    weight: 0.070,
    crossPlatformWeight: 9.2,
    platformsMentioned: 4,
    description: "Evaluates the presence, variety, and validity of JSON-LD structured data across pages.",
    scoringRules: "Page coverage (target 80%) × 35 + schema type variety × 30 + high-value types (Article, FAQ, Organization, Product) × 20 + validity ratio × 15.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Comprehensive schema coverage with multiple high-value types" },
      { range: [70, 89], status: "good", meaning: "Good coverage with key schema types" },
      { range: [40, 69], status: "warning", meaning: "Partial schema, missing important types" },
      { range: [0, 39], status: "critical", meaning: "No or minimal structured data" },
    ],
    criticalRecommendations: [
      "Add JSON-LD structured data to all pages — start with Organization schema.",
      "Implement Article/BlogPosting schema on content pages.",
    ],
    warningRecommendations: [
      "Add FAQPage, Product, and BreadcrumbList schema types.",
      "Validate existing schema using Google's Rich Results Test.",
    ],
    generalRecommendations: [
      "Expand schema coverage to 80%+ of pages.",
    ],
  },

  {
    id: "xml_sitemap",
    name: "XML Sitemap",
    category: "Technical",
    weight: 0.050,
    crossPlatformWeight: 8.2,
    platformsMentioned: 3,
    description: "Evaluates presence, quality, and freshness signals of the XML sitemap.",
    scoringRules: "Existence × 15 + valid XML × 10 + lastmod coverage × 25 + freshness (90-day ratio) × 20 + cross-reference with crawled pages × 15 + robots.txt reference × 15.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Complete sitemap with fresh lastmod dates" },
      { range: [70, 89], status: "good", meaning: "Sitemap present with partial lastmod coverage" },
      { range: [40, 69], status: "warning", meaning: "Sitemap exists but lacks freshness signals" },
      { range: [0, 39], status: "critical", meaning: "No sitemap or severely incomplete" },
    ],
    criticalRecommendations: [
      "Create an XML sitemap and submit it to search engines and AI crawlers.",
    ],
    warningRecommendations: [
      "Add <lastmod> dates to all sitemap URLs.",
      "Reference your sitemap in robots.txt.",
    ],
    generalRecommendations: [
      "Set up automatic sitemap regeneration when content changes.",
    ],
  },

  {
    id: "page_speed",
    name: "Page Speed / TTFB",
    category: "Technical",
    weight: 0.045,
    crossPlatformWeight: 8.0,
    platformsMentioned: 3,
    description: "Measures server response time (TTFB) which affects AI crawler efficiency. Slow responses may cause crawler timeouts.",
    scoringRules: "Average TTFB score × 45 + % pages under 200ms × 35 + P95 TTFB score × 20. TTFB < 200ms = 1.0, < 500ms = 0.4-1.0 linear, > 1000ms = poor.",
    optimalRange: "TTFB < 200ms",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Fast responses, all pages under 500ms" },
      { range: [70, 89], status: "good", meaning: "Most pages respond quickly" },
      { range: [40, 69], status: "warning", meaning: "Some slow pages affecting crawl efficiency" },
      { range: [0, 39], status: "critical", meaning: "Very slow — AI crawlers may timeout" },
    ],
    criticalRecommendations: [
      "Optimize server response times — aim for TTFB under 200ms.",
      "Implement CDN and server-side caching.",
    ],
    warningRecommendations: [
      "Identify and optimize slow-responding pages.",
    ],
    generalRecommendations: [
      "Monitor P95 response times to prevent outlier slowdowns.",
    ],
  },

  {
    id: "semantic_html",
    name: "Semantic HTML5",
    category: "Technical",
    weight: 0.045,
    crossPlatformWeight: 8.3,
    platformsMentioned: 5,
    description: "Evaluates use of semantic HTML5 elements vs generic <div> elements. Semantic markup helps AI understand page structure.",
    scoringRules: "Semantic ratio (semantic / total structural elements) < 0.15 target × 40 + essential elements (<main>, <article>, <nav>, <header>/<footer>) × 40 + variety of semantic types × 20.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Rich semantic structure, minimal div-soup" },
      { range: [70, 89], status: "good", meaning: "Good semantic element usage" },
      { range: [40, 69], status: "warning", meaning: "Excessive <div> usage, limited semantics" },
      { range: [0, 39], status: "critical", meaning: "Almost no semantic HTML — pure div-based layout" },
    ],
    criticalRecommendations: [
      "Add a <main> element to every page.",
      "Replace excessive <div> usage with <article>, <section>, <aside>.",
    ],
    warningRecommendations: [
      "Add <header>, <footer>, <nav> elements to improve structure.",
    ],
    generalRecommendations: [
      "Use <figure> with <figcaption> for images and <time> for dates.",
    ],
  },

  {
    id: "canonical_urls",
    name: "Canonical URLs",
    category: "Technical",
    weight: 0.035,
    crossPlatformWeight: 7.6,
    platformsMentioned: 3,
    description: "Checks that pages have canonical URL tags that correctly point to the preferred version, preventing duplicate content issues.",
    scoringRules: "Coverage (pages with canonical) × 35 + correct self-referencing × 30 + HTTPS canonicals × 15 + sitemap alignment × 20.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "All pages have correct canonical URLs" },
      { range: [70, 89], status: "good", meaning: "Most pages have canonicals" },
      { range: [40, 69], status: "warning", meaning: "Inconsistent canonical implementation" },
      { range: [0, 39], status: "critical", meaning: "Missing or broken canonical URLs" },
    ],
    criticalRecommendations: [
      "Add canonical URL tags to all pages.",
    ],
    warningRecommendations: [
      "Ensure canonical URLs use HTTPS and match the actual page URL.",
    ],
    generalRecommendations: [
      "Align canonical URLs with sitemap entries.",
    ],
  },

  {
    id: "clean_urls",
    name: "Clean URL Structure",
    category: "Technical",
    weight: 0.030,
    crossPlatformWeight: 7.6,
    platformsMentioned: 2,
    description: "Evaluates URL cleanliness: no session IDs, no excessive parameters, readable paths with hyphens.",
    scoringRules: "Per-URL cleanliness (penalize session IDs -0.3, tracking params -0.15, non-alpha paths -0.1, depth > 4 -0.1) × 50 + % without query params × 25 + base score 25.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Clean, descriptive URLs throughout" },
      { range: [70, 89], status: "good", meaning: "Mostly clean URLs" },
      { range: [40, 69], status: "warning", meaning: "URLs with tracking params or session IDs" },
      { range: [0, 39], status: "critical", meaning: "Messy URLs that confuse AI crawlers" },
    ],
    criticalRecommendations: [
      "Remove session IDs and tracking parameters from URLs.",
      "Use clean, descriptive URL paths with hyphens.",
    ],
    warningRecommendations: [
      "Reduce URL depth to 3-4 segments maximum.",
    ],
    generalRecommendations: [],
  },

  {
    id: "meta_descriptions",
    name: "Meta Descriptions",
    category: "Technical",
    weight: 0.030,
    crossPlatformWeight: 7.6,
    platformsMentioned: 3,
    description: "Evaluates presence, quality, length, and uniqueness of meta description tags.",
    scoringRules: "Coverage × 35 + optimal length (120-160 chars) × 25 + uniqueness (no duplicates) × 25 + quality baseline 15.",
    optimalRange: "120-160 characters",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "All pages have unique, optimal-length descriptions" },
      { range: [70, 89], status: "good", meaning: "Good coverage with mostly unique descriptions" },
      { range: [40, 69], status: "warning", meaning: "Gaps in coverage or duplicate descriptions" },
      { range: [0, 39], status: "critical", meaning: "Missing or very poor meta descriptions" },
    ],
    criticalRecommendations: [
      "Add unique, descriptive meta descriptions to all pages.",
    ],
    warningRecommendations: [
      "Make each meta description unique — avoid duplicates.",
      "Aim for 120-160 characters per description.",
    ],
    generalRecommendations: [],
  },

  {
    id: "https_security",
    name: "HTTPS Security",
    category: "Technical",
    weight: 0.035,
    crossPlatformWeight: 9.0,
    platformsMentioned: 3,
    description: "Checks HTTPS enforcement, HSTS headers, and consistent secure serving across all pages.",
    scoringRules: "HTTPS coverage × 40 + full enforcement bonus × 20 + HSTS header × 10 + consistency × 20 + base 10.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Full HTTPS with HSTS" },
      { range: [70, 89], status: "good", meaning: "HTTPS enforced, minor HSTS gaps" },
      { range: [40, 69], status: "warning", meaning: "Mixed content or incomplete HTTPS" },
      { range: [0, 39], status: "critical", meaning: "No HTTPS — major trust issue" },
    ],
    criticalRecommendations: [
      "Enforce HTTPS on all pages with proper redirects.",
      "Add HSTS header to prevent downgrade attacks.",
    ],
    warningRecommendations: [
      "Fix mixed content issues.",
    ],
    generalRecommendations: [],
  },

  {
    id: "mobile_responsive",
    name: "Mobile Responsive",
    category: "Technical",
    weight: 0.030,
    crossPlatformWeight: 7.4,
    platformsMentioned: 2,
    description: "Evaluates mobile-responsive design through viewport meta tag, CSS media queries, and content parity between mobile and desktop.",
    scoringRules: "Correct viewport meta × 30 + content parity (mobile vs desktop) × 40 + responsive CSS indicators × 30.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Fully responsive with content parity" },
      { range: [70, 89], status: "good", meaning: "Responsive design, minor content differences" },
      { range: [40, 69], status: "warning", meaning: "Partial responsiveness, content gaps on mobile" },
      { range: [0, 39], status: "critical", meaning: "Not mobile-responsive" },
    ],
    criticalRecommendations: [
      "Add proper viewport meta tag: <meta name='viewport' content='width=device-width, initial-scale=1'>",
    ],
    warningRecommendations: [
      "Ensure all critical content is visible on mobile viewports.",
    ],
    generalRecommendations: [],
  },

  {
    id: "js_dependency",
    name: "JS-Dependent Content",
    category: "Technical",
    weight: 0.045,
    crossPlatformWeight: 9.0,
    platformsMentioned: 3,
    description: "Detects content that requires JavaScript execution to become visible (accordions, tabs, modals, infinite scroll). AI crawlers cannot trigger these interactions.",
    scoringRules: "% pages with visible content without JS × 55 + no captcha pages × 15 + absence of hidden-content patterns × 30.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "All content accessible without JavaScript" },
      { range: [70, 89], status: "good", meaning: "Most content accessible, minor JS-dependent elements" },
      { range: [40, 69], status: "warning", meaning: "Significant content hidden behind JS interactions" },
      { range: [0, 39], status: "critical", meaning: "Critical content requires JS — invisible to AI" },
    ],
    criticalRecommendations: [
      "Ensure all content is accessible without JavaScript execution.",
      "Remove captcha/anti-bot mechanisms from content pages.",
    ],
    warningRecommendations: [
      "Replace JS-dependent accordions/tabs with <details>/<summary> elements.",
      "Avoid infinite scroll — use pagination instead.",
    ],
    generalRecommendations: [],
  },

  {
    id: "status_codes",
    name: "HTTP Status Codes",
    category: "Technical",
    weight: 0.030,
    crossPlatformWeight: 7.4,
    platformsMentioned: 2,
    description: "Evaluates HTTP status code health: percentage of 200 OK responses, error rates, and redirect handling.",
    scoringRules: "% 200 OK × 40 + (1 - error rate) × 25 + redirect health × 15 + soft-404 check × 10 + base 10.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "All pages return 200 OK, no errors" },
      { range: [70, 89], status: "good", meaning: "Mostly healthy with minor issues" },
      { range: [40, 69], status: "warning", meaning: "Notable error or redirect issues" },
      { range: [0, 39], status: "critical", meaning: "Significant error pages or broken redirects" },
    ],
    criticalRecommendations: [
      "Fix broken pages returning 4xx/5xx error codes.",
      "Fix redirect chains longer than 2 hops.",
    ],
    warningRecommendations: [
      "Eliminate soft-404 pages that return 200 but display error content.",
    ],
    generalRecommendations: [],
  },

  {
    id: "open_graph",
    name: "Open Graph Tags",
    category: "Technical",
    weight: 0.020,
    crossPlatformWeight: 6.8,
    platformsMentioned: 2,
    description: "Evaluates Open Graph meta tags which AI platforms use for preview generation and content identification.",
    scoringRules: "Core tags (title + description + image) coverage × 40 + full completeness (6 tags) × 30 + consistency estimate × 20 + image quality estimate × 10.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Complete OG tags on all pages, consistent" },
      { range: [70, 89], status: "good", meaning: "Core OG tags present, mostly consistent" },
      { range: [40, 69], status: "warning", meaning: "Partial OG coverage or inconsistencies" },
      { range: [0, 39], status: "critical", meaning: "No or minimal Open Graph tags" },
    ],
    criticalRecommendations: [
      "Add og:title, og:description, og:image to all pages.",
    ],
    warningRecommendations: [
      "Add og:type, og:url, og:site_name for complete coverage.",
    ],
    generalRecommendations: [],
  },

  // ═══════════════════════════════════════════════════════════
  // CONTENT STRUCTURE (8 factors)
  // ═══════════════════════════════════════════════════════════

  {
    id: "heading_hierarchy",
    name: "Heading Hierarchy",
    category: "Content",
    weight: 0.055,
    crossPlatformWeight: 8.7,
    platformsMentioned: 5,
    description: "Evaluates proper heading structure: single H1, valid hierarchy (no level skipping), question-based headings, and heading IDs.",
    scoringRules: "Single H1 per page × 30 + valid hierarchy (no skipping) × 30 + question heading ratio (target 50%) × 25 + heading ID coverage × 15.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Perfect heading hierarchy with question headings" },
      { range: [70, 89], status: "good", meaning: "Mostly correct hierarchy" },
      { range: [40, 69], status: "warning", meaning: "Hierarchy issues or missing H1s" },
      { range: [0, 39], status: "critical", meaning: "Broken heading structure" },
    ],
    criticalRecommendations: [
      "Ensure each page has exactly one H1 tag.",
      "Fix heading hierarchy — don't skip levels (e.g., H1 → H3).",
    ],
    warningRecommendations: [
      "Add question-based H2/H3 headings that match user queries.",
    ],
    generalRecommendations: [
      "Add ID attributes to headings for deep linking.",
    ],
  },

  {
    id: "faq_detection",
    name: "FAQ with Schema",
    category: "Content",
    weight: 0.050,
    crossPlatformWeight: 8.6,
    platformsMentioned: 3,
    description: "Detects FAQ content both in JSON-LD schema (FAQPage mainEntity) and HTML patterns (clusters of question-based headings).",
    scoringRules: "Schema FAQ coverage (target 20% of pages) × 30 + total Q&A volume (capped at 50) × 25 + self-contained answers × 25 + schema/HTML cross-reference × 20.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Rich FAQ content with matching schema" },
      { range: [70, 89], status: "good", meaning: "FAQ present with schema support" },
      { range: [40, 69], status: "warning", meaning: "Some FAQ content but gaps in schema" },
      { range: [0, 39], status: "critical", meaning: "No FAQ content or schema detected" },
    ],
    criticalRecommendations: [
      "Add FAQ sections with question-based headings to key pages.",
      "Implement FAQPage JSON-LD schema with mainEntity items.",
    ],
    warningRecommendations: [
      "Expand FAQ sections with more question-answer pairs.",
    ],
    generalRecommendations: [],
  },

  {
    id: "answer_first",
    name: "Answer-First Structure",
    category: "Content",
    weight: 0.065,
    crossPlatformWeight: 9.0,
    platformsMentioned: 5,
    description: "Evaluates whether content sections lead with direct answers rather than filler phrases. AI platforms extract the first sentences of sections as potential citations.",
    scoringRules: "Answer-first section coverage (target 70%) × 40 + page consistency (>50% AF sections per page) × 30 + capsule quality (15-30 word declarative first sentences) × 30.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Most sections lead with direct, citable answers" },
      { range: [70, 89], status: "good", meaning: "Good answer-first adoption" },
      { range: [40, 69], status: "warning", meaning: "Too many filler introductions" },
      { range: [0, 39], status: "critical", meaning: "Content consistently starts with filler phrases" },
    ],
    criticalRecommendations: [
      "Lead content sections with direct, declarative answers instead of filler.",
      "Add 15-30 word 'answer capsule' sentences at the start of each section.",
    ],
    warningRecommendations: [
      "Ensure at least half your pages consistently use answer-first structure.",
      "Remove filler phrases like 'In this article...', 'When it comes to...'.",
    ],
    generalRecommendations: [],
  },

  {
    id: "internal_linking",
    name: "Internal Linking",
    category: "Content",
    weight: 0.040,
    crossPlatformWeight: 7.8,
    platformsMentioned: 5,
    description: "Evaluates internal linking quality: descriptive anchor text, link density per page, contextual vs navigation links, and orphan page detection.",
    scoringRules: "Descriptive anchor % × 35 + contextual link density (target 5+ per page) × 30 + orphan page detection × 20 + contextual vs navigation ratio × 15.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Rich contextual linking with descriptive anchors" },
      { range: [70, 89], status: "good", meaning: "Good linking with mostly descriptive text" },
      { range: [40, 69], status: "warning", meaning: "Generic anchors or low link density" },
      { range: [0, 39], status: "critical", meaning: "Poor internal linking — orphaned pages likely" },
    ],
    criticalRecommendations: [
      "Replace generic anchor text ('click here', 'read more') with descriptive text.",
      "Add contextual internal links within page content.",
    ],
    warningRecommendations: [
      "Aim for 5+ contextual internal links per content page.",
    ],
    generalRecommendations: [],
  },

  {
    id: "alt_text",
    name: "Image Alt Text",
    category: "Content",
    weight: 0.030,
    crossPlatformWeight: 7.4,
    platformsMentioned: 3,
    description: "Evaluates image accessibility through alt text coverage, quality (non-generic), and figure/caption usage.",
    scoringRules: "Alt text coverage × 50 + quality (non-generic alts / total alts) × 30 + figure+caption bonus × 20.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "All images have descriptive, unique alt text" },
      { range: [70, 89], status: "good", meaning: "Most images have alt text" },
      { range: [40, 69], status: "warning", meaning: "Gap in alt text coverage or generic descriptions" },
      { range: [0, 39], status: "critical", meaning: "Most images missing alt text" },
    ],
    criticalRecommendations: [
      "Add descriptive alt text to all content images.",
    ],
    warningRecommendations: [
      "Replace generic alt text ('image', 'photo', 'IMG_1234') with descriptive text.",
    ],
    generalRecommendations: [
      "Wrap images in <figure> with <figcaption> for richer AI context.",
    ],
  },

  {
    id: "html_tables",
    name: "Tables for Data",
    category: "Content",
    weight: 0.030,
    crossPlatformWeight: 7.2,
    platformsMentioned: 2,
    description: "Evaluates use of properly structured HTML tables for presenting comparative or tabular data.",
    scoringRules: "Usage rate (pages with tables, target 30%) × 30 + proper headers (<th>) × 40 + <thead> usage × 15 + <caption> usage × 15. Score of 40 if no tables found (not all sites need them).",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Well-structured tables with headers and captions" },
      { range: [70, 89], status: "good", meaning: "Tables present with proper structure" },
      { range: [40, 69], status: "warning", meaning: "Tables lack proper headers or structure" },
      { range: [0, 39], status: "critical", meaning: "No tables or very poor table structure" },
    ],
    criticalRecommendations: [
      "Add <thead> and <th> elements to all data tables.",
    ],
    warningRecommendations: [
      "Consider using HTML tables for comparative data instead of divs.",
    ],
    generalRecommendations: [
      "Add <caption> elements to describe what each table contains.",
    ],
  },

  {
    id: "paragraph_quality",
    name: "Paragraph Quality",
    category: "Content",
    weight: 0.035,
    crossPlatformWeight: 7.6,
    platformsMentioned: 3,
    description: "Evaluates paragraph length (optimal ≤80 words), self-containment (minimal cross-references), and overall digestibility.",
    scoringRules: "Average length score (≤80 words = 1.0, ≤100 = 0.8, ≤120 = 0.5, ≤150 = 0.3, >150 = 0.1) × 35 + % under 100 words × 25 + (1 - % over 150 words) × 15 + self-containment × 25.",
    optimalRange: "≤ 80 words per paragraph",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Short, self-contained paragraphs ideal for AI extraction" },
      { range: [70, 89], status: "good", meaning: "Mostly short paragraphs" },
      { range: [40, 69], status: "warning", meaning: "Too many long or cross-referencing paragraphs" },
      { range: [0, 39], status: "critical", meaning: "Wall-of-text content, hard to extract" },
    ],
    criticalRecommendations: [
      "Break long paragraphs into shorter, self-contained chunks of 80 words or fewer.",
    ],
    warningRecommendations: [
      "Reduce cross-references ('This', 'As mentioned above') — make paragraphs standalone.",
    ],
    generalRecommendations: [],
  },

  {
    id: "html_lists",
    name: "Numbered/Bulleted Lists",
    category: "Content",
    weight: 0.025,
    crossPlatformWeight: 7.0,
    platformsMentioned: 2,
    description: "Evaluates use of proper HTML lists (<ol>, <ul>) vs fake text lists (bullet characters in paragraphs).",
    scoringRules: "Usage rate (60% of pages target) × 35 + list density (1.5+ lists/page) × 30 + proper HTML (not fake lists) × 20 + variety (both OL and UL) × 15.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Rich, varied list usage across pages" },
      { range: [70, 89], status: "good", meaning: "Good list usage" },
      { range: [40, 69], status: "warning", meaning: "Low list usage or fake list patterns" },
      { range: [0, 39], status: "critical", meaning: "No or minimal list usage" },
    ],
    criticalRecommendations: [
      "Use proper HTML <ol> and <ul> lists instead of text bullet characters.",
    ],
    warningRecommendations: [
      "Add structured lists to content pages — aim for 1-2 per page.",
    ],
    generalRecommendations: [],
  },

  // ═══════════════════════════════════════════════════════════
  // AUTHORITY & TRUST (1 factor)
  // ═══════════════════════════════════════════════════════════

  {
    id: "content_freshness",
    name: "Content Freshness",
    category: "Authority",
    weight: 0.055,
    crossPlatformWeight: 8.3,
    platformsMentioned: 5,
    description: "Evaluates content recency through multiple date signals: schema dates, meta tags, visible dates, and sitemap lastmod.",
    scoringRules: "Date coverage × 20 + freshness rate (updated within 90 days) × 30 + visible date rate × 20 + schema date rate × 15 + (1 - stale content penalty) × 15.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Most content updated within 90 days, dates clearly visible" },
      { range: [70, 89], status: "good", meaning: "Good freshness with date signals" },
      { range: [40, 69], status: "warning", meaning: "Some dated content, incomplete date coverage" },
      { range: [0, 39], status: "critical", meaning: "No date signals or very stale content" },
    ],
    criticalRecommendations: [
      "Add visible 'Last Updated' dates to content pages.",
      "Add dateModified/datePublished to Article JSON-LD schema.",
    ],
    warningRecommendations: [
      "Update key content within the last 90 days.",
      "Review and refresh content older than 1 year.",
    ],
    generalRecommendations: [],
  },

  // ═══════════════════════════════════════════════════════════
  // SEMANTIC / NLP (2 factors)
  // ═══════════════════════════════════════════════════════════

  {
    id: "readability",
    name: "Natural Language Readability",
    category: "Semantic",
    weight: 0.030,
    crossPlatformWeight: 8.0,
    platformsMentioned: 2,
    description: "Evaluates text readability using Flesch-Kincaid Grade Level (optimal: 7-9), sentence length, and long sentence percentage.",
    scoringRules: "FK Grade (7-9 = 1.0, ±1 dev = 0.8, ±2 = 0.6, ±3 = 0.4, else 0.2) × 45 + sentence length (≤20 words = 1.0, ≤25 = 0.7, ≤30 = 0.4, else 0.2) × 30 + (1 - long sentence %) × 25.",
    optimalRange: "FK Grade Level 7-9, avg sentence ≤ 20 words",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Grade 7-9, short sentences, clear language" },
      { range: [70, 89], status: "good", meaning: "Close to optimal range, mostly clear" },
      { range: [40, 69], status: "warning", meaning: "Too complex or too simple, long sentences" },
      { range: [0, 39], status: "critical", meaning: "Academic-level complexity or very poor readability" },
    ],
    criticalRecommendations: [
      "Simplify language to target FK Grade Level 7-9.",
      "Shorten sentences to 20 words or fewer.",
    ],
    warningRecommendations: [
      "Break up long sentences exceeding 30 words.",
    ],
    generalRecommendations: [],
  },

  {
    id: "entity_consistency",
    name: "Consistent Entity Naming",
    category: "Semantic",
    weight: 0.025,
    crossPlatformWeight: 8.0,
    platformsMentioned: 2,
    description: "Evaluates consistency in brand/product naming, pronoun ambiguity, and abbreviation clarity across pages.",
    scoringRules: "Brand name consistency (1 variant = 1.0, else 1.0/variants) × 30 + product naming consistency × 25 + pronoun clarity (1 - pronoun_start_rate) × 25 + abbreviation clarity × 20.",
    interpretations: [
      { range: [90, 100], status: "excellent", meaning: "Consistent naming, minimal pronoun ambiguity" },
      { range: [70, 89], status: "good", meaning: "Mostly consistent with minor variations" },
      { range: [40, 69], status: "warning", meaning: "Inconsistent naming or pronoun ambiguity" },
      { range: [0, 39], status: "critical", meaning: "Frequent name switching, undefined abbreviations" },
    ],
    criticalRecommendations: [
      "Use a consistent brand name across all pages.",
      "Reduce paragraphs starting with 'It', 'This', 'They' — use specific entity names.",
    ],
    warningRecommendations: [
      "Define abbreviations on first use within each page.",
    ],
    generalRecommendations: [],
  },
];

// ─── Derived lookup maps ───────────────────────────────────

export const FACTOR_BY_ID: Record<string, GeoFactorDefinition> = {};
for (const f of GEO_FACTORS) FACTOR_BY_ID[f.id] = f;

export const FACTOR_IDS = GEO_FACTORS.map((f) => f.id);

// Normalize weights to sum to exactly 1.0
// (The guide's raw percentages sum to ~1.06 due to rounding; we preserve
//  relative proportions while ensuring composite scores stay in 0-100.)
const rawWeightSum = GEO_FACTORS.reduce((sum, f) => sum + f.weight, 0);
export const WEIGHTS: Record<string, number> = {};
for (const f of GEO_FACTORS) WEIGHTS[f.id] = f.weight / rawWeightSum;

export const NAMES: Record<string, string> = {};
for (const f of GEO_FACTORS) NAMES[f.id] = f.name;

export const CATEGORIES: Record<string, string> = {};
for (const f of GEO_FACTORS) CATEGORIES[f.id] = f.category;

// ─── Readiness Levels ──────────────────────────────────────
// ⚠ SYNC: This data MUST match shared/geo-config.json and
//   src/config/geo-readiness.ts — they are the single source of
//   truth. If you change levels, thresholds, or colors, update
//   ALL THREE locations.

export const READINESS_LEVELS = [
  { level: 0, label: "AI Invisible", threshold: 0, color: "#DC3545", description: "Fundamentally invisible to AI crawlers. Critical infrastructure failures." },
  { level: 1, label: "AI Hostile", threshold: 20, color: "#E67C00", description: "Severe deficiencies that actively prevent AI citation." },
  { level: 2, label: "AI Unaware", threshold: 40, color: "#FFC107", description: "Built without AI findability in mind. Rarely cited." },
  { level: 3, label: "AI Emerging", threshold: 60, color: "#8BC34A", description: "Foundational GEO elements in place but gaps remain." },
  { level: 4, label: "AI Optimized", threshold: 75, color: "#28A745", description: "Well-optimized for AI findability. Likely appearing in citations." },
  { level: 5, label: "AI Authority", threshold: 90, color: "#1B5E20", description: "Best-in-class GEO implementation. Dominates AI citations." },
];

// ─── Weight verification ───────────────────────────────────

const normalizedSum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(normalizedSum - 1.0) > 0.001) {
  console.error(`[geo-factors] Normalized weight sum is ${normalizedSum}, expected 1.0!`);
}

