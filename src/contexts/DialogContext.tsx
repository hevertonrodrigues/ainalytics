import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, AlertCircle, Info, CheckCircle, HelpCircle } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';

/**
 * Imperative, promise-based replacement for `window.confirm`, `window.alert`
 * and `window.prompt`.
 *
 *   const { confirm, alert, prompt } = useDialog();
 *   if (!(await confirm({ message: 'Delete?' }))) return;
 *   await alert({ message: 'Saved', variant: 'success' });
 *   const url = await prompt({ message: 'URL:', defaultValue: 'https://' });
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

interface PromptOptions {
  message: string;
  title?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: 'text' | 'url' | 'email' | 'number';
}

interface DialogContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert:   (opts: AlertOptions)   => Promise<void>;
  prompt:  (opts: PromptOptions)  => Promise<string | null>;
}

interface ConfirmState extends ConfirmOptions {
  kind: 'confirm';
  resolve: (v: boolean) => void;
}

interface AlertState extends AlertOptions {
  kind: 'alert';
  resolve: () => void;
}

interface PromptState extends PromptOptions {
  kind: 'prompt';
  resolve: (v: string | null) => void;
}

type DialogState = ConfirmState | AlertState | PromptState;

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

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setDialog({ kind: 'prompt', ...opts, resolve });
    });
  }, []);

  const handleConfirm = useCallback((value?: string) => {
    if (!dialog) return;
    if (dialog.kind === 'confirm') dialog.resolve(true);
    else if (dialog.kind === 'prompt') dialog.resolve(value ?? '');
    else dialog.resolve();
    setDialog(null);
  }, [dialog]);

  const handleCancel = useCallback(() => {
    if (!dialog) return;
    if (dialog.kind === 'confirm') dialog.resolve(false);
    else if (dialog.kind === 'prompt') dialog.resolve(null);
    else dialog.resolve();
    setDialog(null);
  }, [dialog]);

  const value = useMemo(() => ({ confirm, alert, prompt }), [confirm, alert, prompt]);

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
  onConfirm: (value?: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  useScrollLock(true);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(
    dialog.kind === 'prompt' ? (dialog.defaultValue ?? '') : '',
  );

  const submit = useCallback(() => {
    if (dialog.kind === 'prompt') onConfirm(inputValue);
    else onConfirm();
  }, [dialog.kind, inputValue, onConfirm]);

  // Esc closes / Enter confirms (Enter inside input also confirms).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      else if (e.key === 'Enter' && dialog.kind !== 'prompt') {
        e.preventDefault();
        submit();
      }
    }
    document.addEventListener('keydown', onKey);
    if (dialog.kind === 'prompt') {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      confirmBtnRef.current?.focus();
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, submit, dialog.kind]);

  const variantClass =
    dialog.kind === 'confirm'
      ? CONFIRM_VARIANT[dialog.variant ?? 'danger']
      : dialog.kind === 'alert'
        ? ALERT_VARIANT[dialog.variant ?? 'info']
        : CONFIRM_VARIANT.primary;

  const Icon = variantClass.icon;

  const confirmLabel =
    dialog.kind === 'confirm' ? (dialog.confirmLabel ?? t('common.confirm'))
    : dialog.kind === 'prompt' ? (dialog.confirmLabel ?? t('common.confirm'))
    : (dialog.okLabel ?? t('common.gotIt'));

  const cancelLabel =
    dialog.kind === 'alert' ? null
    : (dialog.cancelLabel ?? t('common.cancel'));

  const confirmBtnClass = variantClass.button;

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

        {dialog.kind === 'prompt' && (
          <input
            ref={inputRef}
            type={dialog.inputType ?? 'text'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submit(); }
            }}
            placeholder={dialog.placeholder}
            className="input w-full text-sm"
          />
        )}

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
            onClick={submit}
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
