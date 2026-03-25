/**
 * Shared test helpers for AI provider adapter tests.
 *
 * Provides utilities to:
 *  - mock `globalThis.fetch` with sequential or single responses
 *  - mock `Deno.env.get` for API key injection
 *  - create standardized AiRequest / ModelRecord objects
 *  - restore all mocks after each test
 *
 * Usage:
 *   import { setupMocks, mockFetchSequence, makeRequest, restoreAll } from "./test-helpers.ts";
 */

import type { AiRequest, ModelRecord } from "../types.ts";

// ── Deno.env mock ──────────────────────────────────────────

const originalEnvGet = Deno.env.get.bind(Deno.env);
let envOverrides: Record<string, string> = {};
let envMocked = false;

/** Set environment variable overrides for the duration of a test. */
export function mockEnv(vars: Record<string, string>): void {
  envOverrides = { ...vars };
  if (!envMocked) {
    Deno.env.get = (key: string): string | undefined => {
      if (key in envOverrides) return envOverrides[key];
      return originalEnvGet(key);
    };
    envMocked = true;
  }
}

/** Clear a specific env var (simulates missing key). */
export function clearEnv(key: string): void {
  envOverrides[key] = undefined as unknown as string;
  if (!envMocked) {
    Deno.env.get = (k: string): string | undefined => {
      if (k in envOverrides) return envOverrides[k];
      return originalEnvGet(k);
    };
    envMocked = true;
  }
}

// ── fetch mock ─────────────────────────────────────────────

const originalFetch = globalThis.fetch;
let fetchQueue: Array<{ status: number; body: unknown; headers?: Record<string, string> }> = [];
let fetchCalls: Array<{ url: string; init: RequestInit }> = [];

/**
 * Mock fetch with a sequence of responses. Each call to fetch()
 * consumes the next item from the queue.
 */
export function mockFetchSequence(
  responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>,
): void {
  fetchQueue = [...responses];
  fetchCalls = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push({ url, init: init ?? {} });

    const mock = fetchQueue.shift();
    if (!mock) {
      throw new Error(`[test-helpers] No more mocked fetch responses. Call #${fetchCalls.length} to ${url}`);
    }

    const bodyStr = typeof mock.body === "string" ? mock.body : JSON.stringify(mock.body);
    return new Response(bodyStr, {
      status: mock.status,
      headers: { "Content-Type": "application/json", ...(mock.headers ?? {}) },
    });
  }) as typeof globalThis.fetch;
}

/** Mock fetch with a single response (convenience). */
export function mockFetch(status: number, body: unknown): void {
  mockFetchSequence([{ status, body }]);
}

/** Get all fetch calls recorded during the test. */
export function getFetchCalls(): Array<{ url: string; init: RequestInit }> {
  return fetchCalls;
}

/** Get the parsed JSON body of a specific fetch call. */
export function getFetchBody(callIndex = 0): Record<string, unknown> {
  const call = fetchCalls[callIndex];
  if (!call?.init?.body) return {};
  return JSON.parse(call.init.body as string);
}

// ── Restore ────────────────────────────────────────────────

/** Restore all mocks. Call this in afterEach(). */
export function restoreAll(): void {
  globalThis.fetch = originalFetch;
  fetchQueue = [];
  fetchCalls = [];

  if (envMocked) {
    Deno.env.get = originalEnvGet;
    envMocked = false;
  }
  envOverrides = {};
}

// ── Factories ──────────────────────────────────────────────

/** Create a ModelRecord for testing. */
export function makeModel(
  slug: string,
  platformSlug: string,
  id = "test-model-id-001",
): ModelRecord {
  return { id, slug, platformSlug };
}

/** Create an AiRequest for testing with sensible defaults. */
export function makeRequest(overrides: Partial<AiRequest> = {}): AiRequest {
  return {
    prompt: "What is AI?",
    model: makeModel("gpt-4.1-mini", "openai"),
    webSearchEnabled: true,
    ...overrides,
  };
}

// ── Standard setup ─────────────────────────────────────────

/** Convenience: set up env vars for all providers. Call in beforeEach(). */
export function setupMocks(envVars?: Record<string, string>): void {
  mockEnv({
    OPENAI_API_KEY: "sk-test-openai-key",
    ANTHROPIC_API_KEY: "sk-ant-test-key",
    GEMINI_API_KEY: "test-gemini-key",
    XAI_API_KEY: "xai-test-key",
    PERPLEXITY_API_KEY: "pplx-test-key",
    ...envVars,
  });
}

// ── Environment flag for live tests ────────────────────────

/**
 * Check if live API tests should run.
 * Set AI_LIVE_TESTS=true to run tests against real APIs.
 *
 * Usage in test files:
 *   import { isLiveTestEnabled } from "./test-helpers.ts";
 *   if (isLiveTestEnabled()) { Deno.test("live: ...", async () => { ... }); }
 */
export function isLiveTestEnabled(): boolean {
  return originalEnvGet("AI_LIVE_TESTS") === "true";
}
