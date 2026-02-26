import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, X, ExternalLink } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import type { TenantPlatformModel } from '@/types';
import { useScrollLock } from '@/hooks/useScrollLock';

interface ActiveModelsGuardProps {
  children: ReactNode;
}

export function ActiveModelsGuard({ children }: ActiveModelsGuardProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { currentTenant } = useTenant();

  const [hasActiveModels, setHasActiveModels] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Reset check when tenant changes
    if (!currentTenant) return;
    setHasActiveModels(null);
    setDismissed(false);

    let mounted = true;

    async function checkModels() {
      try {
        const res = await apiClient.get<TenantPlatformModel[]>('/platforms/preferences');
        if (!mounted) return;
        const activeCount = res.data.filter((p) => p.is_active).length;
        setHasActiveModels(activeCount > 0);
      } catch (err) {
        console.error('Failed to check active models:', err);
        // Fail open so we don't accidentally block users due to API errors
        if (mounted) setHasActiveModels(true);
      }
    }

    checkModels();

    return () => {
      mounted = false;
    };
  }, [currentTenant?.id]);

  // Still loading the check
  if (hasActiveModels === null) {
    return <>{children}</>;
  }

  const showModal = !hasActiveModels && !dismissed;

  if (showModal) {
    return (
      <div className="relative">
        {/* Render the children blurred in the background */}
        <div className="blur-sm pointer-events-none select-none opacity-50 relative z-0">
          {children}
        </div>

        {/* Modal Overlay */}
        <GuardModal
          onDismiss={() => setDismissed(true)}
          isSa={!!profile?.is_sa}
          onConfigure={() => navigate('/dashboard/models')}
        />
      </div>
    );
  }

  // Check passed or was dismissed
  return <>{children}</>;
}

function GuardModal({ onDismiss, isSa, onConfigure }: { onDismiss: () => void, isSa: boolean, onConfigure: () => void }) {
  const { t } = useTranslation();
  useScrollLock();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-bg-secondary w-full max-w-md rounded-lg shadow-2xl border border-glass-border overflow-hidden animate-slide-up">
        
        <div className="flex items-start justify-between p-5 border-b border-glass-border/50">
          <div className="flex items-center gap-3 text-brand-secondary">
            <div className="p-2 bg-brand-secondary/10 rounded-full">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-text-primary">
              {t('models.guardTitle', 'No Active Models')}
            </h2>
          </div>
          
          {/* Only SuperAdmins can dismiss the modal to see the empty state */}
          {isSa && (
            <button
              onClick={onDismiss}
              className="icon-btn"
              title={t('common.close', 'Close')}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          <p className="text-text-secondary text-sm leading-relaxed">
            {t(
              'models.guardMessage',
              'In order to generate prompts or topics, you must select and activate at least one AI Model for this tenant. Please configure your models to continue.'
            )}
          </p>
        </div>

        <div className="p-5 bg-bg-tertiary border-t border-glass-border/50 flex justify-end">
          <button
            onClick={onConfigure}
            className="btn btn-primary w-full sm:w-auto"
          >
            {t('models.guardAction', 'Configure Models')}
            <ExternalLink className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}
