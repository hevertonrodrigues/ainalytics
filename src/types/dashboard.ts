import type { Topic, Prompt, PromptAnswer, Source } from './index';

export interface TopicWithPrompts extends Topic {
  prompts_list: Prompt[];
}

export type FormMode = 'closed' | 'create' | 'edit';

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

export type SourceWithReferences = Source & {
  prompt_answer_sources: {
    prompt_id: string;
    prompt: { id: string; text: string };
  }[];
};

export interface PlatformMetadata {
  slug: string;
  label: string;
  colorClass: string;
  gradientClass: string;
  isSyncable: boolean;
}

export const PLATFORM_METADATA: Record<string, PlatformMetadata> = {
  openai: {
    slug: 'openai',
    label: 'OpenAI',
    colorClass: 'bg-emerald-500',
    gradientClass: 'from-emerald-500 to-green-600',
    isSyncable: true,
  },
  anthropic: {
    slug: 'anthropic',
    label: 'Anthropic',
    colorClass: 'bg-orange-500',
    gradientClass: 'from-orange-400 to-amber-600',
    isSyncable: true,
  },
  gemini: {
    slug: 'gemini',
    label: 'Gemini',
    colorClass: 'bg-blue-500',
    gradientClass: 'from-blue-500 to-indigo-600',
    isSyncable: true,
  },
  grok: {
    slug: 'grok',
    label: 'Grok',
    colorClass: 'bg-slate-600',
    gradientClass: 'from-slate-600 to-slate-800',
    isSyncable: true,
  },
  perplexity: {
    slug: 'perplexity',
    label: 'Perplexity',
    colorClass: 'bg-cyan-500',
    gradientClass: 'from-cyan-500 to-teal-600',
    isSyncable: false,
  },
};

export const SYNCABLE_PLATFORMS = new Set(
  Object.values(PLATFORM_METADATA)
    .filter((p) => p.isSyncable)
    .map((p) => p.slug)
);

export const PLATFORM_COLORS: Record<string, string> = Object.entries(PLATFORM_METADATA).reduce(
  (acc, [slug, meta]) => {
    acc[slug] = meta.colorClass;
    return acc;
  },
  {} as Record<string, string>
);

export const PLATFORM_GRADIENTS: Record<string, string> = Object.entries(PLATFORM_METADATA).reduce(
  (acc, [slug, meta]) => {
    acc[slug] = meta.gradientClass;
    return acc;
  },
  {} as Record<string, string>
);
