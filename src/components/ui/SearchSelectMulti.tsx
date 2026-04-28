import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import type { SelectOption } from './SearchSelect';

interface SearchSelectMultiProps {
  options: SelectOption[];
  /** Currently selected values. */
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Minimum options to show the search input (default: 0 = always show). */
  searchThreshold?: number;
  /** Translation for "N selected" pill. e.g. ({ n }) => `${n} selected`. */
  formatCount?: (n: number) => string;
}

/**
 * Multi-select sibling of `SearchSelect`. Reuses the same `select-*` CSS
 * classes for visual consistency.
 */
export function SearchSelectMulti({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  disabled = false,
  id,
  className = '',
  searchThreshold = 0,
  formatCount = (n) => `${n} selected`,
}: SearchSelectMultiProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const showSearch = options.length >= searchThreshold;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open && showSearch) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, showSearch]);

  const toggle = useCallback(() => {
    if (disabled) return;
    setOpen((prev) => {
      if (prev) setQuery('');
      return !prev;
    });
  }, [disabled]);

  const handleToggleOption = useCallback(
    (val: string) => {
      const next = new Set(selectedSet);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      onChange(Array.from(next));
    },
    [selectedSet, onChange],
  );

  const handleClearAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
      if (e.key === 'Enter' && filtered.length === 1) {
        handleToggleOption(filtered[0]!.value);
      }
    },
    [filtered, handleToggleOption],
  );

  const triggerLabel = (() => {
    if (value.length === 0) return placeholder;
    if (value.length <= 2) {
      return options
        .filter((o) => selectedSet.has(o.value))
        .map((o) => o.label)
        .join(', ');
    }
    return formatCount(value.length);
  })();

  return (
    <div
      ref={containerRef}
      className={`select-container ${className}`}
      id={id}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`select-trigger${open ? ' select-trigger-open' : ''}${disabled ? ' select-trigger-disabled' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value.length === 0 ? 'text-text-muted' : 'text-text-primary'}>
          {triggerLabel}
        </span>
        <span className="flex items-center gap-1">
          {value.length > 0 && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClearAll}
              className="text-text-muted hover:text-text-primary transition-colors"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`select-chevron${open ? ' select-chevron-open' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="select-dropdown">
          {showSearch && (
            <div className="select-search-wrap">
              <Search className="select-search-icon" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="select-search"
              />
            </div>
          )}
          <ul className="select-options" role="listbox" aria-multiselectable="true">
            {filtered.length === 0 && <li className="select-empty">No results</li>}
            {filtered.map((option) => {
              const isSelected = selectedSet.has(option.value);
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleToggleOption(option.value)}
                  className={`select-option${isSelected ? ' select-option-selected' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                        isSelected
                          ? 'bg-brand-primary border-brand-primary text-white'
                          : 'border-glass-border'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5" />}
                    </span>
                    {option.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
