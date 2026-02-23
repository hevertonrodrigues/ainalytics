---
description: Security and authentication best practices for JWT, CORS, and API hardening
---

# Security & Authentication Rule

## Purpose

Enforce best-in-class security practices for a serverless multi-tenant SaaS platform. All APIs must be safe for both web and mobile (native app) consumers.

## Rules

### 1. JWT Authentication

- All authenticated endpoints require `Authorization: Bearer <token>` header
- JWT is issued by Supabase Auth (GoTrue) and verified in Edge Functions
- Custom claims include `tenant_id` for current tenant context
- Token refresh is handled via Supabase `onAuthStateChange` on the frontend
- Tokens are stored in `localStorage` (web) — acceptable for SPA + Edge Function architecture
- Mobile apps use the same header-based approach (no cookies)

### 2. JWT Verification in Edge Functions

```typescript
// Always verify the JWT and extract user + tenant
const { user, tenantId } = await verifyAuth(req);

// verifyAuth must:
// 1. Extract Bearer token from Authorization header
// 2. Verify token with Supabase Auth (getUser)
// 3. Extract tenant_id from JWT claims or query tenant_users
// 4. Throw 401 if token invalid
// 5. Throw 403 if user not in requested tenant
```

### 3. CORS Configuration

```typescript
const ALLOWED_ORIGINS = [Deno.env.get("SITE_URL") || "http://localhost:5173"];

const corsHeaders = {
  "Access-Control-Allow-Origin": origin, // validated against allowlist
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
```

### 4. Input Validation

- All Edge Function inputs must be validated before processing
- Use Zod or manual validation with clear error messages
- Never trust client input for `tenant_id` — derive from JWT
- Sanitize all string inputs to prevent injection

### 5. Rate Limiting

- Auth endpoints (signup, signin, forgot-password) should implement basic rate limiting
- Use Supabase's built-in rate limiting where available
- Return `429 Too Many Requests` when limits are exceeded

### 6. Password Requirements

- Minimum 8 characters
- Enforced by Supabase Auth configuration
- Additional validation in signup Edge Function

### 7. Tenant Isolation

- Every database query in Edge Functions must include `tenant_id` filter
- Even with service_role (bypasses RLS), always filter by tenant
- Never return data from a tenant the user doesn't belong to

### 8. Headers

All Edge Function responses must include:

```typescript
{
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  ...corsHeaders
}
```

### 9. Secrets Management

- All secrets in environment variables via `.env` (never committed)
- `.env.example` documents required vars without values
- Edge Functions use `Deno.env.get()` — never `import.meta.env`
- Frontend uses `import.meta.env.VITE_*` — only public values

### 10. API Key Security

- `SUPABASE_ANON_KEY` — public, used by frontend for authenticated SELECT queries
- `SUPABASE_SERVICE_ROLE_KEY` — **secret**, only used in Edge Functions
- Never expose service_role key to the frontend
