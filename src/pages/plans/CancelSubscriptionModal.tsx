import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XCircle, MessageSquareText } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';

const CANCEL_REASONS = [
  'too_expensive',
  'not_useful',
  'missing_features',
  'switched_competitor',
  'temporary',
  'other',
] as const;

type CancelReason = typeof CANCEL_REASONS[number];

interface CancelSubscriptionModalProps {
  onClose: () => void;
  onConfirm: (reason: string, feedback?: string) => Promise<void>;
  canceling: boolean;
}

export function CancelSubscriptionModal({ onClose, onConfirm, canceling }: CancelSubscriptionModalProps) {
  const [step, setStep] = useState<'persuade' | 'survey'>('persuade');
  const [reason, setReason] = useState<CancelReason | ''>('');
  const [feedback, setFeedback] = useState('');

  useScrollLock(true);

  const handleConfirm = () => {
    if (reason) onConfirm(reason, feedback.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md dashboard-card p-6 space-y-5 animate-in fade-in zoom-in-95">

        {step === 'persuade' ? (
          <PersuadeStep
            onKeep={onClose}
            onProceed={() => setStep('survey')}
          />
        ) : (
          <SurveyStep
            reason={reason}
            feedback={feedback}
            canceling={canceling}
            onReasonChange={setReason}
            onFeedbackChange={setFeedback}
            onKeep={onClose}
            onConfirm={handleConfirm}
          />
        )}

      </div>
    </div>
  );
}

// ─── Persuasion Step ────────────────────────────────────────

interface PersuadeStepProps {
  onKeep: () => void;
  onProceed: () => void;
}

function PersuadeStep({ onKeep, onProceed }: PersuadeStepProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
          <XCircle className="w-6 h-6 text-warning" />
        </div>
        <h2 className="text-base font-semibold text-text-primary">{t('plans.cancelTitle')}</h2>
      </div>

      <p className="text-sm text-text-secondary text-center">{t('plans.cancelConfirm')}</p>

      <div className="rounded-lg bg-warning/5 border border-warning/15 p-3 space-y-1.5">
        <p className="text-xs font-medium text-warning">{t('plans.cancelLoseTitle')}</p>
        <ul className="text-xs text-text-secondary space-y-1 list-disc list-inside">
          <li>{t('plans.cancelLose1')}</li>
          <li>{t('plans.cancelLose2')}</li>
          <li>{t('plans.cancelLose3')}</li>
        </ul>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <button onClick={onKeep} className="btn btn-primary btn-sm w-full">
          {t('plans.keepPlan')}
        </button>
        <button
          onClick={onProceed}
          className="btn btn-ghost btn-sm w-full text-text-muted hover:text-error"
        >
          {t('plans.cancelAnyway')}
        </button>
      </div>
    </>
  );
}

// ─── CSAT Survey Step ───────────────────────────────────────

interface SurveyStepProps {
  reason: CancelReason | '';
  feedback: string;
  canceling: boolean;
  onReasonChange: (r: CancelReason) => void;
  onFeedbackChange: (f: string) => void;
  onKeep: () => void;
  onConfirm: () => void;
}

function SurveyStep({
  reason,
  feedback,
  canceling,
  onReasonChange,
  onFeedbackChange,
  onKeep,
  onConfirm,
}: SurveyStepProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto">
          <MessageSquareText className="w-6 h-6 text-brand-primary" />
        </div>
        <h2 className="text-base font-semibold text-text-primary">{t('plans.csatTitle')}</h2>
        <p className="text-xs text-text-muted">{t('plans.csatSubtitle')}</p>
      </div>

      {/* Reason radio options */}
      <div className="space-y-2">
        {CANCEL_REASONS.map((r) => (
          <label
            key={r}
            className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
              reason === r
                ? 'border-brand-primary bg-brand-primary/5'
                : 'border-glass-border hover:border-text-muted'
            }`}
          >
            <input
              type="radio"
              name="cancel-reason"
              value={r}
              checked={reason === r}
              onChange={() => onReasonChange(r)}
              className="accent-brand-primary"
            />
            <span className="text-sm text-text-primary">{t(`plans.csatReasons.${r}`)}</span>
          </label>
        ))}
      </div>

      {/* Optional feedback */}
      <textarea
        value={feedback}
        onChange={(e) => onFeedbackChange(e.target.value)}
        placeholder={t('plans.csatPlaceholder')}
        rows={3}
        className="input-field text-sm resize-none"
      />

      <div className="flex flex-col gap-2 pt-1">
        <button onClick={onKeep} className="btn btn-primary btn-sm w-full">
          {t('plans.keepPlan')}
        </button>
        <button
          onClick={onConfirm}
          disabled={canceling || !reason}
          className="btn btn-ghost btn-sm w-full text-text-muted hover:text-error disabled:opacity-40"
        >
          {canceling ? t('common.loading') : t('plans.confirmCancel')}
        </button>
      </div>
    </>
  );
}
