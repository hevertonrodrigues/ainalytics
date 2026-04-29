# Ainalytics — Project Specification

## 1. Overview

**Ainalytics** is a multi-tenant SaaS platform that monitors brand visibility across AI platforms (ChatGPT, Claude, Gemini, Grok, Perplexity). Organizations track AI-generated responses about their brand, analyze citations, and optimize websites for AI discoverability (GEO — Generative Engine Optimization).

- **Production URL**: https://ainalytics.tech
- **Supabase Project ID**: `kjfvhiffsusdqphgjsdz`
- **Deployment**: Vercel (frontend) + Supabase (backend)
- **Sister project**: [`indexai`](../indexai) — Next.js 16 news portal at https://indexai.news that consumes the public Blog API exposed by this backend (see §23).

---

## 2. Technology Stack

### Frontend
- **React** 19.x + **Vite** 6.2.x + **TypeScript** 5.7.x
- **Tailwind CSS 4.x** (v4 import syntax, NOT v3 — no `tailwind.config.js`) + `@tailwindcss/typography`
- **React Router DOM** 7.2.x — client-side routing
- **i18next** 24.x + **react-i18next** 15.x — i18n (en, es, pt-br)
- **@supabase/supabase-js** 2.49.x — SELECT/auth only (never mutations)
- **@sentry/react** 10.x — error tracking
- **Lucide React** 0.575.x, **@stripe/stripe-js** 8.9.x, **jsPDF** 4.2.x, **html2canvas** 1.4.x, **intl-tel-input** 26.7.x, **react-markdown** 10.1.x

### Backend & Infrastructure
- **Supabase** — PostgreSQL + Auth + Edge Functions (Deno/TypeScript) + Storage
- **pg_cron** — scheduled background jobs
- **Stripe** — payments | **SendGrid** — transactional email | **reCAPTCHA v3** — bot protection

### Analytics & Fonts
- Google Tag Manager (GTM-K4HQB33N) + Microsoft Clarity (vtprlhr5j6)
- Fonts: **Outfit** (headings 300–800), **Plus Jakarta Sans** (body 300–700), **JetBrains Mono** (code 400–600)

---

## 3. Architecture

### 3.1 Multi-Tenant Architecture

Every data table includes `tenant_id` referencing `tenants`. RLS enforces data isolation. Frontend sends `x-tenant-id` header with every API request.

```
tenants → tenant_users (user ↔ tenant, role: owner|admin|member) → profiles (→ auth.users)
```

**Super Admin (`is_sa`):** Boolean on `profiles`. Access all tenants + global resources. Checked via `SuperAdminGate`/`SuperAdminRoute`.

### 3.2 Data Flow — CRITICAL RULE

```
Frontend (React)
  ├── SELECT queries → Supabase JS Client (RLS-scoped, read-only)
  └── Mutations → apiClient (fetch) → Edge Functions → createAdminClient (bypasses RLS)
```

**The Supabase JS client is ONLY for SELECT queries and auth operations. NEVER `.insert()`, `.update()`, `.delete()`, `.upsert()`.** All mutations go through `apiClient` → Edge Functions → `createAdminClient()` (service_role key).

### 3.3 API Client (`src/lib/api.ts`)

- Base URL: `{SUPABASE_URL}/functions/v1`
- Auto-attaches JWT + `x-tenant-id` header
- Auto-refreshes tokens (retry once on 401)
- Unwraps `{ success, data, error }` envelope
- Methods: `get`, `post`, `put`, `patch`, `delete`

### 3.4 Standard Response Envelope

```typescript
{ success: true, data: T, meta?: Record<string, unknown> }       // Success
{ success: false, error: { message: string, code: string, details?: unknown } }  // Error
```

Error codes: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`

---

## 4. Project Structure

```
ainalytics/
├── src/
│   ├── App.tsx                   # Routes (lazy-loaded with Suspense)
│   ├── main.tsx                  # Entry point (StrictMode + ErrorBoundary)
│   ├── index.css                 # Design system (~92KB)
│   ├── components/
│   │   ├── ErrorBoundary.tsx, InterestFormModal.tsx, PageExplanation.tsx
│   │   ├── PhoneInput.tsx, PricingPlans.tsx, PromptForm.tsx, SignUpForm.tsx
│   │   ├── geo/                  # GEO analysis (index.tsx, ImprovementsAndRecommendations.tsx)
│   │   ├── guards/               # ProtectedRoute, GuestRoute, FlowGate, SuperAdminGate, SuperAdminRoute, ActiveModelsGuard
│   │   ├── layout/               # AppLayout, Header, MobileHeader, Sidebar
│   │   ├── suggestions/          # SuggestionsModal
│   │   └── ui/                   # CollapsibleSection, ConfirmModal, LocaleSwitcher, SearchSelect, TutorialModal
│   ├── config/geo-readiness.ts   # GEO levels & factor colors
│   ├── contexts/                 # AuthContext, TenantContext, ThemeContext, ToastContext, LayoutContext
│   ├── hooks/                    # useCurrency, useScrollLock, useTutorial, useTenantSetup
│   ├── i18n/                     # index.ts + locales/{en,es,pt-br}.json (~83-90KB each)
│   ├── lib/                      # api, analytics, authErrors, constants, dateFormat, domain, email, languages, pdfReport, recaptcha, sentry, stripe, supabase, tlds.json
│   ├── pages/
│   │   ├── auth/                 # SignIn, SignUp, ForgotPassword, ResetPassword
│   │   ├── landing/              # LandingPage + LandingHeader, LandingHero, LandingFooter, LandingFAQ
│   │   ├── dashboard/            # Dashboard, InsightsPage, AnalysesPage
│   │   ├── company/              # MyCompanyPage (company setup + GEO)
│   │   ├── topics/               # TopicsPage, TopicDetailPage, TopicAnswersPage
│   │   ├── prompts/              # PromptsPage, PromptDetailPage
│   │   ├── sources/              # SourcesPage, SourceDetailPage
│   │   ├── models/               # ModelsPage
│   │   ├── plans/                # PlansPage, SubscriptionSettings, CancelSubscriptionModal, ActivationCodeModal
│   │   ├── profile/              # ProfilePage
│   │   ├── settings/             # TenantSettings
│   │   ├── onboarding/           # OnboardingPage + step components
│   │   ├── deep-analyze/         # DeepAnalyzePage (SA-only)
│   │   ├── platforms/            # PlatformsPage (SA-only, within dashboard)
│   │   ├── llmtext/              # LlmTextPage
│   │   ├── sa/                   # Super Admin module (separate layout)
│   │   │   ├── SALayout, SASidebar
│   │   │   ├── CRMPipelinePage, ActiveUsersPage, UserDetailPage
│   │   │   ├── PlansPage, ActivationCodesPage
│   │   │   ├── PlatformsPage, ModelsPage, AICostsPage, MonitoringTimelinePage
│   │   │   ├── CreateProposalModal, UserDetailModal, KanbanBoard
│   │   │   └── useAdminCrud.ts, types.ts
│   │   ├── proposal/             # ProposalPublicPage (public slug-based view)
│   │   ├── sales/                # SalesPage
│   │   ├── contact/, support/, legal/, error/
│   │   └── (24 page directories total)
│   └── types/                    # index.ts (~520 lines), dashboard.ts (~100 lines)
├── supabase/
│   ├── config.toml, seed.sql, .env.local, .env.vault_secrets
│   ├── email_templates/
│   ├── migrations/               # 94 migration files
│   ├── functions/                # 55 Edge Functions (SaaS app + admin + blog API)
│   │   ├── _shared/              # auth, admin-auth, cors, response, supabase, logger, sentry, verify-recaptcha, cost-calculator, scoring, prompt-execution, llm-generation, deep-analyze-core, suggest-topics
│   │   │   ├── ai-providers/     # openai, anthropic, gemini, grok, perplexity, index, types, normalize, model-fetcher
│   │   │   └── prompts/          # load, deep-analyze, extract-website-info, generate-llm-txt, insights, scrape-company-analyze
│   │   ├── blog-*/               # 14 public Blog API functions consumed by indexai (§23)
│   │   └── [function-dirs]/      # Individual functions
│   └── snippets/
├── shared/geo-config.json        # GEO config (consumed by frontend + backend)
├── .agents/                      # rules/ (7), skills/ (4), workflows/ (4)
├── scripts/, tests/, guide_docs/, public/
└── package.json, vite.config.ts, vercel.json, tsconfig.json, eslint.config.js
```

---

## 5. Environment Variables

### Frontend (Vite — `VITE_` prefix)
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_NAME, VITE_RECAPTCHA_SITE_KEY, VITE_STRIPE_PUBLISHABLE_KEY
```

### Backend (Edge Functions — `Deno.env.get()`)
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, XAI_API_KEY, PERPLEXITY_API_KEY
SENDGRID_API_KEY, RECAPTCHA_SECRET_KEY, SITE_URL
```

---

## 6. Routing

### Public Routes (no auth)
| Path | Component | Notes |
|---|---|---|
| `/` | LandingPage | Marketing page |
| `/:lang` | LandingPage | Localized (en, es, pt-br) |
| `/contact` | ContactPage | |
| `/terms`, `/privacy` | LegalPage | |
| `/proposal/:slug` | ProposalPublicPage | Public proposal view |

### Guest Routes (redirect if authenticated)
`/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/oferta-marco` (SalesPage)

### Super Admin Routes (`/sa` — requires `is_sa`)
| Path | Component |
|---|---|
| `/sa` | CRMPipelinePage (Kanban: registered → email_confirmed → subscribed → cancelled) |
| `/sa/active` | ActiveUsersPage |
| `/sa/plans` | PlansPage (CRUD) |
| `/sa/activation-codes` | ActivationCodesPage |
| `/sa/platforms` | PlatformsPage |
| `/sa/models` | ModelsPage |
| `/sa/costs` | AICostsPage |
| `/sa/monitoring` | MonitoringTimelinePage |
| `/sa/users/:userId` | UserDetailPage |

Uses its own `SALayout` + `SASidebar`, separate from the dashboard layout.

### Protected Routes (`/dashboard` — requires auth + TenantProvider + AppLayout)

**Always accessible:** `/dashboard/onboarding`, `/dashboard/plans`, `/dashboard/profile`, `/dashboard/support`

**Flow-gated (sequential setup):**
- Gate 0 — Plan: `/dashboard/company` requires active plan
- Gate 1 — Company: `/dashboard/models` requires company
- Gate 2 — Models: all remaining routes require models

**Fully-gated routes:** `/dashboard`, `/dashboard/settings`, `/dashboard/topics(/:id(/answers))`, `/dashboard/prompts(/:id)`, `/dashboard/insights`, `/dashboard/analyses`, `/dashboard/sources(/:id)`, `/dashboard/llmtext`

**SA-only (within dashboard):** `/dashboard/deep-analyze`, `/dashboard/platforms`

### Context Provider Tree
```
ThemeProvider → LayoutProvider → ToastProvider → BrowserRouter → Suspense → Routes
  ├── Public routes (no provider)
  └── AuthProvider
        ├── Guest routes
        ├── SuperAdminRoute → SALayout → SA routes
        └── ProtectedRoute → TenantProvider → AppLayout → FlowGate → Dashboard routes
```

---

## 7. React Contexts

| Context | Key State | Key Methods |
|---|---|---|
| **AuthContext** | `profile`, `tenants`, `loading`, `initialized` | `signIn`, `signUp`, `signOut`, `forgotPassword`, `resetPassword`, `refreshAuth` |
| **TenantContext** | `currentTenant`, `hasCompany`, `hasModels`, `isFullySetup` | `switchTenant`, `refreshTenant`, `setHasCompany`, `setHasModels` |
| **ThemeContext** | `theme` (light/dark) | `toggleTheme` — persisted via localStorage, sets `data-theme` on `<html>` |
| **ToastContext** | Toast queue | `addToast(variant, message)` — variants: success, error, info; auto-dismiss 8s |
| **LayoutContext** | `layoutMode` (centered/expanded), `sidebarOpen` | `setLayoutMode` — persisted via localStorage, sets `data-layout` on `<html>` |

**Auth flow notes:**
- SignUp retries `/users-me` 3 times (500/1500/3000ms) waiting for DB trigger to create profile/tenant/tenant_user
- Tokens stored in localStorage: `access_token`, `refresh_token`, `current_tenant_id`

---

## 8. Custom Hooks

| Hook | Purpose |
|---|---|
| `useCurrency` | Fetches exchange rates from `general_settings` (USD_BRL, USD_EUR). `formatPrice()` converts to locale currency |
| `useTutorial` | Page-specific tutorials via `profile.tutorial_views` JSONB. `dismissTutorial()` calls `/users-me` PUT |
| `useScrollLock` | Locks body scroll for modals |
| `useTenantSetup` | Checks tenant setup state (plan, company, models) |

---

## 9. Edge Functions

### Shared Modules (`_shared/`)

| File | Purpose |
|---|---|
| `auth.ts` | JWT verification + tenant resolution from `x-tenant-id` header |
| `admin-auth.ts` | Super admin verification |
| `cors.ts` | CORS headers, preflight, `withCors` wrapper (origin from `SITE_URL`) |
| `response.ts` | `ok`, `created`, `noContent`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `serverError` |
| `supabase.ts` | `createAdminClient()` (service_role) + `createUserClient(token)` |
| `verify-recaptcha.ts` | Server-side reCAPTCHA v3 verification |
| `prompt-execution.ts` | Core prompt execution against AI models |
| `llm-generation.ts` | LLM text generation utilities |
| `suggest-topics.ts` | AI topic/prompt suggestion generation |
| `deep-analyze-core.ts` | Deep analysis logic |
| `cost-calculator.ts` | AI usage cost calculation with model pricing lookup |
| `scoring.ts` | Scoring utilities |
| `logger.ts` | Request logging |
| `sentry.ts` | Sentry error tracking |

### AI Provider Adapters (`_shared/ai-providers/`)

Extensible adapter pattern — adding a new platform requires creating an adapter and registering it.

Files: `openai.ts`, `anthropic.ts`, `gemini.ts`, `grok.ts`, `perplexity.ts`, `index.ts` (registry), `types.ts`, `normalize.ts`, `model-fetcher.ts`

```typescript
// AiRequest
{ prompt: string; model: string; systemInstruction?: string; webSearchEnabled?: boolean; country?: string; language?: string }

// AiResponse
{ text: string|null; model: string; tokens: {input,output}|null; latency_ms: number; raw_request?; raw_response?; error?: string; web_search_enabled: boolean; annotations: NormalizedAnnotation[]|null; sources: NormalizedSource[]|null }
```

### Prompt Templates (`_shared/prompts/`)
`load.ts`, `deep-analyze.ts`, `extract-website-info.ts`, `generate-llm-txt.ts`, `insights.ts`, `scrape-company-analyze.ts`

### Function List (55 functions)

#### SaaS app (tenant-authenticated)
| Function | Description |
|---|---|
| `users-me` | User profile & tenant data |
| `company` | Company CRUD |
| `topics-prompts` | Topics & prompts CRUD |
| `platforms` | Platform & model management, preferences |
| `plans` | Plan listing/management |
| `prompt-search` | Execute prompts against AI models |
| `prompt-search-sources` | Source extraction from AI responses |
| `prompt-execution-worker` | Background prompt execution queue |
| `analyses-data` | Analysis data fetching |
| `insights` | AI-generated insights reports |
| `dashboard-overview` | Dashboard overview data |
| `sources-summary` | Source aggregation/summaries |
| `crawl-pages` | Website page crawling |
| `get-website-information` | Website metadata extraction |
| `scrape-company` | Company website scraping |
| `pre-analyze` | GEO pre-analysis |
| `free-analyze` | Public GEO quick analysis |
| `deep-analyze` | AI deep analysis (SA-only) |
| `proposals` | Sales proposal management (CRUD + public view) |
| `track-activity` | Frontend activity tracker |

#### Public / marketing (no auth)
| Function | Description |
|---|---|
| `faq` | FAQ management |
| `public-contact` | Public contact form |
| `public-careers` | Public careers listing/applications |
| `interest-leads` | Lead capture |
| `support-contact` | Support ticket creation |
| `careers-email-track` | Careers email open/click tracking |
| `sendgrid-inbound-webhook` | SendGrid inbound email webhook |

#### Stripe
| Function | Description |
|---|---|
| `stripe-checkout` | Stripe checkout sessions |
| `stripe-course-checkout` | Stripe checkout for academy courses |
| `stripe-webhook` | Stripe webhook handler |
| `stripe-cancel` | Subscription cancellation |

#### Super Admin (SA-only)
| Function | Description |
|---|---|
| `admin-crm-pipeline` | CRM pipeline data |
| `admin-active-users` | Active user analytics |
| `admin-ai-costs` | AI cost tracking |
| `admin-analytics` | Aggregated analytics |
| `admin-careers` | Careers admin |
| `admin-inbox` | Admin inbox |
| `admin-meta-ads` | Meta Ads integration metrics |
| `admin-metrics-overview` | Metrics overview |
| `admin-monitoring-timeline` | Monitoring metrics |
| `admin-settings` | Admin configuration |

#### Public Blog API (consumed by `indexai` — see §23)
Deployed with `--no-verify-jwt`. Every read returns `{ data, seo }` with weak ETag + `Content-Language` headers and Next.js-friendly `Cache-Control`.

| Function | Description |
|---|---|
| `blog-categories` | List localized categories |
| `blog-news` | List news + article detail (`/{lang}` and `/{lang}/{slug}`) |
| `blog-trending` | Trending hero feed |
| `blog-ticker` | Engine status ticker items |
| `blog-ranking` | AVI ranking items (filterable) |
| `blog-ranking-sectors` | Sector + subsector taxonomy |
| `blog-ranking-timeline` | ISO-week ranking timeline |
| `blog-engine-profiles` | Engine profile cards |
| `blog-engines` | Engine catalog |
| `blog-sectors` | Sector catalog |
| `blog-regions` | Region catalog |
| `blog-newsletter` | POST `/register` — newsletter signup |
| `blog-admin` | Authenticated admin CRUD for blog content |
| `blog-revalidate` | Calls `indexai`'s `/api/revalidate` webhook after writes |

### Edge Function Pattern

```typescript
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, created, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);
  try {
    const auth = await verifyAuth(req);
    const db = createAdminClient();
    // Always filter by auth.tenantId, always insert with tenant_id: auth.tenantId
    // Route via req.method + URL pathname segments
  } catch (err) {
    if (err.status) return withCors(req, new Response(JSON.stringify({
      success: false, error: { message: err.message, code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" }
    }), { status: err.status, headers: { "Content-Type": "application/json" } }));
    return withCors(req, serverError(err.message || "Internal server error"));
  }
});
```

**Key rules:** Always handle CORS preflight, always wrap with `withCors()`, always `verifyAuth()` for authenticated endpoints, always filter/insert by `tenant_id`.

---

## 10. Database

### Migration Conventions
- Naming: `YYYYMMDDHHMMSS_description.sql` (94 files)
- Required columns for tenant-scoped tables: `id UUID DEFAULT gen_random_uuid()`, `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`
- Always: index on `tenant_id`, enable RLS, add SELECT policy for authenticated, add `updated_at` trigger
- Never: add INSERT/UPDATE/DELETE RLS policies (mutations via Edge Functions with admin client)

### Core Tables

**Global (no tenant_id):** `plans`, `platforms`, `models`, `activation_plans`, `general_settings`, `contact_messages`, `faq`, `interest_leads`

**Tenant-scoped:**
| Table | Purpose |
|---|---|
| `tenants` | Root org table (`name`, `slug`, `active_plan_id`, `main_domain`) |
| `profiles` | User profiles (`user_id`, `full_name`, `email`, `locale`, `is_sa`, `tutorial_views`) |
| `tenant_users` | User ↔ tenant join (`role`: owner/admin/member, `is_active`) |
| `topics` | Prompt groupings |
| `prompts` | AI queries (max 500 chars, linked to topic) |
| `tenant_platform_models` | Tenant's selected AI models |
| `prompt_answers` | AI responses with `answer_text`, `tokens_used`, `latency_ms`, `annotations`, `sources` |
| `sources` | Citation source domains with `mentions_count` |
| `prompt_answer_sources` | Join: answers ↔ sources (`url`, `title`, `annotation`) |
| `prompt_execution_queue` | Background execution queue |
| `companies` | Company profiles (`domain`, website metadata, `llm_txt`, `latest_analysis`) |
| `geo_analyses` | GEO analysis results (`geo_score`, `readiness_level`, `ai_report`) |
| `geo_analyses_pages` | Individual page analysis data |
| `company_ai_analyses` | Deep AI analysis results |
| `insights_reports` | AI-generated insights |
| `ai_usage_log` | AI usage tracking for cost calculation |
| `proposals` | Sales proposals (`slug`, `status`, `custom_plan_name`, `custom_price`, `custom_features` JSONB) |
| `subscriptions` | Active subscriptions |
| `payment_attempts` | Payment history |

### Seeded Data
- **Platforms:** OpenAI, Anthropic, Gemini, Grok (Perplexity commented out)
- **Models:** gpt-5.2-pro, gpt-4.1, gpt-4.1-mini, claude-sonnet-4-5-20250929, claude-opus-4-6, claude-haiku-4-5-20251001, gemini-2.5-pro, gemini-2.5-flash-lite, grok-4-1-fast, grok-4 (all web_search_active=true)
- **Defaults:** gpt-5.2-pro, claude-sonnet-4-5-20250929, gemini-2.5-pro, grok-4-1-fast
- **Activation plan:** code `012345678910`

### Background Jobs (pg_cron)
- Prompt execution scheduling (10x per cycle)
- Stale crawling page cleanup
- Source summary materialized view refresh

---

## 11. Type System (`src/types/`)

### `index.ts` (~520 lines) — Core Types
- **Base:** `BaseEntity`, `Plan`, `Tenant`, `Profile`, `TenantUser`, `ROLES`
- **Topics/Prompts:** `Topic`, `Prompt`, `CreateTopicInput`, `UpdateTopicInput`, `CreatePromptInput`, `UpdatePromptInput`
- **AI:** `Platform`, `Model`, `TenantPlatformModel`, `PromptAnswer`, `Source`, `PromptAnswerSource`, `SearchPromptInput`
- **Company:** `Company`, `CompanyPage`, `CompanyStatus`, `CreateCompanyInput`
- **GEO:** `GeoAnalysis`, `AnalysisStatus`, `GeoFactorScore`, `GeoFactorCategory`, `AiReport`, `GeoReadinessLevel`, `GeoCategoryScores`
- **Deep Analyze:** `CompanyAiAnalysis`, `DeepAnalyzeStatus`, `DeepAnalyzeTopic`, `DeepAnalyzeImprovement`
- **Insights:** `InsightsData`, `InsightsCheck`, `InsightsActionItem`, `InsightsHighlight`
- **API:** `ApiSuccessResponse<T>`, `ApiErrorResponse`, `ApiResponse<T>`
- **Auth:** `SignUpInput`, `SignInInput`, `AuthSession`, `UpdateProfileInput`

### `dashboard.ts` (~100 lines)
- `PLATFORM_METADATA`: OpenAI (emerald), Anthropic (orange), Gemini (blue), Grok (slate), Perplexity (violet)
- `SYNCABLE_PLATFORMS`: OpenAI, Anthropic, Gemini, Grok (NOT Perplexity)
- Helper types: `TopicWithPrompts`, `PlatformGroup`, `SourceWithReferences`

---

## 12. GEO Analysis System

Analyzes website optimization for AI discoverability: crawl → analyze HTML/schema/content → score 25 factors in 4 categories → report with recommendations.

### Readiness Levels (0–5)
| Level | Label | Threshold | Color |
|---|---|---|---|
| 0 | AI Invisible | 0 | #DC3545 |
| 1 | AI Hostile | 20 | #E67C00 |
| 2 | AI Unaware | 40 | #FFC107 |
| 3 | AI Emerging | 60 | #8BC34A |
| 4 | AI Optimized | 75 | #28A745 |
| 5 | AI Authority | 90 | #1B5E20 |

### Factor Categories & Status Thresholds
- Categories: Technical, Content, Authority, Semantic
- Statuses: Excellent (90–100, #00cec9), Good (70–89, #28A745), Warning (40–69, #FFC107), Critical (0–39, #DC3545)
- **Config source:** `shared/geo-config.json` (consumed by both frontend and backend)

---

## 13. Proposals Module (NEW)

Sales proposals with public slug-based links.

- **Table:** `proposals` — `slug` (unique, "prop-xxxxxxxx"), `status` (draft/sent/viewed/accepted/expired), `custom_plan_name`, `custom_price`, `billing_interval`, `currency`, `custom_features` (JSONB multilingual), `custom_description` (JSONB multilingual), `valid_until`, `viewed_at`
- **Edge Function:** `proposals` — GET public/:slug (auto-marks viewed/expired), CRUD for admins
- **Frontend:** `ProposalPublicPage` (public), `CreateProposalModal` (SA admin)
- **RLS:** Public SELECT for non-draft proposals by slug; authenticated SELECT for all

---

## 14. Super Admin Module (`/sa`)

Dedicated admin area with its own layout (`SALayout` + `SASidebar`), accessible only to users with `is_sa=true`.

**Pages:** CRM Pipeline (Kanban), Active Users, Plans CRUD, Activation Codes, Platforms, Models, AI Costs, Monitoring Timeline, User Detail

**CRM Pipeline stages:** registered → email_confirmed → subscribed_stripe → subscribed_activation → cancelled

**Admin Edge Functions:** `admin-crm-pipeline`, `admin-active-users`, `admin-ai-costs`, `admin-monitoring-timeline`, `admin-settings` — all require SA auth via `admin-auth.ts`

**Key types (`src/pages/sa/types.ts`):** `CRMPipelineUser` (profile, auth, tenant, company, plan, payment, activation info, kanban stage)

---

## 15. i18n

- **Languages:** `en`, `es`, `pt-br` (fallback: `en`)
- **Detection:** querystring → localStorage → navigator
- **Locale files:** `src/i18n/locales/{en,es,pt-br}.json` (~83-90KB each)
- **Rule:** No hardcoded strings — all UI text uses `t()`. All 3 locale files must be updated together.

---

## 16. Build & Deployment

### Vite Config
- Path alias: `@` → `./src`
- Dev: port 5173, host: true
- Build: ES2020, source maps enabled
- Plugins: React, Tailwind CSS v4, Sentry (source maps upload), rollup-visualizer, custom defer-css
- Manual chunks: vendor-react, vendor-jspdf, vendor-html2canvas, vendor-supabase, vendor-i18n, vendor-markdown, vendor-ui, vendor-sentry

### NPM Scripts
```json
{
  "dev": "vite",
  "dev:all": "node dev-all.js",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "functions": "npx supabase functions serve --no-verify-jwt --env-file supabase/.env.local",
  "test": "deno test supabase/functions/",
  "test:unit": "deno test (AI providers + shared)",
  "test:live": "deno test (live Edge Functions)",
  "deploy": "npx supabase functions deploy --no-verify-jwt && npx supabase db push",
  "prepare": "husky"
}
```

### Deployment
- **Frontend:** Vercel (SPA with catch-all rewrite to `/index.html`)
- **Backend:** Supabase hosted
- **Pre-commit:** Husky hooks

---

## 17. Styling & Design System

- Single `src/index.css` (~92KB) with Tailwind CSS v4
- CSS custom properties for theming via `data-theme` (light/dark) and `data-layout` (centered/expanded)
- Primary: `#6c5ce7` (purple), Gradient: `#a29bfe` → `#fd79a8`, Dark bg: `#0a0a0f`
- Critical CSS inlined in `index.html` for landing page (no FOUC)

---

## 18. Security

- **RLS:** All tenant tables — SELECT policies only (mutations via admin client)
- **CORS:** Dynamic origin from `SITE_URL`, allowed headers: authorization, x-client-info, apikey, content-type, x-tenant-id
- **reCAPTCHA v3:** Lazy-loaded frontend + server-side verification on public forms
- **Security headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- **Sentry:** Error tracking on frontend (@sentry/react) and Edge Functions

---

## 19. Authentication Flow

### Sign Up
1. `supabase.auth.signUp()` → auth.users record
2. DB trigger (`handle_new_user`) creates: profiles + tenants + tenant_users (role: owner)
3. Frontend retries `/users-me` 3x (500/1500/3000ms) waiting for trigger
4. First tenant ID saved to localStorage

### Sign In
1. `supabase.auth.signInWithPassword()`
2. `/users-me` → profile + tenants
3. Tenant ID → localStorage

### Token Management
- localStorage keys: `access_token`, `refresh_token`, `current_tenant_id`
- `onAuthStateChange` auto-updates tokens
- `apiClient` refreshes via `getSession()` before requests; on 401: `refreshSession()` + retry once → redirect to `/signin`

---

## 20. Key Architectural Decisions

1. **Edge Functions for ALL mutations** — Supabase JS client on frontend is strictly read-only
2. **Admin client in Edge Functions** — `service_role` key bypasses RLS
3. **Tenant resolution via `x-tenant-id` header** — verified server-side
4. **Sequential onboarding (FlowGate)** — Plan → Company → Models
5. **Lazy loading** — all pages via `React.lazy()` + manual vendor chunk splitting
6. **CSS deferred loading** — custom Vite plugin for non-blocking CSS
7. **Extensible AI provider registry** — new platform = adapter file + registry entry
8. **Normalized AI responses** — uniform `AiResponse` interface across all providers
9. **GEO shared config** — `shared/geo-config.json` consumed by frontend and backend
10. **Separate SA module** — own layout/routes at `/sa`, isolated from tenant dashboard
11. **Sentry integration** — error tracking across frontend and Edge Functions

---

## 21. Agents & Workflows (`.agents/`)

### Rules (7)
`code-quality`, `tenant-id-rule`, `edge-function-pattern`, `security-auth`, `edge-function-testing`, `api-pattern`, `i18n-rule`

### Skills (4)
`database-migration`, `edge-function-dev`, `edge-function-testing`, `frontend-design`

### Workflows (4)
- `/new-edge-function` — scaffold Edge Function with shared imports
- `/new-migration` — generate migration with required columns, RLS, indexes
- `/new-page` — create React page with i18n, routing, sidebar nav
- `/start-dev` — start full local dev stack

---

## 22. Development Guide

### Local Setup
```bash
npm install
npx supabase start && npx supabase db reset
npm run dev                    # Frontend: http://localhost:5173
# Separate terminal:
npm run functions              # Edge Functions
# Or use: npm run dev:all      # All services at once
```

### Adding a New Feature Checklist
- [ ] Types in `src/types/index.ts`
- [ ] Edge Function in `supabase/functions/`
- [ ] Migration if new tables needed
- [ ] Page component in `src/pages/`
- [ ] Translations in all 3 locale files
- [ ] Route in `src/App.tsx`
- [ ] Sidebar nav in `src/components/layout/Sidebar.tsx`
- [ ] Responsive design
- [ ] Design system tokens (CSS variables)
- [ ] No hardcoded strings (`t()`)

---

## 23. Public Blog API → `indexai` Integration

The 14 `blog-*` Edge Functions form a **public-read API** consumed by the sister project [`indexai`](../indexai) (a Next.js 16 news portal at https://indexai.news).

- **Base URL**: `https://kjfvhiffsusdqphgjsdz.supabase.co/functions/v1`
- **Auth**: none (deployed `--no-verify-jwt`); rate limit + abuse handled at the edge.
- **Languages**: every endpoint takes `{lang}` ∈ `pt | es | en` as the first path segment. No fallback — 404 `unsupported_lang` on anything else.
- **Response envelope**: `{ data, seo }`. The `seo` block is pre-built so the frontend can map it directly into `generateMetadata` + JSON-LD (`NewsArticle` / `WebSite` are pre-rendered server-side; `BreadcrumbList`, `CollectionPage`, `FAQPage` assembled client-side).
- **Caching contract**: weak `ETag` (SHA-1 of body) + `Cache-Control: public, s-maxage=…, stale-while-revalidate=…`. Honor `If-None-Match` → `304`. `If-Modified-Since` is **not** honored.
- **Detailed contracts**: see [`../docs/api.md`](../docs/api.md) (canonical Blog API reference) and [`../docs/ranking-research.md`](../docs/ranking-research.md) (ranking taxonomy + methodology).

### Endpoint summary

| # | Path | Cache (s-maxage) |
|---|---|---|
| 1 | `GET /blog-categories/{lang}` | 3600 |
| 2 | `GET /blog-news/{lang}?q=&category=&sort=&limit=&cursor=` | 300 (0 when `q=`) |
| 2 | `GET /blog-news/{lang}/{slug}` | 3600 |
| 3 | `GET /blog-trending/{lang}?limit=10` | 300 |
| 4 | `GET /blog-ticker/{lang}` | 60 |
| 5 | `GET /blog-ranking-sectors/{lang}` | 3600 |
| 6 | `GET /blog-ranking/{lang}?q=&sector=&subsector=&region=&sort=&limit=` | 300 |
| 7 | `GET /blog-ranking-timeline/{lang}` | 600 |
| 8 | `GET /blog-engine-profiles/{lang}` | 3600 |
| A1 | `GET /blog-regions/{lang}` | 3600 |
| A2 | `GET /blog-sectors/{lang}` | 3600 |
| A3 | `GET /blog-engines/{lang}` | 3600 |
| 9 | `POST /blog-newsletter/register` | uncached |

### Revalidation handshake

After every write, **the admin must call `indexai`'s on-demand revalidation webhook** so visitors see fresh content immediately (rather than waiting up to 1h for ISR):

```
POST https://indexai.news/api/revalidate
Headers: x-revalidate-secret: <REVALIDATE_SECRET>
Body:    { event, lang, slug?, tags? }
```

Events → tags:

| Event | Tags revalidated on indexai |
|---|---|
| `article.published` / `.updated` / `.deleted` | `blog:news:{lang}`, `blog:trending:{lang}`, `blog:ticker:{lang}`, `blog:article:{slug}` |
| `category.changed` | `blog:categories:{lang}` |
| `ranking.updated` | `blog:ranking:{lang}`, `blog:ranking-sectors:{lang}`, `blog:ranking-timeline:{lang}`, `blog:engine-profiles:{lang}`, `blog:regions:{lang}`, `blog:sectors:{lang}`, `blog:engines:{lang}` |
| `purge` | `blog` (umbrella) |

`blog-revalidate` Edge Function wraps this call; fire **one request per locale** when the same article exists in multiple languages. Fire-and-forget — the publish UI must not block on it.

### Environment / secrets

Set on the Supabase project:
- `INDEXAI_REVALIDATE_URL` = `https://indexai.news/api/revalidate`
- `INDEXAI_REVALIDATE_SECRET` = same value the indexai Vercel project has as `REVALIDATE_SECRET`

Rotation: deploy the new value to Vercel **first** (it immediately rejects the old one), then update Supabase secrets. A few seconds of 401s are harmless — the page still refreshes when its ISR window expires.
