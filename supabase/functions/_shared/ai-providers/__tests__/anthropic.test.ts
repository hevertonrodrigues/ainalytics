/**
 * Tests for the Anthropic adapter (Messages API).
 *
 * Validates: request body structure, web_search_result_location citation parsing,
 * web search fallback, error handling, and missing API key.
 *
 * Run:  deno test supabase/functions/_shared/ai-providers/__tests__/anthropic.test.ts
 * Live: AI_LIVE_TESTS=true deno test ... --allow-net --allow-env
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { afterEach, beforeEach, describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  setupMocks, mockFetch, mockFetchSequence, restoreAll,
  getFetchCalls, getFetchBody, makeModel, makeRequest,
  isLiveTestEnabled, clearEnv,
} from "./test-helpers.ts";
import { anthropicAdapter } from "../anthropic.ts";
import {
  ANTHROPIC_SUCCESS_WITH_SEARCH, ANTHROPIC_400_WEB_SEARCH_UNSUPPORTED,
  GENERIC_500_ERROR,
} from "./fixtures.ts";

describe("Anthropic Adapter", () => {
  beforeEach(() => setupMocks());
  afterEach(() => restoreAll());

  // ── Request Structure ──────────────────────────────────

  describe("request body structure", () => {
    it("should send model slug as string", async () => {
      mockFetch(200, ANTHROPIC_SUCCESS_WITH_SEARCH.response);
      const req = makeRequest({
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
      });
      await anthropicAdapter(req);

      const body = getFetchBody();
      assertEquals(body.model, "claude-haiku-4-5-20251001");
    });

    it("should POST to Anthropic /v1/messages endpoint", async () => {
      mockFetch(200, ANTHROPIC_SUCCESS_WITH_SEARCH.response);
      await anthropicAdapter(makeRequest({ model: makeModel("claude-haiku-4-5-20251001", "anthropic") }));

      const calls = getFetchCalls();
      assertEquals(calls[0].url, "https://api.anthropic.com/v1/messages");
    });

    it("should include correct headers (x-api-key, anthropic-version)", async () => {
      mockFetch(200, ANTHROPIC_SUCCESS_WITH_SEARCH.response);
      await anthropicAdapter(makeRequest({ model: makeModel("claude-haiku-4-5-20251001", "anthropic") }));

      const calls = getFetchCalls();
      const headers = calls[0].init.headers as Record<string, string>;
      assertEquals(headers["x-api-key"], "sk-ant-test-key");
      assertEquals(headers["anthropic-version"], "2023-06-01");
    });

    it("should include web_search_20250305 tool when web search enabled", async () => {
      mockFetch(200, ANTHROPIC_SUCCESS_WITH_SEARCH.response);
      await anthropicAdapter(makeRequest({
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
        webSearchEnabled: true,
      }));

      const body = getFetchBody();
      const tools = body.tools as Array<Record<string, unknown>>;
      assertExists(tools);
      assertEquals(tools[0].type, "web_search_20250305");
      assertEquals(tools[0].name, "web_search");
    });

    it("should set max_tokens to 16384", async () => {
      mockFetch(200, ANTHROPIC_SUCCESS_WITH_SEARCH.response);
      await anthropicAdapter(makeRequest({ model: makeModel("claude-haiku-4-5-20251001", "anthropic") }));

      const body = getFetchBody();
      assertEquals(body.max_tokens, 16384);
    });

    it("should send system instruction as 'system' field", async () => {
      mockFetch(200, ANTHROPIC_SUCCESS_WITH_SEARCH.response);
      await anthropicAdapter(makeRequest({
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
        systemInstruction: "Be helpful.",
        webSearchEnabled: false,
      }));

      const body = getFetchBody();
      assertEquals(body.system, "Be helpful.");
    });

    it("should include user_location when country is provided", async () => {
      mockFetch(200, ANTHROPIC_SUCCESS_WITH_SEARCH.response);
      await anthropicAdapter(makeRequest({
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
        country: "US",
      }));

      const body = getFetchBody();
      const tools = body.tools as Array<Record<string, unknown>>;
      const userLoc = tools[0].user_location as Record<string, string>;
      assertEquals(userLoc.country, "US");
    });

    it("should not include tools when web search is disabled", async () => {
      const responseNoSearch = {
        ...ANTHROPIC_SUCCESS_WITH_SEARCH.response,
        content: [{ type: "text", text: "AI is cool." }],
      };
      mockFetch(200, responseNoSearch);
      await anthropicAdapter(makeRequest({
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
        webSearchEnabled: false,
      }));

      const body = getFetchBody();
      assertEquals(body.tools, undefined);
    });
  });

  // ── Citation Parsing ───────────────────────────────────

  describe("citation and source parsing", () => {
    it("should extract web_search_result_location citations", async () => {
      mockFetch(200, ANTHROPIC_SUCCESS_WITH_SEARCH.response);
      const result = await anthropicAdapter(makeRequest({
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
      }));

      assertExists(result.annotations);
      assertEquals(result.annotations!.length, ANTHROPIC_SUCCESS_WITH_SEARCH.expected.annotationCount);

      const first = result.annotations![0];
      assertEquals(first.url, ANTHROPIC_SUCCESS_WITH_SEARCH.expected.firstAnnotation.url);
      assertEquals(first.start_index, null); // Anthropic uses cited_text
      assertEquals(first.end_index, null);
      assert(first.cited_text.length > 0, "Anthropic should have cited_text");
    });

    it("should extract sources from citations", async () => {
      mockFetch(200, ANTHROPIC_SUCCESS_WITH_SEARCH.response);
      const result = await anthropicAdapter(makeRequest({
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
      }));

      assertExists(result.sources);
      assertEquals(result.sources!.length, ANTHROPIC_SUCCESS_WITH_SEARCH.expected.sourceCount);
    });

    it("should concatenate text from multiple text blocks", async () => {
      mockFetch(200, ANTHROPIC_SUCCESS_WITH_SEARCH.response);
      const result = await anthropicAdapter(makeRequest({
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
      }));

      assertExists(result.text);
      // Response has 2 text blocks, should be concatenated
      assert(result.text!.includes("Isso oferece flexibilidade"));
    });

    it("should return null annotations when web search is disabled", async () => {
      const responseNoSearch = {
        ...ANTHROPIC_SUCCESS_WITH_SEARCH.response,
        content: [{ type: "text", text: "Just text, no citations." }],
      };
      mockFetch(200, responseNoSearch);
      const result = await anthropicAdapter(makeRequest({
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
        webSearchEnabled: false,
      }));

      assertEquals(result.annotations, null);
      assertEquals(result.sources, null);
    });
  });

  // ── Web Search Fallback ────────────────────────────────

  describe("web search fallback on 400", () => {
    it("should retry without tools when web_search_20250305 is not supported", async () => {
      const responseNoSearch = {
        ...ANTHROPIC_SUCCESS_WITH_SEARCH.response,
        content: [{ type: "text", text: "Fallback response." }],
      };
      mockFetchSequence([
        { status: 400, body: ANTHROPIC_400_WEB_SEARCH_UNSUPPORTED.body },
        { status: 200, body: responseNoSearch },
      ]);

      const result = await anthropicAdapter(makeRequest({
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
      }));

      assertEquals(result.error, undefined);
      assertExists(result.text);
      assertEquals(result.web_search_enabled, false);

      const calls = getFetchCalls();
      assertEquals(calls.length, 2);
    });
  });

  // ── Error Handling ─────────────────────────────────────

  describe("error handling", () => {
    it("should return error when API key is missing", async () => {
      clearEnv("ANTHROPIC_API_KEY");

      const result = await anthropicAdapter(makeRequest({
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
      }));

      assertExists(result.error);
      assert(result.error!.includes("ANTHROPIC_API_KEY"));
    });

    it("should handle 500 server errors", async () => {
      mockFetch(GENERIC_500_ERROR.status, GENERIC_500_ERROR.body);
      const result = await anthropicAdapter(makeRequest({
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
        webSearchEnabled: false,
      }));

      assertExists(result.error);
      assert(result.error!.includes("500"));
    });

    it("should include token usage", async () => {
      mockFetch(200, ANTHROPIC_SUCCESS_WITH_SEARCH.response);
      const result = await anthropicAdapter(makeRequest({
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
      }));

      assertExists(result.tokens);
      assertEquals(result.tokens!.input, 5200);
      assertEquals(result.tokens!.output, 800);
    });
  });
});

// ── Live API tests (opt-in) ──────────────────────────────

if (isLiveTestEnabled()) {
  describe("Anthropic Adapter [LIVE]", () => {
    afterEach(() => restoreAll());

    it("live: should get a response with citations from claude-haiku", async () => {
      const req = makeRequest({
        prompt: "What are the latest developments in quantum computing?",
        model: makeModel("claude-haiku-4-5-20251001", "anthropic"),
        webSearchEnabled: true,
      });

      const result = await anthropicAdapter(req);

      assertEquals(result.error, undefined);
      assertExists(result.text);
      assert(result.text!.length > 50);
      assertEquals(result.web_search_enabled, true);
      assertExists(result.annotations, "Live response should have annotations");
      assert(result.annotations!.length > 0);
    });
  });
}
