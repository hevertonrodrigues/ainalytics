import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { FILTERS } from '../types';
import type { Filter, Meta } from '../types';

interface InboxToolbarProps {
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  search: string;
  onSearchChange: (s: string) => void;
  meta: Meta;
}

const ACCENTS: Record<Filter, string> = {
  inbox: 'bg-brand-primary/15 text-brand-primary border-brand-primary/30',
  unread: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  starred: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  archived: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  all: 'bg-brand-primary/15 text-brand-primary border-brand-primary/30',
};

export function InboxToolbar({ filter, onFilterChange, search, onSearchChange, meta }: InboxToolbarProps) {
  const { t } = useTranslation();

  const filterCount = useMemo<Record<Filter, number | undefined>>(() => ({
    inbox: meta.total,
    unread: meta.unread,
    starred: meta.starred,
    archived: undefined,
    all: undefined,
  }), [meta]);

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {FILTERS.map(f => {
          const count = filterCount[f.key];
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? ACCENTS[f.key]
                  : 'bg-glass-element text-text-secondary border-glass-border hover:border-text-muted'
              }`}
            >
              {t(f.translationKey)}
              {count !== undefined && count > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full text-[10px] font-bold tabular-nums ${
                    active ? 'bg-current/20' : 'bg-glass-border text-text-muted'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="relative flex-1 max-w-md lg:ml-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t('sa.inbox.searchPlaceholder')}
          className="input-field !pl-10 !py-2 !text-sm w-full"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
