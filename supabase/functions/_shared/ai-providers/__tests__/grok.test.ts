/**
 * Tests for the Grok (xAI) adapter (Responses API at api.x.ai).
 *
 * Validates: request body structure, dual citation format (top-level + annotations),
 * web search fallback, error handling.
 *
 * Run:  deno test supabase/functions/_shared/ai-providers/__tests__/grok.test.ts
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { afterEach, beforeEach, describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  setupMocks, mockFetch, mockFetchSequence, restoreAll,
  getFetchCalls, getFetchBody, makeModel, makeRequest,
  isLiveTestEnabled, clearEnv,
} from "./test-helpers.ts";
import { grokAdapter } from "../grok.ts";
import { GROK_SUCCESS_WITH_SEARCH, GENERIC_500_ERROR } from "./fixtures.ts";

describe("Grok Adapter", () => {
  beforeEach(() => setupMocks());
  afterEach(() => restoreAll());

  // ── Request Structure ──────────────────────────────────

  describe("request body structure", () => {
    it("should POST to xAI Responses API endpoint", async () => {
      mockFetch(200, GROK_SUCCESS_WITH_SEARCH.response);
      await grokAdapter(makeRequest({ model: makeModel("grok-4", "grok") }));

      const calls = getFetchCalls();
      assertEquals(calls[0].url, "https://api.x.ai/v1/responses");
    });

    it("should send model slug as string", async () => {
      mockFetch(200, GROK_SUCCESS_WITH_SEARCH.response);
      await grokAdapter(makeRequest({ model: makeModel("grok-4", "grok") }));

      const body = getFetchBody();
      assertEquals(body.model, "grok-4");
    });

    it("should send input as role/content array (not plain string)", async () => {
      mockFetch(200, GROK_SUCCESS_WITH_SEARCH.response);
      await grokAdapter(makeRequest({ model: makeModel("grok-4", "grok") }));

      const body = getFetchBody();
      const input = body.input as Array<Record<string, string>>;
      assertExists(input);
      assertEquals(input[0].role, "user");
      assertEquals(input[0].content, "What is AI?");
    });

    it("should include web_search tool when enabled", async () => {
      mockFetch(200, GROK_SUCCESS_WITH_SEARCH.response);
      await grokAdapter(makeRequest({
        model: makeModel("grok-4", "grok"),
        webSearchEnabled: true,
      }));

      const body = getFetchBody();
      const tools = body.tools as Array<Record<string, unknown>>;
      assertExists(tools);
      assertEquals(tools[0].type, "web_search");
      assertEquals(body.tool_choice, "required");
    });

    it("should NOT include 'include' parameter (unlike OpenAI)", async () => {
      mockFetch(200, GROK_SUCCESS_WITH_SEARCH.response);
      await grokAdapter(makeRequest({
        model: makeModel("grok-4", "grok"),
        webSearchEnabled: true,
      }));

      const body = getFetchBody();
      assertEquals(body.include, undefined);
    });

    it("should use XAI_API_KEY for authorization", async () => {
      mockFetch(200, GROK_SUCCESS_WITH_SEARCH.response);
      await grokAdapter(makeRequest({ model: makeModel("grok-4", "grok") }));

      const calls = getFetchCalls();
      const headers = calls[0].init.headers as Record<string, string>;
      assertEquals(headers["Authorization"], "Bearer xai-test-key");
    });
  });

  // ── Citation Parsing ───────────────────────────────────

  describe("citation and annotation parsing", () => {
    it("should extract sources from top-level citations array", async () => {
      mockFetch(200, GROK_SUCCESS_WITH_SEARCH.response);
      const result = await grokAdapter(makeRequest({
        model: makeModel("grok-4", "grok"),
      }));

      assertExists(result.sources);
      // Should have top-level citations + unique web_search_call sources
      assertEquals(result.sources!.length, GROK_SUCCESS_WITH_SEARCH.expected.sourceCount);
    });

    it("should extract annotations from output message content", async () => {
      mockFetch(200, GROK_SUCCESS_WITH_SEARCH.response);
      const result = await grokAdapter(makeRequest({
        model: makeModel("grok-4", "grok"),
      }));

      assertExists(result.annotations);
      assertEquals(result.annotations!.length, GROK_SUCCESS_WITH_SEARCH.expected.annotationCount);

      const first = result.annotations![0];
      assertEquals(first.type ?? "url_citation", "url_citation");
      assertEquals(first.url, "https://example.com/source1");
    });

    it("should merge sources from top-level citations AND web_search_call", async () => {
      mockFetch(200, GROK_SUCCESS_WITH_SEARCH.response);
      const result = await grokAdapter(makeRequest({
        model: makeModel("grok-4", "grok"),
      }));

      const urls = result.sources!.map((s) => s.url);
      // source1 and source2 from top-level, source3 from web_search_call
      assert(urls.includes("https://example.com/source1"));
      assert(urls.includes("https://example.com/source2"));
      assert(urls.includes("https://example.com/source3"));
    });

    it("should use output_text for text when data.output_text is available", async () => {
      mockFetch(200, GROK_SUCCESS_WITH_SEARCH.response);
      const result = await grokAdapter(makeRequest({
        model: makeModel("grok-4", "grok"),
      }));

      assertExists(result.text);
      assertEquals(result.text, "AI is the simulation of human intelligence by machines.");
    });
  });

  // ── Fallback ───────────────────────────────────────────

  describe("web search fallback on 400", () => {
    it("should retry without tools when web_search is not supported", async () => {
      const err400 = JSON.stringify({
        error: { message: "web_search is not supported for this model" },
      });
      const noSearch = {
        ...GROK_SUCCESS_WITH_SEARCH.response,
        citations: undefined,
        output: [
          {
            id: "msg1", role: "assistant", type: "message", status: "completed",
            content: [{ type: "output_text", text: "Fallback." }],
          },
        ],
        output_text: "Fallback.",
      };
      mockFetchSequence([
        { status: 400, body: err400 },
        { status: 200, body: noSearch },
      ]);

      const result = await grokAdapter(makeRequest({
        model: makeModel("grok-4", "grok"),
        webSearchEnabled: true,
      }));

      assertEquals(result.error, undefined);
      assertEquals(result.web_search_enabled, false);
    });
  });

  // ── Error Handling ─────────────────────────────────────

  describe("error handling", () => {
    it("should return error when API key is missing", async () => {
      clearEnv("XAI_API_KEY");
      const result = await grokAdapter(makeRequest({ model: makeModel("grok-4", "grok") }));

      assertExists(result.error);
      assert(result.error!.includes("XAI_API_KEY"));
    });

    it("should handle 500 server errors", async () => {
      mockFetch(500, GENERIC_500_ERROR.body);
      const result = await grokAdapter(makeRequest({
        model: makeModel("grok-4", "grok"),
        webSearchEnabled: false,
      }));

      assertExists(result.error);
    });

    it("should parse token usage", async () => {
      mockFetch(200, GROK_SUCCESS_WITH_SEARCH.response);
      const result = await grokAdapter(makeRequest({ model: makeModel("grok-4", "grok") }));

      assertExists(result.tokens);
      assertEquals(result.tokens!.input, 100);
      assertEquals(result.tokens!.output, 50);
    });
  });
});

if (isLiveTestEnabled()) {
  describe("Grok Adapter [LIVE]", () => {
    afterEach(() => restoreAll());

    it("live: should get a response with citations from grok-4", async () => {
      const req = makeRequest({
        prompt: "What is the latest AI news?",
        model: makeModel("grok-4", "grok"),
        webSearchEnabled: true,
      });
      const result = await grokAdapter(req);

      assertEquals(result.error, undefined);
      assertExists(result.text);
      assertEquals(result.web_search_enabled, true);
    });
  });
}
