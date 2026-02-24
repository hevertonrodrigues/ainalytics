// ────────────────────────────────────────────────────────────
// Base Entity — every table has these
// ────────────────────────────────────────────────────────────

export interface BaseEntity {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────
// Plans (global — no tenant_id)
// ────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  settings: Record<string, unknown>;
  features: Record<string, string[]>;
  created_at: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────
// Tenants (NO tenant_id — tenants is the root table)
// ────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan_id: string | null;
  created_at: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────
// Profiles (holds user info — no separate public.users table)
// ────────────────────────────────────────────────────────────

export interface Profile extends BaseEntity {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  locale: 'en' | 'es' | 'pt-br';
  metadata: Record<string, unknown> | null;
}

// ────────────────────────────────────────────────────────────
// Tenant Users (join table)
// ────────────────────────────────────────────────────────────

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export interface TenantUser extends BaseEntity {
  user_id: string;
  role: Role;
  is_active: boolean;
}

// ────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────
// Topics & Prompts (AI Monitoring)
// ────────────────────────────────────────────────────────────

export interface Topic extends BaseEntity {
  name: string;
  description: string | null;
  is_active: boolean;
  prompt_count?: number; // virtual, from join
}

export interface Prompt extends BaseEntity {
  topic_id: string;
  text: string;
  description: string | null;
  is_active: boolean;
}

export interface CreateTopicInput {
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateTopicInput {
  id: string;
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface CreatePromptInput {
  topic_id: string;
  text: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdatePromptInput {
  id: string;
  text?: string;
  description?: string;
  is_active?: boolean;
}

// ────────────────────────────────────────────────────────────
// Platforms, Models & Answers (AI Integration)
// ────────────────────────────────────────────────────────────

export interface Model {
  id: string;
  platform_id: string;
  slug: string;
  name: string;
  is_active: boolean;
  web_search_active: boolean;
  created_at: string;
}

export interface Platform {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  default_model_id: string | null;
  default_model: Model | null; // joined from models
  created_at: string;
  updated_at: string;
}

export interface TenantPlatformModel {
  id: string;
  tenant_id: string;
  platform_id: string;
  model_id: string;
  is_active: boolean;
  platform?: { id: string; slug: string; name: string };
  model?: { id: string; slug: string; name: string; web_search_active?: boolean };
  created_at: string;
  updated_at: string;
}

export interface PromptAnswer {
  id: string;
  tenant_id: string;
  prompt_id: string;
  platform_slug: string;
  platform_id: string | null;
  model: { id: string; slug: string; name: string } | null;
  model_id: string | null;
  answer_text: string | null;
  tokens_used: { input: number; output: number } | null;
  latency_ms: number | null;
  raw_request: unknown | null;
  raw_response: unknown | null;
  error: string | null;
  deleted: boolean;
  searched_at: string;
  created_at: string;
}

export interface SearchPromptInput {
  prompt_id: string;
  prompt_text: string;
}

// ────────────────────────────────────────────────────────────
// API Response Envelope
// ────────────────────────────────────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ────────────────────────────────────────────────────────────
// Auth Types
// ────────────────────────────────────────────────────────────

export interface SignUpInput {
  email: string;
  password: string;
  full_name: string;
  tenant_name: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  profile: Profile;
  tenants: Tenant[];
  current_tenant_id: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface UpdateProfileInput {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  locale?: 'en' | 'es' | 'pt-br';
}

// ────────────────────────────────────────────────────────────
// Hook Return Types
// ────────────────────────────────────────────────────────────

export interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseMutationResult<TInput, TOutput> {
  mutate: (input: TInput) => Promise<TOutput>;
  loading: boolean;
  error: string | null;
}
