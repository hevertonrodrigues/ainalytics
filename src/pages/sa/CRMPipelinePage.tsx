import { useState, useMemo, useEffect } from 'react';
import { formatDate } from '@/lib/dateFormat';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  Activity, 
  Search, 
  Building2, 
  Mail, 
  Shield, 
  ChevronDown,
  ChevronUp,
  User,
  LayoutGrid,
  List,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { CRMPipelineUser } from './types';
import { KanbanBoard } from './KanbanBoard';
import { UserDetailModal } from './UserDetailModal';
import { SAPageHeader } from './SAPageHeader';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-glass-element rounded-md ${className}`} />;
}

type SortField = 'created_at' | 'full_name' | 'company_domain' | 'plan_name' | 'paid_amount';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'kanban' | 'table';

export function CRMPipelinePage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'no_plan'>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedUser, setSelectedUser] = useState<CRMPipelineUser | null>(null);

  const [users, setUsers] = useState<CRMPipelineUser[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        const res = await apiClient.get<CRMPipelineUser[]>('/admin-crm-pipeline');
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
  const kpis = useMemo(() => {
    if (!users) return { totalUsers: 0, activeSubs: 0, mrr: 0, cancelled: 0 };
    let activeSubs = 0, totalMrr = 0, cancelled = 0;
    users.forEach(u => {
      if (u.subscription_status === 'active' || u.subscription_status === 'trialing') {
        activeSubs++;
        if (u.billing_interval === 'monthly') totalMrr += Number(u.paid_amount);
        if (u.billing_interval === 'yearly') totalMrr += Number(u.paid_amount) / 12;
      }
      if (u.stage === 'churned_from_trial' || u.stage === 'churned_from_paid') cancelled++;
    });
    return { totalUsers: users.length, activeSubs, mrr: totalMrr, cancelled };
  }, [users]);

  // Filter & Sort (for table view)
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    let filtered = [...users];
    if (statusFilter !== 'all') {
      filtered = filtered.filter((u: CRMPipelineUser) => {
        if (statusFilter === 'active') return u.subscription_status === 'active' || u.subscription_status === 'trialing';
        if (statusFilter === 'inactive') return u.subscription_status === 'canceled' || u.subscription_status === 'past_due';
        if (statusFilter === 'no_plan') return !u.subscription_status || u.subscription_status === 'incomplete';
        return true;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) ||
        u.company_domain?.toLowerCase().includes(q) || u.tenant_name?.toLowerCase().includes(q)
      );
    }
    filtered.sort((a, b) => {
      let valA: string | number = a[sortField] ?? '', valB: string | number = b[sortField] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [users, search, statusFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
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
        <h3 className="text-error font-medium">{t('sa.failedLoadCRM')}</h3>
        <p className="text-sm text-error/80 mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="stagger-enter space-y-6">
      {/* Header */}
      <SAPageHeader title={t('sa.crmPipeline')} subtitle={t('sa.crmSubtitle')}>
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-bg-secondary/60 rounded-lg p-0.5 border border-glass-border">
          <button
            onClick={() => setViewMode('kanban')}
            className={`p-2 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-brand-primary/10 text-brand-primary' : 'text-text-muted hover:text-text-primary'}`}
            title={t('sa.kanbanView')}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-brand-primary/10 text-brand-primary' : 'text-text-muted hover:text-text-primary'}`}
            title={t('sa.tableView')}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </SAPageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="dashboard-card p-5">
          <div className="flex items-center gap-2 text-text-muted mb-2"><Users className="w-4 h-4" /><span className="text-sm font-medium">{t('sa.totalUsers')}</span></div>
          <p className="text-2xl font-bold text-text-primary">{kpis.totalUsers}</p>
        </div>
        <div className="dashboard-card p-5">
          <div className="flex items-center gap-2 text-text-muted mb-2"><CreditCard className="w-4 h-4" /><span className="text-sm font-medium">{t('sa.activeSubs')}</span></div>
          <p className="text-2xl font-bold text-text-primary">{kpis.activeSubs}</p>
        </div>
        <div className="dashboard-card p-5">
          <div className="flex items-center gap-2 text-text-muted mb-2"><TrendingUp className="w-4 h-4" /><span className="text-sm font-medium">{t('sa.estMRR')}</span></div>
          <p className="text-2xl font-bold text-success">${kpis.mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}{t('sa.perMonth')}</p>
        </div>
        <div className="dashboard-card p-5">
          <div className="flex items-center gap-2 text-text-muted mb-2"><Activity className="w-4 h-4" /><span className="text-sm font-medium">{t('sa.cancelledUsers')}</span></div>
          <p className="text-2xl font-bold text-error">{kpis.cancelled}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="text" placeholder={t('sa.searchUsers')} value={search} onChange={e => setSearch(e.target.value)} className="input pl-9 w-full" />
        </div>
        {viewMode === 'table' && (
          <select className="input py-2 bg-bg-secondary w-full sm:w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">{t('sa.filterAll')}</option>
            <option value="active">{t('sa.filterActive')}</option>
            <option value="inactive">{t('sa.filterInactive')}</option>
            <option value="no_plan">{t('sa.filterNoPlan')}</option>
          </select>
        )}
      </div>

      {/* Views */}
      {viewMode === 'kanban' ? (
        <KanbanBoard users={users || []} searchQuery={search} onUserClick={setSelectedUser} />
      ) : (
        <div className="dashboard-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left pb-4">
              <thead className="text-xs text-text-muted bg-bg-secondary/50 border-b border-glass-border">
                <tr>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary transition-colors" onClick={() => handleSort('full_name')}>{t('sa.colUser')} {getSortIcon('full_name')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary transition-colors" onClick={() => handleSort('company_domain')}>{t('sa.colCompany')} {getSortIcon('company_domain')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary transition-colors" onClick={() => handleSort('plan_name')}>{t('sa.colPlan')} {getSortIcon('plan_name')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer text-right hover:text-text-primary transition-colors" onClick={() => handleSort('paid_amount')}>{t('sa.colMRR')} {getSortIcon('paid_amount')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer text-right hover:text-text-primary transition-colors" onClick={() => handleSort('created_at')}>{t('sa.colDate')} {getSortIcon('created_at')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">{t('sa.noUsersFound')}</td></tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.user_id} className="hover:bg-glass-hover transition-colors cursor-pointer" onClick={() => setSelectedUser(user)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0 border border-brand-primary/20"><User className="w-4 h-4 text-brand-primary" /></div>
                          <div className="min-w-0 max-w-[200px]">
                            <div className="font-medium text-text-primary truncate flex items-center gap-1.5">{user.full_name || t('sa.unnamed')}{user.is_sa && <Shield className="w-3 h-3 text-brand-accent" />}</div>
                            <div className="text-xs text-text-muted flex items-center gap-1 truncate"><Mail className="w-3 h-3 shrink-0" />{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.company_domain ? (
                          <div className="min-w-0 max-w-[200px]">
                            <div className="font-medium text-text-secondary truncate flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-text-muted shrink-0" />{user.company_name || user.company_domain}</div>
                            <div className="text-xs text-text-muted truncate mt-0.5">{user.company_domain}</div>
                          </div>
                        ) : <span className="text-xs text-text-muted italic">{t('sa.noCompany')}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          {user.plan_name ? <span className="badge badge-primary">{user.plan_name}</span> : <span className="text-xs text-text-muted italic">{t('sa.noPlan')}</span>}
                          {user.subscription_status && (
                            <span className={`text-[10px] font-medium uppercase tracking-wider ${
                              ['active', 'trialing'].includes(user.subscription_status) ? 'text-success' : 
                              ['past_due', 'unpaid', 'canceled'].includes(user.subscription_status) ? 'text-error' : 'text-warning'
                            }`}>{user.subscription_status.replace('_', ' ')}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {user.paid_amount > 0 ? (
                          <div><span className="font-medium text-text-primary">${user.paid_amount}</span><span className="text-xs text-text-muted ml-0.5">/{user.billing_interval === 'yearly' ? 'yr' : 'mo'}</span></div>
                        ) : <span className="text-text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right"><div className="text-text-secondary whitespace-nowrap">{formatDate(user.created_at)}</div></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedUser && <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  );
}
