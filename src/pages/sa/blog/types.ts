// Blog admin shared types — mirror the simplified database schema.

export type Lang = 'pt' | 'es' | 'en';
export const LANGS: Lang[] = ['pt', 'es', 'en'];

// ─── Authors ────────────────────────────────────────────────────────────────

export interface BlogAuthor {
  id: string;
  email: string | null;
  image_url: string | null;
  social: Record<string, string>;
  created_at: string;
  updated_at: string;
  name?: string;
  role?: string;
  translations?: Partial<Record<Lang, AuthorTranslation>>;
}

export interface AuthorTranslation {
  author_id?: string;
  lang?: Lang;
  name: string;
  role: string;
  bio?: string | null;
}

// ─── Categories ─────────────────────────────────────────────────────────────

export interface BlogCategory {
  id: string;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  labels?: Partial<Record<Lang, { label: string; slug: string }>>;
  translations?: Partial<Record<Lang, CategoryTranslation>>;
}

export interface CategoryTranslation {
  category_id?: string;
  lang?: Lang;
  slug: string;
  label: string;
  description: string;
  seo_title?: string | null;
  segment: string;
}

// ─── Tags ───────────────────────────────────────────────────────────────────

export interface BlogTag {
  id: string;
  is_engine: boolean;
  created_at: string;
  updated_at: string;
  labels?: Partial<Record<Lang, string>>;
  translations?: Partial<Record<Lang, TagTranslation>>;
}

export interface TagTranslation {
  tag_id?: string;
  lang?: Lang;
  slug: string;
  label: string;
}

// ─── Brands ─────────────────────────────────────────────────────────────────

export interface BlogBrand {
  id: string;
  name: string;
  country: string | null;
  sector: string;
  subsector_id: string | null;
  homepage_domain: string | null;
  entity_type: string;
  labels: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// ─── Sectors / Subsectors taxonomy ──────────────────────────────────────────

export interface BlogSector {
  id: string;
  label: string;
  description: string | null;
  brandCount: number;
  subsectors: BlogSubsector[];
}

export interface BlogSubsector {
  id: string;
  label: string;
  description: string | null;
  brandCount: number;
}

// ─── Articles (news) ────────────────────────────────────────────────────────

export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'retracted';

export interface BlogArticle {
  id: string;
  category_id: string;
  read_time_minutes: number;
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  status: ArticleStatus;
  is_featured: boolean;
  trending_position: number | null;
  published_at: string;
  modified_at: string;
  created_at: string;
  updated_at: string;
  translations?: Partial<Record<Lang, ArticleTranslation>>;
  authors?: Array<{ author_id: string; position: number }>;
  tags?: Array<{ tag_id: string; article_id?: string }>;
  keywords?: Array<{ keyword: string; position: number }>;
  sources?: Array<{ name: string; url: string; position?: number }>;
}

// ─── Ranking FAQ ────────────────────────────────────────────────────────────

export interface RankingFaq {
  id: number;
  region: string | null;
  sector: string | null;
  lang: Lang;
  position: number;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
}

export interface ArticleTranslation {
  article_id?: string;
  lang?: Lang;
  slug: string;
  title: string;
  dek: string;
  display_date: string;
  read_time_label: string;
  /**
   * Article body. Authored as HTML via the rich-text editor on
   * /sa/blog/news/:id. The blog-admin import path also accepts the legacy
   * `ArticleBlock[]` shape and converts it to HTML server-side.
   */
  body: string;
  toc: string[];
  ui: Record<string, unknown>;
  sidebar_cta: Record<string, unknown>;
  image_alt: string | null;
  meta_keywords: string[];
}

/** Legacy block shape — accepted by import only; storage is now HTML. */
export type ArticleBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'blockquote'; text: string };

// ─── Ticker ─────────────────────────────────────────────────────────────────

export interface BlogTickerItem {
  id: number;
  lang: Lang;
  position: number;
  engine_id: string | null;
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  link_url: string | null;
  is_active: boolean;
  updated_at: string;
}

// ─── Rankings ───────────────────────────────────────────────────────────────

export interface RankingSnapshot {
  id: number;
  period_label: string;
  period_from: string;
  period_to: string;
  region: string;
  sector: string;
  queries_analyzed: number;
  sectors_covered: number;
  engines_monitored: string[];
  generated_at: string;
  items?: RankingItem[];
}

export interface RankingItem {
  snapshot_id: number;
  rank: number;
  brand_id: string;
  score: number;
  delta: string;
  direction: 'up' | 'down' | 'flat';
}

// ─── Locale Meta (SEO config per language) ─────────────────────────────────

export interface LocaleMeta {
  lang: Lang;
  site_title: string;
  site_description: string;
  site_keywords: string[];
  default_og_image_url: string | null;
  publisher_name: string;
  publisher_url: string;
  publisher_logo_url: string;
  publisher_logo_width: number;
  publisher_logo_height: number;
  twitter_handle: string | null;
  trending_title: string;
  trending_description: string;
  trending_eyebrow: string | null;
  newsletter_eyebrow: string | null;
  newsletter_title: string | null;
  newsletter_text: string | null;
  newsletter_placeholder: string | null;
  newsletter_button: string | null;
  newsletter_success_message: string | null;
  rankings_title: string;
  rankings_description: string;
  categories_title: string;
  categories_description: string;
  category_segment: string;
}

// ─── Newsletter ─────────────────────────────────────────────────────────────

export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed' | 'bounced';

export interface NewsletterSubscriber {
  id: number;
  email: string;
  lang: Lang;
  topics: string[];
  source: string | null;
  status: SubscriberStatus;
  subscribed_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
}
