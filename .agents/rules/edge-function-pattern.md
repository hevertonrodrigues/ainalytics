---
description: Enforce all mutations through Supabase Edge Functions — never mutate from frontend
---

# Edge Function Mutation Enforcement

## Purpose

All database mutations (INSERT, UPDATE, DELETE) **must** go through Supabase Edge Functions. The frontend is only allowed to perform SELECT queries directly via the Supabase client.

## Rules

### 1. Frontend — SELECT Only

The Supabase client in the frontend (`src/lib/supabase.ts`) must **only** be used for:

```typescript
// ✅ ALLOWED — Read queries
supabase.from('table').select('*')
supabase.rpc('function_name', { params })

// ❌ FORBIDDEN — These must NEVER appear in frontend code
supabase.from('table').insert(...)
supabase.from('table').update(...)
supabase.from('table').upsert(...)
supabase.from('table').delete(...)
```

### 2. Mutations via `apiClient`

All mutations must use the `apiClient` utility (`src/lib/api.ts`) which calls Edge Functions:

```typescript
// ✅ CORRECT — Mutation through Edge Function
const result = await apiClient.post("/tenant-settings", {
  key: "theme",
  value: "dark",
});

// ❌ WRONG — Direct mutation from frontend
const { error } = await supabase
  .from("tenant_settings")
  .insert({ key: "theme", value: "dark" });
```

### 3. RLS Enforcement

Database RLS policies must enforce this pattern:

- `authenticated` role: Only `SELECT` policies
- `service_role` (used by Edge Functions): Full access (bypasses RLS)

### 4. Edge Function Standard Structure

Every Edge Function must follow this pattern:

```typescript
import { serve } from "https://deno.land/std/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, error, created } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    // 2. Authenticate & extract tenant
    const { user, tenantId } = await verifyAuth(req);

    // 3. Route by method
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/[^/]+/, ""); // strip function name

    // 4. Business logic
    const db = createAdminClient();
    // ... operations ...

    // 5. Standard response
    return ok({ data: result });
  } catch (err) {
    return error(err.message, err.status || 400);
  }
});
```

## Code Review Checklist

- [ ] No `.insert()`, `.update()`, `.delete()`, `.upsert()` calls in `src/` directory
- [ ] All mutation hooks call `apiClient` methods
- [ ] Edge Functions use `createAdminClient()` (service_role) for mutations
- [ ] RLS policies only allow SELECT for `authenticated` role
