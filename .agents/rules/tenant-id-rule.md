---
description: Enforce tenant_id column on all database tables for multi-tenant isolation
---

# Tenant ID Enforcement Rule

## Purpose

Every database table in this project **must** include a `tenant_id` column to ensure complete multi-tenant data isolation. This is a non-negotiable architectural constraint.

## Rules

### 1. All Tables Must Have `tenant_id`

Every table in the `public` schema must include:

```sql
tenant_id UUID NOT NULL REFERENCES tenants(id)
```

**Exception**: The `tenants` table itself does **NOT** have a `tenant_id` column — it is the root entity. All other tables must reference it.

### 2. Migration Checklist

When creating or reviewing a migration:

- [ ] New table includes `tenant_id UUID NOT NULL REFERENCES tenants(id)`
- [ ] Index exists on `tenant_id` for the new table: `CREATE INDEX idx_<table>_tenant_id ON <table>(tenant_id)`
- [ ] RLS is enabled: `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY`
- [ ] SELECT policy filters by `tenant_id` matching user's tenant membership
- [ ] No INSERT/UPDATE/DELETE policies for `authenticated` role (mutations via Edge Functions only)

### 3. Edge Function Enforcement

When inserting or updating data in Edge Functions:

- Always include `tenant_id` in the payload
- Validate that the authenticated user belongs to the target `tenant_id` via `tenant_users`
- Never trust `tenant_id` from client input — derive it from the JWT claims or validate against `tenant_users`

### 4. TypeScript Types

Every database entity type must include:

```typescript
interface BaseEntity {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}
```

### 5. Seed Data

All seed data must include valid `tenant_id` references.

## Violations

If a table is found without `tenant_id`, it is a **critical** architectural violation that must be fixed immediately before any other work proceeds.
