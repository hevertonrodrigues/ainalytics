/**
 * Tests for the Perplexity adapter (Agent API).
 *
 * Validates: request body structure, citation + annotation parsing,
 * always-on web search, error handling.
 *
 * Run:  deno test supabase/functions/_shared/ai-providers/__tests__/perplexity.test.ts
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { afterEach, beforeEach, describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  setupMocks, mockFetch, restoreAll,
  getFetchCalls, getFetchBody, makeModel, makeRequest,
  isLiveTestEnabled, clearEnv,
} from "./test-helpers.ts";
import { perplexityAdapter } from "../perplexity.ts";
import { PERPLEXITY_SUCCESS, GENERIC_500_ERROR } from "./fixtures.ts";

describe("Perplexity Adapter", () => {
  beforeEach(() => setupMocks());
  afterEach(() => restoreAll());

  // ── Request Structure ──────────────────────────────────

  describe("request body structure", () => {
    it("should POST to Perplexity Agent API endpoint", async () => {
      mockFetch(200, PERPLEXITY_SUCCESS.response);
      await perplexityAdapter(makeRequest({ model: makeModel("sonar-pro", "perplexity") }));

      const calls = getFetchCalls();
      assertEquals(calls[0].url, "https://api.perplexity.ai/responses");
    });

    it("should send model slug as string", async () => {
      mockFetch(200, PERPLEXITY_SUCCESS.response);
      await perplexityAdapter(makeRequest({ model: makeModel("sonar-pro", "perplexity") }));

      const body = getFetchBody();
      assertEquals(body.model, "sonar-pro");
    });

    it("should send input as plain prompt string", async () => {
      mockFetch(200, PERPLEXITY_SUCCESS.response);
      await perplexityAdapter(makeRequest({
        model: makeModel("sonar-pro", "perplexity"),
        prompt: "What is AI?",
      }));

      const body = getFetchBody();
      assertEquals(body.input, "What is AI?");
    });

    it("should include stream: false", async () => {
      mockFetch(200, PERPLEXITY_SUCCESS.response);
      await perplexityAdapter(makeRequest({ model: makeModel("sonar-pro", "perplexity") }));

      const body = getFetchBody();
      assertEquals(body.stream, false);
    });

    it("should include user_location when country is provided", async () => {
      mockFetch(200, PERPLEXITY_SUCCESS.response);
      await perplexityAdapter(makeRequest({
        model: makeModel("sonar-pro", "perplexity"),
        country: "BR",
      }));

      const body = getFetchBody();
      const loc = body.user_location as Record<string, string>;
      assertExists(loc);
      assertEquals(loc.country, "BR");
    });

    it("should include search_language_filter when language is provided", async () => {
      mockFetch(200, PERPLEXITY_SUCCESS.response);
      await perplexityAdapter(makeRequest({
        model: makeModel("sonar-pro", "perplexity"),
        language: "pt",
      }));

      const body = getFetchBody();
      const filter = body.search_language_filter as string[];
      assertExists(filter);
      assertEquals(filter, ["pt"]);
    });

    it("should NOT include tools (Perplexity always searches)", async () => {
      mockFetch(200, PERPLEXITY_SUCCESS.response);
      await perplexityAdapter(makeRequest({ model: makeModel("sonar-pro", "perplexity") }));

      const body = getFetchBody();
      assertEquals(body.tools, undefined);
      assertEquals(body.tool_choice, undefined);
    });
  });

  // ── Citation/Annotation Parsing ────────────────────────

  describe("citation and annotation parsing", () => {
    it("should always set web_search_enabled to true", async () => {
      mockFetch(200, PERPLEXITY_SUCCESS.response);
      const result = await perplexityAdapter(makeRequest({
        model: makeModel("sonar-pro", "perplexity"),
        webSearchEnabled: false, // ignored
      }));

      assertEquals(result.web_search_enabled, true);
    });

    it("should extract sources from top-level citations array", async () => {
      mockFetch(200, PERPLEXITY_SUCCESS.response);
      const result = await perplexityAdapter(makeRequest({
        model: makeModel("sonar-pro", "perplexity"),
      }));

      assertExists(result.sources);
      assertEquals(result.sources!.length, PERPLEXITY_SUCCESS.expected.sourceCount);
    });

    it("should extract annotations from output_text blocks", async () => {
      mockFetch(200, PERPLEXITY_SUCCESS.response);
      const result = await perplexityAdapter(makeRequest({
        model: makeModel("sonar-pro", "perplexity"),
      }));

      assertExists(result.annotations);
      assertEquals(result.annotations!.length, PERPLEXITY_SUCCESS.expected.annotationCount);

      const first = result.annotations![0];
      assertEquals(first.url, "https://en.wikipedia.org/wiki/Artificial_intelligence");
      assertEquals(first.start_index, 0);
      assertEquals(first.end_index, 61);
    });

    it("should use output_text from data when available", async () => {
      mockFetch(200, PERPLEXITY_SUCCESS.response);
      const result = await perplexityAdapter(makeRequest({
        model: makeModel("sonar-pro", "perplexity"),
      }));

      assertExists(result.text);
      assert(result.text!.length > 0);
    });

    it("should handle response with no citations gracefully", async () => {
      const noCitations = {
        ...PERPLEXITY_SUCCESS.response,
        citations: undefined,
        output: [{
          id: "msg1", type: "message", status: "completed",
          content: [{ type: "output_text", text: "No citations here." }],
        }],
        output_text: "No citations here.",
      };
      mockFetch(200, noCitations);
      const result = await perplexityAdapter(makeRequest({
        model: makeModel("sonar-pro", "perplexity"),
      }));

      assertEquals(result.annotations, null);
      assertEquals(result.sources, null);
    });
  });

  // ── Error Handling ─────────────────────────────────────

  describe("error handling", () => {
    it("should return error when API key is missing", async () => {
      clearEnv("PERPLEXITY_API_KEY");
      const result = await perplexityAdapter(makeRequest({
        model: makeModel("sonar-pro", "perplexity"),
      }));

      assertExists(result.error);
      assert(result.error!.includes("PERPLEXITY_API_KEY"));
    });

    it("should handle 500 server errors", async () => {
      mockFetch(500, GENERIC_500_ERROR.body);
      const result = await perplexityAdapter(makeRequest({
        model: makeModel("sonar-pro", "perplexity"),
      }));

      assertExists(result.error);
      assert(result.error!.includes("500"));
    });

    it("should parse token usage", async () => {
      mockFetch(200, PERPLEXITY_SUCCESS.response);
      const result = await perplexityAdapter(makeRequest({
        model: makeModel("sonar-pro", "perplexity"),
      }));

      assertExists(result.tokens);
      assertEquals(result.tokens!.input, 50);
      assertEquals(result.tokens!.output, 30);
    });
  });
});

if (isLiveTestEnabled()) {
  describe("Perplexity Adapter [LIVE]", () => {
    afterEach(() => restoreAll());

    it("live: should get a response with citations from sonar-pro", async () => {
      const req = makeRequest({
        prompt: "What is quantum computing?",
        model: makeModel("sonar-pro", "perplexity"),
      });
      const result = await perplexityAdapter(req);

      assertEquals(result.error, undefined);
      assertExists(result.text);
      assertEquals(result.web_search_enabled, true);
      assertExists(result.sources, "Perplexity should always return sources");
    });
  });
}
