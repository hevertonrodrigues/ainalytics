import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, AlertCircle, Info, CheckCircle, HelpCircle } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';

/**
 * Imperative, promise-based replacement for `window.confirm` / `window.alert`.
 *
 *   const { confirm, alert } = useDialog();
 *   if (!(await confirm({ message: 'Delete?' }))) return;
 *   await alert({ message: 'Saved', variant: 'success' });
 *
 * Uses the project's design system (dashboard-card + Tailwind tokens) so it
 * matches the rest of the UI instead of the native, OS-styled prompt.
 */

// ── Types ───────────────────────────────────────────────────

type ConfirmVariant = 'danger' | 'warning' | 'primary';
type AlertVariant   = 'info' | 'error' | 'success' | 'warning';

interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface AlertOptions {
  message: string;
  title?: string;
  okLabel?: string;
  variant?: AlertVariant;
}

interface DialogContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert:   (opts: AlertOptions)   => Promise<void>;
}

interface ConfirmState extends ConfirmOptions {
  kind: 'confirm';
  resolve: (v: boolean) => void;
}

interface AlertState extends AlertOptions {
  kind: 'alert';
  resolve: () => void;
}

type DialogState = ConfirmState | AlertState;

// ── Context ─────────────────────────────────────────────────

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}

// ── Provider ────────────────────────────────────────────────

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ kind: 'confirm', ...opts, resolve });
    });
  }, []);

  const alert = useCallback((opts: AlertOptions) => {
    return new Promise<void>((resolve) => {
      setDialog({ kind: 'alert', ...opts, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!dialog) return;
    if (dialog.kind === 'confirm') dialog.resolve(true);
    else dialog.resolve();
    setDialog(null);
  }, [dialog]);

  const handleCancel = useCallback(() => {
    if (!dialog) return;
    if (dialog.kind === 'confirm') dialog.resolve(false);
    else dialog.resolve();
    setDialog(null);
  }, [dialog]);

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {dialog && (
        <DialogModal
          dialog={dialog}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </DialogContext.Provider>
  );
}

// ── Modal ───────────────────────────────────────────────────

function DialogModal({
  dialog, onConfirm, onCancel,
}: {
  dialog: DialogState;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  useScrollLock(true);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Esc closes (cancel for confirm, dismiss for alert) / Enter confirms.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      else if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    }
    document.addEventListener('keydown', onKey);
    confirmBtnRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  const variantClass =
    dialog.kind === 'confirm'
      ? CONFIRM_VARIANT[dialog.variant ?? 'danger']
      : ALERT_VARIANT[dialog.variant ?? 'info'];

  const Icon = variantClass.icon;
  const isConfirm = dialog.kind === 'confirm';

  const confirmLabel = isConfirm
    ? (dialog.confirmLabel ?? t('common.confirm'))
    : (dialog.okLabel ?? t('common.gotIt'));

  const cancelLabel = isConfirm
    ? (dialog.cancelLabel ?? t('common.cancel'))
    : null;

  const confirmBtnClass = isConfirm
    ? variantClass.button
    : ALERT_VARIANT[dialog.variant ?? 'info'].button;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm dashboard-card p-6 space-y-5 animate-in fade-in zoom-in-95"
      >
        <div className="text-center space-y-3">
          <div className={`w-12 h-12 rounded-full ${variantClass.iconBg} flex items-center justify-center mx-auto`}>
            <Icon className={`w-6 h-6 ${variantClass.iconColor}`} />
          </div>
          {dialog.title && (
            <h2 className="text-base font-semibold text-text-primary">{dialog.title}</h2>
          )}
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {dialog.message}
          </p>
        </div>

        <div className="flex gap-3">
          {cancelLabel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-ghost btn-sm flex-1"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`btn btn-sm flex-1 border-0 text-white ${confirmBtnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Variant styling ─────────────────────────────────────────

const CONFIRM_VARIANT: Record<ConfirmVariant, {
  icon: typeof AlertTriangle;
  iconColor: string;
  iconBg: string;
  button: string;
}> = {
  danger: {
    icon: AlertTriangle,
    iconColor: 'text-error',
    iconBg: 'bg-error/10',
    button: 'bg-error hover:bg-error/90',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-warning',
    iconBg: 'bg-warning/10',
    button: 'bg-warning hover:bg-warning/90',
  },
  primary: {
    icon: HelpCircle,
    iconColor: 'text-brand-primary',
    iconBg: 'bg-brand-primary/10',
    button: 'bg-brand-primary hover:bg-brand-primary/90',
  },
};

const ALERT_VARIANT: Record<AlertVariant, {
  icon: typeof AlertCircle;
  iconColor: string;
  iconBg: string;
  button: string;
}> = {
  info: {
    icon: Info,
    iconColor: 'text-brand-primary',
    iconBg: 'bg-brand-primary/10',
    button: 'bg-brand-primary hover:bg-brand-primary/90',
  },
  error: {
    icon: AlertCircle,
    iconColor: 'text-error',
    iconBg: 'bg-error/10',
    button: 'bg-error hover:bg-error/90',
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-success',
    iconBg: 'bg-success/10',
    button: 'bg-success hover:bg-success/90',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-warning',
    iconBg: 'bg-warning/10',
    button: 'bg-warning hover:bg-warning/90',
  },
};
