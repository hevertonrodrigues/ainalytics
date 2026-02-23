---
description: How to create a new Supabase Edge Function following project patterns
---

# Create a New Edge Function

// turbo-all

1. Create the function directory and index file:

```bash
mkdir -p supabase/functions/<function-name>
```

2. Copy the standard template into the new function:

```bash
cat > supabase/functions/<function-name>/index.ts << 'EOF'
import { serve } from "https://deno.land/std/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, created, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const auth = await verifyAuth(req);
    const db = createAdminClient();

    switch (req.method) {
      case "GET": {
        // TODO: Implement GET
        return withCors(ok([]));
      }
      case "POST": {
        const body = await req.json();
        // TODO: Implement POST
        return withCors(created(body));
      }
      default:
        return withCors(badRequest(`Method ${req.method} not allowed`));
    }
  } catch (err) {
    console.error("[<function-name>]", err);
    return withCors(serverError(err.message || "Internal server error"));
  }
});
EOF
```

3. Test with local Supabase:

```bash
npx supabase functions serve <function-name> --no-verify-jwt
```

4. Test with curl:

```bash
curl -X GET http://localhost:54321/functions/v1/<function-name> \
  -H "Authorization: Bearer <your-jwt>" \
  -H "Content-Type: application/json"
```
