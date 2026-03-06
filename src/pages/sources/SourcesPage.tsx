import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Globe, ChevronDown, ChevronUp, MessageSquare, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { PageExplanation } from '@/components/PageExplanation';

interface SourceSummary {
  id: string;
  tenant_id: string;
  domain: string;
  total: number;
  percent: number;
  total_by_prompt: Array<{ prompt_id: string; prompt_text: string; count: number; percent: number }>;
  total_by_answer: Array<{ answer_id: string; count: number }>;
  total_by_platform: Array<{ platform_id: string; platform_name: string; platform_slug: string; count: number; percent: number }>;
  total_by_model: Array<{ model_id: string; model_name: string; model_slug: string; count: number }>;
}

export function SourcesPage() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const companyDomain = currentTenant?.main_domain?.toLowerCase() || '';

  const [sources, setSources] = useState<SourceSummary[]>([]);
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
      
      const { data, error: fetchErr } = await supabase.functions.invoke('sources-summary', {
        method: 'GET',
        headers: {
          'x-tenant-id': localStorage.getItem('current_tenant_id') || '',
        },
      });
        
      if (fetchErr) throw fetchErr;
      
      // Edge function returns { success: true, data: [...] } with pre-computed percentages
      const items: SourceSummary[] = data?.data || [];
      
      // Sort by total count descending
      items.sort((a, b) => b.total - a.total);
      
      setSources(items);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const filteredSources = useMemo(() => {
    const filtered = sources.filter(
      (s) => s.domain.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Separate own source (matching company domain) from others
    const ownIdx = filtered.findIndex(
      (s) => companyDomain && s.domain.toLowerCase() === companyDomain
    );
    if (ownIdx > 0) {
      const own = filtered.splice(ownIdx, 1)[0] as SourceSummary;
      filtered.unshift(own);
    }

    return filtered;
  }, [sources, searchTerm, companyDomain]);


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

      <PageExplanation message={t('sources.banner')} />

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
            const isOwnSource = companyDomain && source.domain.toLowerCase() === companyDomain;
            
            return (
              <div key={source.id} className={`dashboard-card overflow-hidden ${
                isOwnSource ? 'ring-2 ring-brand-primary/30 shadow-lg shadow-brand-primary/5' : ''
              }`}>
                {/* Main line */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-glass-hover transition-colors"
                  onClick={() => toggleExpand(source.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full shrink-0 ${
                      isOwnSource
                        ? 'bg-gradient-to-br from-brand-primary to-brand-accent text-white'
                        : 'bg-brand-primary/10 text-brand-primary'
                    }`}>
                      {isOwnSource ? <Building2 className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-text-primary" title={source.domain}>
                        {source.domain}
                      </h3>
                      {isOwnSource && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary">
                          {t('sources.yourDomain', { defaultValue: 'Your Domain' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-text-muted">
                    <span>{source.percent < 0.01 && source.percent > 0 ? '<0.01' : source.percent.toFixed(2)}% {t('sources.detailTitle', { defaultValue: 'References' })}</span>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
                
                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-glass-border bg-bg-secondary/30 p-4">
                    {/* Platform counts */}
                    {source.total_by_platform?.length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-4">
                        {source.total_by_platform.map((p) => (
                            <div key={p.platform_id} className="flex-1 min-w-[120px] p-3 rounded-md bg-bg-primary border border-glass-border">
                              <div className="text-xs text-text-muted mb-1">{p.platform_name}</div>
                              <div className="text-lg font-bold text-text-primary">{p.percent < 0.01 && p.percent > 0 ? '<0.01' : p.percent.toFixed(2)}%</div>
                            </div>
                        ))}
                      </div>
                    )}

                    {/* Prompts list */}
                    {source.total_by_prompt?.length > 0 && (
                      <>
                        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                          {t('sources.promptsReferencing', { defaultValue: 'Prompts Referencing this Source' })}
                        </h4>
                        <div className="space-y-2">
                          {source.total_by_prompt.map((p, idx) => (
                              <div key={p.prompt_id || idx} className="p-3 rounded-md bg-bg-primary border border-glass-border shadow-sm flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <MessageSquare className="w-4 h-4 text-brand-primary shrink-0" />
                                  <span className="text-sm font-medium text-text-primary truncate">
                                    {p.prompt_text}
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-text-muted shrink-0">
                                  {p.percent < 0.01 && p.percent > 0 ? '<0.01' : p.percent.toFixed(2)}%
                                </span>
                              </div>
                          ))}
                        </div>
                      </>
                    )}

                    {source.total > 0 && (
                      <div className="mt-4 flex justify-end">
                        <Link
                          to={`/dashboard/sources/${source.id}`}
                          className="text-sm font-medium text-brand-primary hover:text-brand-secondary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('common.viewAll', { defaultValue: 'View all references' })} ({source.total}) →
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
