/**
 * Tests for the Gemini adapter (GenerateContent API).
 *
 * Validates: request body structure, grounding metadata parsing,
 * google_search fallback, error handling.
 *
 * Run:  deno test supabase/functions/_shared/ai-providers/__tests__/gemini.test.ts
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { afterEach, beforeEach, describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  setupMocks, mockFetch, mockFetchSequence, restoreAll,
  getFetchCalls, getFetchBody, makeModel, makeRequest,
  isLiveTestEnabled, clearEnv,
} from "./test-helpers.ts";
import { geminiAdapter } from "../gemini.ts";
import {
  GEMINI_SUCCESS_WITH_GROUNDING, GEMINI_400_GROUNDING_UNSUPPORTED,
  GENERIC_500_ERROR,
} from "./fixtures.ts";

describe("Gemini Adapter", () => {
  beforeEach(() => setupMocks());
  afterEach(() => restoreAll());

  // ── Request Structure ──────────────────────────────────

  describe("request body structure", () => {
    it("should include model slug in the URL, not the body", async () => {
      mockFetch(200, GEMINI_SUCCESS_WITH_GROUNDING.response);
      await geminiAdapter(makeRequest({
        model: makeModel("gemini-2.5-pro", "gemini"),
      }));

      const calls = getFetchCalls();
      assert(calls[0].url.includes("gemini-2.5-pro:generateContent"));
      assert(calls[0].url.includes("generativelanguage.googleapis.com"));
    });

    it("should include google_search tool when web search enabled", async () => {
      mockFetch(200, GEMINI_SUCCESS_WITH_GROUNDING.response);
      await geminiAdapter(makeRequest({
        model: makeModel("gemini-2.5-pro", "gemini"),
        webSearchEnabled: true,
      }));

      const body = getFetchBody();
      const tools = body.tools as Array<Record<string, unknown>>;
      assertExists(tools);
      assertExists(tools[0].google_search);
    });

    it("should not include tools when web search disabled", async () => {
      const noGroundingResp = {
        candidates: [{ content: { parts: [{ text: "Simple response." }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
      };
      mockFetch(200, noGroundingResp);
      await geminiAdapter(makeRequest({
        model: makeModel("gemini-2.5-pro", "gemini"),
        webSearchEnabled: false,
      }));

      const body = getFetchBody();
      assertEquals(body.tools, undefined);
    });

    it("should include system instruction with country context", async () => {
      mockFetch(200, GEMINI_SUCCESS_WITH_GROUNDING.response);
      await geminiAdapter(makeRequest({
        model: makeModel("gemini-2.5-pro", "gemini"),
        systemInstruction: "Be helpful.",
        country: "BR",
      }));

      const body = getFetchBody();
      const sysInstr = body.systemInstruction as Record<string, unknown>;
      assertExists(sysInstr);
      const parts = sysInstr.parts as Array<Record<string, string>>;
      assert(parts[0].text.includes("Be helpful."));
      assert(parts[0].text.includes("BR"));
    });

    it("should use API key in URL query parameter", async () => {
      mockFetch(200, GEMINI_SUCCESS_WITH_GROUNDING.response);
      await geminiAdapter(makeRequest({ model: makeModel("gemini-2.5-pro", "gemini") }));

      const calls = getFetchCalls();
      assert(calls[0].url.includes("key=test-gemini-key"));
    });
  });

  // ── Grounding Metadata Parsing ─────────────────────────

  describe("grounding metadata parsing", () => {
    it("should extract annotations from groundingSupports + groundingChunks", async () => {
      mockFetch(200, GEMINI_SUCCESS_WITH_GROUNDING.response);
      const result = await geminiAdapter(makeRequest({
        model: makeModel("gemini-2.5-pro", "gemini"),
      }));

      assertExists(result.annotations);
      assertEquals(result.annotations!.length, GEMINI_SUCCESS_WITH_GROUNDING.expected.annotationCount);

      // Verify annotation has start/end indices from segment
      const first = result.annotations![0];
      assertEquals(first.start_index, 0);
      assertEquals(first.end_index, 85);
    });

    it("should extract sources from groundingChunks", async () => {
      mockFetch(200, GEMINI_SUCCESS_WITH_GROUNDING.response);
      const result = await geminiAdapter(makeRequest({
        model: makeModel("gemini-2.5-pro", "gemini"),
      }));

      assertExists(result.sources);
      assertEquals(result.sources!.length, GEMINI_SUCCESS_WITH_GROUNDING.expected.sourceCount);
    });

    it("should handle response without grounding metadata", async () => {
      const noGrounding = {
        candidates: [{ content: { parts: [{ text: "No grounding." }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
      };
      mockFetch(200, noGrounding);
      const result = await geminiAdapter(makeRequest({
        model: makeModel("gemini-2.5-pro", "gemini"),
        webSearchEnabled: true,
      }));

      assertEquals(result.annotations, null);
      assertEquals(result.web_search_enabled, false); // verifyWebSearchResults sets this
    });
  });

  // ── Grounding Fallback ─────────────────────────────────

  describe("grounding fallback on 400", () => {
    it("should retry without google_search when grounding is unsupported", async () => {
      const noGroundingResp = {
        candidates: [{ content: { parts: [{ text: "Fallback." }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
      };
      mockFetchSequence([
        { status: 400, body: GEMINI_400_GROUNDING_UNSUPPORTED.body },
        { status: 200, body: noGroundingResp },
      ]);

      const result = await geminiAdapter(makeRequest({
        model: makeModel("gemini-2.5-pro", "gemini"),
        webSearchEnabled: true,
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
      clearEnv("GEMINI_API_KEY");
      const result = await geminiAdapter(makeRequest({ model: makeModel("gemini-2.5-pro", "gemini") }));

      assertExists(result.error);
      assert(result.error!.includes("GEMINI_API_KEY"));
    });

    it("should handle 500 server errors", async () => {
      mockFetch(500, GENERIC_500_ERROR.body);
      const result = await geminiAdapter(makeRequest({
        model: makeModel("gemini-2.5-pro", "gemini"),
        webSearchEnabled: false,
      }));

      assertExists(result.error);
      assert(result.error!.includes("500"));
    });

    it("should parse usage metadata", async () => {
      mockFetch(200, GEMINI_SUCCESS_WITH_GROUNDING.response);
      const result = await geminiAdapter(makeRequest({ model: makeModel("gemini-2.5-pro", "gemini") }));

      assertExists(result.tokens);
      assertEquals(result.tokens!.input, 100);
      assertEquals(result.tokens!.output, 200);
    });
  });
});

if (isLiveTestEnabled()) {
  describe("Gemini Adapter [LIVE]", () => {
    afterEach(() => restoreAll());

    it("live: should get a response with grounding from gemini-2.5-pro", async () => {
      const req = makeRequest({
        prompt: "What is the latest news about AI?",
        model: makeModel("gemini-2.5-pro", "gemini"),
        webSearchEnabled: true,
      });
      const result = await geminiAdapter(req);

      assertEquals(result.error, undefined);
      assertExists(result.text);
      assertEquals(result.web_search_enabled, true);
    });
  });
}
