// ─── Onboarding data types & utilities ──────────────────────
// Topics & prompts are now returned by the pre-analyze edge function.
// These types and helpers are used across the selection steps and final step.

export interface OnboardingItem {
  id: string;
  title: string;
}

export interface OnboardingItemGroup {
  groupId: string;
  groupTitle: string;
  items: OnboardingItem[];
}

/** Get default selected prompt IDs for a set of topics (first 2 per topic). */
export function getDefaultSelectedPrompts(
  topicIds: Set<string>,
  promptsByTopic: Record<string, OnboardingItem[]>,
): Set<string> {
  const ids = new Set<string>();
  for (const topicId of topicIds) {
    const prompts = promptsByTopic[topicId];
    if (prompts) {
      prompts.slice(0, 2).forEach((p) => ids.add(p.id));
    }
  }
  return ids;
}

/** Build grouped prompt items for the selected topics. */
export function buildPromptGroups(
  selectedTopics: Set<string>,
  topics: OnboardingItem[],
  promptsByTopic: Record<string, OnboardingItem[]>,
): OnboardingItemGroup[] {
  return topics
    .filter((t) => selectedTopics.has(t.id))
    .map((t) => ({
      groupId: t.id,
      groupTitle: t.title,
      items: promptsByTopic[t.id] || [],
    }));
}
