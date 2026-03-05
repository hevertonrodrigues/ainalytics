import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, XCircle } from 'lucide-react';

interface SubscriptionSettingsProps {
  disabled: boolean;
  onCancelClick: () => void;
}

export function SubscriptionSettings({ disabled, onCancelClick }: SubscriptionSettingsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-glass-hover transition-colors"
        aria-label={t('plans.subscriptionSettings')}
      >
        <Settings className={`w-4 h-4 ${disabled ? 'animate-spin' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-56 bg-bg-secondary border border-glass-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in slide-in-from-bottom-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCancelClick();
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-error hover:bg-error/10 transition-colors text-left"
          >
            <XCircle className="w-4 h-4" />
            {t('plans.cancelSubscription')}
          </button>
        </div>
      )}
    </div>
  );
}
