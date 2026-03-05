import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, X } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';

interface ActivationCodeModalProps {
  selecting: string | null;
  onClose: () => void;
  onActivate: () => Promise<void>;
  activationCode: string;
  setActivationCode: (val: string) => void;
  codeError: string;
}

export function ActivationCodeModal({
  selecting,
  onClose,
  onActivate,
  activationCode,
  setActivationCode,
  codeError,
}: ActivationCodeModalProps) {
  const { t } = useTranslation();
  const codeInputRef = useRef<HTMLInputElement>(null);
  useScrollLock(true);

  useEffect(() => {
    setTimeout(() => codeInputRef.current?.focus(), 100);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm dashboard-card p-6 space-y-4 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-brand-primary" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary">{t('plans.activationTitle')}</h2>
          </div>
          <button onClick={onClose} type="button" className="icon-btn">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-text-muted">{t('plans.activationDesc')}</p>

        {/* Error */}
        {codeError && (
          <div className="p-2 rounded-xs bg-error/10 border border-error/20 text-error text-xs">
            {codeError}
          </div>
        )}

        {/* Code input */}
        <form onSubmit={(e) => { e.preventDefault(); onActivate(); }}>
          <input
            ref={codeInputRef}
            type="text"
            value={activationCode}
            onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
            placeholder={t('plans.activationPlaceholder')}
            maxLength={12}
            className="input-field text-center font-mono tracking-widest text-lg uppercase"
            autoFocus
          />

          <div className="flex items-center gap-2 mt-4">
            <button
              type="submit"
              disabled={!!selecting || activationCode.trim().length !== 12}
              className="btn btn-primary btn-sm flex-1"
            >
              {selecting ? t('common.loading') : t('plans.activate')}
            </button>
            <button onClick={onClose} type="button" className="btn btn-ghost btn-sm">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
