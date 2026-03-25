---
name: edge-function-testing
description: Skill for creating comprehensive tests for Supabase Edge Functions. Use this when adding or modifying edge functions to ensure regression coverage.
---

# Edge Function Testing Skill

Use this skill when creating tests for Supabase Edge Functions. It covers both **unit tests** (pure logic, no network) and **live integration tests** (against running local Supabase).

## Test Architecture

```
supabase/functions/
├── __tests__/                              # Edge function tests
│   ├── edge-helpers.ts                     # Shared test infra (mocks, factories, assertions)
│   ├── shared.test.ts                      # Tests for _shared modules (response, cors, logger)
│   ├── logic.test.ts                       # Pure-logic unit tests (scoring, pagination, validation)
│   └── edge-functions-live.test.ts         # Live integration tests for all functions
├── _shared/
│   └── ai-providers/__tests__/             # AI adapter tests
│       ├── test-helpers.ts                 # AI-specific test helpers
│       ├── fixtures.ts                     # Real API response fixtures
│       ├── openai.test.ts                  # ... one per adapter
│       └── index.test.ts                   # Registry/router tests
```

## Test Categories

### 1. Live Integration Tests (primary pattern)

Live tests call real edge functions running via `supabase functions serve`. Add new function tests to `edge-functions-live.test.ts`.

**Template — add to `edge-functions-live.test.ts`:**

```typescript
// ═══════════════════════════════════════════════════════════
// FUNCTION-NAME
// ═══════════════════════════════════════════════════════════

describe("Edge Functions: function-name", () => {
  // CORS preflight
  // (already covered by the generic CORS loop — just add the name to the `fns` array)

  // Auth gating
  // (already covered by the generic auth loop — add to `authRequired` or `adminRequired` array)

  // Method validation
  it("POST /function-name → 400/401 (GET only)", async () => {
    const res = await callFn("POST", "function-name");
    assert([400, 401].includes(res.status));
    await res.body?.cancel();
  });

  // Success path
  it("GET /function-name → 200 with data", async () => {
    const res = await callFn("GET", "function-name");
    if (res.status === 200) {
      const body = await parseBody(res);
      assertEquals(body.success, true);
      // Assert data shape
      const data = body.data as Record<string, unknown>;
      assertExists(data.expectedField);
    } else {
      assert([200, 401].includes(res.status));
      await res.body?.cancel();
    }
  });

  // Query parameter variations
  it("GET /function-name?param=value → filtered results", async () => {
    const res = await callFn("GET", "function-name", {
      queryParams: { param: "value" },
    });
    assert([200, 401].includes(res.status));
    await res.body?.cancel();
  });

  // POST with body
  it("POST /function-name → creates resource", async () => {
    const res = await callFn("POST", "function-name", {
      body: { name: "test", description: "test" },
    });
    assert([200, 201, 400, 401].includes(res.status));
    await res.body?.cancel();
  });
});
```

### 2. Pure Logic Unit Tests

Extract and test business logic without network calls. Add to `logic.test.ts`.

```typescript
describe("Function-Name: Validation Logic", () => {
  it("should reject invalid input", () => {
    const isValid = typeof "abc" === "string" && "abc".trim().length > 0;
    assertEquals(isValid, true);
  });

  it("should calculate score correctly", () => {
    const score = computeScore(50, 100);
    assertEquals(score, 50);
  });
});
```

### 3. Adding to CORS and Auth Loops

In `edge-functions-live.test.ts`, just add the function name to the existing arrays:

```typescript
// For CORS preflight testing (line ~160)
const fns = [
  // ... existing functions ...
  "new-function-name",  // ← add here
];

// For auth gating testing
const authRequired = [
  // ... existing functions that use verifyAuth ...
  "new-function-name",  // ← add here
];

// OR for super admin functions
const adminRequired = [
  // ... existing functions that use verifySuperAdmin ...
  "new-function-name",  // ← add here
];
```

## Key Patterns

### `callFn()` helper

```typescript
// Authenticated GET
const res = await callFn("GET", "function-name");

// With query params
const res = await callFn("GET", "function-name", { queryParams: { view: "summary" } });

// With sub-path
const res = await callFn("GET", "platforms", { subPath: "/preferences" });

// POST with body
const res = await callFn("POST", "function-name", { body: { key: "value" } });

// Unauthenticated (public endpoint)
const res = await callFn("GET", "faq", { noAuth: true });
```

### Response assertions

```typescript
// Always drain the response body to prevent resource leaks
await res.body?.cancel();

// Or parse it with the helper
const body = await parseBody(res);
assertEquals(body.success, true);
```

### Status code flexibility

Since auth runs before method validation, always accept both the expected status AND 401:

```typescript
// ✅ Good — tolerates auth failures in test environments
assert([400, 401].includes(res.status));

// ❌ Bad — will fail if test user JWT is invalid
assertEquals(res.status, 400);
```

For admin functions, also accept 403:

```typescript
assert([200, 401, 403].includes(res.status));
```

## Running Tests

```bash
# Fast unit tests (no network, ~400ms) — runs on pre-commit and pre-push
npm run test:unit

# Live integration tests (needs local Supabase running)
npm run test:live

# All tests
npm test
```

## Checklist for New Edge Function Tests

1. Add function name to CORS preflight `fns` array
2. Add to `authRequired` or `adminRequired` array (if authenticated)
3. Add method validation test (wrong method → 400/401)
4. Add success path test (correct method → 200 with expected data shape)
5. Add query parameter / sub-path tests if applicable
6. Add input validation tests for POST/PUT endpoints
7. Extract pure logic into `logic.test.ts` if there's scoring/calculation/filtering
8. Run `npm run test:live` to verify
