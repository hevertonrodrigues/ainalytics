import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronRight, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Source } from '@/types';
import { SourceDetailModal } from './SourceDetailModal';

export function SourcesPage() {
  const { t } = useTranslation();

  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error: fetchErr } = await supabase
        .from('sources')
        .select('*')
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSources.map((source) => (
            <button
              key={source.id}
              onClick={() => setSelectedSourceId(source.id)}
              className="dashboard-card p-5 flex flex-col items-start text-left hover:border-brand-primary/50 transition-colors group"
            >
              <div className="flex w-full items-start justify-between mb-3">
                <div className="p-2 rounded-full bg-brand-primary/10 text-brand-primary">
                  <Globe className="w-4 h-4" />
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              
              <h3 className="text-base font-semibold text-text-primary truncate w-full" title={source.domain}>
                {source.domain}
              </h3>
              
              {source.name && (
                <p className="text-xs text-text-muted truncate w-full mt-1 line-clamp-2" title={source.name}>
                  {source.name}
                </p>
              )}
            </button>
          ))}
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
