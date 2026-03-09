import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  variant?: 'danger' | 'warning';
}

export function ConfirmModal({
  message,
  onConfirm,
  onCancel,
  loading = false,
  variant = 'danger',
}: ConfirmModalProps) {
  const { t } = useTranslation();

  useScrollLock(true);

  const iconColor = variant === 'danger' ? 'text-error' : 'text-warning';
  const iconBg = variant === 'danger' ? 'bg-error/10' : 'bg-warning/10';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm dashboard-card p-6 space-y-5 animate-in fade-in zoom-in-95">
        {/* Icon + message */}
        <div className="text-center space-y-3">
          <div
            className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center mx-auto`}
          >
            <AlertTriangle className={`w-6 h-6 ${iconColor}`} />
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn btn-ghost btn-sm flex-1"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn btn-sm flex-1 bg-error hover:bg-error/90 text-white border-0 disabled:opacity-40"
          >
            {loading ? t('common.loading') : t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
