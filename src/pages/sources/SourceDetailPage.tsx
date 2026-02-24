import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, MessageSquare, Quote, ArrowLeft, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useParams, useNavigate } from 'react-router-dom';

export function SourceDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [source, setSource] = useState<{ id: string, name: string | null, domain: string } | null>(null);
  const [references, setReferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    let mounted = true;
    
    const loadData = async () => {
      try {
        setLoading(true);

        // Fetch source detail
        const { data: sourceData, error: sourceErr } = await supabase
          .from('sources')
          .select('id, name, domain')
          .eq('id', id)
          .single();

        if (sourceErr) throw sourceErr;
        if (mounted) setSource(sourceData);

        // Fetch references
        const { data, error: fetchErr } = await supabase
          .from('prompt_answer_sources')
          .select(`
            *,
            prompt:prompts(text),
            answer:prompt_answers(platform_slug, model_id)
          `)
          .eq('source_id', id)
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
  }, [id, t]);

  return (
    <div className="stagger-enter space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/dashboard/sources')}
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-brand-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back', { defaultValue: 'Back to sources' })}
        </button>
        
        {loading ? (
          <div className="skeleton h-8 w-64 mb-2" />
        ) : (
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-brand-primary/10 text-brand-primary shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                {source?.domain || 'Unknown Source'}
              </h1>
              {source?.name && (
                <p className="text-sm text-text-secondary mt-1">
                  {source.name}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="dashboard-card p-4 md:p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          {t('sources.detailTitle', { defaultValue: 'References' })} ({references.length})
        </h2>
        
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
                      {ref.answer?.model_id && <span>• {ref.answer.model_id}</span>}
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
                    {t('sources.openUrl', { defaultValue: 'Open URL' })}
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
  );
}
