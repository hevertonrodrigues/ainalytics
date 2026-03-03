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
  main_domain: string | null;
  website_title: string | null;
  metatags: string | null;
  extracted_content: string | null;
  llm_txt: string | null;
  sitemap_xml: string | null;
  llm_txt_status: 'missing' | 'outdated' | 'updated';
  prompt_executions_per_hour: number;
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
  is_sa: boolean;
  has_seen_welcome_modal: boolean;
  tutorial_views: Record<string, boolean> | null;
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
  tokens_used: Record<string, any> | null;
  latency_ms: number | null;
  raw_request: unknown | null;
  raw_response: unknown | null;
  error: string | null;
  deleted: boolean;
  created_at: string;
  searched_at: string;
  web_search_enabled: boolean;
  annotations: any | null;
  sources: any[] | null;
}

export interface Source extends BaseEntity {
  name: string | null;
  domain: string;
  mentions_count?: number; // Virtual, from join or aggregation
  last_referenced_at?: string; // Virtual, from join or aggregation
}

export interface PromptAnswerSource extends BaseEntity {
  prompt_id: string;
  answer_id: string;
  source_id: string;
  url: string;
  title: string | null;
  annotation: string | null;
  prompt?: Prompt;
  answer?: PromptAnswer;
  source?: Source;
}

export interface SearchPromptInput {
  prompt_id: string;
  prompt_text: string;
}

// ────────────────────────────────────────────────────────────
// Companies & Tenant Companies
// ────────────────────────────────────────────────────────────

export type CompanyStatus = 'pending' | 'scraping' | 'scraping_done' | 'analyzing' | 'completed' | 'error';

export interface CompanyPage {
  url: string;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  content_summary: string | null;
  word_count: number;
  has_structured_data: boolean;
  is_client_rendered: boolean;
  has_captcha: boolean;
  status_code: number;
  load_time_ms: number;
  ttfb_ms?: number;
  error?: string;

  // Enhanced extraction fields (GEO Analyzer)
  headings?: {
    h1: string[];
    h2: string[];
    h3: string[];
    h1_count: number;
    hierarchy_valid: boolean;
    question_headings_count: number;
    headings_with_ids: number;
    headings_total: number;
  };
  schema?: {
    detected_types: string[];
    total_schemas: number;
    has_faq: boolean;
    has_organization: boolean;
    has_article: boolean;
    has_product: boolean;
    has_breadcrumb: boolean;
    valid_blocks: number;
    invalid_blocks: number;
  };
  semantic?: {
    article: number;
    section: number;
    main: number;
    nav: number;
    aside: number;
    header: number;
    footer: number;
    figure: number;
    time: number;
    details: number;
    div_count: number;
    semantic_ratio: number;
  };
  links?: {
    internal_count: number;
    external_count: number;
    contextual_internal: number;
    navigation_internal: number;
    generic_anchor_count: number;
    descriptive_anchor_pct: number;
  };
  images?: {
    total: number;
    with_alt: number;
    with_empty_alt: number;
    without_alt: number;
    generic_alt: number;
    in_figure_with_caption: number;
  };
  open_graph?: {
    has_og_title: boolean;
    has_og_description: boolean;
    has_og_image: boolean;
    has_og_type: boolean;
    has_og_url: boolean;
    has_og_site_name: boolean;
  };
  tables?: {
    total: number;
    with_thead: number;
    with_th: number;
    with_caption: number;
  };
  lists?: {
    ordered_count: number;
    unordered_count: number;
    total_list_items: number;
    fake_list_patterns: number;
  };
  paragraphs?: {
    total: number;
    avg_word_count: number;
    pct_under_100: number;
    pct_over_150: number;
    cross_reference_count: number;
  };
  canonical_url?: string | null;
  canonical_matches_url?: boolean;
  viewport_tag?: string | null;
  is_https?: boolean;
  redirect_chain?: string[];
  hsts_header?: boolean;
}

// ────────────────────────────────────────────────────────────
// GEO Analysis (stored in geo_analyses table)
// ────────────────────────────────────────────────────────────

export type AnalysisStatus = 'pending' | 'scraping' | 'scraping_done' | 'analyzing' | 'completed' | 'error';

export interface GeoAnalysis {
  id: string;
  company_id: string;
  status: AnalysisStatus;
  progress: number;
  error_message: string | null;
  status_message: string | null;
  robots_txt: string | null;
  sitemap_xml: string | null;
  llms_txt: string | null;
  crawled_pages: CompanyPage[];
  ai_report: Record<string, AiReport> | Record<string, never>;
  geo_score: number | null;
  readiness_level: number | null;
  pages_crawled: number;
  total_pages: number;
  created_at: string;
  completed_at: string | null;
}


// ────────────────────────────────────────────────────────────
// GEO Factor Scoring (25 Factors)
// ────────────────────────────────────────────────────────────

export type GeoFactorStatus = 'excellent' | 'good' | 'warning' | 'critical';

export type GeoFactorCategory = 'Technical' | 'Content' | 'Authority' | 'Semantic';

export interface GeoFactorScore {
  factor_id: string;
  name: string;
  category: GeoFactorCategory;
  score: number;        // 0–100
  weight: number;       // decimal, e.g. 0.08
  weighted_score: number;
  status: GeoFactorStatus;
  details: string;
  recommendations: string[];
}

export interface GeoCategoryScores {
  technical: number;
  content: number;
  authority: number;
  semantic: number;
}

export type GeoReadinessLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface GeoNextLevel {
  level: GeoReadinessLevel;
  label: string;
  threshold: number;
}

export interface GeoTopRecommendation {
  priority: number;
  factor_id: string;
  factor_name: string;
  current_score: number;
  estimated_score_after_fix: number;
  potential_composite_gain: number;
  recommendation: string;
}


export interface AiReportProductService {
  name: string;
  description: string;
  type: 'product' | 'service';
}

export interface AiReport {
  summary: string;
  company_name: string;
  industry: string;
  country: string;
  market: string;
  tags: string[];
  categories: string[];
  products_services: AiReportProductService[];
  competitors: string[];
  strengths: string[];
  weaknesses: string[];
  geo_score: number;
  content_quality: 'excellent' | 'good' | 'fair' | 'poor';
  structured_data_coverage: 'comprehensive' | 'partial' | 'none';
  ai_bot_access: Record<string, boolean>;
  schema_markup_types: string[];
  // GEO Factor Scoring
  factor_scores?: GeoFactorScore[];
  composite_score?: number;
  readiness_level?: GeoReadinessLevel;
  readiness_label?: string;
  category_scores?: GeoCategoryScores;
  points_to_next_level?: number;
  next_level?: GeoNextLevel;
  top_recommendations?: GeoTopRecommendation[];
}

export interface Company {
  id: string;
  domain: string;
  description: string | null;
  website_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  og_image: string | null;
  favicon_url: string | null;
  language: string | null;
  company_name: string | null;
  industry: string | null;
  country: string | null;
  tags: string[];
  target_language: string;
  created_at: string;
  updated_at: string;
  // Latest analysis joined from geo_analyses table
  latest_analysis: GeoAnalysis | null;
}

export interface TenantCompany {
  id: string;
  tenant_id: string;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCompanyInput {
  domain: string;
  description?: string;
  target_language?: string;
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
  main_domain: string;
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
  has_seen_welcome_modal?: boolean;
  tutorial_views?: Record<string, boolean>;
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
