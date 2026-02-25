import type { PromptAnswer } from '@/types';

export type PlatformGroup = {
  platform_slug: string;
  models: {
    model_id: string;
    model_slug: string;
    answers: PromptAnswer[];
  }[];
};

export type PromptSource = {
  domain: string;
  name: string | null;
  total_count: number;
  platforms: Record<string, number>;
};

export const PLATFORM_COLORS: Record<string, string> = {
  openai: 'bg-emerald-500',
  anthropic: 'bg-orange-500',
  gemini: 'bg-blue-500',
  grok: 'bg-slate-600',
  perplexity: 'bg-cyan-500',
};
