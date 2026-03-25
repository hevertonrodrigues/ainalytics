# Ainalytics — Complete Project Specification

## 1. Project Overview

**Ainalytics** is a comprehensive, multi-tenant SaaS platform that monitors and evaluates brand visibility across AI platforms (ChatGPT/OpenAI, Claude/Anthropic, Gemini/Google, Grok/xAI, Perplexity). It allows organizations to track what AI models say about their brand, analyze AI-generated responses, monitor citation sources, and optimize their website for AI discoverability (GEO — Generative Engine Optimization).

- **Production URL**: https://ainalytics.tech
- **Supabase Project ID**: `kjfvhiffsusdqphgjsdz`
- **Deployment**: Vercel (frontend) + Supabase (backend)
- **Domain**: ainalytics.tech

---

## 2. Technology Stack

### 2.1 Frontend

| Technology              | Version     | Purpose                              |
| ----------------------- | ----------- | ------------------------------------ |
| React                   | 19.x        | UI framework                         |
| Vite                    | 6.2.x       | Build tool and dev server            |
| Tailwind CSS            | 4.x         | Utility-first CSS (v4, NOT v3)       |
| React Router DOM        | 7.2.x       | Client-side routing                  |
| react-i18next / i18next | 15.x / 24.x | Internationalization (en, es, pt-br) |
| Lucide React            | 0.575.x     | Icon library                         |
| Supabase JS             | 2.49.x      | Supabase client (SELECT/auth only)   |
| Stripe JS               | 8.9.x       | Stripe payment integration           |
| jsPDF                   | 4.2.x       | PDF report generation                |
| html2canvas             | 1.4.x       | Screenshot capture for PDFs          |
| intl-tel-input          | 26.7.x      | International phone input            |
| react-markdown          | 10.1.x      | Markdown rendering                   |

### 2.2 Backend & Infrastructure

| Technology                                | Purpose                                        |
| ----------------------------------------- | ---------------------------------------------- |
| Supabase                                  | BaaS (Database, Auth, Edge Functions, Storage) |
| PostgreSQL                                | Relational database with RLS                   |
| Supabase Edge Functions (Deno/TypeScript) | Serverless API layer                           |
| Supabase Auth                             | JWT-based authentication                       |
| pg_cron                                   | Scheduled background jobs                      |
| Stripe                                    | Payment processing                             |
| SendGrid                                  | Transactional email                            |
| Google reCAPTCHA v3                       | Bot protection                                 |

### 2.3 Analytics & Tracking

- Google Tag Manager (GTM-K4HQB33N)
- Meta Pixel (Facebook)
- Microsoft Clarity (vtprlhr5j6)

### 2.4 Fonts

- **Outfit** (headings): weights 300–800
- **Plus Jakarta Sans** (body): weights 300–700
- **JetBrains Mono** (code): weights 400–600

---

## 3. Architecture Overview

### 3.1 Multi-Tenant Architecture

Every data table includes a `tenant_id` column referencing the `tenants` table. Row Level Security (RLS) policies enforce data isolation at the database level. The frontend sends `x-tenant-id` header with every API request.

**Tenant hierarchy:**

```
tenants (root)
  └── tenant_users (join: user ↔ tenant, with role)
        └── profiles (user data, linked to auth.users)
```

**Roles:** `owner`, `admin`, `member`

**Super Admin (`is_sa`):** A boolean flag on `profiles` table. Super admins can access all tenants and manage global resources (platforms, models). Checked via `SuperAdminGate` component.

### 3.2 Data Flow Architecture

```
Frontend (React)
  ├── SELECT queries → Supabase JS Client (with RLS, read-only)
  └── Mutations → apiClient (fetch) → Edge Functions → createAdminClient (bypasses RLS)
```

**CRITICAL RULE:** The frontend Supabase client is ONLY used for:

- `SELECT` queries (reads)
- Auth operations (signIn, signUp, signOut, resetPassword)
- NEVER for `.insert()`, `.update()`, `.delete()`, `.upsert()`

All mutations MUST go through the `apiClient` which calls Edge Functions. Edge Functions use `createAdminClient()` (service_role key) to bypass RLS for writes.

### 3.3 API Client Pattern

The `apiClient` in `src/lib/api.ts`:

- Base URL: `{SUPABASE_URL}/functions/v1`
- Auto-attaches JWT from localStorage
- Auto-attaches `x-tenant-id` header
- Auto-refreshes expired tokens (retry once on 401)
- Unwraps the standard `{ success, data, error }` response envelope
- Methods: `get`, `post`, `put`, `patch`, `delete`

### 3.4 Standard API Response Envelope

Every Edge Function response uses this format:

```typescript
// Success
{ success: true, data: T, meta?: Record<string, unknown> }

// Error
{ success: false, error: { message: string, code: string, details?: unknown } }
```

Error codes: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`

---

## 4. Project Structure

```
ainalytics/
├── src/                          # Frontend React Application
│   ├── App.tsx                   # Root component with all routes
│   ├── main.tsx                  # Entry point (StrictMode + ErrorBoundary)
│   ├── index.css                 # Global styles (~92KB, design system)
│   ├── vite-env.d.ts             # Vite type declarations
│   ├── components/               # Reusable UI components
│   │   ├── ErrorBoundary.tsx     # Global error boundary
│   │   ├── InterestFormModal.tsx  # Lead capture modal
│   │   ├── PageExplanation.tsx   # Page header with description
│   │   ├── PhoneInput.tsx        # International phone input
│   │   ├── PricingPlans.tsx      # Plan comparison cards
│   │   ├── PromptForm.tsx        # Prompt creation/edit form
│   │   ├── SignUpForm.tsx        # Registration form
│   │   ├── geo/                  # GEO analysis components
│   │   │   ├── index.tsx         # Main GEO dashboard component
│   │   │   └── ImprovementsAndRecommendations.tsx
│   │   ├── guards/               # Route protection components
│   │   │   ├── ActiveModelsGuard.tsx  # Ensures active models exist
│   │   │   ├── FlowGate.tsx          # Sequential onboarding gate
│   │   │   ├── GuestRoute.tsx        # Redirects authenticated users
│   │   │   ├── ProtectedRoute.tsx    # Redirects unauthenticated users
│   │   │   └── SuperAdminGate.tsx    # Restricts to is_sa=true
│   │   ├── layout/               # App shell components
│   │   │   ├── AppLayout.tsx     # Main layout wrapper
│   │   │   ├── Header.tsx        # Top header bar
│   │   │   ├── MobileHeader.tsx  # Mobile navigation header
│   │   │   └── Sidebar.tsx       # Navigation sidebar (~12KB)
│   │   ├── suggestions/          # AI suggestion components
│   │   │   └── SuggestionsModal.tsx  # AI-generated topic/prompt suggestions
│   │   └── ui/                   # Generic UI components
│   │       ├── CollapsibleSection.tsx
│   │       ├── ConfirmModal.tsx
│   │       ├── LocaleSwitcher.tsx
│   │       ├── SearchSelect.tsx
│   │       └── TutorialModal.tsx
│   ├── config/                   # Configuration files
│   │   └── geo-readiness.ts      # GEO readiness levels & factor status colors
│   ├── contexts/                 # React Context providers
│   │   ├── AuthContext.tsx       # Authentication state & methods
│   │   ├── LayoutContext.tsx     # Layout mode (centered/expanded) & sidebar
│   │   ├── TenantContext.tsx     # Current tenant, setup state, company/models
│   │   ├── ThemeContext.tsx      # Dark/light theme toggle
│   │   └── ToastContext.tsx      # Toast notification system
│   ├── hooks/                    # Custom React hooks
│   │   ├── useCurrency.ts       # Currency conversion (USD→BRL/EUR)
│   │   ├── useScrollLock.ts     # Body scroll locking for modals
│   │   └── useTutorial.ts       # Page-specific tutorial modals
│   ├── i18n/                     # Internationalization
│   │   ├── index.ts             # i18next configuration
│   │   └── locales/
│   │       ├── en.json          # English (~66KB)
│   │       ├── es.json          # Spanish (~71KB)
│   │       └── pt-br.json       # Portuguese BR (~71KB)
│   ├── lib/                      # Shared utilities
│   │   ├── api.ts               # API client for Edge Functions
│   │   ├── authErrors.ts        # Auth error message mapping
│   │   ├── constants.ts         # App constants, env vars, storage keys
│   │   ├── domain.ts            # Root domain extraction utility
│   │   ├── email.ts             # Email validation & free provider blocking
│   │   ├── languages.ts         # Language/locale utilities
│   │   ├── pdfReport.ts         # PDF report generation (~33KB)
│   │   ├── recaptcha.ts         # reCAPTCHA v3 lazy loader
│   │   ├── stripe.ts            # Stripe client initialization
│   │   ├── supabase.ts          # Supabase client (READ-ONLY)
│   │   └── tlds.json            # Valid TLD list for domain validation
│   ├── pages/                    # Route page components (20 modules)
│   │   ├── auth/                 # SignIn, SignUp, ForgotPassword, ResetPassword
│   │   ├── company/              # MyCompanyPage (company setup & GEO analysis)
│   │   ├── contact/              # ContactPage (public contact form)
│   │   ├── dashboard/            # Dashboard, InsightsPage, AnalysesPage
│   │   ├── deep-analyze/         # DeepAnalyzePage (SA-only AI deep analysis)
│   │   ├── error/                # NotFoundPage (404)
│   │   ├── landing/              # LandingPage (public marketing page)
│   │   ├── legal/                # LegalPage (terms/privacy)
│   │   ├── llmtext/              # LlmTextPage (llms.txt management)
│   │   ├── models/               # ModelsPage (AI model selection)
│   │   ├── onboarding/           # OnboardingPage (first-time setup wizard)
│   │   ├── plans/                # PlansPage (subscription plans)
│   │   ├── platforms/            # PlatformsPage (SA-only platform management)
│   │   ├── profile/              # ProfilePage (user profile settings)
│   │   ├── prompts/              # PromptsPage, PromptDetailPage
│   │   ├── sales/                # SalesPage (promotional landing)
│   │   ├── settings/             # TenantSettings (organization settings)
│   │   ├── sources/              # SourcesPage, SourceDetailPage
│   │   ├── support/              # SupportPage (help/contact support)
│   │   └── topics/               # TopicsPage, TopicDetailPage, TopicAnswersPage
│   └── types/                    # TypeScript type definitions
│       ├── index.ts             # All entity types (~620 lines)
│       └── dashboard.ts         # Dashboard-specific types & platform metadata
├── supabase/                     # Backend configuration
│   ├── config.toml              # Supabase local config
│   ├── seed.sql                 # Seed data (platforms, models, activation plans)
│   ├── .env.local               # Local environment variables
│   ├── .env.vault_secrets       # Vault secrets config
│   ├── email_templates/         # Auth email templates
│   ├── migrations/              # 82 PostgreSQL migration files
│   ├── functions/               # 23 Edge Functions
│   │   ├── _shared/             # Shared utilities for all functions
│   │   └── [function-name]/     # Individual function directories
│   └── snippets/                # SQL snippets
├── shared/                       # Shared config (frontend + backend)
│   └── geo-config.json          # GEO readiness levels, factor statuses, colors
├── scripts/                      # Utility scripts
│   └── local-cron.sh            # Local cron job simulator
├── tests/                        # Test files
│   ├── e2e/                     # End-to-end tests
│   └── helpers/                 # Test helpers
├── guide_docs/                   # AI provider integration guides
├── _mkt/                         # Marketing assets
├── public/                       # Static assets
│   ├── favicon.ico
│   ├── logo-purple.webp
│   ├── logo-white.png
│   ├── robots.txt
│   └── landing-*.png
├── .agents/                      # AI agent configuration
│   ├── rules/                   # Agent rules
│   ├── skills/                  # Agent skills (database-migration, edge-function-dev, frontend-design)
│   └── workflows/               # Predefined workflows
├── index.html                    # HTML entry point with SSR shell, SEO, analytics
├── package.json                  # Dependencies & scripts
├── vite.config.ts                # Vite configuration with chunking
├── vercel.json                   # Vercel SPA rewrite rules
├── tsconfig.json                 # TypeScript config
└── eslint.config.js              # ESLint configuration
```

---

## 5. Environment Variables

### 5.1 Frontend (Vite — `VITE_` prefix required)

```
VITE_SUPABASE_URL=https://kjfvhiffsusdqphgjsdz.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_APP_NAME=Ainalytics
VITE_RECAPTCHA_SITE_KEY=<recaptcha-site-key>
VITE_STRIPE_PUBLISHABLE_KEY=<stripe-publishable-key>
```

### 5.2 Backend (Edge Functions — Deno.env.get())

```
SUPABASE_URL=<project-url>
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
OPENAI_API_KEY=<openai-key>
ANTHROPIC_API_KEY=<anthropic-key>
GEMINI_API_KEY=<gemini-key>
XAI_API_KEY=<xai/grok-key>
PERPLEXITY_API_KEY=<perplexity-key>
SENDGRID_API_KEY=<sendgrid-key>
RECAPTCHA_SECRET_KEY=<recaptcha-secret>
SITE_URL=https://ainalytics.tech
```

---

## 6. Routing & Navigation

### 6.1 Route Structure

All routes are defined in `src/App.tsx` with lazy-loaded components and `Suspense`:

**Public Routes (no auth required):**
| Path | Component | Description |
|---|---|---|
| `/` | LandingPage | Marketing landing page |
| `/:lang` | LandingWithLang | Localized landing (en, es, pt-br) |
| `/contact` | ContactPage | Public contact form |
| `/terms` | LegalPage | Terms of service |
| `/privacy` | LegalPage | Privacy policy |

**Guest Routes (redirect if authenticated):**
| Path | Component | Description |
|---|---|---|
| `/signin` | SignIn | Login page |
| `/signup` | SignUp | Registration page |
| `/forgot-password` | ForgotPassword | Password reset request |
| `/reset-password` | ResetPassword | Password reset form |
| `/oferta-marco` | SalesPage | Promotional sales page |

**Protected Routes (require authentication + TenantProvider + AppLayout):**

_Always accessible (no gate):_
| Path | Component | Description |
|---|---|---|
| `/dashboard/onboarding` | OnboardingPage | First-time setup wizard |
| `/dashboard/plans` | PlansPage | Subscription plan selection |
| `/dashboard/profile` | ProfilePage | User profile settings |
| `/dashboard/support` | SupportPage | Help & support |

_Flow-gated (sequential setup required):_
| Path | Component | Gate Level |
|---|---|---|
| `/dashboard/company` | MyCompanyPage | Requires: plan |
| `/dashboard/models` | ModelsPage | Requires: plan + company |
| `/dashboard` | Dashboard | Requires: plan + company + models |
| `/dashboard/settings` | TenantSettings | Requires: all setup |
| `/dashboard/topics` | TopicsPage | Requires: all setup |
| `/dashboard/topics/:id` | TopicDetailPage | Requires: all setup |
| `/dashboard/topics/:id/answers` | TopicAnswersPage | Requires: all setup |
| `/dashboard/prompts` | PromptsPage | Requires: all setup |
| `/dashboard/prompts/:id` | PromptDetailPage | Requires: all setup |
| `/dashboard/insights` | InsightsPage | Requires: all setup |
| `/dashboard/analyses` | AnalysesPage | Requires: all setup |
| `/dashboard/sources` | SourcesPage | Requires: all setup |
| `/dashboard/sources/:id` | SourceDetailPage | Requires: all setup |
| `/dashboard/llmtext` | LlmTextPage | Requires: all setup |

_SuperAdmin-only:_
| Path | Component | Description |
|---|---|---|
| `/dashboard/deep-analyze` | DeepAnalyzePage | AI deep analysis tool |
| `/dashboard/platforms` | PlatformsPage | Global platform management |

### 6.2 FlowGate — Sequential Onboarding

The `FlowGate` component (`src/components/guards/FlowGate.tsx`) enforces a sequential setup flow:

1. **Gate 0 — Plan:** If no `active_plan_id` on tenant → redirect to onboarding (if not seen) or plans
2. **Gate 1 — Company:** If no company exists → redirect to `/dashboard/company`
3. **Gate 2 — Models:** If no model preferences → redirect to `/dashboard/models`

Only after all three gates pass does the user access the full dashboard.

### 6.3 Context Provider Tree

```
ThemeProvider
  └── LayoutProvider
        └── ToastProvider
              └── BrowserRouter
                    └── Suspense
                          └── Routes
                                ├── Public routes (no provider)
                                └── AuthProvider
                                      ├── Guest routes
                                      └── ProtectedRoute
                                            └── TenantProvider
                                                  └── AppLayout
                                                        └── FlowGate
                                                              └── Dashboard routes
```

---

## 7. React Contexts

### 7.1 AuthContext (`src/contexts/AuthContext.tsx`)

- **State:** `profile: Profile | null`, `tenants: Tenant[]`, `loading`, `initialized`
- **Methods:** `signIn`, `signUp`, `signOut`, `forgotPassword`, `resetPassword`, `refreshAuth`
- **Behavior:**
  - On mount: checks localStorage for access_token, calls `/users-me` to restore session
  - Listens to Supabase `onAuthStateChange` for token refresh
  - SignUp includes retry logic (3 attempts with 500/1500/3000ms delays) because the DB trigger that creates tenant/profile runs asynchronously
  - Token stored in localStorage keys: `access_token`, `refresh_token`, `current_tenant_id`

### 7.2 TenantContext (`src/contexts/TenantContext.tsx`)

- **State:** `currentTenant`, `tenants`, `hasCompany`, `hasModels`, `isFullySetup`, `tenantLoading`
- **Methods:** `switchTenant`, `refreshTenant`, `setHasCompany`, `setHasModels`
- **Behavior:**
  - On tenant change: fetches `/company` and `/platforms/preferences` in parallel
  - `isFullySetup = hasPlan && hasCompany && hasModels`

### 7.3 ThemeContext (`src/contexts/ThemeContext.tsx`)

- Supports `light` and `dark` themes
- Persisted via `localStorage` key `ainalytics-theme`
- Sets `data-theme` attribute on `<html>` element
- Defaults to OS preference via `prefers-color-scheme`

### 7.4 ToastContext (`src/contexts/ToastContext.tsx`)

- Variants: `success`, `error`, `info`
- Auto-dismiss after 8 seconds
- Fixed position bottom-right
- Uses Lucide icons (CheckCircle, AlertCircle, Info)

### 7.5 LayoutContext (`src/contexts/LayoutContext.tsx`)

- Layout modes: `centered` (default) and `expanded`
- Controls sidebar open/close state
- Persisted via localStorage key `ainalytics_layout_mode`
- Sets `data-layout` attribute on `<html>` element

---

## 8. Custom Hooks

### 8.1 `useCurrency` (`src/hooks/useCurrency.ts`)

- Fetches exchange rates from `general_settings` table (keys: `USD_BRL`, `USD_EUR`)
- `formatPrice(usdPrice)`: converts to locale-appropriate currency format
  - `pt-*` → R$ (BRL), `es-*` → € (EUR), default → $ (USD)

### 8.2 `useTutorial` (`src/hooks/useTutorial.ts`)

- Tracks page-specific tutorials via `profile.tutorial_views` JSONB field
- Path-to-key mapping: topics, prompts, sources, llmText, insights, models
- `dismissTutorial()`: updates profile via `/users-me` PUT

### 8.3 `useScrollLock` (`src/hooks/useScrollLock.ts`)

- Locks body scroll when modals are open

---

## 9. Type System (`src/types/index.ts`)

### 9.1 Base Entity

Every tenant-scoped table includes: `id`, `tenant_id`, `created_at`, `updated_at`

### 9.2 Core Types

| Type                  | Description                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Plan`                | Subscription plan (global, no tenant_id)                                                                                                                                         |
| `Tenant`              | Organization with `name`, `slug`, `active_plan_id`, `main_domain`                                                                                                                |
| `Profile`             | User profile with `user_id`, `full_name`, `email`, `locale`, `is_sa`, `has_seen_onboarding`, `tutorial_views`                                                                    |
| `TenantUser`          | Join table: `user_id`, `role` (owner/admin/member), `is_active`                                                                                                                  |
| `Topic`               | Prompt grouping: `name`, `description`, `is_active`, virtual `prompt_count`                                                                                                      |
| `Prompt`              | AI query: `topic_id`, `text` (max 500 chars), `description`, `is_active`                                                                                                         |
| `Platform`            | AI provider: `slug`, `name`, `is_active`, `default_model_id`                                                                                                                     |
| `Model`               | AI model: `platform_id`, `slug`, `name`, `is_active`, `web_search_active`                                                                                                        |
| `TenantPlatformModel` | Tenant's selected models: `platform_id`, `model_id`, `is_active`                                                                                                                 |
| `PromptAnswer`        | AI response: `prompt_id`, `platform_slug`, `model_id`, `answer_text`, `tokens_used`, `latency_ms`, `raw_request`, `raw_response`, `web_search_enabled`, `annotations`, `sources` |
| `Source`              | Citation source: `domain`, `name`, `mentions_count`                                                                                                                              |
| `PromptAnswerSource`  | Join: answer ↔ source with `url`, `title`, `annotation`                                                                                                                          |
| `Company`             | Company profile: `domain`, website metadata, `llm_txt`, `llm_txt_status`, `latest_analysis`                                                                                      |
| `GeoAnalysis`         | GEO analysis results: `status`, `crawled_pages`, `ai_report`, `geo_score`, `readiness_level`, deep analyze data                                                                  |
| `CompanyAiAnalysis`   | Deep AI analysis: `final_score`, category scores, `reasoning`, `high_probability_prompts`, `improvements`                                                                        |

### 9.3 GEO Analysis Types

The GEO (Generative Engine Optimization) system has extensive types:

- `CompanyPage`: Detailed page analysis (headings, schema, semantic HTML, links, images, OG tags, tables, lists, paragraphs, security)
- `GeoFactorScore`: 25 scoring factors across 4 categories (Technical, Content, Authority, Semantic)
- `GeoReadinessLevel`: 0–5 scale (AI Invisible → AI Authority)
- `AiReport`: Company analysis including competitors, strengths, weaknesses, products/services

### 9.4 API Response Types

- `ApiSuccessResponse<T>`: `{ success: true, data: T, meta? }`
- `ApiErrorResponse`: `{ success: false, error: { message, code, details? } }`
- `ApiResponse<T>`: Union of success and error

---

## 10. Supabase Edge Functions

### 10.1 Shared Modules (`supabase/functions/_shared/`)

| File                   | Purpose                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.ts`              | JWT verification + tenant resolution from `x-tenant-id` header or first active membership                                                  |
| `cors.ts`              | CORS headers, preflight handler, `withCors` wrapper. Allowed origin from `SITE_URL` env var                                                |
| `response.ts`          | Standard response builders: `ok`, `created`, `noContent`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `serverError` |
| `supabase.ts`          | `createAdminClient()` (service_role, bypasses RLS) and `createUserClient(token)` (user JWT, RLS-scoped)                                    |
| `verify-recaptcha.ts`  | Server-side reCAPTCHA v3 token verification                                                                                                |
| `prompt-execution.ts`  | Core prompt execution logic for running prompts against AI models                                                                          |
| `llm-generation.ts`    | LLM text generation utilities                                                                                                              |
| `suggest-topics.ts`    | AI-powered topic/prompt suggestion generation                                                                                              |
| `deep-analyze-core.ts` | Deep analysis core logic                                                                                                                   |

### 10.2 AI Provider Adapters (`supabase/functions/_shared/ai-providers/`)

Extensible adapter pattern for AI platforms:

| File               | Platform                                                                           | Env Var              |
| ------------------ | ---------------------------------------------------------------------------------- | -------------------- |
| `openai.ts`        | OpenAI (GPT models)                                                                | `OPENAI_API_KEY`     |
| `anthropic.ts`     | Anthropic (Claude models)                                                          | `ANTHROPIC_API_KEY`  |
| `gemini.ts`        | Google Gemini                                                                      | `GEMINI_API_KEY`     |
| `grok.ts`          | xAI Grok                                                                           | `XAI_API_KEY`        |
| `perplexity.ts`    | Perplexity                                                                         | `PERPLEXITY_API_KEY` |
| `index.ts`         | Registry: `getAdapter`, `executePrompt`, `executePromptMulti`                      | —                    |
| `types.ts`         | `AiRequest`, `AiResponse`, `NormalizedAnnotation`, `NormalizedSource`, `AiAdapter` | —                    |
| `normalize.ts`     | Response normalization utilities                                                   | —                    |
| `model-fetcher.ts` | Model fetching utilities                                                           | —                    |

**AiRequest interface:**

```typescript
{
  prompt: string;
  model: string;
  systemInstruction?: string;
  webSearchEnabled?: boolean;
  country?: string;   // ISO 3166-1 alpha-2
  language?: string;  // ISO 639-1
}
```

**AiResponse interface:**

```typescript
{
  text: string | null;
  model: string;
  tokens: { input: number; output: number } | null;
  latency_ms: number;
  raw_request?: unknown;
  raw_response?: unknown;
  error?: string;
  web_search_enabled: boolean;
  annotations: NormalizedAnnotation[] | null;
  sources: NormalizedSource[] | null;
}
```

### 10.3 Prompt Templates (`supabase/functions/_shared/prompts/`)

| File                        | Purpose                                |
| --------------------------- | -------------------------------------- |
| `deep-analyze.ts`           | Deep analysis prompt templates         |
| `extract-website-info.ts`   | Website information extraction prompts |
| `generate-llm-txt.ts`       | llms.txt file generation prompts       |
| `load.ts`                   | Prompt loading utilities               |
| `scrape-company-analyze.ts` | Company scraping + analysis prompts    |

### 10.4 Edge Functions List

| Function                  | Description                              |
| ------------------------- | ---------------------------------------- |
| `analyses-data`           | Fetch analysis data                      |
| `company`                 | Company CRUD operations                  |
| `crawl-pages`             | Website page crawling                    |
| `deep-analyze`            | AI deep analysis (SuperAdmin)            |
| `faq`                     | FAQ management                           |
| `get-website-information` | Website metadata extraction              |
| `interest-leads`          | Interest/lead capture                    |
| `plans`                   | Plan listing/management                  |
| `platforms`               | Platform & model management, preferences |
| `pre-analyze`             | GEO pre-analysis                         |
| `prompt-execution-worker` | Background prompt execution worker       |
| `prompt-search`           | Execute prompts against AI models        |
| `prompt-search-sources`   | Source extraction from AI responses      |
| `public-contact`          | Public contact form handler              |
| `scrape-company`          | Company website scraping                 |
| `sources-summary`         | Source aggregation and summaries         |
| `stripe-cancel`           | Stripe subscription cancellation         |
| `stripe-checkout`         | Stripe checkout session creation         |
| `stripe-webhook`          | Stripe webhook handler                   |
| `support-contact`         | Support ticket creation                  |
| `topics-prompts`          | Topics & prompts CRUD                    |
| `users-me`                | User profile & tenant data               |

### 10.5 Edge Function Pattern

Every Edge Function follows this pattern:

```typescript
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, created, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const auth = await verifyAuth(req); // Extracts user + tenantId from JWT
    const db = createAdminClient(); // Admin client bypasses RLS

    switch (req.method) {
      case "GET": {
        // Always filter by auth.tenantId
        const { data, error } = await db
          .from("table_name")
          .select("*")
          .eq("tenant_id", auth.tenantId);
        if (error) return withCors(req, serverError(error.message));
        return withCors(req, ok(data));
      }
      case "POST": {
        const body = await req.json();
        // Validate input, insert with tenant_id
        const { data, error } = await db
          .from("table_name")
          .insert({ tenant_id: auth.tenantId, ...body })
          .select()
          .single();
        if (error) return withCors(req, serverError(error.message));
        return withCors(req, created(data));
      }
      default:
        return withCors(req, badRequest(`Method ${req.method} not allowed`));
    }
  } catch (err) {
    if (err.status) {
      return withCors(
        req,
        new Response(
          JSON.stringify({
            success: false,
            error: {
              message: err.message,
              code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
            },
          }),
          {
            status: err.status,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }
    return withCors(req, serverError(err.message || "Internal server error"));
  }
});
```

**Key rules:**

- Always handle CORS preflight (`OPTIONS`)
- Always use `withCors(req, response)` to wrap responses
- Always use `verifyAuth(req)` for authenticated endpoints
- Always use `createAdminClient()` for database operations
- Always filter by `auth.tenantId` in queries
- Always insert with `tenant_id: auth.tenantId`
- URL routing via pathname segments (not separate files)

---

## 11. Database Schema

### 11.1 Migration Conventions

- **File naming:** `YYYYMMDDHHMMSS_description.sql`
- **82 migration files** in `supabase/migrations/`
- **Required columns** for tenant-scoped tables:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **Always** create index on `tenant_id`
- **Always** enable RLS
- **Always** add SELECT policy for authenticated role
- **Never** add INSERT/UPDATE/DELETE RLS policies (mutations go through Edge Functions with admin client)
- **Always** add `updated_at` trigger

### 11.2 Core Tables

| Table              | Scope  | Description                               |
| ------------------ | ------ | ----------------------------------------- |
| `tenants`          | Global | Organizations (root table)                |
| `profiles`         | Tenant | User profiles linked to auth.users        |
| `tenant_users`     | Tenant | User ↔ tenant membership with roles       |
| `plans`            | Global | Subscription plans                        |
| `activation_plans` | Global | Activation codes                          |
| `general_settings` | Global | Key-value settings (exchange rates, etc.) |

### 11.3 AI Monitoring Tables

| Table                    | Scope  | Description                                          |
| ------------------------ | ------ | ---------------------------------------------------- |
| `topics`                 | Tenant | Prompt groupings                                     |
| `prompts`                | Tenant | AI queries (max 500 chars)                           |
| `platforms`              | Global | AI providers (openai, anthropic, gemini, grok)       |
| `models`                 | Global | AI models per platform with `web_search_active` flag |
| `tenant_platform_models` | Tenant | Tenant's selected models                             |
| `prompt_answers`         | Tenant | AI responses with metadata                           |
| `sources`                | Tenant | Citation source domains                              |
| `prompt_answer_sources`  | Tenant | Join: answers ↔ sources                              |
| `prompt_execution_queue` | Tenant | Background execution queue                           |

### 11.4 Company & GEO Tables

| Table                 | Scope  | Description                            |
| --------------------- | ------ | -------------------------------------- |
| `companies`           | Tenant | Company profiles with domain, metadata |
| `geo_analyses`        | Tenant | GEO analysis results                   |
| `geo_analyses_pages`  | Tenant | Individual page analysis data          |
| `company_ai_analyses` | Tenant | Deep AI analysis results               |

### 11.5 Billing Tables

| Table              | Scope  | Description          |
| ------------------ | ------ | -------------------- |
| `subscriptions`    | Tenant | Active subscriptions |
| `payment_attempts` | Tenant | Payment history      |

### 11.6 Support Tables

| Table              | Scope  | Description                  |
| ------------------ | ------ | ---------------------------- |
| `contact_messages` | Global | Contact form submissions     |
| `faq`              | Global | FAQ entries with status enum |
| `interest_leads`   | Global | Lead capture data            |

### 11.7 Seeded Data

The `seed.sql` file populates:

- **4 platforms:** OpenAI, Anthropic, Gemini, Grok (Perplexity commented out)
- **10 models:** GPT-5.2 Pro, GPT-4.1, GPT-4.1 Mini, Claude Sonnet 4.5, Claude Opus 4.6, Claude Haiku 4.5, Gemini 2.5 Pro, Gemini 2.5 Flash-Lite, Grok 4.1 Fast, Grok 4
- **Default models** set per platform
- **Activation plan** with code `012345678910`

### 11.8 Background Jobs (pg_cron)

The system uses `pg_cron` for scheduled tasks:

- Prompt execution scheduling (v2 scheduler with 10x per cycle)
- Stale crawling page cleanup
- Source summary materialized view refresh

---

## 12. Internationalization (i18n)

### 12.1 Configuration

- Library: `i18next` + `react-i18next` + `i18next-browser-languagedetector`
- Supported languages: `en`, `es`, `pt-br`
- Fallback: `en`
- Detection order: querystring (`?lang=`), localStorage, navigator
- All strings lowercase normalized (`lowerCaseLng: true`)
- Translation files: `src/i18n/locales/{en,es,pt-br}.json` (~65-71KB each)

### 12.2 Rules

- **No hardcoded strings** — all UI text must use `t()` function
- **All three locale files** must be updated when adding new strings
- Landing page supports `/:lang` URL prefix for localized versions

---

## 13. GEO Analysis System

### 13.1 Overview

GEO (Generative Engine Optimization) analyzes how well a website is optimized for AI discoverability. The system:

1. **Crawls** company website pages
2. **Analyzes** HTML structure, schema markup, semantic elements, content quality
3. **Scores** across 25 factors in 4 categories
4. **Reports** with recommendations and readiness level

### 13.2 GEO Readiness Levels (0–5)

| Level | Label        | Threshold | Color                 |
| ----- | ------------ | --------- | --------------------- |
| 0     | AI Invisible | 0         | #DC3545 (red)         |
| 1     | AI Hostile   | 20        | #E67C00 (orange)      |
| 2     | AI Unaware   | 40        | #FFC107 (yellow)      |
| 3     | AI Emerging  | 60        | #8BC34A (light green) |
| 4     | AI Optimized | 75        | #28A745 (green)       |
| 5     | AI Authority | 90        | #1B5E20 (dark green)  |

### 13.3 GEO Factor Categories

- **Technical:** Infrastructure, crawlability, performance
- **Content:** Quality, structure, freshness
- **Authority:** Citations, backlinks, trust signals
- **Semantic:** Schema markup, structured data, HTML semantics

### 13.4 Factor Status Thresholds

- **Excellent:** 90–100 (color: #00cec9)
- **Good:** 70–89 (color: #28A745)
- **Warning:** 40–69 (color: #FFC107)
- **Critical:** 0–39 (color: #DC3545)

### 13.5 Shared Config

GEO readiness levels and factor statuses are defined in `shared/geo-config.json` and consumed by both frontend (`src/config/geo-readiness.ts`) and backend. **Only edit `shared/geo-config.json`** to change these values.

---

## 14. Platform Metadata

Defined in `src/types/dashboard.ts`:

| Platform    | Label     | Color       | Gradient      | Syncable |
| ----------- | --------- | ----------- | ------------- | -------- |
| `openai`    | OpenAI    | emerald-500 | emerald→green | Yes      |
| `anthropic` | Anthropic | orange-500  | orange→amber  | Yes      |
| `gemini`    | Gemini    | blue-500    | blue→indigo   | Yes      |
| `grok`      | Grok      | slate-600   | slate→slate   | Yes      |

---

## 15. Build & Deployment

### 15.1 Vite Configuration (`vite.config.ts`)

- **Path alias:** `@` → `./src`
- **Dev server:** port 5173, host: true
- **Build target:** ES2020
- **CSS:** Deferred loading via custom `deferCssPlugin`
- **Bundle splitting:** Manual chunks for vendor dependencies:
  - `vendor-react`: react, react-dom, react-router-dom
  - `vendor-jspdf`: jspdf
  - `vendor-html2canvas`: html2canvas
  - `vendor-supabase`: @supabase/supabase-js
  - `vendor-i18n`: i18next, react-i18next, i18next-browser-languagedetector
  - `vendor-markdown`: react-markdown
  - `vendor-ui`: lucide-react, intl-tel-input
- **Bundle analyzer:** rollup-plugin-visualizer (output: dist/stats.html)

### 15.2 Deployment Targets

- **Frontend:** Vercel (SPA mode with catch-all rewrite to `/index.html`)
- **Backend:** Supabase hosted (Edge Functions + PostgreSQL)
- **Deploy command:** `npx supabase functions deploy --no-verify-jwt && npx supabase db push`

### 15.3 NPM Scripts

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "functions": "npx supabase functions serve --no-verify-jwt --env-file supabase/.env.local",
  "deploy": "npx supabase functions deploy --no-verify-jwt && npx supabase db push"
}
```

---

## 16. Authentication Flow

### 16.1 Sign Up

1. User submits: email, password, full_name, tenant_name, phone, main_domain, optional activation code
2. `supabase.auth.signUp()` creates auth.users record with metadata
3. **Database trigger** (`handle_new_user`) automatically creates:
   - A `profiles` record
   - A `tenants` record
   - A `tenant_users` record (role: owner)
4. Frontend retries `/users-me` up to 3 times (500ms, 1500ms, 3000ms delays) to wait for trigger completion
5. First tenant ID saved to localStorage

### 16.2 Sign In

1. `supabase.auth.signInWithPassword()` authenticates
2. Calls `/users-me` edge function to get profile + tenants
3. Saves tenant ID to localStorage

### 16.3 Token Management

- Access token stored in `localStorage.access_token`
- Refresh token stored in `localStorage.refresh_token`
- Supabase `onAuthStateChange` listener auto-updates tokens
- `apiClient` auto-refreshes via `supabase.auth.getSession()` before every request
- On 401: attempts `supabase.auth.refreshSession()`, retries once, then redirects to `/signin`

---

## 17. Stripe Integration

### 17.1 Frontend

- `src/lib/stripe.ts`: Lazy-loads Stripe.js via `loadStripe()`
- Plans displayed via `PricingPlans` component with currency conversion

### 17.2 Edge Functions

- `stripe-checkout`: Creates Stripe checkout sessions
- `stripe-webhook`: Handles Stripe webhook events (payment success, subscription changes)
- `stripe-cancel`: Handles subscription cancellations
- Database tables: `subscriptions`, `payment_attempts`

---

## 18. Email & Notifications

- **SendGrid** for transactional emails
- Email templates in `supabase/email_templates/`
- Professional email validation with configurable free-provider blocking (`src/lib/email.ts`)
- Flag `BLOCK_FREE_EMAILS` (currently `false`) to restrict registration to business emails only

---

## 19. Security

### 19.1 Row Level Security (RLS)

- All tenant-scoped tables have RLS enabled
- SELECT policies allow authenticated users to read their tenant's data
- No INSERT/UPDATE/DELETE policies (mutations via admin client in Edge Functions)
- Infinite recursion fix applied for self-referencing policies

### 19.2 reCAPTCHA v3

- Frontend: lazy-loaded script (`src/lib/recaptcha.ts`)
- Backend: server-side verification (`_shared/verify-recaptcha.ts`)
- Used in public forms (contact, sign up)

### 19.3 CORS

- Dynamic origin matching against `SITE_URL` env var
- Default: `http://localhost:5173` for local dev
- Custom headers allowed: `authorization`, `x-client-info`, `apikey`, `content-type`, `x-tenant-id`

### 19.4 Security Headers

All API responses include:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

---

## 20. Styling & Design System

### 20.1 CSS Architecture

- Single `src/index.css` file (~92KB) containing the entire design system
- Uses Tailwind CSS v4 (NOT v3 — import syntax, no `tailwind.config.js`)
- CSS custom properties for theming
- `data-theme` attribute on `<html>` for dark/light mode
- `data-layout` attribute for centered/expanded layout

### 20.2 Theme Colors

- Primary brand: `#6c5ce7` (purple)
- Gradient accent: `#a29bfe` → `#fd79a8` (purple to pink)
- Dark background: `#0a0a0f`
- Text muted: `#9898b0`

### 20.3 Critical CSS

Inlined in `index.html` for above-the-fold landing page rendering (no FOUC)

---

## 21. Workflows (`.agents/workflows/`)

### 21.1 `/new-edge-function`

Creates a new Supabase Edge Function with the standard template (imports \_shared modules, CORS, auth, method routing).

### 21.2 `/new-migration`

Generates a migration file with required columns (id, tenant_id, timestamps), RLS, and indexes.

### 21.3 `/new-page`

Creates a new React page with i18n, route registration, sidebar navigation, and responsive design.

### 21.4 `/start-dev`

Starts the full local development stack: Supabase, migrations, Vite dev server, Edge Functions.

---

## 22. Skills (`.agents/skills/`)

### 22.1 `database-migration`

Skill for creating Supabase database migrations with tenant_id enforcement, RLS policies, and proper indexes.

### 22.2 `edge-function-dev`

Skill for building Supabase Edge Functions with consistent patterns, auth, validation, and error handling.

### 22.3 `frontend-design`

Skill for creating distinctive, production-grade frontend interfaces with high design quality.

---

## 23. Testing

### 23.1 Structure

```
tests/
├── e2e/        # End-to-end tests
└── helpers/    # Test helper utilities
```

---

## 24. Key Architectural Decisions

1. **Edge Functions for ALL mutations**: The Supabase JS client on the frontend is strictly read-only. This ensures all business logic, validation, and authorization checks happen server-side.

2. **Admin client in Edge Functions**: Uses `service_role` key to bypass RLS, allowing the function to perform any operation regardless of the calling user's RLS policies.

3. **Tenant resolution via header**: The `x-tenant-id` header is sent with every API request. Edge Functions verify the user belongs to that tenant before proceeding.

4. **Sequential onboarding (FlowGate)**: Users must complete setup in order: Plan → Company → Models. This ensures all required data exists before accessing the dashboard.

5. **Lazy loading everything**: All page components are lazily loaded via `React.lazy()` with manual vendor chunk splitting for optimal loading performance.

6. **CSS deferred loading**: Custom Vite plugin converts stylesheet `<link>` tags to `preload` with `onload` swap for non-blocking CSS.

7. **Extensible AI provider registry**: Adding a new AI platform requires only creating an adapter file and registering it in the registry array.

8. **Normalized AI responses**: All AI providers return the same `AiResponse` interface with normalized annotations and sources, enabling uniform comparison.

9. **GEO shared config**: Frontend and backend read from the same `shared/geo-config.json` for readiness levels and factor statuses.

10. **Critical CSS inlined**: Landing page critical CSS is inlined in `index.html` to avoid FOUC and improve FCP.

---

## 25. Development Guide

### 25.1 Local Setup

```bash
npm install
npx supabase start
npx supabase db reset
npm run dev
# In a separate terminal:
npx supabase functions serve --no-verify-jwt --env-file supabase/.env.local
```

### 25.2 Access Points

- Frontend: http://localhost:5173
- Supabase Studio: http://localhost:54323

### 25.3 Adding a New Feature Checklist

- [ ] Define types in `src/types/index.ts`
- [ ] Create Edge Function in `supabase/functions/`
- [ ] Create migration if new tables needed
- [ ] Create page component in `src/pages/`
- [ ] Add translations to all 3 locale files
- [ ] Register route in `src/App.tsx`
- [ ] Add sidebar navigation in `src/components/layout/Sidebar.tsx`
- [ ] Ensure responsive design
- [ ] Use design system tokens (CSS variables)
- [ ] No hardcoded strings (all use `t()`)
