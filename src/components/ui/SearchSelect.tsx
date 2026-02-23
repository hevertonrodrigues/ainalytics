import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Minimum options to show the search input (default: 5) */
  searchThreshold?: number;
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  disabled = false,
  id,
  className = '',
  searchThreshold = 0,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

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

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
      setQuery('');
    },
    [onChange],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
      if (e.key === 'Enter' && filtered.length === 1) {
        handleSelect(filtered[0]!.value);
      }
    },
    [filtered, handleSelect],
  );

  return (
    <div
      ref={containerRef}
      className={`select-container ${className}`}
      id={id}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`select-trigger${open ? ' select-trigger-open' : ''}${disabled ? ' select-trigger-disabled' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? 'text-text-primary' : 'text-text-muted'}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={`select-chevron${open ? ' select-chevron-open' : ''}`} />
      </button>

      {/* Dropdown */}
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
          <ul className="select-options" role="listbox">
            {filtered.length === 0 && (
              <li className="select-empty">No results</li>
            )}
            {filtered.map((option) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.value)}
                  className={`select-option${isSelected ? ' select-option-selected' : ''}`}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-brand-secondary" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
