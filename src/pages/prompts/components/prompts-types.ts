import type { Topic, Prompt } from '@/types';

export interface TopicWithPrompts extends Topic {
  prompts_list: Prompt[];
}

export type FormMode = 'closed' | 'create' | 'edit';
