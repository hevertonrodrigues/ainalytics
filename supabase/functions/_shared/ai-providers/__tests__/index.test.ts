/**
 * Tests for the AI provider registry and routing.
 *
 * Validates: executePrompt routing, executePromptMulti parallel execution,
 * unknown platform handling, getAdapter, isPlatformConfigured.
 *
 * Run:  deno test supabase/functions/_shared/ai-providers/__tests__/index.test.ts
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { afterEach, beforeEach, describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  setupMocks, mockFetch, restoreAll, makeModel, makeRequest,
} from "./test-helpers.ts";
import { getAdapter, isPlatformConfigured, executePrompt, executePromptMulti } from "../index.ts";
import { OPENAI_SUCCESS_NO_SEARCH } from "./fixtures.ts";

describe("AI Provider Registry", () => {
  beforeEach(() => setupMocks());
  afterEach(() => restoreAll());

  // ── getAdapter ─────────────────────────────────────────

  describe("getAdapter", () => {
    it("should return adapter for known platforms", () => {
      for (const slug of ["openai", "anthropic", "gemini", "grok", "perplexity"]) {
        const adapter = getAdapter(slug);
        assertExists(adapter, `Adapter for '${slug}' should exist`);
        assertEquals(typeof adapter, "function");
      }
    });

    it("should return null for unknown platform", () => {
      const adapter = getAdapter("unknown-platform");
      assertEquals(adapter, null);
    });
  });

  // ── isPlatformConfigured ───────────────────────────────

  describe("isPlatformConfigured", () => {
    it("should return true when API key is set", () => {
      assertEquals(isPlatformConfigured("openai"), true);
      assertEquals(isPlatformConfigured("anthropic"), true);
      assertEquals(isPlatformConfigured("gemini"), true);
      assertEquals(isPlatformConfigured("grok"), true);
      assertEquals(isPlatformConfigured("perplexity"), true);
    });

    it("should return false for unknown platform", () => {
      assertEquals(isPlatformConfigured("unknown"), false);
    });
  });

  // ── executePrompt ──────────────────────────────────────

  describe("executePrompt", () => {
    it("should route to correct adapter based on model.platformSlug", async () => {
      mockFetch(200, OPENAI_SUCCESS_NO_SEARCH.response);
      const req = makeRequest({
        model: makeModel("gpt-4.1-mini", "openai"),
        webSearchEnabled: false,
      });
      const result = await executePrompt(req);

      assertEquals(result.error, undefined);
      assertExists(result.text);
    });

    it("should return error for unknown platform", async () => {
      const req = makeRequest({
        model: makeModel("some-model", "unknown-platform"),
      });
      const result = await executePrompt(req);

      assertExists(result.error);
      assert(result.error!.includes("Unknown platform"));
      assertEquals(result.text, null);
      assertEquals(result.web_search_enabled, false);
    });
  });

  // ── executePromptMulti ─────────────────────────────────

  describe("executePromptMulti", () => {
    it("should execute against multiple models in parallel", async () => {
      // Mock will be consumed once per model, so we need a response for each
      let fetchCount = 0;
      globalThis.fetch = (async () => {
        fetchCount++;
        return new Response(JSON.stringify(OPENAI_SUCCESS_NO_SEARCH.response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      const models = [
        makeModel("gpt-4.1-mini", "openai"),
        makeModel("gpt-4.1", "openai"),
      ];
      const results = await executePromptMulti(
        models, "What is AI?", undefined, false,
      );

      assertEquals(results.length, 2);
      assertEquals(fetchCount, 2);

      for (const r of results) {
        assertEquals(r.error, undefined);
        assertExists(r.text);
        assertEquals(r.slug, "openai");
      }
    });

    it("should handle mixed success/failure results", async () => {
      let callCount = 0;
      globalThis.fetch = (async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify(OPENAI_SUCCESS_NO_SEARCH.response), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Second call fails
        return new Response(JSON.stringify({ error: { message: "Rate limited" } }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      const models = [
        makeModel("gpt-4.1-mini", "openai"),
        makeModel("gpt-4.1", "openai"),
      ];
      const results = await executePromptMulti(
        models, "What is AI?", undefined, false,
      );

      assertEquals(results.length, 2);
      assertEquals(results[0].error, undefined); // first succeeded
      assertExists(results[1].error); // second failed
    });

    it("should return error for unknown platform without crashing", async () => {
      const models = [makeModel("some-model", "totally-unknown")];
      const results = await executePromptMulti(
        models, "test", undefined, false,
      );

      assertEquals(results.length, 1);
      assertExists(results[0].error);
      assert(results[0].error!.includes("Unknown platform"));
    });
  });
});
