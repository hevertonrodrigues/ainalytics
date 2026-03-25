/**
 * Scoring functions for source relevance calculations.
 *
 * Extracted from sources-summary so they can be tested directly.
 * All functions are pure — no side effects, no closures.
 */

/**
 * Log-scaled mention rate score (0–100).
 * @param pct   Source's mention percentage (e.g. 5.23 for 5.23%)
 * @param maxPct  Highest percentage among all sources in this page
 */
export function mentionRateScore(pct: number, maxPct: number): number {
  if (maxPct === 0) return 0;
  return Math.min(100, (Math.log(1 + pct / 100) / Math.log(1 + maxPct / 100)) * 100);
}

/**
 * Linear platform breadth score (0–100).
 * @param count  Number of platforms this source appears on
 * @param total  Total active platforms for the tenant
 */
export function platformBreadthScore(count: number, total: number): number {
  if (total === 0) return 0;
  return (count / total) * 100;
}

/**
 * Linear prompt coverage score (0–100).
 * @param count  Number of prompts that cite this source
 * @param total  Total active prompts for the tenant
 */
export function promptCoverageScore(count: number, total: number): number {
  if (total === 0) return 0;
  return (count / total) * 100;
}

/**
 * Shannon entropy-based distribution score (0–100).
 * Measures how evenly citations are spread across platforms.
 * @param platformCounts  Array of objects with a `cnt` field per platform
 */
// deno-lint-ignore no-explicit-any
export function distributionScore(platformCounts: { cnt: number }[] | any[]): number {
  if (!platformCounts || platformCounts.length <= 1) return 0;
  // deno-lint-ignore no-explicit-any
  const counts = platformCounts.map((p: any) => p.cnt || 0);
  const tc = counts.reduce((s: number, c: number) => s + c, 0);
  if (tc === 0) return 0;
  let entropy = 0;
  for (const c of counts) {
    if (c > 0) {
      const p = c / tc;
      entropy -= p * Math.log(p);
    }
  }
  const maxE = Math.log(platformCounts.length);
  return maxE > 0 ? (entropy / maxE) * 100 : 0;
}

/** Scoring weights — must match the values used in sources-summary. */
export const SCORE_WEIGHTS = {
  MENTION: 0.35,
  PLATFORM: 0.25,
  PROMPT: 0.20,
  DISTRIBUTION: 0.20,
} as const;

/** Compute weighted composite score from the four sub-scores. */
export function computeCompositeScore(
  mention: number,
  breadth: number,
  coverage: number,
  distrib: number,
): number {
  return Math.round(
    (mention * SCORE_WEIGHTS.MENTION +
     breadth * SCORE_WEIGHTS.PLATFORM +
     coverage * SCORE_WEIGHTS.PROMPT +
     distrib * SCORE_WEIGHTS.DISTRIBUTION) * 10,
  ) / 10;
}
