import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Globe, ChevronDown, ChevronUp, MessageSquare, ExternalLink, Quote } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Source } from '@/types';
import { SourceDetailModal } from './SourceDetailModal';

type SourceWithReferences = Source & {
  prompt_answer_sources: any[];
};

export function SourcesPage() {
  const { t } = useTranslation();

  const [sources, setSources] = useState<SourceWithReferences[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error: fetchErr } = await supabase
        .from('sources')
        .select(`
          *,
          prompt_answer_sources(
            id, url, title, annotation, created_at,
            prompt:prompts(text),
            answer:prompt_answers(platform_slug, model_id)
          )
        `)
        .order('domain', { ascending: true });
        
      if (fetchErr) throw fetchErr;
      
      setSources(data || []);
    } catch (err: any) {
      console.error(err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const filteredSources = sources.filter(
    (s) =>
      s.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="stagger-enter space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">
            {t('sources.title')}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {t('sources.description')}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder={t('common.search') + '...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
      </div>

      {/* States */}
      {error && (
        <div className="p-3 rounded-xs bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="dashboard-card p-4">
              <div className="skeleton h-5 w-48 mb-2" />
              <div className="skeleton h-4 w-32" />
            </div>
          ))}
        </div>
      ) : filteredSources.length === 0 ? (
        <div className="dashboard-card p-12 text-center">
          <Globe className="w-12 h-12 text-brand-primary/20 mx-auto mb-3" />
          <p className="text-text-muted text-sm">{searchTerm ? t('common.noResults') : t('common.noResults')}</p>
        </div>
      ) : (
        <div className="flex flex-col space-y-3">
          {filteredSources.map((source) => {
            const isExpanded = expandedSources.has(source.id);
            const references = source.prompt_answer_sources || [];
            // sort references by newest first inside JS
            const sortedRefs = [...references].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            
            return (
              <div key={source.id} className="dashboard-card overflow-hidden">
                {/* Main line */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-glass-hover transition-colors"
                  onClick={() => toggleExpand(source.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-brand-primary/10 text-brand-primary shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-text-primary" title={source.domain}>
                        {source.domain}
                      </h3>
                      {source.name && (
                        <p className="text-xs text-text-muted mt-0.5 line-clamp-1" title={source.name}>
                          {source.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-text-muted">
                    <span>{references.length} {t('sources.detailTitle', { defaultValue: 'References' })}</span>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
                
                {/* Expanded content */}
                {isExpanded && references.length > 0 && (
                  <div className="border-t border-glass-border bg-bg-secondary/30 p-4">
                    <div className="space-y-3">
                      {sortedRefs.slice(0, 3).map((ref) => (
                        <div key={ref.id} className="p-3 rounded-md bg-bg-primary border border-glass-border shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
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
                              onClick={e => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                              {t('sources.openUrl', { defaultValue: 'Open URL' })}
                            </a>
                          </div>
                          {ref.title && (
                            <div className="text-xs font-medium text-text-secondary line-clamp-1 mb-1.5">
                              {ref.title}
                            </div>
                          )}
                          {ref.annotation && (
                            <div className="mt-2 p-2 rounded-sm bg-bg-tertiary/50 border-l-2 border-brand-accent flex gap-2 text-xs">
                              <Quote className="w-3 h-3 text-brand-accent/60 shrink-0 mt-0.5" />
                              <p className="text-text-primary font-serif italic line-clamp-2">
                                "{ref.annotation}"...
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {references.length > 0 && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSourceId(source.id);
                          }}
                          className="text-sm font-medium text-brand-primary hover:text-brand-secondary transition-colors"
                        >
                          {t('common.viewAll', { defaultValue: 'View all' })} ({references.length}) →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedSourceId && (
        <SourceDetailModal
          isOpen={true}
          onClose={() => setSelectedSourceId(null)}
          sourceId={selectedSourceId}
          sourceDomain={sources.find(s => s.id === selectedSourceId)?.domain || ''}
        />
      )}
    </div>
  );
}
