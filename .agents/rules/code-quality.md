---
description: Code quality standards — DRY, modular, typed, consistent patterns
---

# Code Quality & Patterns Rule

## Purpose

Enforce clean, maintainable, DRY code with consistent patterns across the entire codebase.

## Rules

### 1. No Repeated Code

- Extract repeated logic into shared utilities (`src/lib/`)
- Extract repeated UI into reusable components (`src/components/ui/`)
- Extract repeated hooks into custom hooks (`src/hooks/`)
- Edge Function shared code goes in `supabase/functions/_shared/`

### 2. TypeScript Strict Mode

- `strict: true` in `tsconfig.json`
- No `any` types — use `unknown` and narrow
- All function parameters and returns must be typed
- Use interfaces for objects, enums/unions for constants

### 3. Base Entity Pattern

All database types extend:

```typescript
interface BaseEntity {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

interface Tenant extends BaseEntity {
  name: string;
  slug: string;
}

interface User extends BaseEntity {
  email: string;
  full_name: string;
}
```

### 4. Hook Pattern

All data-fetching hooks follow:

```typescript
interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Example
function useTenantSettings(): UseQueryResult<TenantSetting[]> { ... }
```

All mutation hooks follow:

```typescript
interface UseMutationResult<TInput, TOutput> {
  mutate: (input: TInput) => Promise<TOutput>;
  loading: boolean;
  error: string | null;
}

// Example
function useUpdateProfile(): UseMutationResult<UpdateProfileInput, Profile> { ... }
```

### 5. Component Pattern

```tsx
// Props interface always defined
interface ComponentProps {
  title: string;
  onAction: () => void;
  children?: React.ReactNode;
}

// Named export, not default
export function Component({ title, onAction, children }: ComponentProps) {
  const { t } = useTranslation();
  // ...
}
```

### 6. File Organization

```
// One component per file
// File name matches component/hook name
// Index files for barrel exports

src/components/ui/
├── Button.tsx
├── Input.tsx
├── Card.tsx
├── Modal.tsx
└── index.ts    // export { Button } from './Button'; ...
```

### 7. Import Order

```typescript
// 1. React/framework imports
import { useState, useEffect } from "react";

// 2. Third-party libraries
import { useTranslation } from "react-i18next";

// 3. Internal modules (absolute paths with @/)
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui";

// 4. Types
import type { User } from "@/types";

// 5. Styles (if any)
import "./styles.css";
```

### 8. Error Handling

- Edge Functions: Always try/catch, return standard error response
- Frontend: API client throws on error, components catch in hooks
- Never silently swallow errors
- Log errors with context (function name, input summary)

### 9. Constants

- No magic strings or numbers
- Use `const` objects or enums:

```typescript
export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
```

### 10. Naming Conventions

| Element                | Convention             | Example            |
| ---------------------- | ---------------------- | ------------------ |
| Files (components)     | PascalCase             | `SignIn.tsx`       |
| Files (utils/hooks)    | camelCase              | `useAuth.ts`       |
| Files (Edge Functions) | kebab-case             | `tenant-settings/` |
| Variables/functions    | camelCase              | `getCurrentUser`   |
| Types/interfaces       | PascalCase             | `TenantSettings`   |
| Constants              | UPPER_SNAKE            | `MAX_RETRIES`      |
| DB columns             | snake_case             | `tenant_id`        |
| CSS classes            | kebab-case             | `nav-sidebar`      |
| i18n keys              | camelCase dot-notation | `auth.signIn`      |
