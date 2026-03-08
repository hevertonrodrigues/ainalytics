import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Bot,
  Target,
  BarChart3,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  Zap,
  Shield,
  ExternalLink,
  Microscope,
  ArrowUpRight,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { ScoreRing, ImprovementsAndRecommendations } from '@/components/geo';
import type { CompanyAiAnalysis, DeepAnalyzeTopic } from '@/types';

// ─── Metric config (used for metric score bars) ────────────
const METRIC_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  semantic: { label: 'Semantic', icon: Target, color: '#6c5ce7' },
  content: { label: 'Content', icon: FileText, color: '#fd79a8' },
  authority: { label: 'Authority', icon: Shield, color: '#00cec9' },
  technical: { label: 'Technical', icon: Zap, color: '#fdcb6e' },
  competitive_position: { label: 'Competitive Position', icon: BarChart3, color: '#a29bfe' },
};

// ─── Analyzing Overlay Phrases ──────────────────────────────
const OVERLAY_PHRASES = [
  'deepAnalyze.overlay.crawling',
  'deepAnalyze.overlay.reading',
  'deepAnalyze.overlay.evaluating',
  'deepAnalyze.overlay.scoring',
  'deepAnalyze.overlay.generating',
  'deepAnalyze.overlay.finalizing',
];

// ─── Main Component ─────────────────────────────────────────
export function DeepAnalyzePage() {
  const { t, i18n } = useTranslation();

  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyses, setAnalyses] = useState<CompanyAiAnalysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<CompanyAiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch analyses on mount ───────────────────────────────
  const fetchAnalyses = useCallback(async () => {
    try {
      const res = await apiClient.get<CompanyAiAnalysis[]>('/deep-analyze');
      const data = res.data || [];
      setAnalyses(data);
      if (data.length > 0 && !currentAnalysis) {
        setCurrentAnalysis(data[0] ?? null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [currentAnalysis]);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  // ─── Submit analysis (waits for full response) ─────────────
  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await apiClient.post<CompanyAiAnalysis>('/deep-analyze', {
        url: url.trim(),
        language: i18n.language,
      });
      setCurrentAnalysis(res.data);
      setAnalyses(prev => [res.data, ...prev]);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deepAnalyze.errorGeneric'));
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="stagger-enter space-y-6">
        <div className="dashboard-card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto" />
        </div>
      </div>
    );
  }

  const hasResult = currentAnalysis?.status === 'completed';

  return (
    <div className="stagger-enter space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Microscope className="w-5 h-5 text-brand-primary" />
          {t('deepAnalyze.title')}
        </h1>
        <p className="text-sm text-text-secondary mt-1">{t('deepAnalyze.subtitle')}</p>
      </div>

      {/* Input Card */}
      <div className="dashboard-card p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder={t('deepAnalyze.urlPlaceholder')}
              className="form-input pl-10"
              disabled={analyzing}
              id="deep-analyze-url-input"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !url.trim()}
            className="btn btn-primary px-6 py-2.5 font-semibold whitespace-nowrap"
            id="deep-analyze-submit-btn"
          >
            <Search className="w-4 h-4" />
            {t('deepAnalyze.analyze')}
          </button>
        </div>
        <p className="text-xs text-text-muted mt-2">{t('deepAnalyze.inputHint')}</p>
      </div>

      {/* Error State */}
      {error && (
        <div className="dashboard-card p-6 max-w-xl mx-auto text-center">
          <div className="w-12 h-12 rounded-xl bg-error/10 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6 text-error" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary mb-1">{t('deepAnalyze.errorTitle')}</h3>
          <p className="text-xs text-text-secondary">{error}</p>
        </div>
      )}

      {/* Results */}
      {hasResult && currentAnalysis && (
        <AnalysisResults analysis={currentAnalysis} />
      )}

      {/* History */}
      {analyses.length > 1 && (
        <div className="dashboard-card">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">{t('deepAnalyze.history')}</span>
              <span className="text-xs text-text-muted">({analyses.length})</span>
            </div>
            {showHistory ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
          </button>
          {showHistory && (
            <div className="px-4 pb-4 space-y-2">
              {analyses.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setCurrentAnalysis(a)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                    a.id === currentAnalysis?.id
                      ? 'border-brand-primary/40 bg-brand-primary/5'
                      : 'border-glass-border hover:border-glass-hover hover:bg-glass-hover'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {a.company_name || a.url}
                      </span>
                      <StatusBadge status={a.status} />
                    </div>
                    <span className="text-xs text-text-muted block truncate">{a.url}</span>
                  </div>
                  {a.final_score != null && (
                    <span className="text-lg font-bold text-text-primary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {a.final_score}
                    </span>
                  )}
                  <span className="text-xs text-text-muted whitespace-nowrap">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full-screen Analyzing Overlay (modal) */}
      <AnalyzingModal visible={analyzing} url={url} />
    </div>
  );
}

// ─── Analyzing Modal (full-screen overlay) ──────────────────
function AnalyzingModal({ visible, url }: { visible: boolean; url: string }) {
  const { t } = useTranslation();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const cleanDomain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`;

  useEffect(() => {
    if (!visible) {
      setPhraseIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % OVERLAY_PHRASES.length);
        setIsTransitioning(false);
      }, 400);
    }, 4000);

    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const currentPhrase = t(OVERLAY_PHRASES[phraseIndex]!);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-primary/95 backdrop-blur-md animate-in fade-in duration-300">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-primary/5 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-brand-accent/5 blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative flex flex-col items-center gap-6 px-6 max-w-lg text-center">
        {/* Favicon with pulsing ring */}
        <div className="relative">
          <div className="absolute inset-0 -m-3 rounded-full border-2 border-brand-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-0 -m-1.5 rounded-full border border-brand-primary/30 animate-pulse" />
          <div className="w-16 h-16 rounded-full bg-bg-secondary border-2 border-glass-border flex items-center justify-center shadow-lg shadow-brand-primary/10 overflow-hidden">
            <img
              src={faviconUrl}
              alt={cleanDomain}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-1">{t('deepAnalyze.processingTitle')}</h2>
          <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
            <Globe className="w-3.5 h-3.5" />
            <span>{cleanDomain}</span>
          </div>
        </div>

        {/* Rotating phrase */}
        <div className="min-h-[2.5rem] flex items-center justify-center">
          <p
            className={`text-lg font-semibold text-brand-primary transition-all duration-400 ${
              isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
            }`}
          >
            {currentPhrase}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {OVERLAY_PHRASES.map((_, idx) => (
            <div
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                idx === phraseIndex
                  ? 'bg-brand-primary w-6'
                  : idx < phraseIndex
                  ? 'bg-brand-primary/40'
                  : 'bg-glass-border'
              }`}
            />
          ))}
        </div>

        {/* Warning — do not leave */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl mt-2" style={{ background: 'rgba(253,203,110,0.08)', border: '1px solid rgba(253,203,110,0.20)' }}>
          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
          <p className="text-xs text-text-secondary text-left">
            {t('deepAnalyze.overlay.doNotLeave')}
          </p>
        </div>

        {/* Subtle sub-text */}
        <p className="text-xs text-text-muted animate-pulse">
          {t('deepAnalyze.overlay.wait')}
        </p>
      </div>
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    completed: { color: '#00cec9', bg: 'rgba(0,206,201,0.10)', label: 'Completed' },
    analyzing: { color: '#6c5ce7', bg: 'rgba(108,92,231,0.10)', label: 'Analyzing' },
    pending: { color: '#fdcb6e', bg: 'rgba(253,203,110,0.10)', label: 'Pending' },
    error: { color: '#ff6b6b', bg: 'rgba(255,107,107,0.10)', label: 'Error' },
  };
  const c = config[status] || config.pending;
  return (
    <span
      className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
      style={{ color: c?.color ?? '#999', background: c?.bg ?? 'transparent' }}
    >
      {c?.label ?? status}
    </span>
  );
}

// ─── Analysis Results ───────────────────────────────────────
function AnalysisResults({ analysis }: { analysis: CompanyAiAnalysis }) {
  const { t } = useTranslation();
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [showPages, setShowPages] = useState(false);

  const a = analysis;

  return (
    <div className="space-y-6">
      {/* Company Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">
            {a.company_name || a.url}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <Globe className="w-3.5 h-3.5 text-text-muted" />
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-primary hover:underline flex items-center gap-1"
            >
              {a.url}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <span className="text-xs font-medium text-success">{t('deepAnalyze.completed')}</span>
        </div>
      </div>

      {/* ── Scores + Metrics — same row ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 1/3: Three Score Rings in one card */}
        <div className="dashboard-card p-5 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <ScoreRing score={a.final_score || 0} size={90} label={t('deepAnalyze.finalScore')} />
              <p className="text-[9px] text-text-muted text-center mt-0.5">{t('deepAnalyze.finalScoreDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-5 w-full justify-center">
            <div className="flex flex-col items-center gap-1">
              <ScoreRing score={a.generic_score || 0} size={64} label={t('deepAnalyze.genericScore')} />
              <p className="text-[8px] text-text-muted text-center mt-0.5 max-w-[90px]">{t('deepAnalyze.genericScoreDesc')}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ScoreRing score={a.specific_score || 0} size={64} label={t('deepAnalyze.specificScore')} />
              <p className="text-[8px] text-text-muted text-center mt-0.5 max-w-[90px]">{t('deepAnalyze.specificScoreDesc')}</p>
            </div>
          </div>
          {/* Confidence */}
          {a.confidence != null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg w-full justify-center" style={{ background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.15)' }}>
              <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
              <span className="text-[10px] text-text-secondary">
                {t('deepAnalyze.confidenceLabel')}: <span className="font-bold text-text-primary">{a.confidence}%</span>
              </span>
            </div>
          )}
        </div>

        {/* 2/3: Metric Scores */}
        <div className="lg:col-span-2 dashboard-card p-5">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-brand-primary" />
            {t('deepAnalyze.metricScores')}
          </h3>
          <div className="space-y-3">
            {Object.entries(METRIC_CONFIG).map(([key, cfg]) => {
              const scoreKey = key === 'competitive_position' ? 'competitive_position_score' : `${key}_score`;
              const score = (a as unknown as Record<string, unknown>)[scoreKey] as number | null;
              if (score == null) return null;
              const Icon = cfg.icon;
              const pct = score;
              const reasoning = a.reasoning?.metric_reasoning?.[key];

              return (
                <div key={key}>
                  <button
                    onClick={() => setExpandedMetric(expandedMetric === key ? null : key)}
                    className="w-full flex items-center gap-3 group"
                  >
                    <Icon className="w-4 h-4 shrink-0" style={{ color: cfg.color }} />
                    <span className="text-xs font-medium text-text-secondary w-36 shrink-0 text-left">{cfg.label}</span>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${pct}%`, background: cfg.color, boxShadow: `0 0 8px ${cfg.color}30` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-text-primary w-10 text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {score}
                    </span>
                    <span className="text-[10px] text-text-muted">/100</span>
                    {reasoning && (
                      expandedMetric === key
                        ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
                        : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                    )}
                  </button>
                  {expandedMetric === key && reasoning && (
                    <div className="ml-7 mt-2 pl-4 border-l-2 text-xs text-text-secondary leading-relaxed" style={{ borderColor: cfg.color + '40' }}>
                      {reasoning}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Summary */}
      {a.reasoning?.summary && (
        <div className="dashboard-card p-6">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4 text-brand-primary" />
            {t('deepAnalyze.summary')}
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed">{a.reasoning.summary}</p>

          {/* Score-specific reasoning */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {a.reasoning.generic_score_reasoning && (
              <div className="p-3 rounded-lg bg-bg-primary/50 border border-glass-border">
                <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">{t('deepAnalyze.genericScoreReasoning')}</span>
                <p className="text-xs text-text-secondary mt-1">{a.reasoning.generic_score_reasoning}</p>
              </div>
            )}
            {a.reasoning.specific_score_reasoning && (
              <div className="p-3 rounded-lg bg-bg-primary/50 border border-glass-border">
                <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">{t('deepAnalyze.specificScoreReasoning')}</span>
                <p className="text-xs text-text-secondary mt-1">{a.reasoning.specific_score_reasoning}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* High Probability Prompts */}
      {a.high_probability_prompts && a.high_probability_prompts.length > 0 && (
        <HighProbabilityPrompts topics={a.high_probability_prompts} />
      )}

      {/* Improvements */}
      {a.improvements && a.improvements.length > 0 && (
        <ImprovementsAndRecommendations improvements={a.improvements} />
      )}

      {/* Analysis Scope (pages used) */}
      {a.analysis_scope?.relevant_pages_used && a.analysis_scope.relevant_pages_used.length > 0 && (
        <div className="dashboard-card">
          <button
            onClick={() => setShowPages(!showPages)}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-primary" />
              <span className="text-sm font-semibold text-text-primary">{t('deepAnalyze.pagesAnalyzed')}</span>
              <span className="text-xs text-text-muted">({a.analysis_scope.relevant_pages_used.length})</span>
            </div>
            {showPages ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
          </button>
          {showPages && (
            <div className="px-4 pb-4 space-y-2 max-h-64 overflow-y-auto">
              {a.analysis_scope.relevant_pages_used.map((page, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-bg-primary/50 border border-glass-border text-sm">
                  <div className="flex-1 min-w-0">
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-primary font-medium truncate block hover:text-brand-primary transition-colors"
                    >
                      {page.url}
                    </a>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary">
                        {page.page_type}
                      </span>
                      <span className="text-xs text-text-muted">{page.reason_used}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── High Probability Prompts ───────────────────────────────
function HighProbabilityPrompts({ topics }: { topics: DeepAnalyzeTopic[] }) {
  const { t } = useTranslation();

  return (
    <div className="dashboard-card p-5">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-brand-accent" />
        {t('deepAnalyze.highProbabilityPrompts')}
        <span className="text-xs text-text-muted font-normal">
          ({topics.reduce((sum, t) => sum + t.prompts.length, 0)} {t('deepAnalyze.prompts')})
        </span>
      </h3>
      <div className="space-y-4">
        {topics.map((topic) => (
          <div key={topic.topic_probability_rank} className="rounded-xl border border-glass-border overflow-hidden">
            {/* Topic header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-bg-primary/50">
              <span
                className="flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold shrink-0"
                style={{
                  background: 'rgba(253,121,168,0.10)',
                  color: 'var(--brand-accent)',
                  border: '1px solid rgba(253,121,168,0.20)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                #{topic.topic_probability_rank}
              </span>
              <span className="text-sm font-semibold text-text-primary">{topic.topic}</span>
              <span className="text-xs text-text-muted ml-auto">{topic.prompts.length} {t('deepAnalyze.prompts')}</span>
            </div>
            {/* Prompts */}
            <div className="divide-y divide-glass-border">
              {topic.prompts.map((p) => (
                <div key={p.probability_rank_within_topic} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="text-[10px] font-bold text-text-muted mt-1 w-5 shrink-0" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {p.probability_rank_within_topic}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-text-primary">{p.prompt}</p>
                      {p.prompt_score != null && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            color: p.prompt_score >= 60 ? '#00cec9' : p.prompt_score >= 30 ? '#fdcb6e' : '#ff6b6b',
                            background: p.prompt_score >= 60 ? 'rgba(0,206,201,0.10)' : p.prompt_score >= 30 ? 'rgba(253,203,110,0.10)' : 'rgba(255,107,107,0.10)',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}
                        >
                          {p.prompt_score}%
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3 text-success" />
                      {p.why_it_has_high_probability}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Improvements List ──────────────────────────────────────
