---
description: How to start the local development environment
---

# Start Development Environment

// turbo-all

1. Start local Supabase:

```bash
cd /Users/hr/Desktop/dev/ainalytics && npx supabase start
```

2. Apply all migrations:

```bash
cd /Users/hr/Desktop/dev/ainalytics && npx supabase db reset
```

3. Start the Vite dev server:

```bash
cd /Users/hr/Desktop/dev/ainalytics && npm run dev
```

4. Start Edge Functions (in a separate terminal):

```bash
cd /Users/hr/Desktop/dev/ainalytics && npx supabase functions serve --no-verify-jwt
```

5. Access the app at `http://localhost:5173`
6. Access Supabase Studio at `http://localhost:54323`
