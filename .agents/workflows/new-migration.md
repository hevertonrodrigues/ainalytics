---
description: How to create a new database migration following project patterns
---

# Create a New Database Migration

// turbo-all

1. Generate a new migration file:

```bash
npx supabase migration new <description>
```

2. Open the generated file in `supabase/migrations/` and add your SQL following the template:

```sql
-- Always include these columns:
-- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
-- tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
-- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

-- Always create index on tenant_id
-- Always enable RLS
-- Always add SELECT policy for authenticated role
-- Never add INSERT/UPDATE/DELETE policies
-- Always add updated_at trigger
```

3. Apply the migration locally:

```bash
npx supabase db reset
```

4. Verify the migration:

```bash
npx supabase db diff
```
