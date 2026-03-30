import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowUpCircle, X, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionLimits {
  max_prompts: number | null;
  max_models: number | null;
  current_prompts: number;
  current_models: number;
  is_over_prompts: boolean;
  is_over_models: boolean;
}

/**
 * Persistent toast that appears when the user is over their subscription limits.
 * Shows on every page within the dashboard layout — cannot be dismissed.
 * Fetches limits once on mount from the dashboard-overview endpoint.
 */
export function OverLimitToast() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    // Don't show for SuperAdmin users
    if (profile?.is_sa) return;

    apiClient
      .get<{ subscription_limits?: SubscriptionLimits }>('/dashboard-overview')
      .then((res) => {
        if (res.data.subscription_limits) {
          setLimits(res.data.subscription_limits);
        }
      })
      .catch(() => {
        /* ignore — don't block the UI for a limit check */
      });
  }, [profile?.is_sa]);

  // Only render when there's an actual overuse
  if (!limits) return null;
  const isOverPrompts = limits.is_over_prompts;
  const isOverModels = limits.is_over_models;
  if (!isOverPrompts && !isOverModels) return null;

  const promptsOver = isOverPrompts
    ? limits.current_prompts - (limits.max_prompts ?? 0)
    : 0;
  const modelsOver = isOverModels
    ? limits.current_models - (limits.max_models ?? 0)
    : 0;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="overlimit-toast-minimized"
        title={t('limits.overLimitTitle')}
      >
        <div className="overlimit-toast-minimized-pulse" />
        <Flame className="w-4 h-4" />
        <span className="overlimit-toast-minimized-count">
          {promptsOver + modelsOver}
        </span>
      </button>
    );
  }

  return (
    <div className="overlimit-toast" role="alert">
      {/* Animated gradient border effect */}
      <div className="overlimit-toast-glow" />

      <div className="overlimit-toast-inner">
        {/* Header row */}
        <div className="overlimit-toast-header">
          <div className="overlimit-toast-icon-wrap">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <h4 className="overlimit-toast-title">
            {t('limits.overLimitTitle')}
          </h4>
          <button
            onClick={() => setMinimized(true)}
            className="overlimit-toast-minimize"
            aria-label="Minimize"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Over-limit details */}
        <div className="overlimit-toast-details">
          {isOverPrompts && (
            <div className="overlimit-toast-item">
              <span className="overlimit-toast-item-label">
                {t('limits.toastPrompts')}
              </span>
              <span className="overlimit-toast-item-value">
                {limits.current_prompts}
                <span className="overlimit-toast-item-sep">/</span>
                {limits.max_prompts}
                <span className="overlimit-toast-item-over">
                  (+{promptsOver})
                </span>
              </span>
            </div>
          )}
          {isOverModels && (
            <div className="overlimit-toast-item">
              <span className="overlimit-toast-item-label">
                {t('limits.toastModels')}
              </span>
              <span className="overlimit-toast-item-value">
                {limits.current_models}
                <span className="overlimit-toast-item-sep">/</span>
                {limits.max_models}
                <span className="overlimit-toast-item-over">
                  (+{modelsOver})
                </span>
              </span>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/dashboard/plans')}
          className="overlimit-toast-cta"
        >
          <ArrowUpCircle className="w-3.5 h-3.5" />
          {t('limits.upgradePlan')}
        </button>
      </div>
    </div>
  );
}
