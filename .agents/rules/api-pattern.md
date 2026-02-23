---
description: Standard API input/output patterns for Edge Functions and frontend API client
---

# API Pattern Standardization

## Purpose

All Edge Functions must follow a consistent input/output contract. All frontend API calls must follow a consistent calling pattern. This ensures predictability, reusability, and easy debugging.

## Standard Response Envelope

Every Edge Function response must use this shape:

```typescript
// Success response
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
    [key: string]: unknown;
  };
}

// Error response
interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string; // machine-readable error code
    details?: unknown; // validation errors, etc.
  };
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
```

## Response Helper Functions

Use the shared response module (`_shared/response.ts`):

```typescript
// 200 OK
return ok(data);
// → { success: true, data }

// 201 Created
return created(data);
// → { success: true, data }

// 400 Bad Request
return badRequest("Validation failed", details);
// → { success: false, error: { message, code: "BAD_REQUEST", details } }

// 401 Unauthorized
return unauthorized("Invalid token");
// → { success: false, error: { message, code: "UNAUTHORIZED" } }

// 403 Forbidden
return forbidden("Not a member of this tenant");
// → { success: false, error: { message, code: "FORBIDDEN" } }

// 404 Not Found
return notFound("Resource not found");
// → { success: false, error: { message, code: "NOT_FOUND" } }

// 500 Internal Server Error
return serverError("Unexpected error");
// → { success: false, error: { message, code: "INTERNAL_ERROR" } }
```

## Standard Input Pattern

### Edge Function Input

```typescript
// All POST/PUT bodies must include tenant context (derived from JWT, not client)
interface MutationInput<T> {
  // tenant_id comes from JWT, not from body
  payload: T; // the actual data
}
```

### Frontend API Client

```typescript
// Standard API client methods
const apiClient = {
  get: <T>(path: string) => Promise<ApiSuccessResponse<T>>,
  post: <T>(path: string, body: unknown) => Promise<ApiSuccessResponse<T>>,
  put: <T>(path: string, body: unknown) => Promise<ApiSuccessResponse<T>>,
  delete: <T>(path: string) => Promise<ApiSuccessResponse<T>>,
};
```

## HTTP Status Codes

| Status | When to Use                            |
| ------ | -------------------------------------- |
| 200    | Successful read or update              |
| 201    | Successful creation                    |
| 204    | Successful deletion (no body)          |
| 400    | Validation errors, malformed input     |
| 401    | Missing or invalid authentication      |
| 403    | Authenticated but not authorized       |
| 404    | Resource not found                     |
| 409    | Conflict (duplicate email, slug, etc.) |
| 500    | Unexpected server error                |

## Error Codes

Use machine-readable error codes for frontend handling:

```typescript
const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  TENANT_REQUIRED: "TENANT_REQUIRED",
  INVALID_TENANT: "INVALID_TENANT",
} as const;
```

## Rules

- [ ] Every Edge Function uses response helpers, never raw `new Response()`
- [ ] Every response includes `success` boolean at the top level
- [ ] Error responses always include `error.message` (human-readable)
- [ ] Frontend `apiClient` unwraps and throws on `success: false`
- [ ] No custom response shapes — always use the standard envelope
