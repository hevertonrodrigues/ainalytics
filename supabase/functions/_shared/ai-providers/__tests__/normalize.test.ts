/**
 * Tests for shared normalization helpers.
 *
 * Validates: buildSuccessResponse, buildErrorResponse,
 * verifyWebSearchResults, toSourcesArray.
 *
 * Run:  deno test supabase/functions/_shared/ai-providers/__tests__/normalize.test.ts
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  buildSuccessResponse, buildErrorResponse,
  verifyWebSearchResults, toSourcesArray,
} from "../normalize.ts";
import { makeModel, makeRequest } from "./test-helpers.ts";

describe("Normalize Helpers", () => {
  // ── toSourcesArray ─────────────────────────────────────

  describe("toSourcesArray", () => {
    it("should convert Map to array", () => {
      const map = new Map([
        ["https://a.com", { url: "https://a.com", title: "A" }],
        ["https://b.com", { url: "https://b.com", title: "B" }],
      ]);
      const result = toSourcesArray(map);
      assertEquals(result.length, 2);
      assertEquals(result[0].url, "https://a.com");
    });

    it("should return empty array for empty map", () => {
      const result = toSourcesArray(new Map());
      assertEquals(result.length, 0);
    });

    it("should naturally deduplicate (Map keys)", () => {
      const map = new Map<string, { url: string; title: string }>();
      map.set("https://a.com", { url: "https://a.com", title: "A1" });
      map.set("https://a.com", { url: "https://a.com", title: "A2" }); // overwrite
      const result = toSourcesArray(map);
      assertEquals(result.length, 1);
      assertEquals(result[0].title, "A2"); // last value wins
    });
  });

  // ── buildErrorResponse ─────────────────────────────────

  describe("buildErrorResponse", () => {
    it("should return error response with correct fields", () => {
      const req = makeRequest();
      const result = buildErrorResponse(req, Date.now() - 100, "test error");

      assertEquals(result.text, null);
      assertEquals(result.model, req.model.slug);
      assertEquals(result.tokens, null);
      assertEquals(result.error, "test error");
      assertEquals(result.web_search_enabled, false);
      assertEquals(result.annotations, null);
      assertEquals(result.sources, null);
      assert(result.latency_ms >= 0);
    });

    it("should include raw_request and raw_response when provided", () => {
      const req = makeRequest();
      const result = buildErrorResponse(req, Date.now(), "err", { foo: 1 }, { bar: 2 });

      assertEquals(result.raw_request, { foo: 1 });
      assertEquals(result.raw_response, { bar: 2 });
    });

    it("should use model slug from ModelRecord", () => {
      const req = makeRequest({ model: makeModel("custom-model", "custom") });
      const result = buildErrorResponse(req, Date.now(), "err");

      assertEquals(result.model, "custom-model");
    });
  });

  // ── buildSuccessResponse ───────────────────────────────

  describe("buildSuccessResponse", () => {
    it("should return null annotations when array is empty", () => {
      const result = buildSuccessResponse({
        text: "hello",
        model: "test",
        tokens: null,
        latency_ms: 100,
        raw_request: {},
        raw_response: {},
        web_search_enabled: true,
        annotations: [],
        sources: [],
      });

      assertEquals(result.annotations, null);
      assertEquals(result.sources, null);
    });

    it("should return annotations when array is non-empty", () => {
      const ann = [{ start_index: 0, end_index: 10, url: "https://a.com", title: "A", cited_text: "" }];
      const src = [{ url: "https://a.com", title: "A" }];
      const result = buildSuccessResponse({
        text: "hello",
        model: "test",
        tokens: { input: 10, output: 20 },
        latency_ms: 100,
        raw_request: {},
        raw_response: {},
        web_search_enabled: true,
        annotations: ann,
        sources: src,
      });

      assertExists(result.annotations);
      assertEquals(result.annotations!.length, 1);
      assertExists(result.sources);
      assertEquals(result.sources!.length, 1);
    });

    it("should preserve all fields correctly", () => {
      const result = buildSuccessResponse({
        text: "answer",
        model: "gpt-4.1",
        tokens: { input: 100, output: 50 },
        latency_ms: 250,
        raw_request: { q: "test" },
        raw_response: { a: "resp" },
        web_search_enabled: true,
        annotations: [],
        sources: [],
      });

      assertEquals(result.text, "answer");
      assertEquals(result.model, "gpt-4.1");
      assertEquals(result.latency_ms, 250);
      assertEquals(result.web_search_enabled, true);
      assertEquals(result.error, undefined);
    });
  });

  // ── verifyWebSearchResults ─────────────────────────────

  describe("verifyWebSearchResults", () => {
    it("should return true when annotations exist", () => {
      const ann = [{ start_index: 0, end_index: 10, url: "https://a.com", title: "A", cited_text: "" }];
      const result = verifyWebSearchResults("test", "model", true, ann, new Map());
      assertEquals(result, true);
    });

    it("should return true when sources exist", () => {
      const map = new Map([["https://a.com", { url: "https://a.com", title: "A" }]]);
      const result = verifyWebSearchResults("test", "model", true, [], map);
      assertEquals(result, true);
    });

    it("should return false when web search enabled but no results", () => {
      const result = verifyWebSearchResults("test", "model", true, [], new Map());
      assertEquals(result, false);
    });

    it("should return false when web search was not enabled", () => {
      const result = verifyWebSearchResults("test", "model", false, [], new Map());
      assertEquals(result, false);
    });
  });
});
