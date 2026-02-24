import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ExternalLink, MessageSquare, Quote } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SourceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceId: string;
  sourceDomain: string;
}

export function SourceDetailModal({ isOpen, onClose, sourceId, sourceDomain }: SourceDetailModalProps) {
  const { t } = useTranslation();
  
  const [references, setReferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !sourceId) return;

    let mounted = true;
    
    const loadData = async () => {
      try {
        setLoading(true);
        // We join to prompts to get the name/text, and prompt_answers to get platform
        const { data, error: fetchErr } = await supabase
          .from('prompt_answer_sources')
          .select(`
            *,
            prompt:prompts(text),
            answer:prompt_answers(platform_slug, model)
          `)
          .eq('source_id', sourceId)
          .order('created_at', { ascending: false });

        if (fetchErr) throw fetchErr;
        
        if (mounted) {
          setReferences(data || []);
        }
      } catch (err: any) {
        console.error(err);
        if (mounted) setError(t('common.error'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [isOpen, sourceId, t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className="bg-bg-primary border border-glass-border shadow-2xl rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-glass-border bg-bg-secondary/50">
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {sourceDomain}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {t('sources.detailTitle')} ({references.length})
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-md font-medium text-text-muted hover:text-text-primary hover:bg-glass-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {error ? (
            <div className="p-4 rounded-xs bg-error/10 border border-error/20 text-error text-center">
              {error}
            </div>
          ) : loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton h-24 w-full rounded-md" />
              ))}
            </div>
          ) : references.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-text-muted">{t('common.noResults')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {references.map((ref) => (
                <div key={ref.id} className="p-4 rounded-md border border-glass-border bg-bg-secondary/20">
                  {/* Context Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-3.5 h-3.5 text-brand-primary" />
                        <span className="text-sm font-medium text-text-primary truncate">
                          {ref.prompt?.text || t('sources.prompt')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span className="px-1.5 py-0.5 rounded-sm bg-bg-tertiary">
                          {ref.answer?.platform_slug || 'AI'} 
                        </span>
                        {ref.answer?.model && <span>• {ref.answer.model}</span>}
                        <span>• {new Date(ref.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <a 
                      href={ref.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-brand-primary hover:underline whitespace-nowrap bg-brand-primary/10 px-2 py-1.5 rounded-sm"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {t('sources.openUrl')}
                    </a>
                  </div>
                  
                  {/* Page Title */}
                  {ref.title && (
                    <div className="text-sm font-medium text-text-secondary line-clamp-1 mb-2">
                      {ref.title}
                    </div>
                  )}

                  {/* Annotation if present */}
                  {ref.annotation && (
                    <div className="mt-3 p-3 rounded-sm bg-bg-tertiary/50 border-l-2 border-brand-accent flex gap-3 text-sm">
                      <Quote className="w-4 h-4 text-brand-accent/60 shrink-0 mt-0.5" />
                      <p className="text-text-primary font-serif italic text-sm/relaxed">
                        "{ref.annotation}"...
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
