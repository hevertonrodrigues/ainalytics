---
name: database-migration
description: Skill for creating Supabase database migrations with tenant_id enforcement, RLS policies, and proper indexes
---

# Database Migration Skill

Use this skill when creating or modifying database migrations for the multi-tenant SaaS platform.

## Migration File Naming

```
supabase/migrations/YYYYMMDDHHMMSS_description.sql
```

Example: `20260223001200_create_tenants.sql`

## Table Template

Every new table must follow this template:

```sql
-- Create table: <table_name>
CREATE TABLE IF NOT EXISTS <table_name> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- ... table-specific columns ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on tenant_id (REQUIRED for every table)
CREATE INDEX IF NOT EXISTS idx_<table_name>_tenant_id
  ON <table_name>(tenant_id);

-- Enable RLS (REQUIRED for every table)
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- SELECT policy: authenticated users in same tenant
CREATE POLICY "<table_name>_select_own_tenant"
  ON <table_name> FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- No INSERT/UPDATE/DELETE policies for 'authenticated'
-- Mutations happen via Edge Functions using service_role

-- Updated_at trigger
CREATE TRIGGER set_<table_name>_updated_at
  BEFORE UPDATE ON <table_name>
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Common Trigger Function

Create this once, reuse across all tables:

```sql
-- In a shared migration (first migration)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Checklist for Every Migration

- [ ] Table has `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- [ ] Table has `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- [ ] Table has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- [ ] Table has `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- [ ] Index on `tenant_id` created
- [ ] Additional indexes for common queries (e.g., `user_id`, `slug`)
- [ ] RLS enabled
- [ ] SELECT policy added for `authenticated` role
- [ ] NO INSERT/UPDATE/DELETE policies for `authenticated`
- [ ] `updated_at` trigger created
- [ ] Foreign keys have `ON DELETE CASCADE` where appropriate
- [ ] Unique constraints where needed (e.g., `(tenant_id, slug)`)

## Seed Data Pattern

```sql
-- seed.sql
-- Create a demo tenant
INSERT INTO tenants (id, tenant_id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Demo Organization', 'demo-org');

-- Create a demo user (must match a Supabase Auth user)
INSERT INTO users (id, tenant_id, email, full_name) VALUES
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'demo@example.com', 'Demo User');

-- Link user to tenant
INSERT INTO tenant_users (tenant_id, user_id, role, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'owner', true);
```

## Common Gotchas

1. **Order matters**: `tenants` must be created before any table that references it
2. **Auth users**: The `users` table `id` must match `auth.users.id` — use `auth.uid()` in RLS
3. **Self-referencing tenant**: `tenants.tenant_id` references `tenants.id` — insert the tenant first, then update
4. **RLS + service_role**: Edge Functions using `createClient` with `service_role` key bypass RLS — this is by design
5. **Migration idempotency**: Use `IF NOT EXISTS` for CREATE TABLE, `IF EXISTS` for DROP
