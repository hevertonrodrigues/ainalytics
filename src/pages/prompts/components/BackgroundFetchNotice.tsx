import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import type { Profile } from '@/types';

interface BackgroundFetchNoticeProps {
  profile: Profile | null;
  answersCount: number;
}

export function BackgroundFetchNotice({ profile, answersCount }: BackgroundFetchNoticeProps) {
  const { t } = useTranslation();

  if (profile?.is_sa || answersCount > 0) return null;

  return (
    <div className="dashboard-card p-4 flex items-start gap-3 border-l-4" style={{ borderLeftColor: 'var(--brand-primary)' }}>
      <Clock className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--brand-primary)' }} />
      <p className="text-sm text-text-secondary">
        {t('promptDetail.backgroundFetchNotice', 'AI results for this prompt are fetched in the background. New responses will appear here after the next scheduled update batch.')}
      </p>
    </div>
  );
}
