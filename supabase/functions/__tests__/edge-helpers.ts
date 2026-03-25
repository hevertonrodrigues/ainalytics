/**
 * Shared test helpers for Edge Function tests.
 *
 * Provides:
 *  - Request factories (createReq, createOptionsReq, createUnauthReq, createLiveReq)
 *  - Response assertion helpers (parseBody, assertOk, assertError)
 *  - Environment mock (mockEnv)
 *  - Setup / teardown (setup, restore)
 *
 * Usage:
 *   import { setup, restore, createReq, assertOk, assertError, parseBody, mockEnv } from "./edge-helpers.ts";
 */

// ── Types ──────────────────────────────────────────────────

export interface MockAuthContext {
  user: { id: string; email: string };
  tenantId: string;
  token: string;
}

// ── Auth Defaults ──────────────────────────────────────────

export const DEFAULT_AUTH: MockAuthContext = {
  user: { id: "test-user-001", email: "test@example.com" },
  tenantId: "test-tenant-001",
  token: "test-jwt-token",
};

// ── Request Factory ────────────────────────────────────────

const BASE_URL = "http://localhost:54321/functions/v1";

interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  tenantId?: string;
  token?: string;
  queryParams?: Record<string, string>;
}

/** Create a Request for testing edge functions */
export function createReq(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Request {
  const url = new URL(`${BASE_URL}${path}`);
  if (opts.queryParams) {
    for (const [k, v] of Object.entries(opts.queryParams)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${opts.token ?? DEFAULT_AUTH.token}`,
    ...(opts.tenantId ? { "x-tenant-id": opts.tenantId } : {}),
    ...opts.headers,
  };

  const init: RequestInit = { method, headers };
  if (opts.body && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    init.body = JSON.stringify(opts.body);
  }

  return new Request(url.toString(), init);
}

/** Create an OPTIONS request for CORS preflight testing */
export function createOptionsReq(path: string): Request {
  return new Request(`${BASE_URL}${path}`, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  });
}

/** Create a request with no auth header */
export function createUnauthReq(method: string, path: string, body?: unknown): Request {
  const url = `${BASE_URL}${path}`;
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) init.body = JSON.stringify(body);
  return new Request(url, init);
}

// ── Response Assertions ────────────────────────────────────

/** Parse response JSON body */
export async function parseBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

/** Assert response is a success (200, { success: true, data }) */
export async function assertOk(
  res: Response,
  assert: { assertEquals: (a: unknown, b: unknown, msg?: string) => void; assertExists: (a: unknown, msg?: string) => void },
): Promise<Record<string, unknown>> {
  assert.assertEquals(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await parseBody(res);
  assert.assertEquals(body.success, true, "Expected success: true");
  assert.assertExists(body.data, "Expected data field");
  return body;
}

/** Assert response is an error */
export async function assertError(
  res: Response,
  expectedStatus: number,
  assert: { assertEquals: (a: unknown, b: unknown, msg?: string) => void },
): Promise<Record<string, unknown>> {
  assert.assertEquals(res.status, expectedStatus, `Expected ${expectedStatus}, got ${res.status}`);
  const body = await parseBody(res);
  assert.assertEquals(body.success, false, "Expected success: false");
  return body;
}

// ── Live Test Helpers ──────────────────────────────────────

/** Check if live tests should run */
export function isLiveTestEnabled(): boolean {
  try {
    return Deno.env.get("AI_LIVE_TESTS") === "true";
  } catch {
    return false;
  }
}

const LIVE_URL = "http://127.0.0.1:54321/functions/v1";

/** Create a live request against the local Supabase instance */
export function createLiveReq(
  method: string,
  functionName: string,
  subPath = "",
  opts: RequestOptions & { anonKey?: string; serviceRoleKey?: string } = {},
): Request {
  const anonKey = opts.anonKey ?? Deno.env.get("SUPABASE_ANON_KEY") ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

  const url = new URL(`${LIVE_URL}/${functionName}${subPath}`);
  if (opts.queryParams) {
    for (const [k, v] of Object.entries(opts.queryParams)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": anonKey,
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...(opts.tenantId ? { "x-tenant-id": opts.tenantId } : {}),
    ...opts.headers,
  };

  const init: RequestInit = { method, headers };
  if (opts.body && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    init.body = JSON.stringify(opts.body);
  }

  return new Request(url.toString(), init);
}

// ── Setup / Teardown ───────────────────────────────────────

const originalFetch = globalThis.fetch;
const originalEnvGet = Deno.env.get.bind(Deno.env);
let envOverrides: Record<string, string | undefined> = {};
let envMocked = false;
let fetchMocked = false;

/** Set environment variable overrides */
export function mockEnv(vars: Record<string, string | undefined>): void {
  envOverrides = { ...envOverrides, ...vars };
  if (!envMocked) {
    Deno.env.get = (key: string): string | undefined => {
      if (key in envOverrides) return envOverrides[key];
      return originalEnvGet(key);
    };
    envMocked = true;
  }
}

/** Mock globalThis.fetch with a stub (e.g. to silence Sentry). Restored by restore(). */
export function mockFetch(stub?: typeof globalThis.fetch): void {
  globalThis.fetch = stub ?? ((() => Promise.resolve(new Response("{}", { status: 200 }))) as typeof globalThis.fetch);
  fetchMocked = true;
}

/** Full setup — call in beforeEach() */
export function setup(): void {
  mockEnv({
    SUPABASE_URL: "http://localhost:54321",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    SUPABASE_ANON_KEY: "test-anon-key",
    SITE_URL: "http://localhost:5173",
  });
}

/** Full teardown — call in afterEach() */
export function restore(): void {
  envOverrides = {};
  if (envMocked) {
    Deno.env.get = originalEnvGet;
    envMocked = false;
  }
  if (fetchMocked) {
    globalThis.fetch = originalFetch;
    fetchMocked = false;
  }
}
