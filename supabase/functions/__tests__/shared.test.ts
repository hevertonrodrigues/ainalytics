/**
 * Tests for shared modules: response.ts, cors.ts, logger.ts, auth.ts
 *
 * These test the building blocks used by all edge functions.
 *
 * Run: deno test supabase/functions/__tests__/shared.test.ts --allow-env --no-check
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { afterEach, beforeEach, describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import { setup, restore, parseBody, mockEnv, mockFetch } from "./edge-helpers.ts";

// ── Import shared modules directly ───────────────────────

import { ok, badRequest, serverError, unauthorized, forbidden, notFound, conflict, created, noContent } from "../_shared/response.ts";
import { getCorsHeaders, handleCors, withCors } from "../_shared/cors.ts";
import { createRequestLogger } from "../_shared/logger.ts";

describe("Shared: response.ts", () => {
  beforeEach(() => {
    setup();
    // Prevent sentry from making real fetch calls — restored by restore()
    mockFetch();
  });
  afterEach(() => restore());

  describe("ok()", () => {
    it("should return 200 with { success: true, data }", async () => {
      const res = ok({ items: [1, 2, 3] });
      assertEquals(res.status, 200);
      const body = await parseBody(res);
      assertEquals(body.success, true);
      assertEquals(body.data, { items: [1, 2, 3] });
    });

    it("should include meta if provided", async () => {
      const res = ok([], { total: 10 });
      const body = await parseBody(res);
      assertEquals(body.meta, { total: 10 });
    });

    it("should set correct content-type headers", () => {
      const res = ok("test");
      assertEquals(res.headers.get("Content-Type"), "application/json");
      assertEquals(res.headers.get("X-Content-Type-Options"), "nosniff");
      assertEquals(res.headers.get("X-Frame-Options"), "DENY");
    });
  });

  describe("created()", () => {
    it("should return 201 with success: true", async () => {
      const res = created({ id: "abc" });
      assertEquals(res.status, 201);
      const body = await parseBody(res);
      assertEquals(body.success, true);
      assertEquals(body.data, { id: "abc" });
    });
  });

  describe("noContent()", () => {
    it("should return 204 with no body", () => {
      const res = noContent();
      assertEquals(res.status, 204);
      assertEquals(res.body, null);
    });
  });

  describe("badRequest()", () => {
    it("should return 400 with error structure", async () => {
      const res = badRequest("Missing field");
      assertEquals(res.status, 400);
      const body = await parseBody(res);
      assertEquals(body.success, false);
      const err = body.error as Record<string, unknown>;
      assertEquals(err.message, "Missing field");
      assertEquals(err.code, "BAD_REQUEST");
    });

    it("should include details if provided", async () => {
      const res = badRequest("Validation failed", { fields: ["name"] });
      const body = await parseBody(res);
      const err = body.error as Record<string, unknown>;
      assertEquals(err.details, { fields: ["name"] });
    });
  });

  describe("unauthorized()", () => {
    it("should return 401", async () => {
      const res = unauthorized();
      assertEquals(res.status, 401);
      const body = await parseBody(res);
      assertEquals((body.error as Record<string, unknown>).code, "UNAUTHORIZED");
    });
  });

  describe("forbidden()", () => {
    it("should return 403", async () => {
      const res = forbidden("Not allowed");
      assertEquals(res.status, 403);
      const body = await parseBody(res);
      assertEquals((body.error as Record<string, unknown>).code, "FORBIDDEN");
    });
  });

  describe("notFound()", () => {
    it("should return 404", async () => {
      const res = notFound("Item not found");
      assertEquals(res.status, 404);
      const body = await parseBody(res);
      assertEquals((body.error as Record<string, unknown>).code, "NOT_FOUND");
    });
  });

  describe("conflict()", () => {
    it("should return 409", async () => {
      const res = conflict("Already exists");
      assertEquals(res.status, 409);
      const body = await parseBody(res);
      assertEquals((body.error as Record<string, unknown>).code, "CONFLICT");
    });
  });

  describe("serverError()", () => {
    it("should return 500 with INTERNAL_ERROR code", async () => {
      const res = serverError("Something broke");
      assertEquals(res.status, 500);
      const body = await parseBody(res);
      assertEquals((body.error as Record<string, unknown>).code, "INTERNAL_ERROR");
    });
  });
});

describe("Shared: cors.ts", () => {
  beforeEach(() => setup());
  afterEach(() => restore());

  describe("getCorsHeaders()", () => {
    it("should return CORS headers with allowed origin", () => {
      const req = new Request("http://localhost:5173/test", {
        headers: { origin: "http://localhost:5173" },
      });
      const headers = getCorsHeaders(req);
      assertEquals(headers["Access-Control-Allow-Origin"], "http://localhost:5173");
      assert(headers["Access-Control-Allow-Headers"].includes("authorization"));
      assert(headers["Access-Control-Allow-Headers"].includes("x-tenant-id"));
      assert(headers["Access-Control-Allow-Methods"].includes("GET"));
      assert(headers["Access-Control-Allow-Methods"].includes("POST"));
    });

    it("should fallback to SITE_URL for non-matching origins", () => {
      const req = new Request("http://evil.com/test", {
        headers: { origin: "http://evil.com" },
      });
      const headers = getCorsHeaders(req);
      assertEquals(headers["Access-Control-Allow-Origin"], "http://localhost:5173");
    });
  });

  describe("handleCors()", () => {
    it("should return 204 for preflight", () => {
      const req = new Request("http://localhost:5173/test", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      });
      const res = handleCors(req);
      assertEquals(res.status, 204);
    });
  });

  describe("withCors()", () => {
    it("should add CORS headers to existing response", () => {
      const req = new Request("http://localhost:5173/test", {
        headers: { origin: "http://localhost:5173" },
      });
      const original = ok({ test: true });
      const wrapped = withCors(req, original);

      assertEquals(wrapped.status, 200);
      assertExists(wrapped.headers.get("Access-Control-Allow-Origin"));
    });

    it("should preserve original response status and body", async () => {
      const req = new Request("http://localhost:5173/test");
      const original = badRequest("test error");
      const wrapped = withCors(req, original);

      assertEquals(wrapped.status, 400);
      const body = await parseBody(wrapped);
      assertEquals(body.success, false);
    });
  });
});

describe("Shared: logger.ts", () => {
  it("should create logger with request_id and done method", () => {
    const req = new Request("http://localhost:5173/test-fn", { method: "GET" });
    const logger = createRequestLogger("test-fn", req);

    assertExists(logger.request_id);
    assertEquals(typeof logger.done, "function");
  });

  it("should pass response through done()", () => {
    const req = new Request("http://localhost:5173/test-fn", { method: "GET" });
    const logger = createRequestLogger("test-fn", req);
    const response = ok({ test: true });
    const result = logger.done(response);

    assertEquals(result.status, 200);
    assertEquals(result, response);
  });

  it("should accept auth context in done()", () => {
    const req = new Request("http://localhost:5173/test-fn", { method: "GET" });
    const logger = createRequestLogger("test-fn", req);
    const response = ok({ test: true });

    // Should not throw
    const result = logger.done(response, { tenant_id: "t1", user_id: "u1" });
    assertEquals(result.status, 200);
  });
});
