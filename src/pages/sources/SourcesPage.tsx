import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Globe, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PageExplanation } from '@/components/PageExplanation';

import type { SourceWithReferences } from '@/types/dashboard';

export function SourcesPage() {
  const { t } = useTranslation();

  const [sources, setSources] = useState<SourceWithReferences[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
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
            prompt_id,
            prompt:prompts(id, text)
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

      <PageExplanation 
        message={t('sources.banner')} 
        pageName={t('nav.sources')}
      />

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
            
            // Get unique prompts from references
            const uniquePromptsMap = new Map<string, any>();
            references.forEach(ref => {
              if (ref.prompt_id && ref.prompt && !uniquePromptsMap.has(ref.prompt_id)) {
                uniquePromptsMap.set(ref.prompt_id, ref.prompt);
              }
            });
            const uniquePrompts = Array.from(uniquePromptsMap.values());
            
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
                {isExpanded && uniquePrompts.length > 0 && (
                  <div className="border-t border-glass-border bg-bg-secondary/30 p-4">
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                      {t('sources.promptsReferencing', { defaultValue: 'Prompts Referencing this Source' })}
                    </h4>
                    <div className="space-y-2">
                      {uniquePrompts.map((prompt: any, idx: number) => (
                        <div key={prompt.id || idx} className="p-3 rounded-md bg-bg-primary border border-glass-border shadow-sm flex items-center gap-3">
                          <MessageSquare className="w-4 h-4 text-brand-primary shrink-0" />
                          <span className="text-sm font-medium text-text-primary line-clamp-2">
                            {prompt.text || t('sources.prompt')}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    {references.length > 0 && (
                      <div className="mt-4 flex justify-end">
                        <Link
                          to={`/dashboard/sources/${source.id}`}
                          className="text-sm font-medium text-brand-primary hover:text-brand-secondary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('common.viewAll', { defaultValue: 'View all references' })} ({references.length}) →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
