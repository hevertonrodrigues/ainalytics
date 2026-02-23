---
name: edge-function-development
description: Skill for building Supabase Edge Functions with consistent patterns, auth, validation, and error handling
---

# Edge Function Development Skill

Use this skill when creating or modifying Supabase Edge Functions. It provides templates, patterns, and best practices specific to this multi-tenant SaaS platform.

## File Structure

Every Edge Function lives in `supabase/functions/<name>/index.ts` and shares utilities from `supabase/functions/_shared/`.

```
supabase/functions/
├── _shared/
│   ├── cors.ts          # CORS headers and preflight handler
│   ├── auth.ts          # JWT verification, user/tenant extraction
│   ├── response.ts      # Standard response builders (ok, error, created, etc.)
│   ├── validate.ts      # Input validation helpers
│   └── supabase.ts      # Supabase admin client (service_role)
├── auth/
│   └── index.ts         # signup, signin, forgot-password, reset-password
├── users-me/
│   └── index.ts         # GET/PUT own profile
└── tenant-settings/
    └── index.ts         # GET/PUT tenant settings
```

## Edge Function Template

```typescript
import { serve } from "https://deno.land/std/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth, type AuthContext } from "../_shared/auth.ts";
import {
  ok,
  created,
  badRequest,
  notFound,
  serverError,
} from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  // 1. CORS preflight
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    // 2. Auth (skip for public routes like signup/signin)
    const auth: AuthContext = await verifyAuth(req);

    // 3. Parse URL for routing
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    // segments[0] = function name, segments[1+] = sub-routes

    // 4. Create admin Supabase client
    const db = createAdminClient();

    // 5. Route by method
    switch (req.method) {
      case "GET": {
        const { data, error: dbError } = await db
          .from("table_name")
          .select("*")
          .eq("tenant_id", auth.tenantId);

        if (dbError) throw dbError;
        return withCors(ok(data));
      }

      case "POST": {
        const body = await req.json();
        // Validate input
        if (!body.required_field) {
          return withCors(badRequest("required_field is required"));
        }

        const { data, error: dbError } = await db
          .from("table_name")
          .insert({
            tenant_id: auth.tenantId,
            ...body,
          })
          .select()
          .single();

        if (dbError) throw dbError;
        return withCors(created(data));
      }

      default:
        return withCors(badRequest(`Method ${req.method} not allowed`));
    }
  } catch (err) {
    console.error("[function-name]", err);
    if (err.status) {
      return withCors(serverError(err.message, err.status));
    }
    return withCors(serverError("Internal server error"));
  }
});
```

## Shared Module Patterns

### `_shared/cors.ts`

```typescript
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = Deno.env.get("SITE_URL") || "http://localhost:5173";

  return {
    "Access-Control-Allow-Origin": origin === allowed ? origin : allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-tenant-id",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}
```

### `_shared/auth.ts`

```typescript
export interface AuthContext {
  user: { id: string; email: string };
  tenantId: string;
}

export async function verifyAuth(req: Request): Promise<AuthContext> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) throw { status: 401, message: "Missing authorization" };
  // ... verify with Supabase Auth, extract tenant from claims or header
}
```

### `_shared/response.ts`

```typescript
export function ok<T>(data: T) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
// ... created, badRequest, unauthorized, forbidden, notFound, serverError
```

## Rules

1. **Always use `createAdminClient()`** — Edge Functions need service_role to bypass RLS
2. **Always include `tenant_id`** in every INSERT query
3. **Always verify tenant membership** before returning data
4. **Always validate input** before database operations
5. **Always use standard response helpers** — never raw `new Response()`
6. **Always handle CORS** — first line in serve callback
7. **Always log errors** with function name context
8. **Never expose internal errors** to the client — wrap in generic messages for 500s
