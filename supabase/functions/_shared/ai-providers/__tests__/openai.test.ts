/**
 * Tests for the OpenAI adapter (Responses API).
 *
 * Validates: request body structure, annotation parsing, web search fallback,
 * include parameter values, error handling, and missing API key.
 *
 * Run:  deno test supabase/functions/_shared/ai-providers/__tests__/openai.test.ts
 * Live: AI_LIVE_TESTS=true deno test ... --allow-net --allow-env
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { afterEach, beforeEach, describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  setupMocks, mockFetch, mockFetchSequence, restoreAll,
  getFetchCalls, getFetchBody, makeModel, makeRequest,
  isLiveTestEnabled, clearEnv,
} from "./test-helpers.ts";
import { openaiAdapter } from "../openai.ts";
import {
  OPENAI_SUCCESS_WITH_SEARCH, OPENAI_SUCCESS_NO_SEARCH,
  OPENAI_400_WEB_SEARCH_UNSUPPORTED, GENERIC_500_ERROR,
} from "./fixtures.ts";

describe("OpenAI Adapter", () => {
  beforeEach(() => setupMocks());
  afterEach(() => restoreAll());

  // ── Request Structure ──────────────────────────────────

  describe("request body structure", () => {
    it("should send model slug as string, not object", async () => {
      mockFetch(200, OPENAI_SUCCESS_WITH_SEARCH.response);
      const req = makeRequest({ model: makeModel("gpt-4.1-mini", "openai") });
      await openaiAdapter(req);

      const body = getFetchBody();
      assertEquals(body.model, "gpt-4.1-mini");
      assertEquals(typeof body.model, "string");
    });

    it("should include web_search tool with required tool_choice when web search enabled", async () => {
      mockFetch(200, OPENAI_SUCCESS_WITH_SEARCH.response);
      await openaiAdapter(makeRequest({ webSearchEnabled: true, country: "BR" }));

      const body = getFetchBody();
      const tools = body.tools as Array<Record<string, unknown>>;
      assertExists(tools, "tools array should exist");
      assertEquals(tools.length, 1);
      assertEquals(tools[0].type, "web_search");
      assertEquals(body.tool_choice, "required");
    });

    it("should only include valid values in the include parameter", async () => {
      mockFetch(200, OPENAI_SUCCESS_WITH_SEARCH.response);
      await openaiAdapter(makeRequest({ webSearchEnabled: true }));

      const body = getFetchBody();
      const include = body.include as string[];
      assertExists(include);

      // This is the critical test that would have caught the output_text.annotations bug
      const validIncludeValues = [
        "file_search_call.results",
        "web_search_call.results",
        "web_search_call.action.sources",
        "message.input_image.image_url",
        "computer_call_output.output.image_url",
        "code_interpreter_call.outputs",
        "reasoning.encrypted_content",
        "message.output_text.logprobs",
      ];

      for (const val of include) {
        assert(
          validIncludeValues.includes(val),
          `Invalid include value: '${val}'. Must be one of: ${validIncludeValues.join(", ")}`,
        );
      }

      // Current expected value
      assert(include.includes("web_search_call.action.sources"));
    });

    it("should send user_location when country is provided", async () => {
      mockFetch(200, OPENAI_SUCCESS_WITH_SEARCH.response);
      await openaiAdapter(makeRequest({ country: "BR" }));

      const body = getFetchBody();
      const tools = body.tools as Array<Record<string, unknown>>;
      const userLoc = tools[0].user_location as Record<string, string>;
      assertEquals(userLoc.country, "BR");
      assertEquals(userLoc.type, "approximate");
    });

    it("should not include tools when web search is disabled", async () => {
      mockFetch(200, OPENAI_SUCCESS_NO_SEARCH.response);
      await openaiAdapter(makeRequest({ webSearchEnabled: false }));

      const body = getFetchBody();
      assertEquals(body.tools, undefined);
      assertEquals(body.tool_choice, undefined);
      assertEquals(body.include, undefined);
    });

    it("should send system instruction as 'instructions' field", async () => {
      mockFetch(200, OPENAI_SUCCESS_NO_SEARCH.response);
      await openaiAdapter(makeRequest({
        systemInstruction: "You are a helpful assistant.",
        webSearchEnabled: false,
      }));

      const body = getFetchBody();
      assertEquals(body.instructions, "You are a helpful assistant.");
    });

    it("should POST to /v1/responses endpoint", async () => {
      mockFetch(200, OPENAI_SUCCESS_NO_SEARCH.response);
      await openaiAdapter(makeRequest({ webSearchEnabled: false }));

      const calls = getFetchCalls();
      assertEquals(calls.length, 1);
      assertEquals(calls[0].url, "https://api.openai.com/v1/responses");
    });
  });

  // ── Annotation Parsing ─────────────────────────────────

  describe("annotation and source parsing", () => {
    it("should extract url_citation annotations from output_text blocks", async () => {
      mockFetch(200, OPENAI_SUCCESS_WITH_SEARCH.response);
      const result = await openaiAdapter(makeRequest());

      assertExists(result.annotations);
      assertEquals(result.annotations!.length, OPENAI_SUCCESS_WITH_SEARCH.expected.annotationCount);

      const first = result.annotations![0];
      assertEquals(first.url, OPENAI_SUCCESS_WITH_SEARCH.expected.firstAnnotation.url);
      assertEquals(first.start_index, OPENAI_SUCCESS_WITH_SEARCH.expected.firstAnnotation.start_index);
      assertEquals(first.end_index, OPENAI_SUCCESS_WITH_SEARCH.expected.firstAnnotation.end_index);
      assertEquals(first.cited_text, ""); // OpenAI doesn't provide cited_text
    });

    it("should extract sources from web_search_call action items", async () => {
      mockFetch(200, OPENAI_SUCCESS_WITH_SEARCH.response);
      const result = await openaiAdapter(makeRequest());

      assertExists(result.sources);
      assertEquals(result.sources!.length, OPENAI_SUCCESS_WITH_SEARCH.expected.sourceCount);
    });

    it("should deduplicate sources from action.sources and annotations", async () => {
      mockFetch(200, OPENAI_SUCCESS_WITH_SEARCH.response);
      const result = await openaiAdapter(makeRequest());

      const urls = result.sources!.map((s) => s.url);
      const uniqueUrls = new Set(urls);
      assertEquals(urls.length, uniqueUrls.size, "Sources should be deduplicated");
    });

    it("should return null annotations when web search is disabled", async () => {
      mockFetch(200, OPENAI_SUCCESS_NO_SEARCH.response);
      const result = await openaiAdapter(makeRequest({ webSearchEnabled: false }));

      assertEquals(result.annotations, null);
      assertEquals(result.sources, null);
      assertEquals(result.web_search_enabled, false);
    });

    it("should extract output_text from data.output_text fallback", async () => {
      mockFetch(200, OPENAI_SUCCESS_WITH_SEARCH.response);
      const result = await openaiAdapter(makeRequest());

      assertExists(result.text);
      assert(result.text!.length > 0);
    });
  });

  // ── Web Search Fallback ────────────────────────────────

  describe("web search fallback on 400", () => {
    it("should retry without web_search when tools are unsupported", async () => {
      mockFetchSequence([
        { status: 400, body: OPENAI_400_WEB_SEARCH_UNSUPPORTED.body },
        { status: 200, body: OPENAI_SUCCESS_NO_SEARCH.response },
      ]);

      const result = await openaiAdapter(makeRequest({ webSearchEnabled: true }));

      assertEquals(result.error, undefined);
      assertExists(result.text);
      assertEquals(result.web_search_enabled, false);

      // Verify 2 fetch calls: first with tools, second without
      const calls = getFetchCalls();
      assertEquals(calls.length, 2);

      const firstBody = JSON.parse(calls[0].init.body as string);
      assertExists(firstBody.tools);
      assertExists(firstBody.include);

      const secondBody = JSON.parse(calls[1].init.body as string);
      assertEquals(secondBody.tools, undefined);
      assertEquals(secondBody.include, undefined);
      assertEquals(secondBody.tool_choice, undefined);
    });

    it("should return error for non-web-search 400 errors", async () => {
      const nonWebSearch400 = JSON.stringify({
        error: { message: "Invalid model: nonexistent-model", type: "invalid_request_error" },
      });
      mockFetch(400, nonWebSearch400);

      const result = await openaiAdapter(makeRequest());

      assertExists(result.error);
      assert(result.error!.includes("400"));
    });
  });

  // ── Error Handling ─────────────────────────────────────

  describe("error handling", () => {
    it("should return error when API key is missing", async () => {
      clearEnv("OPENAI_API_KEY");

      const result = await openaiAdapter(makeRequest());

      assertExists(result.error);
      assert(result.error!.includes("OPENAI_API_KEY"));
      assertEquals(result.text, null);
    });

    it("should handle 500 server errors", async () => {
      mockFetch(GENERIC_500_ERROR.status, GENERIC_500_ERROR.body);
      const result = await openaiAdapter(makeRequest({ webSearchEnabled: false }));

      assertExists(result.error);
      assert(result.error!.includes("500"));
    });

    it("should handle network/fetch errors gracefully", async () => {
      globalThis.fetch = (() => Promise.reject(new Error("Network timeout"))) as typeof fetch;
      const result = await openaiAdapter(makeRequest({ webSearchEnabled: false }));

      assertExists(result.error);
      assert(result.error!.includes("Network timeout"));
    });

    it("should include latency_ms in all responses", async () => {
      mockFetch(200, OPENAI_SUCCESS_NO_SEARCH.response);
      const result = await openaiAdapter(makeRequest({ webSearchEnabled: false }));

      assert(result.latency_ms >= 0);
    });

    it("should include token usage", async () => {
      mockFetch(200, OPENAI_SUCCESS_WITH_SEARCH.response);
      const result = await openaiAdapter(makeRequest());

      assertExists(result.tokens);
      assertEquals(result.tokens!.input, 8520);
      assertEquals(result.tokens!.output, 617);
    });
  });
});

// ── Live API tests (opt-in) ──────────────────────────────

if (isLiveTestEnabled()) {
  describe("OpenAI Adapter [LIVE]", () => {
    afterEach(() => restoreAll());

    it("live: should get a response with annotations from gpt-4.1-mini", async () => {
      // Uses real API key from environment
      const req = makeRequest({
        prompt: "What is the latest news about artificial intelligence?",
        model: makeModel("gpt-4.1-mini", "openai"),
        webSearchEnabled: true,
      });

      const result = await openaiAdapter(req);

      assertEquals(result.error, undefined);
      assertExists(result.text);
      assert(result.text!.length > 50);
      assertEquals(result.web_search_enabled, true);
      assertExists(result.annotations, "Live response should have annotations");
      assert(result.annotations!.length > 0, "Should have at least 1 annotation");
      assertExists(result.sources, "Live response should have sources");
      assert(result.sources!.length > 0, "Should have at least 1 source");

      // Validate annotation structure
      for (const ann of result.annotations!) {
        assertEquals(ann.type ?? "url_citation", "url_citation");
        assert(ann.url.startsWith("http"), `URL should start with http: ${ann.url}`);
        assertExists(ann.start_index);
        assertExists(ann.end_index);
      }
    });
  });
}
