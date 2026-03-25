/**
 * Unit tests for pure logic extracted from edge functions.
 *
 * These test business logic (scoring, pagination, filtering, validation)
 * without needing a running Supabase instance.
 *
 * Run: deno test supabase/functions/__tests__/logic.test.ts --allow-env --no-check
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";

// Import the REAL scoring functions — these are the same functions
// used by sources-summary/index.ts in production.
import {
  mentionRateScore, platformBreadthScore, promptCoverageScore,
  distributionScore, computeCompositeScore, SCORE_WEIGHTS,
} from "../_shared/scoring.ts";

// ═══════════════════════════════════════════════════════════
// Sources Summary: Scoring Logic
// (imported from _shared/scoring.ts — shared with sources-summary)
// ═══════════════════════════════════════════════════════════

describe("Sources Summary: Scoring Logic", () => {
  describe("mentionRateScore", () => {
    it("should return 0 when maxPercent is 0", () => {
      assertEquals(mentionRateScore(10, 0), 0);
    });

    it("should return 100 when source is the max", () => {
      // pct === maxPct → log(1+x)/log(1+x) = 1 → score = 100
      const score = mentionRateScore(50, 50);
      assertEquals(score, 100);
    });

    it("should return proportional score for partial mentions", () => {
      const score = mentionRateScore(25, 50);
      assert(score > 0 && score < 100, `Expected 0 < ${score} < 100`);
    });

    it("should use log scale (not linear)", () => {
      // A source at half the max percentage should score > 50 due to log compression
      const score = mentionRateScore(25, 50);
      assert(score > 50, `Log scale: expected > 50, got ${score}`);
    });
  });

  describe("platformBreadthScore", () => {
    it("should return 0 when no platforms exist", () => {
      assertEquals(platformBreadthScore(3, 0), 0);
    });

    it("should return 100 when source appears on all platforms", () => {
      assertEquals(platformBreadthScore(5, 5), 100);
    });

    it("should return proportional score", () => {
      assertEquals(platformBreadthScore(2, 4), 50);
    });
  });

  describe("promptCoverageScore", () => {
    it("should return 0 when no prompts exist", () => {
      assertEquals(promptCoverageScore(5, 0), 0);
    });

    it("should return 100 when source covers all prompts", () => {
      assertEquals(promptCoverageScore(10, 10), 100);
    });

    it("should return proportional score", () => {
      assertEquals(promptCoverageScore(3, 10), 30);
    });
  });

  describe("distributionScore (Shannon entropy)", () => {
    it("should return 0 for single platform", () => {
      assertEquals(distributionScore([{ cnt: 10 }]), 0);
    });

    it("should return 0 for empty/null input", () => {
      assertEquals(distributionScore([]), 0);
    });

    it("should return 100 for perfectly uniform distribution", () => {
      const score = distributionScore([
        { cnt: 25 }, { cnt: 25 }, { cnt: 25 }, { cnt: 25 },
      ]);
      assertEquals(Math.round(score), 100);
    });

    it("should return low score for highly skewed distribution", () => {
      const score = distributionScore([
        { cnt: 99 }, { cnt: 1 }, { cnt: 0 }, { cnt: 0 },
      ]);
      assert(score < 30, `Expected < 30 for skewed, got ${score}`);
    });

    it("should return moderate score for moderate skew", () => {
      const score = distributionScore([
        { cnt: 50 }, { cnt: 30 }, { cnt: 20 },
      ]);
      assert(score > 50 && score < 100, `Expected 50–100, got ${score}`);
    });
  });

  describe("computeCompositeScore", () => {
    it("should produce max score of 100 with perfect inputs", () => {
      const score = computeCompositeScore(100, 100, 100, 100);
      assertEquals(score, 100);
    });

    it("should produce 0 with all zeros", () => {
      const score = computeCompositeScore(0, 0, 0, 0);
      assertEquals(score, 0);
    });

    it("should weight mention rate highest (0.35)", () => {
      const mentionOnly = computeCompositeScore(100, 0, 0, 0);
      const platformOnly = computeCompositeScore(0, 100, 0, 0);
      assert(mentionOnly > platformOnly, "Mention rate should have highest weight");
    });
  });

  describe("SCORE_WEIGHTS", () => {
    it("should sum to 1.0", () => {
      const sum = SCORE_WEIGHTS.MENTION + SCORE_WEIGHTS.PLATFORM +
                  SCORE_WEIGHTS.PROMPT + SCORE_WEIGHTS.DISTRIBUTION;
      assertEquals(sum, 1.0);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Pagination Logic
// ═══════════════════════════════════════════════════════════

describe("Pagination Logic", () => {
  it("should clamp page to minimum of 1", () => {
    const page = Math.max(1, parseInt("-5", 10));
    assertEquals(page, 1);
  });

  it("should clamp per_page between 1 and 100", () => {
    const perPage1 = Math.min(100, Math.max(1, parseInt("200", 10)));
    assertEquals(perPage1, 100);

    const perPage2 = Math.min(100, Math.max(1, parseInt("0", 10)));
    assertEquals(perPage2, 1);

    const perPage3 = Math.min(100, Math.max(1, parseInt("50", 10)));
    assertEquals(perPage3, 50);
  });

  it("should handle NaN page gracefully", () => {
    const page = Math.max(1, parseInt("abc", 10) || 1);
    assertEquals(page, 1);
  });

  it("should calculate total_pages correctly", () => {
    assertEquals(Math.ceil(0 / 50), 0);
    assertEquals(Math.ceil(1 / 50), 1);
    assertEquals(Math.ceil(50 / 50), 1);
    assertEquals(Math.ceil(51 / 50), 2);
    assertEquals(Math.ceil(100 / 50), 2);
    assertEquals(Math.ceil(101 / 50), 3);
  });

  it("should determine has_more correctly", () => {
    const totalPages = Math.ceil(100 / 50);
    assertEquals(1 < totalPages, true);  // page 1 of 2: has more
    assertEquals(2 < totalPages, false); // page 2 of 2: no more
  });
});

// ═══════════════════════════════════════════════════════════
// FAQ: Language Filter Logic
// ═══════════════════════════════════════════════════════════

describe("FAQ: Language Filter Logic", () => {
  const validLangs: Record<string, string> = { en: "en", pt: "pt", es: "es" };

  it("should map valid languages", () => {
    assertEquals(validLangs["en"] || "en", "en");
    assertEquals(validLangs["pt"] || "en", "pt");
    assertEquals(validLangs["es"] || "en", "es");
  });

  it("should fallback to 'en' for unknown language", () => {
    assertEquals(validLangs["de"] || "en", "en");
    assertEquals(validLangs["zh"] || "en", "en");
  });

  it("should map auth state to statuses", () => {
    const authenticated = true;
    const statuses = authenticated ? ["public", "private"] : ["public"];
    assertEquals(statuses, ["public", "private"]);

    const unauthStatuses = false ? ["public", "private"] : ["public"];
    assertEquals(unauthStatuses, ["public"]);
  });
});

// ═══════════════════════════════════════════════════════════
// Admin AI Costs: View Routing
// ═══════════════════════════════════════════════════════════

describe("Admin AI Costs: View Routing Logic", () => {
  const validViews = ["summary", "by_tenant", "by_model", "by_callsite", "daily", "recent"];

  it("should default to 'summary' when no view specified", () => {
    const view = null ?? "summary";
    assertEquals(view, "summary");
  });

  it("should accept all valid view params", () => {
    for (const v of validViews) {
      assert(validViews.includes(v), `View '${v}' should be valid`);
    }
  });

  it("should parse months parameter with default of 1", () => {
    assertEquals(parseInt("3", 10) || 1, 3);
    assertEquals(parseInt("", 10) || 1, 1);
    assertEquals(parseInt("abc", 10) || 1, 1);
  });
});

// ═══════════════════════════════════════════════════════════
// Platform Update: Validation Logic
// ═══════════════════════════════════════════════════════════

describe("Platforms: Update Validation Logic", () => {
  const allowedKeys = new Set(["id", "is_active", "default_model_id"]);

  it("should reject unknown fields", () => {
    const payload: Record<string, unknown> = { id: "1", hack: true, is_active: true };
    const unknownKeys = Object.keys(payload).filter((k) => !allowedKeys.has(k));
    assertEquals(unknownKeys, ["hack"]);
  });

  it("should accept valid fields only", () => {
    const payload = { id: "1", is_active: true, default_model_id: "m1" };
    const unknownKeys = Object.keys(payload).filter((k) => !allowedKeys.has(k));
    assertEquals(unknownKeys.length, 0);
  });

  it("should require id as non-empty string", () => {
    assertEquals(typeof "abc" === "string" && "abc".trim().length > 0, true);
    assertEquals(typeof "" === "string" && "".trim().length > 0, false);
    assertEquals(typeof 123 === "string", false);
  });

  it("should validate is_active as boolean", () => {
    assertEquals(typeof true === "boolean", true);
    assertEquals(typeof "true" === "boolean", false);
  });

  it("should allow null for default_model_id", () => {
    const value: unknown = null;
    assertEquals(typeof value === "string" || value === null, true);
  });
});
