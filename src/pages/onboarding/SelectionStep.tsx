import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react';
import type { StepConfig } from './types';
import type { OnboardingItem, OnboardingItemGroup } from './onboardingData';

// ─── Props ──────────────────────────────────────────────────
interface SelectionStepProps {
  step: number;
  stepConfig: StepConfig;
  direction: 'next' | 'prev';
  isLast: boolean;
  /** Flat list of items (used for Topics). */
  items?: OnboardingItem[];
  /** Grouped items (used for Prompts, grouped by topic). */
  groupedItems?: OnboardingItemGroup[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

// ─── Topic Row (enhanced card-style) ────────────────────────
function TopicRow({
  item,
  selected,
  onToggle,
}: {
  item: OnboardingItem;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      className={`flex items-center gap-4 px-5 py-4 rounded-xl border transition-all duration-200 w-full text-left cursor-pointer group ${
        selected
          ? 'border-brand-primary/40 bg-brand-primary/5 shadow-sm'
          : 'border-glass-border bg-bg-primary/30 hover:border-text-muted/40 hover:bg-bg-secondary/50'
      }`}
    >
      <span
        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2 transition-all duration-200 ${
          selected
            ? 'bg-brand-primary border-brand-primary scale-110'
            : 'border-glass-border bg-transparent group-hover:border-text-muted'
        }`}
      >
        {selected && <Check className="w-3 h-3 text-white" />}
      </span>
      <span
        className={`text-sm transition-colors ${
          selected ? 'text-text-primary font-semibold' : 'text-text-secondary'
        }`}
      >
        {item.title}
      </span>
      {selected && (
        <Sparkles className="w-3.5 h-3.5 text-brand-primary ml-auto shrink-0 animate-in fade-in duration-300" />
      )}
    </button>
  );
}

// ─── Prompt Row (compact checkbox) ──────────────────────────
function PromptRow({
  item,
  selected,
  onToggle,
}: {
  item: OnboardingItem;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all duration-150 w-full text-left cursor-pointer group ${
        selected
          ? 'bg-brand-primary/5'
          : 'hover:bg-bg-secondary/50'
      }`}
    >
      <span
        className={`w-4.5 h-4.5 rounded flex items-center justify-center shrink-0 border-2 transition-all duration-150 ${
          selected
            ? 'bg-brand-primary border-brand-primary'
            : 'border-glass-border bg-transparent group-hover:border-text-muted'
        }`}
      >
        {selected && <Check className="w-3 h-3 text-white" />}
      </span>
      <span
        className={`text-sm transition-colors leading-snug ${
          selected ? 'text-text-primary font-medium' : 'text-text-secondary'
        }`}
      >
        {item.title}
      </span>
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────
export function SelectionStep({
  step,
  stepConfig,
  direction,
  isLast,
  items,
  groupedItems,
  selectedIds,
  onToggle,
  onNext,
  onPrev,
}: SelectionStepProps) {
  const { t } = useTranslation();
  const StepIcon = stepConfig.icon;
  const hasSelection = selectedIds.size > 0;

  // Count selected for grouped items
  const totalGroupedItems = groupedItems?.reduce((sum, g) => sum + g.items.length, 0) ?? 0;
  const selectedGroupedCount = groupedItems?.reduce(
    (sum, g) => sum + g.items.filter(i => selectedIds.has(i.id)).length, 0
  ) ?? 0;

  return (
    <>
      {/* Main content */}
      <div
        key={step}
        className={`flex-1 flex flex-col transition-all duration-500 ease-out ${
          direction === 'next' ? 'animate-in slide-in-from-right-5' : 'animate-in slide-in-from-left-5'
        }`}
      >
        {/* Hero section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-secondary via-bg-tertiary to-bg-secondary border border-glass-border p-8 md:p-10 mb-8">
          <div
            className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-20"
            style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))` }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-10"
            style={{ background: `linear-gradient(135deg, var(--brand-accent), var(--brand-primary))` }}
          />

          <div className="relative z-10 flex flex-col md:flex-row items-start gap-6">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${stepConfig.color} flex items-center justify-center shrink-0 shadow-lg`}>
              <StepIcon className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">
                {t(`onboarding.steps.${stepConfig.key}.title`)}
              </h1>
              <p className="text-base text-text-secondary leading-relaxed mb-2">
                {t(`onboarding.steps.${stepConfig.key}.description`)}
              </p>
              <p className="text-sm text-text-muted leading-relaxed">
                {t(`onboarding.steps.${stepConfig.key}.detail`)}
              </p>
            </div>

            {/* Selection counter badge */}
            {items && (
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-primary/40 border border-glass-border shrink-0">
                <span className="text-2xl font-bold text-brand-primary">{selectedIds.size}</span>
                <span className="text-xs text-text-muted">/ {items.length}<br />{t(`onboarding.steps.${stepConfig.key}.counter`, 'selected')}</span>
              </div>
            )}
            {groupedItems && (
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-primary/40 border border-glass-border shrink-0">
                <span className="text-2xl font-bold text-brand-primary">{selectedGroupedCount}</span>
                <span className="text-xs text-text-muted">/ {totalGroupedItems}<br />{t(`onboarding.steps.${stepConfig.key}.counter`, 'selected')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Flat list (Topics) — card-style rows */}
        {items && (
          <div className="flex flex-col gap-2.5 mb-8">
            {items.map((item) => (
              <TopicRow
                key={item.id}
                item={item}
                selected={selectedIds.has(item.id)}
                onToggle={onToggle}
              />
            ))}
          </div>
        )}

        {/* Grouped cards (Prompts) — enhanced cards */}
        {groupedItems && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {groupedItems.map((group) => {
              const selectedCount = group.items.filter(i => selectedIds.has(i.id)).length;
              return (
                <div
                  key={group.groupId}
                  className="relative overflow-hidden rounded-xl border border-glass-border bg-bg-primary/30 transition-all duration-200 hover:border-brand-primary/20 hover:shadow-sm"
                >
                  {/* Card header with topic name + count */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-glass-border/50 bg-bg-secondary/30">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-brand-primary shrink-0" />
                      <h2 className="text-sm font-bold text-text-primary">
                        {group.groupTitle}
                      </h2>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      selectedCount > 0
                        ? 'bg-brand-primary/10 text-brand-primary'
                        : 'bg-bg-tertiary text-text-muted'
                    }`}>
                      {selectedCount}/{group.items.length}
                    </span>
                  </div>

                  {/* Prompt items */}
                  <div className="p-2">
                    {group.items.map((item) => (
                      <PromptRow
                        key={item.id}
                        item={item}
                        selected={selectedIds.has(item.id)}
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-glass-border">
        <button
          onClick={onPrev}
          className="btn btn-ghost btn-sm"
          id="onboarding-prev-btn"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('common.back')}
        </button>

        <button
          onClick={onNext}
          disabled={!hasSelection}
          className="btn btn-primary btn-sm"
          id="onboarding-next-btn"
        >
          {isLast ? t('onboarding.tryItNow') : t('onboarding.next')}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
