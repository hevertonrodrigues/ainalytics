/**
 * Enhanced HTML data extraction for GEO factor scoring.
 * Extracts headings, schema, semantic HTML, links, images, OG tags,
 * tables, lists, paragraphs, canonical, viewport, dates, readability,
 * answer-first analysis, and FAQ detection.
 */

const MAX_CONTENT_LENGTH = 5000;

// ─── Generic anchor / alt text detection lists ──────────────
const GENERIC_ANCHORS = new Set([
  "click here", "here", "read more", "learn more", "more",
  "continue", "continue reading", "see more", "see details",
  "details", "view more", "view all", "link", "this",
  "this page", "this article", "go", "go here", "check it out",
  "find out more", "get started", "start here", "download", "submit",
]);

const GENERIC_ALT_EXACT = new Set([
  "image", "photo", "picture", "img", "banner", "icon", "logo",
  "screenshot", "graphic", "illustration", "figure", "pic",
  "untitled", "no alt", "alt text", "placeholder",
]);

const GENERIC_ALT_PATTERNS = [
  /^IMG_\d+/i, /^DSC_\d+/i, /^image\d+/i, /^photo\d+/i,
  /^screen.?shot/i, /^\d+$/, /^[a-f0-9-]{36}$/,
];

const CROSS_REF_STARTS = [
  "This ", "That ", "These ", "Those ", "It ", "They ",
  "As mentioned", "As discussed", "As noted above", "See above", "In the previous",
];

const QUESTION_STARTS = [
  "what", "why", "how", "when", "where", "who", "which",
  "is", "are", "can", "do", "does", "should", "will", "could", "would",
];

// Filler phrases for answer-first detection (Appendix B)
const FILLER_PHRASES = [
  "In this section", "In this article", "In this guide", "In this post",
  "In today's", "In the world of", "When it comes to", "When considering",
  "It's no secret", "It is important to note", "It should be noted",
  "It is worth mentioning", "As we all know", "As the name suggests",
  "As you may know", "Many people", "Many businesses", "Many organizations",
  "There are many", "There are several", "There are numerous",
  "Before we dive", "Before we begin", "Before we explore",
  "Let's take a look", "Let's explore", "Let's dive into",
  "If you're looking", "If you've ever wondered", "If you want to",
  "Welcome to", "In order to", "As mentioned", "As discussed",
  "As noted earlier", "One of the most", "One thing that",
  "Simply put", "To put it simply", "In recent years",
  "Over the past few years", "Over the past decade",
  "In the ever-evolving", "In the rapidly changing",
  "The importance of", "The world of",
  "Have you ever wondered", "Did you know that",
];

// Date patterns for visible date extraction
const DATE_PATTERNS = [
  /\d{4}-\d{2}-\d{2}/,
  /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}/i,
  /\d{1,2}\/\d{1,2}\/\d{4}/,
  /\d{1,2}[\-\.]\d{1,2}[\-\.]\d{4}/,
];

const DATE_KEYWORDS = /updated|modified|last updated|published|posted|date/i;

// ─── Helpers ────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function countMatches(html: string, pattern: RegExp): number {
  return (html.match(pattern) || []).length;
}

function extractAllMatches(html: string, pattern: RegExp): string[] {
  const results: string[] = [];
  let m;
  while ((m = pattern.exec(html)) !== null) results.push(m[1] || m[0]);
  return results;
}

function isQuestion(text: string): boolean {
  if (text.trim().endsWith("?")) return true;
  const lower = text.trim().toLowerCase();
  return QUESTION_STARTS.some((q) => lower.startsWith(q));
}

function isGenericAlt(alt: string): boolean {
  const lower = alt.trim().toLowerCase();
  if (GENERIC_ALT_EXACT.has(lower)) return true;
  return GENERIC_ALT_PATTERNS.some((p) => p.test(alt.trim()));
}

// Syllable counting (Hunt algorithm approximation)
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

// ─── Main extraction ────────────────────────────────────────

export interface ExtractedPageData {
  url: string;
  status_code: number;
  title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  og_image: string | null;
  h1: string | null;
  language: string | null;
  is_client_rendered: boolean;
  has_captcha: boolean;
  // Headless browser comparison data (populated when Browserless.io is available)
  headless?: {
    ssr_ratio: number;          // 0.0–1.0: raw text / rendered text
    mobile_parity: number;       // 0.0–1.0: mobile content / desktop content
    rendered_text_length: number; // Text chars in rendered desktop HTML
    raw_text_length: number;      // Text chars in raw (fetch) HTML
    mobile_text_length: number;   // Text chars in rendered mobile HTML
  };
  has_structured_data: boolean;
  content_summary: string;
  content_text: string;
  word_count: number;
  headings: {
    h1: string[]; h2: string[]; h3: string[];
    h1_count: number; hierarchy_valid: boolean;
    question_headings_count: number;
    headings_with_ids: number; headings_total: number;
  };
  schema: {
    detected_types: string[]; total_schemas: number;
    has_faq: boolean; has_organization: boolean;
    has_article: boolean; has_product: boolean;
    has_breadcrumb: boolean;
    valid_blocks: number; invalid_blocks: number;
    faq_questions_count: number;
    date_modified: string | null;
    date_published: string | null;
  };
  semantic: {
    article: number; section: number; main: number;
    nav: number; aside: number; header: number;
    footer: number; figure: number; time: number;
    details: number; div_count: number; semantic_ratio: number;
  };
  links: {
    internal_count: number; external_count: number;
    contextual_internal: number; navigation_internal: number;
    generic_anchor_count: number; descriptive_anchor_pct: number;
  };
  images: {
    total: number; with_alt: number; with_empty_alt: number;
    without_alt: number; generic_alt: number;
    in_figure_with_caption: number;
  };
  open_graph: {
    has_og_title: boolean; has_og_description: boolean;
    has_og_image: boolean; has_og_type: boolean;
    has_og_url: boolean; has_og_site_name: boolean;
  };
  tables: {
    total: number; with_thead: number;
    with_th: number; with_caption: number;
  };
  lists: {
    ordered_count: number; unordered_count: number;
    total_list_items: number; fake_list_patterns: number;
  };
  paragraphs: {
    total: number; avg_word_count: number;
    pct_under_100: number; pct_over_150: number;
    cross_reference_count: number;
    self_contained_pct: number;
  };
  dates: {
    article_modified_time: string | null;
    article_published_time: string | null;
    schema_date_modified: string | null;
    schema_date_published: string | null;
    visible_date: string | null;
    best_date: string | null;
    days_since_update: number | null;
    has_visible_date: boolean;
    has_schema_date: boolean;
  };
  readability: {
    sentence_count: number;
    avg_sentence_words: number;
    flesch_kincaid_grade: number;
    flesch_reading_ease: number;
    long_sentence_pct: number;
  };
  answer_first: {
    total_sections: number;
    answer_first_sections: number;
    capsule_sections: number;
    answer_first_pct: number;
  };
  faq: {
    has_faq_schema: boolean;
    faq_schema_questions: number;
    html_faq_sections: number;
    html_faq_questions: number;
  };
  canonical_url: string | null;
  canonical_matches_url: boolean;
  viewport_tag: string | null;
  is_https: boolean;
  hsts_header: boolean;
}

export function extractFromHtml(html: string, pageUrl: string, headers?: Headers): ExtractedPageData {
  // Basic meta
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || null;
  const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*?)["']/i)?.[1]?.trim() || null;
  const metaKeywords = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*?)["']/i)?.[1]?.trim() || null;
  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*?)["']/i)?.[1]?.trim() || null;
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || null;
  const lang = html.match(/<html[^>]*lang=["']([^"']*?)["']/i)?.[1]?.trim() || null;

  // SSR / client rendering detection
  const hasReactRoot = /id=["'](root|__next|app)["']/.test(html);
  const bodyContent = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || "";
  const textContent = bodyContent
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim();
  const isClientRendered = hasReactRoot && textContent.length < 200;
  const hasCaptcha = /recaptcha|hcaptcha|captcha|cloudflare.*challenge|cf-browser-verification/i.test(html);
  const hasStructuredData = /application\/ld\+json/.test(html);
  const cleanText = textContent.slice(0, MAX_CONTENT_LENGTH);
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

  // ── Headings ──────────────────────────────────────────
  const allHeadings: { level: number; text: string; hasId: boolean }[] = [];
  const hRegex = /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let hm;
  while ((hm = hRegex.exec(html)) !== null) {
    allHeadings.push({
      level: parseInt(hm[1]),
      text: hm[3].replace(/<[^>]+>/g, "").trim(),
      hasId: /id=["']/.test(hm[2]),
    });
  }
  const h1s = allHeadings.filter((h) => h.level === 1).map((h) => h.text);
  const h2s = allHeadings.filter((h) => h.level === 2).map((h) => h.text);
  const h3s = allHeadings.filter((h) => h.level === 3).map((h) => h.text);

  let hierarchyValid = true;
  for (let i = 1; i < allHeadings.length; i++) {
    if (allHeadings[i].level - allHeadings[i - 1].level > 1) {
      hierarchyValid = false;
      break;
    }
  }
  const questionHeadings = allHeadings
    .filter((h) => h.level === 2 || h.level === 3)
    .filter((h) => isQuestion(h.text)).length;

  // ── Schema / JSON-LD ──────────────────────────────────
  const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const detectedTypes: string[] = [];
  let validBlocks = 0, invalidBlocks = 0;
  let schemaDateModified: string | null = null;
  let schemaDatePublished: string | null = null;
  let faqSchemaQuestions = 0;
  let ldm;
  while ((ldm = ldRegex.exec(html)) !== null) {
    try {
      const obj = JSON.parse(ldm[1]);
      const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
      types.forEach((t: string) => { if (t) detectedTypes.push(t); });
      if (obj["@context"] && obj["@type"]) validBlocks++;
      else invalidBlocks++;
      if (obj.dateModified && !schemaDateModified) schemaDateModified = obj.dateModified;
      if (obj.datePublished && !schemaDatePublished) schemaDatePublished = obj.datePublished;
      if (obj["@type"] === "FAQPage" && Array.isArray(obj.mainEntity)) {
        faqSchemaQuestions += obj.mainEntity.length;
      }
    } catch { invalidBlocks++; }
  }
  const uniqueTypes = [...new Set(detectedTypes)];

  // ── Date extraction (meta tags) ───────────────────────
  const articleModTime = html.match(/<meta[^>]*property=["']article:modified_time["'][^>]*content=["']([^"']*?)["']/i)?.[1]?.trim() || null;
  const articlePubTime = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']*?)["']/i)?.[1]?.trim() || null;

  // ── Visible date extraction ────────────────────────────
  let visibleDate: string | null = null;
  const textChunks = textContent.split(/[.\n]/);
  for (const chunk of textChunks) {
    if (DATE_KEYWORDS.test(chunk)) {
      for (const pattern of DATE_PATTERNS) {
        const dmatch = chunk.match(pattern);
        if (dmatch) { visibleDate = dmatch[0]; break; }
      }
      if (visibleDate) break;
    }
  }

  // Best date: most recent from all sources
  const dateCandidates = [schemaDateModified, articleModTime, schemaDatePublished, articlePubTime, visibleDate]
    .filter(Boolean)
    .map((d) => { try { return new Date(d!).getTime(); } catch { return 0; } })
    .filter((t) => t > 0);
  const bestDateMs = dateCandidates.length > 0 ? Math.max(...dateCandidates) : null;
  const bestDate = bestDateMs ? new Date(bestDateMs).toISOString().slice(0, 10) : null;
  const daysSinceUpdate = bestDateMs ? Math.floor((Date.now() - bestDateMs) / 86400000) : null;

  // ── Semantic HTML ─────────────────────────────────────
  const semArticle = countMatches(html, /<article[\s>]/gi);
  const semSection = countMatches(html, /<section[\s>]/gi);
  const semMain = countMatches(html, /<main[\s>]/gi);
  const semNav = countMatches(html, /<nav[\s>]/gi);
  const semAside = countMatches(html, /<aside[\s>]/gi);
  const semHeader = countMatches(html, /<header[\s>]/gi);
  const semFooter = countMatches(html, /<footer[\s>]/gi);
  const semFigure = countMatches(html, /<figure[\s>]/gi);
  const semTime = countMatches(html, /<time[\s>]/gi);
  const semDetails = countMatches(html, /<details[\s>]/gi);
  const divCount = countMatches(html, /<div[\s>]/gi);
  const totalSemantic = semArticle + semSection + semMain + semNav + semAside + semHeader + semFooter + semFigure + semTime + semDetails;
  const totalStructural = totalSemantic + divCount;

  // ── Links ─────────────────────────────────────────────
  const linkRegex = /<a\s[^>]*href=["']([^"'#]*?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let internalCount = 0, externalCount = 0, genericCount = 0;
  
  // Extract nav/header/footer/aside blocks to classify navigational links
  const navBlocks = html.match(/<(nav|header|footer|aside)[\s>][\s\S]*?<\/\1>/gi) || [];
  const navHtml = navBlocks.join(" ");
  let navigationInternal = 0;

  let lm2;
  try {
    const urlObj = new URL(pageUrl);
    const domain = urlObj.hostname.replace(/^www\./, "");
    
    // 1. Pass over all links in the document
    while ((lm2 = linkRegex.exec(html)) !== null) {
      const href = lm2[1].trim();
      const anchor = lm2[2].replace(/<[^>]+>/g, "").trim().toLowerCase();
      if (!href || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
      
      const isInternal = href.startsWith("/") || href.includes(domain);
      if (isInternal) {
        internalCount++;
        if (GENERIC_ANCHORS.has(anchor)) genericCount++;
      } else if (href.startsWith("http")) {
        externalCount++;
      }
    }

    // 2. Count internal links within navigation elements
    const navLinkRegex = /<a\s[^>]*href=["']([^"'#]*?)["'][^>]*>/gi;
    let nlm;
    while ((nlm = navLinkRegex.exec(navHtml)) !== null) {
      const href = nlm[1].trim();
      if (!href || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
      const isInternal = href.startsWith("/") || href.includes(domain);
      if (isInternal) navigationInternal++;
    }
  } catch { /* skip */ }

  const contextualInternal = Math.max(0, internalCount - navigationInternal);

  // ── Images ────────────────────────────────────────────
  const imgRegex = /<img\s([^>]*)>/gi;
  let imgTotal = 0, imgWithAlt = 0, imgEmptyAlt = 0, imgNoAlt = 0, imgGenericAlt = 0;
  let im;
  while ((im = imgRegex.exec(html)) !== null) {
    imgTotal++;
    const altMatch = im[1].match(/alt=["'](.*?)["']/i);
    if (!altMatch) { imgNoAlt++; }
    else if (altMatch[1].trim() === "") { imgEmptyAlt++; }
    else {
      imgWithAlt++;
      if (isGenericAlt(altMatch[1])) imgGenericAlt++;
    }
  }
  const figcaptionCount = countMatches(html, /<figure[\s\S]*?<figcaption/gi);

  // ── Open Graph ────────────────────────────────────────
  const ogTitle = /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*?)["']/i.test(html);
  const ogDesc = /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*?)["']/i.test(html);
  const ogImg = /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*?)["']/i.test(html);
  const ogType = /<meta[^>]*property=["']og:type["'][^>]*content=["']([^"']*?)["']/i.test(html);
  const ogUrl = /<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']*?)["']/i.test(html);
  const ogSiteName = /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*?)["']/i.test(html);

  // ── Tables ────────────────────────────────────────────
  const tableBlocks = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  let tablesWithThead = 0, tablesWithTh = 0, tablesWithCaption = 0;
  for (const t of tableBlocks) {
    if (/<thead/i.test(t)) tablesWithThead++;
    if (/<th[\s>]/i.test(t)) tablesWithTh++;
    if (/<caption/i.test(t)) tablesWithCaption++;
  }

  // ── Lists (excluding nav) ─────────────────────────────
  const olCount = countMatches(html, /<ol[\s>]/gi);
  const ulCount = countMatches(html, /<ul[\s>]/gi);
  const navUlCount = countMatches(html, /<nav[\s\S]*?<ul/gi);
  const contentUlCount = Math.max(ulCount - navUlCount, 0);
  const liCount = countMatches(html, /<li[\s>]/gi);
  const fakeListPatterns = countMatches(textContent, /(?:^|\n)\s*[•\-\*→]/g);

  // ── Paragraphs ────────────────────────────────────────
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const paragraphWords: number[] = [];
  let crossRefCount = 0;
  let pm;
  while ((pm = pRegex.exec(html)) !== null) {
    const pText = pm[1].replace(/<[^>]+>/g, "").trim();
    if (pText.length < 5) continue;
    const wc = pText.split(/\s+/).filter(Boolean).length;
    paragraphWords.push(wc);
    if (CROSS_REF_STARTS.some((s) => pText.startsWith(s))) crossRefCount++;
  }
  const totalParagraphs = paragraphWords.length;
  const avgParaWords = totalParagraphs > 0
    ? paragraphWords.reduce((a, b) => a + b, 0) / totalParagraphs : 0;
  const pctUnder100 = totalParagraphs > 0
    ? paragraphWords.filter((w) => w <= 100).length / totalParagraphs : 1;
  const pctOver150 = totalParagraphs > 0
    ? paragraphWords.filter((w) => w > 150).length / totalParagraphs : 0;
  const selfContainedPct = totalParagraphs > 0
    ? 1 - (crossRefCount / totalParagraphs) : 1;

  // ── Readability (Flesch-Kincaid) ──────────────────────
  const sentences = textContent
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
  const sentenceCount = sentences.length;
  const allWords = textContent.split(/\s+/).filter((w) => w.length > 0);
  const totalWords = allWords.length;
  const totalSyllables = allWords.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgSentenceWords = sentenceCount > 0 ? totalWords / sentenceCount : 0;
  const longSentences = sentences.filter((s) => s.split(/\s+/).length > 30).length;

  let fkGrade = 0, fre = 0;
  if (sentenceCount > 0 && totalWords > 0) {
    fkGrade = 0.39 * (totalWords / sentenceCount) + 11.8 * (totalSyllables / totalWords) - 15.59;
    fre = 206.835 - 1.015 * (totalWords / sentenceCount) - 84.6 * (totalSyllables / totalWords);
    fkGrade = Math.round(fkGrade * 10) / 10;
    fre = Math.round(fre * 10) / 10;
  }

  // ── Answer-First analysis ─────────────────────────────
  let totalSections = 0, answerFirstSections = 0, capsuleSections = 0;
  const headingPositions: { pos: number; text: string }[] = [];
  const headingPosRegex = /<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/gi;
  let hp;
  while ((hp = headingPosRegex.exec(html)) !== null) {
    headingPositions.push({
      pos: hp.index + hp[0].length,
      text: hp[1].replace(/<[^>]+>/g, "").trim(),
    });
  }
  for (let i = 0; i < headingPositions.length; i++) {
    const start = headingPositions[i].pos;
    const end = i + 1 < headingPositions.length
      ? html.indexOf("<h", start + 1)
      : html.indexOf("</body", start);
    if (end <= start) continue;
    const sectionHtml = html.slice(start, end > 0 ? end : undefined);
    const sectionText = sectionHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (sectionText.length < 20) continue;
    totalSections++;
    const firstSentence = sectionText.split(/[.!?]/)[0]?.trim() || "";
    const firstWords = firstSentence.split(/\s+/).filter(Boolean);
    const startsWithFiller = FILLER_PHRASES.some((fp) =>
      firstSentence.toLowerCase().startsWith(fp.toLowerCase())
    );
    const isDeclarative = !firstSentence.endsWith("?");
    const hasConcreteContent = firstWords.length >= 3;
    const under80Words = firstWords.length <= 80;
    if (isDeclarative && !startsWithFiller && hasConcreteContent && under80Words) {
      answerFirstSections++;
      if (firstWords.length >= 15 && firstWords.length <= 30) {
        capsuleSections++;
      }
    }
  }

  // ── FAQ detection (HTML patterns) ─────────────────────
  let htmlFaqSections = 0, htmlFaqQuestions = 0;
  let qStreak = 0;
  for (const h of allHeadings) {
    if ((h.level === 2 || h.level === 3) && isQuestion(h.text)) {
      qStreak++;
    } else {
      if (qStreak >= 3) {
        htmlFaqSections++;
        htmlFaqQuestions += qStreak;
      }
      qStreak = 0;
    }
  }
  if (qStreak >= 3) {
    htmlFaqSections++;
    htmlFaqQuestions += qStreak;
  }

  // ── Canonical & viewport ──────────────────────────────
  const canonical = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*?)["']/i)?.[1]?.trim() || null;
  let canonicalMatches = false;
  if (canonical) {
    try {
      canonicalMatches = new URL(canonical).pathname === new URL(pageUrl).pathname;
    } catch { canonicalMatches = canonical === pageUrl; }
  }
  const viewport = html.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']*?)["']/i)?.[1]?.trim() || null;
  const isHttps = pageUrl.startsWith("https://");
  const hstsHeader = headers?.get("strict-transport-security") ? true : false;

  return {
    url: pageUrl, status_code: 200,
    title, meta_description: metaDesc, meta_keywords: metaKeywords,
    og_image: ogImage, h1: h1Match, language: lang,
    is_client_rendered: isClientRendered, has_captcha: hasCaptcha,
    has_structured_data: hasStructuredData,
    content_summary: cleanText, content_text: textContent, word_count: wordCount,
    headings: {
      h1: h1s, h2: h2s, h3: h3s, h1_count: h1s.length,
      hierarchy_valid: hierarchyValid,
      question_headings_count: questionHeadings,
      headings_with_ids: allHeadings.filter((h) => h.hasId).length,
      headings_total: allHeadings.length,
    },
    schema: {
      detected_types: uniqueTypes, total_schemas: validBlocks + invalidBlocks,
      has_faq: uniqueTypes.some((t) => t === "FAQPage"),
      has_organization: uniqueTypes.some((t) => t === "Organization" || t === "LocalBusiness"),
      has_article: uniqueTypes.some((t) => ["Article", "NewsArticle", "BlogPosting"].includes(t)),
      has_product: uniqueTypes.some((t) => t === "Product"),
      has_breadcrumb: uniqueTypes.some((t) => t === "BreadcrumbList"),
      valid_blocks: validBlocks, invalid_blocks: invalidBlocks,
      faq_questions_count: faqSchemaQuestions,
      date_modified: schemaDateModified,
      date_published: schemaDatePublished,
    },
    semantic: {
      article: semArticle, section: semSection, main: semMain,
      nav: semNav, aside: semAside, header: semHeader,
      footer: semFooter, figure: semFigure, time: semTime,
      details: semDetails, div_count: divCount,
      semantic_ratio: totalStructural > 0 ? totalSemantic / totalStructural : 0,
    },
    links: {
      internal_count: internalCount, external_count: externalCount,
      contextual_internal: contextualInternal,
      navigation_internal: navigationInternal,
      generic_anchor_count: genericCount,
      descriptive_anchor_pct: internalCount > 0 ? (internalCount - genericCount) / internalCount : 1,
    },
    images: {
      total: imgTotal, with_alt: imgWithAlt, with_empty_alt: imgEmptyAlt,
      without_alt: imgNoAlt, generic_alt: imgGenericAlt,
      in_figure_with_caption: figcaptionCount,
    },
    open_graph: {
      has_og_title: ogTitle, has_og_description: ogDesc,
      has_og_image: ogImg, has_og_type: ogType,
      has_og_url: ogUrl, has_og_site_name: ogSiteName,
    },
    tables: {
      total: tableBlocks.length, with_thead: tablesWithThead,
      with_th: tablesWithTh, with_caption: tablesWithCaption,
    },
    lists: {
      ordered_count: olCount, unordered_count: contentUlCount,
      total_list_items: liCount, fake_list_patterns: fakeListPatterns,
    },
    paragraphs: {
      total: totalParagraphs, avg_word_count: Math.round(avgParaWords),
      pct_under_100: Math.round(pctUnder100 * 100) / 100,
      pct_over_150: Math.round(pctOver150 * 100) / 100,
      cross_reference_count: crossRefCount,
      self_contained_pct: Math.round(selfContainedPct * 100) / 100,
    },
    dates: {
      article_modified_time: articleModTime,
      article_published_time: articlePubTime,
      schema_date_modified: schemaDateModified,
      schema_date_published: schemaDatePublished,
      visible_date: visibleDate,
      best_date: bestDate,
      days_since_update: daysSinceUpdate,
      has_visible_date: visibleDate !== null,
      has_schema_date: schemaDateModified !== null,
    },
    readability: {
      sentence_count: sentenceCount,
      avg_sentence_words: Math.round(avgSentenceWords * 10) / 10,
      flesch_kincaid_grade: fkGrade,
      flesch_reading_ease: fre,
      long_sentence_pct: sentenceCount > 0 ? Math.round((longSentences / sentenceCount) * 100) / 100 : 0,
    },
    answer_first: {
      total_sections: totalSections,
      answer_first_sections: answerFirstSections,
      capsule_sections: capsuleSections,
      answer_first_pct: totalSections > 0 ? Math.round((answerFirstSections / totalSections) * 100) / 100 : 0,
    },
    faq: {
      has_faq_schema: faqSchemaQuestions > 0,
      faq_schema_questions: faqSchemaQuestions,
      html_faq_sections: htmlFaqSections,
      html_faq_questions: htmlFaqQuestions,
    },
    canonical_url: canonical, canonical_matches_url: canonicalMatches,
    viewport_tag: viewport, is_https: isHttps, hsts_header: hstsHeader,
  };
}

// ─── Robots.txt AI Bot Parser ───────────────────────────────

export interface RobotsBotStatus {
  [bot: string]: "allowed" | "blocked" | "partially_blocked" | "not_mentioned";
}

export interface RobotsAnalysis {
  exists: boolean;
  bot_status: RobotsBotStatus;
  search_bots_allowed: number;
  training_bots_allowed: number;
  has_blanket_disallow: boolean;
  has_sitemap_directive: boolean;
  sitemap_urls: string[];
}

const SEARCH_BOTS = ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"];
const TRAINING_BOTS = ["GPTBot", "ClaudeBot", "Google-Extended", "Meta-ExternalAgent", "ChatGPT-User", "Applebot-Extended"];

export function parseRobotsTxt(robotsTxt: string | null): RobotsAnalysis {
  if (!robotsTxt) {
    return {
      exists: false, bot_status: {},
      search_bots_allowed: 3, training_bots_allowed: 0,
      has_blanket_disallow: false, has_sitemap_directive: false,
      sitemap_urls: [],
    };
  }

  const lines = robotsTxt.split("\n").map((l) => l.trim());
  const sitemapUrls: string[] = [];
  const ruleGroups: { agent: string; disallows: string[]; allows: string[] }[] = [];
  let current: { agent: string; disallows: string[]; allows: string[] } | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("sitemap:")) {
      sitemapUrls.push(line.slice(8).trim());
    } else if (lower.startsWith("user-agent:")) {
      const agent = line.slice(11).trim();
      current = { agent, disallows: [], allows: [] };
      ruleGroups.push(current);
    } else if (current && lower.startsWith("disallow:")) {
      current.disallows.push(line.slice(9).trim());
    } else if (current && lower.startsWith("allow:")) {
      current.allows.push(line.slice(6).trim());
    }
  }

  const wildcardGroup = ruleGroups.find((g) => g.agent === "*");
  const hasBlanketDisallow = wildcardGroup
    ? wildcardGroup.disallows.includes("/") && wildcardGroup.allows.length === 0
    : false;

  const botStatus: RobotsBotStatus = {};
  const allBots = [...SEARCH_BOTS, ...TRAINING_BOTS];

  for (const bot of allBots) {
    const group = ruleGroups.find((g) => g.agent.toLowerCase() === bot.toLowerCase());
    if (group) {
      if (group.disallows.includes("/") && group.allows.length === 0) {
        botStatus[bot] = "blocked";
      } else if (group.disallows.length > 0 && group.allows.length > 0) {
        botStatus[bot] = "partially_blocked";
      } else if (group.disallows.includes("/")) {
        botStatus[bot] = "blocked";
      } else {
        botStatus[bot] = "allowed";
      }
    } else if (hasBlanketDisallow) {
      botStatus[bot] = "blocked";
    } else {
      botStatus[bot] = "not_mentioned";
    }
  }

  return {
    exists: true,
    bot_status: botStatus,
    search_bots_allowed: SEARCH_BOTS.filter((b) =>
      botStatus[b] === "allowed" || botStatus[b] === "not_mentioned"
    ).length,
    training_bots_allowed: TRAINING_BOTS.filter((b) => botStatus[b] === "allowed").length,
    has_blanket_disallow: hasBlanketDisallow,
    has_sitemap_directive: sitemapUrls.length > 0,
    sitemap_urls: sitemapUrls,
  };
}

// ─── Sitemap Analysis ───────────────────────────────────────

export interface SitemapAnalysis {
  exists: boolean;
  total_urls: number;
  urls_with_lastmod: number;
  lastmod_coverage: number;
  recent_lastmod_90d: number;
  freshness_ratio: number;
  valid_xml: boolean;
  in_robots: boolean;
}

export function analyzeSitemap(
  sitemapXml: string | null,
  robotsAnalysis: RobotsAnalysis,
  crawledUrls: string[],
): SitemapAnalysis {
  if (!sitemapXml) {
    return {
      exists: false, total_urls: 0, urls_with_lastmod: 0,
      lastmod_coverage: 0, recent_lastmod_90d: 0, freshness_ratio: 0,
      valid_xml: false, in_robots: robotsAnalysis.has_sitemap_directive,
    };
  }

  const locRegex = /<url>[\s\S]*?<\/url>/gi;
  const urlBlocks = sitemapXml.match(locRegex) || [];
  const now = Date.now();
  const d90 = 90 * 24 * 60 * 60 * 1000;
  let withLastmod = 0, recent90 = 0;

  for (const block of urlBlocks) {
    const lm = block.match(/<lastmod>(.*?)<\/lastmod>/i);
    if (lm) {
      withLastmod++;
      try {
        const d = new Date(lm[1].trim());
        if (now - d.getTime() <= d90) recent90++;
      } catch { /* skip */ }
    }
  }

  const totalUrls = urlBlocks.length || 1;
  return {
    exists: true,
    total_urls: urlBlocks.length,
    urls_with_lastmod: withLastmod,
    lastmod_coverage: withLastmod / totalUrls,
    recent_lastmod_90d: recent90,
    freshness_ratio: withLastmod > 0 ? recent90 / withLastmod : 0,
    valid_xml: /<urlset/i.test(sitemapXml) || /<sitemapindex/i.test(sitemapXml),
    in_robots: robotsAnalysis.has_sitemap_directive,
  };
}
