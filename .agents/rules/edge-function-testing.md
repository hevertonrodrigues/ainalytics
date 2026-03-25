---
description: Enforce test creation when adding or modifying Supabase Edge Functions
---

# Edge Function Testing Rule

## Purpose

Every edge function must have corresponding tests to catch regressions. Tests are mandatory, not optional.

## Rules

### 1. New Edge Functions Must Have Tests

When creating a new edge function, you **must** also:

1. Add the function name to the **CORS preflight `fns` array** in `supabase/functions/__tests__/edge-functions-live.test.ts`
2. Add the function name to the **`authRequired` or `adminRequired` array** (depending on auth type)
3. Add a **dedicated `describe` block** with:
   - Method validation test (wrong method → expected status)
   - Success path test (correct method → 200)
   - Input validation tests for POST/PUT endpoints
   - Query parameter tests if applicable

### 2. Modified Edge Functions Must Update Tests

When modifying an edge function:

- Update existing tests to cover the new behavior
- Add new tests for new endpoints, query parameters, or validation logic
- Extract pure business logic into `logic.test.ts` when possible

### 3. Test File Locations

| Test type | File | When to use |
|---|---|---|
| Live integration | `__tests__/edge-functions-live.test.ts` | All functions — CORS, auth, method, response shape |
| Pure logic | `__tests__/logic.test.ts` | Scoring, calculations, validation, filtering |
| Shared modules | `__tests__/shared.test.ts` | Changes to `_shared/response.ts`, `cors.ts`, `logger.ts` |
| AI adapters | `_shared/ai-providers/__tests__/*.test.ts` | Changes to AI provider adapters |

### 4. Run Tests Before Deploying

```bash
# Fast unit tests (runs on pre-commit and pre-push)
npm run test:unit

# Full suite with live integration tests
npm run test:live

# All tests
npm test
```

### 5. Use the Testing Skill

Read `.agents/skills/edge-function-testing/SKILL.md` for templates, patterns, and the full checklist.

## Code Review Checklist

- [ ] New function added to CORS preflight and auth gating test arrays
- [ ] Dedicated describe block with method validation and success path tests
- [ ] Pure logic extracted to `logic.test.ts` if applicable
- [ ] All tests pass: `npm run test:unit` and `npm run test:live`
