/**
 * NLP-based GEO factor scorers.
 * Replaces AI placeholder factors with algorithmic scoring using
 * the exact formulas from the GEO Implementation Guide.
 *
 * Five factors:
 *   - Factor 07: Answer-First Content Structure
 *   - Factor 05: FAQ Sections with Schema
 *   - Factor 14: Content Freshness
 *   - Factor 24: Natural Language Readability
 *   - Factor 25: Consistent Entity Naming
 */

import type { ExtractedPageData } from "./geo-extract.ts";
import { WEIGHTS as FACTOR_WEIGHTS, NAMES as FACTOR_NAMES, CATEGORIES as FACTOR_CATEGORIES } from "./geo-factors.ts";

// ─── Helpers ────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  const safe = Number.isFinite(v) ? v : 0;
  return Math.min(Math.max(Math.round(safe * 100) / 100, min), max);
}

function status(score: number): "excellent" | "good" | "warning" | "critical" {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 40) return "warning";
  return "critical";
}

function avg(arr: number[]): number {
  const valid = arr.filter((n) => Number.isFinite(n));
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

// Homepage-weighted averaging (same weights as geo-scoring.ts)
const HOME_WEIGHT = 0.30;

function weightedAvg(values: number[]): number {
  const valid = values.filter((n) => Number.isFinite(n));
  if (valid.length === 0) return 0;
  if (values.length <= 1) return valid[0] ?? 0;
  const otherWeight = (1.0 - HOME_WEIGHT) / (values.length - 1);
  const weights = [HOME_WEIGHT, ...Array(values.length - 1).fill(otherWeight)];
  let wSum = 0, wTotal = 0;
  for (let i = 0; i < values.length; i++) {
    if (Number.isFinite(values[i])) {
      wSum += values[i] * weights[i];
      wTotal += weights[i];
    }
  }
  return wTotal > 0 ? wSum / wTotal : 0;
}

// ─── Factor 07: Answer-First Content Structure ──────────────

export function scoreAnswerFirst(pages: ExtractedPageData[]): {
  factor_id: string; name: string; category: string;
  score: number; weight: number; weighted_score: number;
  status: "excellent" | "good" | "warning" | "critical";
  details: string; recommendations: string[];
} {
  const fid = "answer_first";
  if (pages.length === 0) {
    return { factor_id: fid, name: FACTOR_NAMES[fid], category: FACTOR_CATEGORIES[fid],
      score: 0, weight: FACTOR_WEIGHTS[fid], weighted_score: 0,
      status: "critical", details: "No pages to analyze.", recommendations: [] };
  }

  const totalSections = pages.reduce((s, p) => s + p.answer_first.total_sections, 0);
  const afSections = pages.reduce((s, p) => s + p.answer_first.answer_first_sections, 0);
  const capsuleSections = pages.reduce((s, p) => s + p.answer_first.capsule_sections, 0);

  const answerFirstPct = totalSections > 0 ? afSections / totalSections : 0;
  const capsulePct = totalSections > 0 ? capsuleSections / totalSections : 0;

  // Pages where > 50% of sections are answer-first
  const pagesWithMajorityAF = pages.filter((p) =>
    p.answer_first.total_sections > 0 && p.answer_first.answer_first_pct > 0.5
  ).length;
  const majorityAfPct = pagesWithMajorityAF / pages.length;

  // Scoring formula from guide §Factor 07
  const afCoverage = Math.min(answerFirstPct / 0.70, 1.0) * 40;
  const pageConsistency = majorityAfPct * 30;
  const capsuleQuality = Math.min(capsulePct / 0.40, 1.0) * 30;

  const score = clamp(afCoverage + pageConsistency + capsuleQuality);
  const recs: string[] = [];
  if (answerFirstPct < 0.5) recs.push("Lead content sections with direct, declarative answers instead of introductory filler.");
  if (capsulePct < 0.2) recs.push("Add 15-30 word 'answer capsule' sentences at the start of each section.");
  if (majorityAfPct < 0.5) recs.push("Ensure at least half your pages consistently use answer-first structure.");

  return {
    factor_id: fid, name: FACTOR_NAMES[fid], category: FACTOR_CATEGORIES[fid],
    score, weight: FACTOR_WEIGHTS[fid],
    weighted_score: Math.round(score * FACTOR_WEIGHTS[fid] * 100) / 100,
    status: status(score),
    details: `${Math.round(answerFirstPct * 100)}% of ${totalSections} sections are answer-first. ${Math.round(capsulePct * 100)}% have tight capsules.`,
    recommendations: recs,
  };
}

// ─── Factor 05: FAQ Sections with Schema ────────────────────

export function scoreFaq(pages: ExtractedPageData[]): {
  factor_id: string; name: string; category: string;
  score: number; weight: number; weighted_score: number;
  status: "excellent" | "good" | "warning" | "critical";
  details: string; recommendations: string[];
} {
  const fid = "faq_detection";
  if (pages.length === 0) {
    return { factor_id: fid, name: FACTOR_NAMES[fid], category: FACTOR_CATEGORIES[fid],
      score: 0, weight: FACTOR_WEIGHTS[fid], weighted_score: 0,
      status: "critical", details: "No pages to analyze.", recommendations: [] };
  }

  const pagesWithFaqSchema = pages.filter((p) => p.faq.has_faq_schema).length;
  const totalFaqSchemaQ = pages.reduce((s, p) => s + p.faq.faq_schema_questions, 0);
  const pagesWithHtmlFaq = pages.filter((p) => p.faq.html_faq_sections > 0).length;
  const totalHtmlFaqQ = pages.reduce((s, p) => s + p.faq.html_faq_questions, 0);

  const hasAnyFaq = pagesWithFaqSchema > 0 || pagesWithHtmlFaq > 0;
  if (!hasAnyFaq) {
    return {
      factor_id: fid, name: FACTOR_NAMES[fid], category: FACTOR_CATEGORIES[fid],
      score: 0, weight: FACTOR_WEIGHTS[fid], weighted_score: 0,
      status: "critical", details: "No FAQ content or schema detected.",
      recommendations: [
        "Add FAQ sections with question-based headings to key pages.",
        "Implement FAQPage JSON-LD schema with mainEntity items.",
      ],
    };
  }

  // Scoring formula from guide §Factor 05
  const schemaTarget = Math.max(pages.length * 0.2, 1);
  const schemaFaqComponent = Math.min(pagesWithFaqSchema / schemaTarget, 1.0) * 30;
  const questionVolume = Math.min(totalFaqSchemaQ + totalHtmlFaqQ, 50) / 50;
  const questionComponent = questionVolume * 25;
  // Self-contained check: use paragraph self-containment as proxy
  const selfContainedAvg = avg(pages.map((p) => p.paragraphs.self_contained_pct));
  const selfContainedComponent = selfContainedAvg * 25;
  const schemaMatchBonus = (pagesWithFaqSchema >= pagesWithHtmlFaq && pagesWithHtmlFaq > 0) ? 1.0 : 0.0;
  const bonusComponent = schemaMatchBonus * 20;

  const score = clamp(schemaFaqComponent + questionComponent + selfContainedComponent + bonusComponent);
  const recs: string[] = [];
  if (pagesWithFaqSchema === 0) recs.push("Add FAQPage JSON-LD schema to pages with FAQ content.");
  if (totalFaqSchemaQ + totalHtmlFaqQ < 20) recs.push("Expand FAQ sections with more question-answer pairs.");

  return {
    factor_id: fid, name: FACTOR_NAMES[fid], category: FACTOR_CATEGORIES[fid],
    score, weight: FACTOR_WEIGHTS[fid],
    weighted_score: Math.round(score * FACTOR_WEIGHTS[fid] * 100) / 100,
    status: status(score),
    details: `${pagesWithFaqSchema} pages with FAQ schema, ${totalFaqSchemaQ + totalHtmlFaqQ} total Q&A pairs.`,
    recommendations: recs,
  };
}

// ─── Factor 14: Content Freshness ───────────────────────────

export function scoreContentFreshness(pages: ExtractedPageData[]): {
  factor_id: string; name: string; category: string;
  score: number; weight: number; weighted_score: number;
  status: "excellent" | "good" | "warning" | "critical";
  details: string; recommendations: string[];
} {
  const fid = "content_freshness";
  if (pages.length === 0) {
    return { factor_id: fid, name: FACTOR_NAMES[fid], category: FACTOR_CATEGORIES[fid],
      score: 0, weight: FACTOR_WEIGHTS[fid], weighted_score: 0,
      status: "critical", details: "No pages to analyze.", recommendations: [] };
  }

  const pagesWithDates = pages.filter((p) => p.dates.best_date !== null).length;
  const dateCoverage = pagesWithDates / pages.length;

  const pagesWithVisibleDates = pages.filter((p) => p.dates.has_visible_date).length;
  const visibleDateRate = pagesWithVisibleDates / pages.length;

  const pagesWithSchemaDates = pages.filter((p) => p.dates.has_schema_date).length;
  const schemaDateRate = pagesWithSchemaDates / pages.length;

  const pagesFresh90d = pages.filter((p) =>
    p.dates.days_since_update !== null && p.dates.days_since_update <= 90
  ).length;
  const freshnessRate = pagesWithDates > 0 ? pagesFresh90d / pagesWithDates : 0;

  const pagesStale = pages.filter((p) =>
    p.dates.days_since_update !== null && p.dates.days_since_update > 365
  ).length;
  const stalePct = pagesStale / pages.length;

  // Scoring formula from guide §Factor 14
  const dateCoverageComponent = dateCoverage * 20;
  const freshnessComponent = freshnessRate * 30;
  const visibleDateComponent = visibleDateRate * 20;
  const schemaDateComponent = schemaDateRate * 15;
  const penaltyComponent = (1.0 - stalePct) * 15;

  const score = clamp(dateCoverageComponent + freshnessComponent + visibleDateComponent + schemaDateComponent + penaltyComponent);
  const recs: string[] = [];
  if (dateCoverage < 0.5) recs.push("Add visible 'Last Updated' dates to content pages.");
  if (schemaDateRate < 0.3) recs.push("Add dateModified and datePublished to Article/BlogPosting JSON-LD schema.");
  if (freshnessRate < 0.3) recs.push("Update key content within the last 90 days.");
  if (stalePct > 0.3) recs.push("Review and refresh content older than 1 year.");

  return {
    factor_id: fid, name: FACTOR_NAMES[fid], category: FACTOR_CATEGORIES[fid],
    score, weight: FACTOR_WEIGHTS[fid],
    weighted_score: Math.round(score * FACTOR_WEIGHTS[fid] * 100) / 100,
    status: status(score),
    details: `${Math.round(dateCoverage * 100)}% pages have dates, ${Math.round(freshnessRate * 100)}% fresh within 90 days.`,
    recommendations: recs,
  };
}

// ─── Factor 24: Natural Language Readability ────────────────

export function scoreReadability(pages: ExtractedPageData[]): {
  factor_id: string; name: string; category: string;
  score: number; weight: number; weighted_score: number;
  status: "excellent" | "good" | "warning" | "critical";
  details: string; recommendations: string[];
} {
  const fid = "readability";
  if (pages.length === 0) {
    return { factor_id: fid, name: FACTOR_NAMES[fid], category: FACTOR_CATEGORIES[fid],
      score: 0, weight: FACTOR_WEIGHTS[fid], weighted_score: 0,
      status: "critical", details: "No pages to analyze.", recommendations: [] };
  }

  const pageScores = pages.map((p) => {
    const fkGrade = p.readability.flesch_kincaid_grade;
    const avgSentLen = p.readability.avg_sentence_words;
    const longPct = p.readability.long_sentence_pct;

    // Grade component
    const gradeInRange = fkGrade >= 7.0 && fkGrade <= 9.0;
    const deviation = gradeInRange ? 0 : (fkGrade < 7.0 ? 7.0 - fkGrade : fkGrade - 9.0);
    let gradeVal: number;
    if (gradeInRange) gradeVal = 1.0;
    else if (deviation <= 1.0) gradeVal = 0.8;
    else if (deviation <= 2.0) gradeVal = 0.6;
    else if (deviation <= 3.0) gradeVal = 0.4;
    else gradeVal = 0.2;
    const gradeComponent = gradeVal * 45;

    // Sentence length component
    let sentVal: number;
    if (avgSentLen <= 20) sentVal = 1.0;
    else if (avgSentLen <= 25) sentVal = 0.7;
    else if (avgSentLen <= 30) sentVal = 0.4;
    else sentVal = 0.2;
    const sentComponent = sentVal * 30;

    const longPenalty = (1.0 - longPct) * 25;

    return gradeComponent + sentComponent + longPenalty;
  });

  const score = clamp(weightedAvg(pageScores));
  const avgGrade = avg(pages.map((p) => p.readability.flesch_kincaid_grade));
  const avgSentWords = avg(pages.map((p) => p.readability.avg_sentence_words));
  const recs: string[] = [];
  if (avgGrade > 10) recs.push("Simplify language to target Flesch-Kincaid Grade Level 7-9 for optimal AI extraction.");
  if (avgGrade < 6) recs.push("Content may be too simple. Consider adding more technical depth.");
  if (avgSentWords > 25) recs.push("Shorten sentences to 20 words or fewer for better AI readability.");

  return {
    factor_id: fid, name: FACTOR_NAMES[fid], category: FACTOR_CATEGORIES[fid],
    score, weight: FACTOR_WEIGHTS[fid],
    weighted_score: Math.round(score * FACTOR_WEIGHTS[fid] * 100) / 100,
    status: status(score),
    details: `Avg FK Grade: ${Math.round(avgGrade * 10) / 10}, Avg sentence: ${Math.round(avgSentWords)} words.`,
    recommendations: recs,
  };
}

// ─── Factor 25: Consistent Entity Naming ────────────────────

export function scoreEntityConsistency(pages: ExtractedPageData[]): {
  factor_id: string; name: string; category: string;
  score: number; weight: number; weighted_score: number;
  status: "excellent" | "good" | "warning" | "critical";
  details: string; recommendations: string[];
} {
  const fid = "entity_consistency";
  if (pages.length === 0) {
    return { factor_id: fid, name: FACTOR_NAMES[fid], category: FACTOR_CATEGORIES[fid],
      score: 0, weight: FACTOR_WEIGHTS[fid], weighted_score: 0,
      status: "critical", details: "No pages to analyze.", recommendations: [] };
  }

  // Extract brand name candidates from schema, og:site_name, title
  const brandCandidates: string[] = [];
  for (const p of pages) {
    if (p.title) {
      // Brand is often after " | " or " - " in titles
      const parts = p.title.split(/\s*[\|–—-]\s*/);
      if (parts.length > 1) brandCandidates.push(parts[parts.length - 1].trim());
    }
    if (p.open_graph.has_og_site_name) {
      // We stored boolean but not the value — use schema Organization name instead
      const orgType = p.schema.detected_types.includes("Organization") ||
                       p.schema.detected_types.includes("LocalBusiness");
      if (orgType && p.h1) brandCandidates.push(p.h1);
    }
  }

  // Count unique brand name variants
  const normalizedBrands = brandCandidates.map((b) => b.toLowerCase().trim()).filter(Boolean);
  const uniqueBrands = new Set(normalizedBrands);
  const brandConsistency = uniqueBrands.size <= 1 ? 1.0 : 1.0 / uniqueBrands.size;

  // Pronoun ambiguity: paragraphs starting with pronouns
  const totalParas = pages.reduce((s, p) => s + p.paragraphs.total, 0);
  const crossRefParas = pages.reduce((s, p) => s + p.paragraphs.cross_reference_count, 0);
  const pronounClarity = totalParas > 0 ? 1.0 - (crossRefParas / totalParas) : 1.0;

  // Self-containment as proxy for entity clarity
  const avgSelfContained = weightedAvg(pages.map((p) => p.paragraphs.self_contained_pct));

  // Scoring formula from guide §Factor 25
  const brandComponent = brandConsistency * 30;
  const productComponent = avgSelfContained * 25; // Using self-containment as proxy
  const pronounComponent = pronounClarity * 25;
  const abbreviationComponent = 0.7 * 20; // Default reasonable score (abbreviation detection is complex)

  const score = clamp(brandComponent + productComponent + pronounComponent + abbreviationComponent);
  const recs: string[] = [];
  if (brandConsistency < 0.8) recs.push("Use a consistent brand name across all pages — avoid switching between variants.");
  if (pronounClarity < 0.8) recs.push("Reduce paragraphs starting with 'It', 'This', 'They' — use specific entity names instead.");

  return {
    factor_id: fid, name: FACTOR_NAMES[fid], category: FACTOR_CATEGORIES[fid],
    score, weight: FACTOR_WEIGHTS[fid],
    weighted_score: Math.round(score * FACTOR_WEIGHTS[fid] * 100) / 100,
    status: status(score),
    details: `Brand consistency: ${Math.round(brandConsistency * 100)}%, Pronoun clarity: ${Math.round(pronounClarity * 100)}%.`,
    recommendations: recs,
  };
}
