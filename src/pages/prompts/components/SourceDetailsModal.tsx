import { useTranslation } from 'react-i18next';
import { X, ExternalLink, Globe } from 'lucide-react';
import { PromptSource } from '@/types/dashboard';
import { useScrollLock } from '@/hooks/useScrollLock';

interface SourceDetailsModalProps {
  source: PromptSource;
  onClose: () => void;
}

export function SourceDetailsModal({ source, onClose }: SourceDetailsModalProps) {
  const { t } = useTranslation();
  useScrollLock(!!source);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-bg-primary border border-glass-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-glass-border bg-bg-tertiary/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary capitalize">
                {source.domain}
              </h3>
              {source.name && (
                <p className="text-sm text-text-muted">{source.name}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-glass-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">
              {t('promptDetail.referencedUrls', 'Referenced URLs')} ({source.references.length})
            </p>
            <div className="grid gap-2">
              {source.references.map((ref, idx) => (
                <a
                  key={ref.url + idx}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-lg border border-glass-border hover:border-brand-primary/30 hover:bg-brand-primary/5 group transition-all"
                >
                  <div className="mt-1 p-1 rounded bg-bg-tertiary text-text-muted group-hover:text-brand-primary transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-text-primary group-hover:text-brand-primary transition-colors truncate">
                      {ref.title || ref.url}
                    </div>
                    {ref.title && (
                      <div className="text-xs text-text-muted truncate mt-0.5">
                        {ref.url}
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-glass-border bg-bg-tertiary/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-text-primary bg-glass-card border border-glass-border rounded-lg hover:bg-glass-hover transition-colors"
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
      
      {/* Backdrop click to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
