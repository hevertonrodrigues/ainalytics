---
description: How to create a new Supabase Edge Function following project patterns
---

# Create a New Edge Function

// turbo-all

1. Read the `edge-function-development` skill for templates and rules:

```bash
cat .agents/skills/edge-function-dev/SKILL.md
```

2. Create the function directory and index file:

```bash
mkdir -p supabase/functions/<function-name>
```

3. Copy the standard template into the new function:

```bash
cat > supabase/functions/<function-name>/index.ts << 'EOF'
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, created, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

serve(async (req: Request) => {
  const logger = createRequestLogger("<function-name>", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const auth = await verifyAuth(req);
    const db = createAdminClient();

    switch (req.method) {
      case "GET": {
        // TODO: Implement GET
        return logger.done(withCors(req, ok([])), { tenant_id: auth.tenantId, user_id: auth.user.id });
      }
      case "POST": {
        const body = await req.json();
        // TODO: Implement POST
        return logger.done(withCors(req, created(body)), { tenant_id: auth.tenantId, user_id: auth.user.id });
      }
      default:
        return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)));
    }
  } catch (err: any) {
    console.error("[<function-name>]", err);
    if (err.status) {
      return logger.done(withCors(
        req,
        new Response(
          JSON.stringify({ success: false, error: { message: err.message, code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" } }),
          { status: err.status, headers: { "Content-Type": "application/json" } },
        ),
      ));
    }
    return logger.done(withCors(req, serverError(err.message || "Internal server error")));
  }
});
EOF
```

4. Add tests for the new edge function. Read the `edge-function-testing` skill first:

```bash
cat .agents/skills/edge-function-testing/SKILL.md
```

5. Add the function to the live integration tests in `supabase/functions/__tests__/edge-functions-live.test.ts`:

   - Add `"<function-name>"` to the **CORS `fns` array** (~line 160)
   - Add `"<function-name>"` to the **`authRequired` array** (or `adminRequired` if super admin)
   - Add a **dedicated describe block** with:
     - Method validation test (wrong method → 400/401)
     - Success path test (correct method → 200)
     - Query parameter / body validation tests

6. If the function has extractable pure logic (scoring, filtering, calculations), add unit tests to `supabase/functions/__tests__/logic.test.ts`.

7. Verify tests pass:

```bash
npm run test:unit
npm run test:live
```

8. Test the function with local Supabase:

```bash
curl -X GET http://localhost:54321/functions/v1/<function-name> \
  -H "Authorization: Bearer <your-jwt>" \
  -H "Content-Type: application/json" \
  -H "apikey: <anon-key>"
```
