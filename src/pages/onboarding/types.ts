import type { GeoFactorScore, GeoCategoryScores, GeoReadinessLevel, GeoNextLevel, GeoTopRecommendation } from '@/types';

// ─── Pre-analyze response type ──────────────────────────────
export interface PreAnalyzeResult {
  domain: string;
  website_title: string | null;
  meta_description: string | null;
  robots_txt: boolean;
  sitemap_xml: boolean;
  llms_txt: boolean;
  geo_score: number;
  readiness_level: GeoReadinessLevel;
  readiness_label: string;
  category_scores: GeoCategoryScores;
  points_to_next_level: number;
  next_level: GeoNextLevel | null;
  factor_scores: GeoFactorScore[];
  top_recommendations: GeoTopRecommendation[];
  suggested_topics: { id: string; title: string }[];
  suggested_prompts: Record<string, { id: string; title: string }[]>;
}

// ─── Step config ────────────────────────────────────────────
export interface StepConfig {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

// ─── Category color map ─────────────────────────────────────
export const CATEGORY_COLORS: Record<string, string> = {
  technical: '#6c5ce7',
  content: '#fd79a8',
  authority: '#00b894',
  semantic: '#fdcb6e',
};

// ─── Readiness badges ───────────────────────────────────────
export const READINESS_BADGES: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Not Ready', color: 'text-error', bg: 'bg-error/10' },
  1: { label: 'Beginner', color: 'text-warning', bg: 'bg-warning/10' },
  2: { label: 'Developing', color: 'text-warning', bg: 'bg-warning/10' },
  3: { label: 'Intermediate', color: 'text-warning', bg: 'bg-warning/10' },
  4: { label: 'Advanced', color: 'text-success', bg: 'bg-success/10' },
  5: { label: 'Expert', color: 'text-success', bg: 'bg-success/10' },
};

export const LOCALE_LABELS: Record<string, string> = { en: 'EN', es: 'ES', 'pt-br': 'PT' };
