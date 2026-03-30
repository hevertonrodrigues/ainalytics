import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Building2,
  Target,
  MessageSquare,
  CheckCircle2,
  Circle,
  User,
  Mail,
  ChevronDown,
  ChevronUp,
  Cpu,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { SAPageHeader } from './SAPageHeader';

interface ActiveModelInfo {
  model_slug: string;
  model_name: string;
  platform_slug: string;
  platform_name: string;
  web_search_active: boolean;
}

interface ActiveUser {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  plan_name: string | null;
  plan_end_date: string | null;
  // Company
  has_company: boolean;
  company_name: string | null;
  company_domain: string | null;
  companies_count: number;
  // Analysis
  has_analysis: boolean;
  total_analyses: number;
  completed_analyses: number;
  best_geo_score: number | null;
  latest_analysis_status: string | null;
  latest_analysis_at: string | null;
  // Prompts
  has_prompts: boolean;
  total_prompts: number;
  active_prompts: number;
  // Answers
  has_answers: boolean;
  total_answers: number;
  // Models
  active_models: ActiveModelInfo[];
  active_models_count: number;
  // Limits
  max_prompts: number | null;
  max_models: number | null;
  is_over_limit: boolean;
  // Progress
  progress_percent: number;
}

type SortField = 'full_name' | 'progress_percent' | 'active_prompts' | 'total_answers' | 'best_geo_score';
type SortOrder = 'asc' | 'desc';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-glass-element rounded-md ${className}`} />;
}

export function ActiveUsersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('progress_percent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFinishingSoon, setShowFinishingSoon] = useState(false);
  const [showOverLimit, setShowOverLimit] = useState(false);

  const [users, setUsers] = useState<ActiveUser[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        const res = await apiClient.get<ActiveUser[]>('/admin-active-users');
        if (mounted) { setUsers(res.data); setError(null); }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // KPIs
  const finishingSoonCount = useMemo(() => {
    if (!users) return 0;
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    return users.filter(u => {
      if (!u.plan_end_date) return false;
      const endDate = new Date(u.plan_end_date);
      return endDate <= oneMonthFromNow;
    }).length;
  }, [users]);

  const kpis = useMemo(() => {
    if (!users) return { total: 0, withCompany: 0, withAnalysis: 0, withPrompts: 0, overLimit: 0 };
    return {
      total: users.length,
      withCompany: users.filter(u => u.has_company).length,
      withAnalysis: users.filter(u => u.has_analysis).length,
      withPrompts: users.filter(u => u.has_prompts).length,
      overLimit: users.filter(u => u.is_over_limit).length,
    };
  }, [users]);

  // Filter & Sort
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    let filtered = [...users];
    if (showFinishingSoon) {
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
      filtered = filtered.filter(u => {
        if (!u.plan_end_date) return false;
        const endDate = new Date(u.plan_end_date);
        return endDate <= oneMonthFromNow;
      });
    }
    if (showOverLimit) {
      filtered = filtered.filter(u => u.is_over_limit);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) ||
        u.company_domain?.toLowerCase().includes(q) || u.tenant_name?.toLowerCase().includes(q)
      );
    }
    filtered.sort((a, b) => {
      let valA: string | number = a[sortField] ?? -1, valB: string | number = b[sortField] ?? -1;
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [users, search, sortField, sortOrder, showFinishingSoon, showOverLimit]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
  };
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline-block" /> : <ChevronDown className="w-3 h-3 ml-1 inline-block" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="dashboard-card p-6 h-24" />)}
        </div>
        <div className="dashboard-card p-6 h-[500px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-card p-6 border-error border bg-error/5">
        <h3 className="text-error font-medium">{t('sa.failedLoadActiveUsers')}</h3>
        <p className="text-sm text-error/80 mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="stagger-enter space-y-6">
      {/* Header */}
      <SAPageHeader title={t('sa.activeUsers')} subtitle={t('sa.activeUsersSubtitle')} />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={<Users className="w-4 h-4" />} label={t('sa.totalActive')} value={kpis.total} />
        <KPICard icon={<Building2 className="w-4 h-4" />} label={t('sa.withCompany')} value={kpis.withCompany} valueColor="text-chart-cyan" />
        <KPICard icon={<Target className="w-4 h-4" />} label={t('sa.withAnalysis')} value={kpis.withAnalysis} valueColor="text-brand-primary" />
        <KPICard icon={<MessageSquare className="w-4 h-4" />} label={t('sa.withPrompts')} value={kpis.withPrompts} valueColor="text-success" />
        {kpis.overLimit > 0 && (
          <KPICard icon={<AlertTriangle className="w-4 h-4" />} label={t('sa.overLimitUsers')} value={kpis.overLimit} valueColor="text-warning" />
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="text" placeholder={t('sa.searchUsers')} value={search} onChange={e => setSearch(e.target.value)} className="input pl-9 w-full" />
        </div>
        <button
          onClick={() => setShowFinishingSoon(prev => !prev)}
          title={t('sa.finishingSoonTooltip')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
            showFinishingSoon
              ? 'bg-warning/15 text-warning border-warning/30 shadow-sm'
              : 'bg-bg-secondary text-text-secondary border-glass-border hover:bg-glass-hover hover:text-text-primary'
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          {t('sa.finishingSoon')}
          {finishingSoonCount > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
              showFinishingSoon
                ? 'bg-warning/25 text-warning'
                : 'bg-warning/15 text-warning'
            }`}>
              {finishingSoonCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowOverLimit(prev => !prev)}
          title={t('sa.overLimitTooltip')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
            showOverLimit
              ? 'bg-error/15 text-error border-error/30 shadow-sm'
              : 'bg-bg-secondary text-text-secondary border-glass-border hover:bg-glass-hover hover:text-text-primary'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          {t('sa.overLimit')}
          {kpis.overLimit > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
              showOverLimit
                ? 'bg-error/25 text-error'
                : 'bg-error/15 text-error'
            }`}>
              {kpis.overLimit}
            </span>
          )}
        </button>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="dashboard-card p-6 text-center text-text-muted">{t('sa.noUsersFound')}</div>
        ) : filteredUsers.map(user => (
          <div key={user.user_id} className="dashboard-card p-4 cursor-pointer hover:border-brand-primary/30 transition-colors" onClick={() => navigate(`/sa/users/${user.user_id}`)}>
            {/* User info */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0 border border-brand-primary/20">
                <User className="w-4 h-4 text-brand-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-text-primary truncate">{user.full_name || t('sa.unnamed')}</div>
                <div className="text-xs text-text-muted truncate">{user.email}</div>
              </div>
              {user.plan_name && <span className="text-[10px] text-brand-primary font-medium bg-brand-primary/10 rounded px-1.5 py-0.5 border border-brand-primary/20 shrink-0">{user.plan_name}</span>}
              {user.is_over_limit && <span className="text-[10px] text-error font-semibold bg-error/10 rounded px-1.5 py-0.5 border border-error/20 shrink-0 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{t('sa.overLimit')}</span>}
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    user.progress_percent === 100 ? 'bg-success' :
                    user.progress_percent >= 50 ? 'bg-brand-primary' :
                    'bg-warning'
                  }`}
                  style={{ width: `${user.progress_percent}%` }}
                />
              </div>
              <span className={`text-xs font-semibold ${
                user.progress_percent === 100 ? 'text-success' :
                user.progress_percent >= 50 ? 'text-brand-primary' :
                'text-warning'
              }`}>{user.progress_percent}%</span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="text-center">
                <div className="text-xs text-text-muted">{t('sa.prompts')}</div>
                <div className="text-sm font-semibold text-text-primary">{user.active_prompts || '—'}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-text-muted">{t('sa.answers')}</div>
                <div className="text-sm font-semibold text-text-primary">{user.total_answers || '—'}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-text-muted">{t('sa.activeModels')}</div>
                <div className="text-sm font-semibold text-text-primary">{user.active_models_count || '—'}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-text-muted">{t('sa.geoScore')}</div>
                <div className={`text-sm font-semibold ${
                  user.best_geo_score != null
                    ? user.best_geo_score >= 70 ? 'text-success' : user.best_geo_score >= 40 ? 'text-warning' : 'text-error'
                    : 'text-text-muted'
                }`}>{user.best_geo_score != null ? Math.round(user.best_geo_score) : '—'}</div>
              </div>
            </div>

            {/* Progress steps */}
            <div className="flex items-center justify-between gap-1 pt-2 border-t border-glass-border">
              <ProgressStep done={user.has_company} label={t('sa.stepCompany')} sublabel={user.company_domain} />
              <ProgressStep done={user.has_analysis} label={t('sa.stepAnalysis')} sublabel={user.completed_analyses > 0 ? `${user.completed_analyses}x` : undefined} />
              <ProgressStep done={user.has_prompts} label={t('sa.stepPrompts')} sublabel={user.active_prompts > 0 ? `${user.active_prompts}` : undefined} />
              <ProgressStep done={user.has_answers} label={t('sa.stepAnswers')} sublabel={user.total_answers > 0 ? `${user.total_answers}` : undefined} />
            </div>
          </div>
        ))}
      </div>

      {/* Table (desktop) */}
      <div className="dashboard-card overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-muted bg-bg-secondary/50 border-b border-glass-border">
              <tr>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary transition-colors" onClick={() => handleSort('full_name')}>{t('sa.colUser')} {getSortIcon('full_name')}</th>
                <th className="px-4 py-3 font-medium">{t('sa.progressSteps')}</th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary transition-colors text-center" onClick={() => handleSort('progress_percent')}>{t('sa.progress')} {getSortIcon('progress_percent')}</th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary transition-colors text-center" onClick={() => handleSort('active_prompts')}>{t('sa.prompts')} {getSortIcon('active_prompts')}</th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary transition-colors text-center" onClick={() => handleSort('total_answers')}>{t('sa.answers')} {getSortIcon('total_answers')}</th>
                <th className="px-4 py-3 font-medium text-center"><Cpu className="w-3 h-3 inline-block mr-1" />{t('sa.activeModels')}</th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary transition-colors text-center" onClick={() => handleSort('best_geo_score')}>{t('sa.geoScore')} {getSortIcon('best_geo_score')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">{t('sa.noUsersFound')}</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.user_id} className="hover:bg-glass-hover transition-colors cursor-pointer" onClick={() => navigate(`/sa/users/${user.user_id}`)}>
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0 border border-brand-primary/20">
                          <User className="w-4 h-4 text-brand-primary" />
                        </div>
                        <div className="min-w-0 max-w-[200px]">
                          <div className="font-medium text-text-primary truncate">{user.full_name || t('sa.unnamed')}</div>
                          <div className="text-xs text-text-muted flex items-center gap-1 truncate"><Mail className="w-3 h-3 shrink-0" />{user.email}</div>
                          {user.plan_name && <span className="text-[10px] text-brand-primary font-medium">{user.plan_name}</span>}
                          {user.is_over_limit && <span className="text-[10px] text-error font-semibold flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{t('sa.overLimit')}</span>}
                        </div>
                      </div>
                    </td>

                    {/* Progress Steps */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProgressStep done={user.has_company} label={t('sa.stepCompany')} sublabel={user.company_domain} />
                        <ProgressStep done={user.has_analysis} label={t('sa.stepAnalysis')} sublabel={user.completed_analyses > 0 ? `${user.completed_analyses}x` : undefined} />
                        <ProgressStep done={user.has_prompts} label={t('sa.stepPrompts')} sublabel={user.active_prompts > 0 ? `${user.active_prompts}` : undefined} />
                        <ProgressStep done={user.has_answers} label={t('sa.stepAnswers')} sublabel={user.total_answers > 0 ? `${user.total_answers}` : undefined} />
                      </div>
                    </td>

                    {/* Progress % */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              user.progress_percent === 100 ? 'bg-success' :
                              user.progress_percent >= 50 ? 'bg-brand-primary' :
                              'bg-warning'
                            }`}
                            style={{ width: `${user.progress_percent}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${
                          user.progress_percent === 100 ? 'text-success' :
                          user.progress_percent >= 50 ? 'text-brand-primary' :
                          'text-warning'
                        }`}>{user.progress_percent}%</span>
                      </div>
                    </td>

                    {/* Prompts */}
                    <td className="px-4 py-3 text-center">
                      {user.active_prompts > 0 ? (
                        <span className="font-medium text-text-primary">{user.active_prompts}<span className="text-text-muted text-xs">/{user.total_prompts}</span></span>
                      ) : <span className="text-text-muted">—</span>}
                    </td>

                    {/* Answers */}
                    <td className="px-4 py-3 text-center">
                      {user.total_answers > 0 ? (
                        <span className="font-medium text-text-primary">{user.total_answers}</span>
                      ) : <span className="text-text-muted">—</span>}
                    </td>

                    {/* Active Models */}
                    <td className="px-4 py-3">
                      {user.active_models_count > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-center max-w-[200px]">
                          {user.active_models.map((m) => (
                            <span key={m.model_slug}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-primary/10 text-brand-primary border border-brand-primary/20"
                              title={`${m.platform_name} — ${m.model_name}`}
                            >
                              {m.model_slug}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-text-muted text-center block">—</span>}
                    </td>

                    {/* GEO Score */}
                    <td className="px-4 py-3 text-center">
                      {user.best_geo_score != null ? (
                        <span className={`font-semibold ${
                          user.best_geo_score >= 70 ? 'text-success' :
                          user.best_geo_score >= 40 ? 'text-warning' :
                          'text-error'
                        }`}>{Math.round(user.best_geo_score)}</span>
                      ) : <span className="text-text-muted">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──

function KPICard({ icon, label, value, valueColor = 'text-text-primary' }: {
  icon: React.ReactNode; label: string; value: number; valueColor?: string;
}) {
  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center gap-2 text-text-muted mb-2">{icon}<span className="text-sm font-medium">{label}</span></div>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

function ProgressStep({ done, label, sublabel }: { done: boolean; label: string; sublabel?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[48px] sm:min-w-[56px]">
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-success" />
      ) : (
        <Circle className="w-4 h-4 text-text-muted/40" />
      )}
      <span className={`text-[10px] font-medium leading-tight text-center ${done ? 'text-text-secondary' : 'text-text-muted/60'}`}>{label}</span>
      {sublabel && <span className="text-[9px] text-text-muted">{sublabel}</span>}
    </div>
  );
}
