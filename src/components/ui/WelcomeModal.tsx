import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, List, BookOpen, FileText, Check, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

interface WelcomeModalProps {
  onClose: () => void;
}

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  const { t } = useTranslation();
  const { refreshAuth } = useAuth();
  const [closing, setClosing] = useState(false);

  const handleSkip = async () => {
    setClosing(true);
    try {
      await apiClient.put('/users-me', { has_seen_welcome_modal: true });
      await refreshAuth();
    } catch (err) {
      console.error('Failed to update welcome modal flag', err);
      setClosing(false);
    }
  };

  const features = [
    {
      icon: MessageSquare,
      title: t('welcomeModal.topicsTitle'),
      desc: t('welcomeModal.topicsDesc'),
      color: 'text-brand-primary',
      bg: 'bg-brand-primary/10',
    },
    {
      icon: List,
      title: t('welcomeModal.promptsTitle'),
      desc: t('welcomeModal.promptsDesc'),
      color: 'text-brand-accent',
      bg: 'bg-brand-accent/10',
    },
    {
      icon: BookOpen,
      title: t('welcomeModal.sourcesTitle'),
      desc: t('welcomeModal.sourcesDesc'),
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      icon: FileText,
      title: t('welcomeModal.llmTextTitle'),
      desc: t('welcomeModal.llmTextDesc'),
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-bg-primary/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass-card w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 relative border border-glass-border">
        
        {/* Close Button (X) */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-glass-hover text-text-muted hover:text-text-primary transition-colors z-20"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-glass-border text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/20 via-transparent to-transparent opacity-50 pointer-events-none" />
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">
            {t('welcomeModal.title')}
          </h2>
          <p className="text-text-secondary text-base sm:text-lg max-w-lg mx-auto">
            {t('welcomeModal.description')}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="flex gap-4 p-4 rounded-xl hover:bg-glass-hover transition-colors">
                  <div className={`shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${feature.bg} ${feature.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary mb-1">{feature.title}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 sm:p-8 border-t border-glass-border flex flex-col sm:flex-row items-center justify-end gap-4">
          <button
            onClick={handleSkip}
            disabled={closing}
            className="btn btn-primary w-full sm:w-auto px-8 py-2.5 text-base shadow-lg shadow-brand-primary/25 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              {closing ? t('common.loading') : t('welcomeModal.skipButton')}
              {!closing && <Check className="w-4 h-4 transition-transform group-hover:scale-110" />}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
