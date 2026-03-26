import { useState, useEffect, useCallback, Fragment } from 'react';
import { formatDate, formatDateTime } from '@/lib/dateFormat';
import { useTranslation } from 'react-i18next';
import {
  Activity, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Check, X, Clock, Zap, Filter, BarChart3,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

/* ──────────────── types ──────────────── */

interface GroupedRow {
  period: string;
  total_answers: number;
  success_count: number;
  error_count: number;
  avg_latency_ms: number;
  tenant_count: number;
  platforms: Record<string, number>;
}

interface AnswerRow {
  id: string;
  tenant_id: string;
  tenant_name: string;
  prompt_id: string;
  prompt_text: string;
  topic_name: string;
  platform_slug: string;
  model_name: string | null;
  model_slug: string | null;
  has_answer: boolean;
  answer_preview: string | null;
  tokens_used: { input?: number; output?: number } | null;
  latency_ms: number | null;
  error: string | null;
  searched_at: string;
}

interface Tenant { id: string; name: string; }

const GROUP_OPTIONS = ['hour', 'day', 'week', 'month'] as const;
const PERIOD_OPTIONS = [
  { value: 1, label: 'timeline.last30d' },
  { value: 3, label: 'timeline.last90d' },
  { value: 6, label: 'timeline.last6m' },
  { value: 12, label: 'timeline.last12m' },
] as const;

/* ──────────────── component ──────────────── */

export function MonitoringTimelinePage() {
  const { t } = useTranslation();

  // Filters
  const [groupBy, setGroupBy] = useState<typeof GROUP_OPTIONS[number]>('day');
  const [months, setMonths] = useState(1);
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);

  // Grouped data
  const [grouped, setGrouped] = useState<GroupedRow[]>([]);
  const [loadingGrouped, setLoadingGrouped] = useState(true);

  // Answers (paginated)
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [answersPage, setAnswersPage] = useState(1);
  const [answersTotal, setAnswersTotal] = useState(0);
  const [answersTotalPages, setAnswersTotalPages] = useState(1);
  const [loadingAnswers, setLoadingAnswers] = useState(true);

  // Detail expansion
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Tab: 'grouped' | 'answers'
  const [tab, setTab] = useState<'grouped' | 'answers'>('grouped');

  const perPage = 50;

  // Load tenants
  useEffect(() => {
    apiClient.get<Tenant[]>('/admin-monitoring-timeline?view=tenants').then(r => setTenants(r.data));
  }, []);

  // Load grouped
  const fetchGrouped = useCallback(async () => {
    setLoadingGrouped(true);
    try {
      const params = `view=grouped&group_by=${groupBy}&months=${months}${tenantId ? `&tenant_id=${tenantId}` : ''}`;
      const r = await apiClient.get<GroupedRow[]>(`/admin-monitoring-timeline?${params}`);
      setGrouped(r.data || []);
    } catch { setGrouped([]); }
    finally { setLoadingGrouped(false); }
  }, [groupBy, months, tenantId]);

  // Load answers
  const fetchAnswers = useCallback(async () => {
    setLoadingAnswers(true);
    try {
      const params = `view=answers&page=${answersPage}&per_page=${perPage}&months=${months}${tenantId ? `&tenant_id=${tenantId}` : ''}`;
      const r = await apiClient.get<{ items: AnswerRow[]; total: number; page: number; total_pages: number }>(`/admin-monitoring-timeline?${params}`);
      setAnswers(r.data.items || []);
      setAnswersTotal(r.data.total);
      setAnswersTotalPages(r.data.total_pages);
    } catch { setAnswers([]); }
    finally { setLoadingAnswers(false); }
  }, [answersPage, months, tenantId]);

  useEffect(() => { fetchGrouped(); }, [fetchGrouped]);
  useEffect(() => { fetchAnswers(); }, [fetchAnswers]);
  useEffect(() => { setAnswersPage(1); }, [months, tenantId]); // reset page on filter change

  const refresh = () => { fetchGrouped(); fetchAnswers(); };

  // Helper: max count for bar chart
  const maxCount = Math.max(...grouped.map(g => g.total_answers), 1);

  // Format period label
  const fmtPeriod = (iso: string) => {
    if (groupBy === 'hour') return formatDateTime(iso, 'dateTime');
    if (groupBy === 'week') return `${t('timeline.week')} ${formatDate(iso, 'shortDate')}`;
    if (groupBy === 'month') return formatDate(iso, 'monthYear');
    return formatDate(iso, 'shortDateYear');
  };

  return (
    <div className="stagger-enter space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Activity className="w-6 h-6 text-brand-primary" />{t('timeline.title')}
          </h1>
          <p className="text-sm text-text-secondary mt-1">{t('timeline.subtitle')}</p>
        </div>
        <button onClick={refresh} className="btn btn-secondary btn-sm flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />{t('timeline.refresh')}
        </button>
      </div>

      {/* Filters */}
      <div className="dashboard-card p-4 flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-text-secondary" />

        {/* Period */}
        <select value={months} onChange={e => setMonths(Number(e.target.value))} className="input-field !py-1.5 !text-sm w-auto">
          {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
        </select>

        {/* Group by */}
        <div className="flex bg-bg-tertiary rounded border border-glass-border">
          {GROUP_OPTIONS.map(g => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${groupBy === g ? 'bg-brand-primary text-white rounded' : 'text-text-secondary hover:text-text-primary'}`}>
              {t(`timeline.${g}`)}
            </button>
          ))}
        </div>

        {/* Tenant filter */}
        <select value={tenantId} onChange={e => setTenantId(e.target.value)} className="input-field !py-1.5 !text-sm w-auto min-w-[180px]">
          <option value="">{t('timeline.allTenants')}</option>
          {tenants.map(te => <option key={te.id} value={te.id}>{te.name}</option>)}
        </select>

        {/* Tab toggle */}
        <div className="ml-auto flex bg-bg-tertiary rounded border border-glass-border">
          <button onClick={() => setTab('grouped')}
            className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${tab === 'grouped' ? 'bg-brand-primary text-white rounded' : 'text-text-secondary hover:text-text-primary'}`}>
            <BarChart3 className="w-3 h-3" />{t('timeline.grouped')}
          </button>
          <button onClick={() => setTab('answers')}
            className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${tab === 'answers' ? 'bg-brand-primary text-white rounded' : 'text-text-secondary hover:text-text-primary'}`}>
            <Activity className="w-3 h-3" />{t('timeline.details')}
          </button>
        </div>
      </div>

      {/* ─── GROUPED VIEW ───────────────────────────────── */}
      {tab === 'grouped' && (
        <div className="dashboard-card overflow-hidden">
          {loadingGrouped ? (
            <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 skeleton rounded" />)}</div>
          ) : grouped.length === 0 ? (
            <div className="p-10 text-center text-text-secondary">{t('timeline.noData')}</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left">{t('timeline.period')}</th>
                  <th className="text-right">{t('timeline.total')}</th>
                  <th className="text-right">{t('timeline.success')}</th>
                  <th className="text-right">{t('timeline.errors')}</th>
                  <th className="text-right">{t('timeline.avgLatency')}</th>
                  <th className="text-center">{t('timeline.tenants')}</th>
                  <th className="text-left" style={{ minWidth: 200 }}>{t('timeline.distribution')}</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g, i) => (
                  <tr key={i}>
                    <td className="!font-body font-medium whitespace-nowrap">{fmtPeriod(g.period)}</td>
                    <td className="text-right font-semibold">{g.total_answers.toLocaleString()}</td>
                    <td className="text-right">
                      <span className="text-success font-medium">{g.success_count.toLocaleString()}</span>
                    </td>
                    <td className="text-right">
                      {g.error_count > 0 ? (
                        <span className="text-error font-medium">{g.error_count}</span>
                      ) : <span className="text-text-secondary">0</span>}
                    </td>
                    <td className="text-right">
                      <span className="!font-body text-xs">{g.avg_latency_ms ? `${g.avg_latency_ms}ms` : '—'}</span>
                    </td>
                    <td className="text-center !font-body">{g.tenant_count}</td>
                    <td>
                      {/* Mini bar chart */}
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-4 bg-bg-tertiary rounded overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded"
                            style={{ width: `${Math.max(4, (g.total_answers / maxCount) * 100)}%` }} />
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {Object.entries(g.platforms || {}).slice(0, 4).map(([slug, c]) => (
                            <span key={slug} className="text-[10px] px-1.5 py-0.5 rounded bg-glass-bg border border-glass-border text-text-primary whitespace-nowrap">
                              {slug}:{c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── ANSWERS DETAIL VIEW ────────────────────────── */}
      {tab === 'answers' && (
        <div className="dashboard-card overflow-hidden">
          {loadingAnswers ? (
            <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-8 skeleton rounded" />)}</div>
          ) : answers.length === 0 ? (
            <div className="p-10 text-center text-text-secondary">{t('timeline.noData')}</div>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-left">{t('timeline.searchedAt')}</th>
                    <th className="text-left">{t('timeline.tenant')}</th>
                    <th className="text-left">{t('timeline.prompt')}</th>
                    <th className="text-left">{t('timeline.platform')}</th>
                    <th className="text-left">{t('timeline.model')}</th>
                    <th className="text-center">{t('timeline.status')}</th>
                    <th className="text-right">{t('timeline.latency')}</th>
                    <th className="text-right">{t('timeline.tokens')}</th>
                  </tr>
                </thead>
                <tbody>
                  {answers.map(a => {
                    const isExpanded = expandedId === a.id;
                    return (
                      <Fragment key={a.id}>
                        <tr className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                          <td className="!font-body text-xs whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {isExpanded ? <ChevronUp className="w-3 h-3 text-text-secondary" /> : <ChevronDown className="w-3 h-3 text-text-secondary" />}
                              <Clock className="w-3 h-3 text-text-secondary" />
                              {formatDateTime(a.searched_at, 'dateTimeSeconds')}
                            </div>
                          </td>
                          <td className="!font-body text-sm">{a.tenant_name || '—'}</td>
                          <td className="!font-body text-xs max-w-[200px] truncate" title={a.prompt_text}>{a.prompt_text || '—'}</td>
                          <td>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-glass-bg border border-glass-border text-text-primary">{a.platform_slug}</span>
                          </td>
                          <td className="text-xs">{a.model_name || a.model_slug || '—'}</td>
                          <td className="text-center">
                            {a.has_answer ? (
                              <span className="inline-flex items-center gap-0.5 text-success text-xs font-semibold"><Check className="w-3 h-3" /></span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-error text-xs font-semibold"><X className="w-3 h-3" /></span>
                            )}
                          </td>
                          <td className="text-right !font-body text-xs">
                            {a.latency_ms ? (
                              <span className="inline-flex items-center gap-0.5"><Zap className="w-3 h-3 text-warning" />{a.latency_ms}ms</span>
                            ) : '—'}
                          </td>
                          <td className="text-right text-xs">
                            {a.tokens_used ? (
                              <span className="text-text-primary">{(a.tokens_used.input || 0) + (a.tokens_used.output || 0)}</span>
                            ) : '—'}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="!font-body !text-sm !p-4 bg-bg-tertiary/30">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <span className="text-xs font-semibold text-text-secondary block mb-1">{t('timeline.promptFull')}</span>
                                  <p className="text-sm text-text-primary break-words">{a.prompt_text || '—'}</p>
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-text-secondary block mb-1">{t('timeline.topic')}</span>
                                  <p className="text-sm text-text-primary">{a.topic_name || '—'}</p>
                                </div>
                                {a.answer_preview && (
                                  <div className="sm:col-span-2">
                                    <span className="text-xs font-semibold text-text-secondary block mb-1">{t('timeline.answerPreview')}</span>
                                    <p className="text-sm text-text-primary break-words whitespace-pre-wrap bg-bg-secondary rounded p-3 border border-glass-border max-h-40 overflow-y-auto">{a.answer_preview}</p>
                                  </div>
                                )}
                                {a.error && (
                                  <div className="sm:col-span-2">
                                    <span className="text-xs font-semibold text-error block mb-1">{t('timeline.error')}</span>
                                    <p className="text-sm text-error/80 font-mono bg-error/5 rounded p-2 border border-error/20">{a.error}</p>
                                  </div>
                                )}
                                <div>
                                  <span className="text-xs font-semibold text-text-secondary block mb-1">{t('timeline.tokens')}</span>
                                  <div className="flex gap-3 text-xs">
                                    <span className="text-text-primary">In: <span className="font-semibold">{a.tokens_used?.input || 0}</span></span>
                                    <span className="text-text-primary">Out: <span className="font-semibold">{a.tokens_used?.output || 0}</span></span>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-text-secondary block mb-1">ID</span>
                                  <code className="text-xs text-text-primary break-all">{a.id}</code>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t border-glass-border">
                <span className="text-sm text-text-secondary">
                  {t('timeline.showing')} {((answersPage - 1) * perPage) + 1}–{Math.min(answersPage * perPage, answersTotal)} {t('timeline.of')} {answersTotal.toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <button disabled={answersPage <= 1} onClick={() => setAnswersPage(p => p - 1)}
                    className="btn btn-secondary btn-sm !py-1 !px-2 flex items-center gap-1">
                    <ChevronLeft className="w-3.5 h-3.5" />{t('timeline.prev')}
                  </button>
                  <span className="text-sm text-text-primary font-medium">{answersPage} / {answersTotalPages}</span>
                  <button disabled={answersPage >= answersTotalPages} onClick={() => setAnswersPage(p => p + 1)}
                    className="btn btn-secondary btn-sm !py-1 !px-2 flex items-center gap-1">
                    {t('timeline.next')}<ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
