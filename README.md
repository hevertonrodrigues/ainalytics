# Ainalytics

## Overview

Ainalytics is a comprehensive, multi-tenant platform designed to evaluate, compare, and manage AI prompts and their corresponding responses across various leading AI platforms (OpenAI, Anthropic, Google Gemini, xAI Grok, and Perplexity). The system allows organizations to track model performance, organize prompts by topics, and analyze AI outputs, including native web-search grounding capabilities.

## Key Features

- **Multi-Tenant Architecture**: Isolate data and settings per organization/tenant.
- **Provider Integrations**: Native integrations with top AI providers to fetch and evaluate answers in a unified format.
- **Prompt & Topic Management**: Organize prompts logically into topics for systematic testing and tracking.
- **Web Search Grounding Analytics**: Track and toggle web search capabilities for specific models, and verify search grounding effectiveness.
- **Localization (i18n)**: Built-in multi-language support in the frontend.
- **Admin & Dashboard**: Interactive UI for managing platforms, models, users, and viewing prompt answers.

## Technology Stack

### Frontend

- **React 19** with **Vite** for fast, modern UI development.
- **Tailwind CSS v4** for utility-first styling and responsive design.
- **React Router DOM** for client-side routing.
- **React i18next** for internationalization.
- **Lucide React** for consistent iconography.

### Backend & Infrastructure

- **Supabase**: Open-source Firebase alternative serving as the core backend.
- **PostgreSQL**: Relational database with Row Level Security (RLS) for strict multi-tenant data isolation.
- **Supabase Edge Functions** (Deno/TypeScript): Serverless compute used for secure API interactions, provider integrations (`_shared/ai-providers/`), and custom business logic.
- **Supabase Auth**: JWT-based authentication layered with tenant-specific roles.

## Project Structure

```text
ainalytics/
├── src/                    # Frontend React Application
│   ├── components/         # Reusable UI components and layout pieces
│   ├── contexts/           # React Contexts (Auth, Tenant, Theme, Toast)
│   ├── i18n/               # Internationalization configuration
│   ├── lib/                # Shared utilities and Supabase client
│   ├── pages/              # Route components (Dashboard, Prompts, Models, etc.)
│   └── types/              # TypeScript type definitions
├── supabase/               # Backend configuration and code
│   ├── functions/          # Deno Edge Functions (Topics, Providers, Auth)
│   └── migrations/         # PostgreSQL schema migrations
├── guide_docs/             # API integration guides for AI providers
└── package.json            # Node.js dependencies and scripts
```

## Database Schema Highlights

The database is specifically structured to support multi-tenancy and prompt evaluation:

- `tenants`, `tenant_users`, `tenant_settings`: Core multi-tenancy tables.
- `profiles`: User information linked to Supabase Auth.
- `platforms` & `models_refactor`: Registries for AI providers and their specific models. Tracks features like `web_search_active`.
- `topics` & `prompts`: Organizational structures for test queries.
- `prompt_answers`: Stores the generated responses from different models for analysis, including raw responses and grounding metadata.

## Getting Started

### Prerequisites

- Node.js (v18+)
- Supabase CLI
- Docker (for local Supabase instance)

### Local Development Setup

1. **Install Dependencies:**

   ```bash
   npm install
   ```

2. **Start Local Supabase:**

   ```bash
   npx supabase start
   ```

3. **Environment Setup:**
   Create a `.env.local` file based on `.env.example` and populate it with your local Supabase URL, Anon Key, and provider API keys (OpenAI, Anthropic, Gemini, Grok, Perplexity).

4. **Deploy Edge Functions Locally (Optional for full backend testing):**

   ```bash
   npx supabase functions serve --no-verify-jwt --env-file supabase/.env.local
   ```

5. **Run the Frontend Development Server:**
   ```bash
   npm run dev
   ```

## Development & Deployment

- **Frontend build**: Run `npm run build` to compile the app for production via Vite.
- **Linting**: Run `npm run lint` for ESLint checks.
- **Database Migrations**: Can be created via `npx supabase migration new <migration_name>` and applied locally with `npx supabase db push` or `npx supabase reset`.

## Integrations Guide

Detailed documentation for integrating and maintaining the AI providers can be found in the `guide_docs/` directory. These cover endpoints, parameters, and special capabilities like citations and web search for providers like Perplexity, Anthropic, and Grok.
