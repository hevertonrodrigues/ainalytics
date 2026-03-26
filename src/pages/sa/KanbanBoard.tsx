import { useState, useMemo } from 'react';
import { formatDate } from '@/lib/dateFormat';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Shield,
  Building2,
  Mail,
  CreditCard,
  Key,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { CRMPipelineUser, KanbanStage } from './types';
import { KANBAN_STAGES } from './types';

interface KanbanBoardProps {
  users: CRMPipelineUser[];
  searchQuery: string;
  onUserClick: (user: CRMPipelineUser) => void;
}

const STAGE_CONFIG: Record<KanbanStage, { color: string; borderColor: string; bgColor: string; dotColor: string }> = {
  registered:         { color: 'text-warning',        borderColor: 'border-warning/30',        bgColor: 'bg-warning/5',         dotColor: 'bg-warning' },
  email_confirmed:    { color: 'text-chart-cyan',     borderColor: 'border-chart-cyan/30',     bgColor: 'bg-chart-cyan/5',      dotColor: 'bg-chart-cyan' },
  trial_activation:   { color: 'text-brand-primary',  borderColor: 'border-brand-primary/30',  bgColor: 'bg-brand-primary/5',   dotColor: 'bg-brand-primary' },
  trial_stripe:       { color: 'text-chart-purple',   borderColor: 'border-chart-purple/30',   bgColor: 'bg-chart-purple/5',    dotColor: 'bg-chart-purple' },
  active_activation:  { color: 'text-success',        borderColor: 'border-success/30',        bgColor: 'bg-success/5',         dotColor: 'bg-success' },
  active_stripe:      { color: 'text-chart-green',    borderColor: 'border-chart-green/30',    bgColor: 'bg-chart-green/5',     dotColor: 'bg-chart-green' },
  cancelled:          { color: 'text-error',          borderColor: 'border-error/30',          bgColor: 'bg-error/5',           dotColor: 'bg-error' },
};

export function KanbanBoard({ users, searchQuery, onUserClick }: KanbanBoardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (code: string) => {
    setCollapsedGroups(prev => ({ ...prev, [code]: !prev[code] }));
  };

  // Group filtered users by stage
  const columns = useMemo(() => KANBAN_STAGES.reduce<Record<KanbanStage, CRMPipelineUser[]>>((acc, stage) => {
    acc[stage] = users
      .filter(u => u.stage === stage)
      .filter(u => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.company_domain?.toLowerCase().includes(q) ||
          u.tenant_name?.toLowerCase().includes(q)
        );
      });
    return acc;
  }, {} as Record<KanbanStage, CRMPipelineUser[]>), [users, searchQuery]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[300px] sm:min-h-[500px]">
      {KANBAN_STAGES.map(stage => {
        const cfg = STAGE_CONFIG[stage];
        const stageUsers = columns[stage];

        return (
          <div key={stage} className="flex flex-col min-w-[280px] w-[280px] shrink-0">
            {/* Column header */}
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-lg border-t-2 ${cfg.borderColor} ${cfg.bgColor}`}>
              <div className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
              <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.color}`}>
                {t(`sa.stage_${stage}`)}
              </span>
              <span className="ml-auto text-xs text-text-muted font-medium bg-bg-secondary/60 rounded-full px-2 py-0.5">
                {stageUsers.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 p-2 bg-bg-secondary/30 rounded-b-lg border border-t-0 border-glass-border overflow-y-auto max-h-[calc(100vh-320px)]">
              {stageUsers.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-6 italic">{t('sa.noUsersFound')}</p>
              ) : (stage === 'trial_activation' || stage === 'active_activation') ? (
                /* Group by activation code */
                (() => {
                  const groups: Record<string, CRMPipelineUser[]> = {};
                  stageUsers.forEach(u => {
                    const code = u.tenant_code || t('sa.unknownCode');
                    if (!groups[code]) groups[code] = [];
                    groups[code].push(u);
                  });
                  return Object.entries(groups).map(([code, groupUsers]) => {
                    const isCollapsed = collapsedGroups[code] ?? false;
                    return (
                      <div key={code} className="mb-1">
                        <button
                          onClick={() => toggleGroup(code)}
                          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-brand-primary/5 border border-brand-primary/15 hover:bg-brand-primary/10 transition-colors text-left group/header"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-3 h-3 text-brand-primary shrink-0" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-brand-primary shrink-0" />
                          )}
                          <Key className="w-3 h-3 text-brand-primary shrink-0" />
                          <span className="text-[11px] font-semibold text-brand-primary truncate flex-1">
                            {code}
                          </span>
                          <span className="text-[10px] text-text-muted bg-bg-secondary/60 rounded-full px-1.5 py-0.5 font-medium">
                            {groupUsers.length}
                          </span>
                        </button>
                        {!isCollapsed && (
                          <div className="mt-1.5 space-y-2 pl-1">
                            {groupUsers.map(user => (
                              <KanbanCard
                                key={user.user_id}
                                user={user}
                                onQuickView={() => onUserClick(user)}
                                onFullView={() => navigate(`/sa/users/${user.user_id}`)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()
              ) : (
                stageUsers.map(user => (
                  <KanbanCard
                    key={user.user_id}
                    user={user}
                    onQuickView={() => onUserClick(user)}
                    onFullView={() => navigate(`/sa/users/${user.user_id}`)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ user, onQuickView, onFullView }: {
  user: CRMPipelineUser;
  onQuickView: () => void;
  onFullView: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="dashboard-card p-3 cursor-pointer hover:border-brand-primary/30 transition-all duration-200 group relative"
      onClick={onQuickView}
    >
      {/* User info */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-7 h-7 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0 border border-brand-primary/20">
          <User className="w-3.5 h-3.5 text-brand-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-text-primary truncate flex items-center gap-1">
            {user.full_name || t('sa.unnamed')}
            {user.is_sa && <Shield className="w-3 h-3 text-brand-accent" />}
          </div>
          <div className="text-[11px] text-text-muted truncate flex items-center gap-1">
            <Mail className="w-3 h-3 shrink-0" />
            {user.email}
          </div>
        </div>
      </div>

      {/* Metadata tags */}
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {user.company_name && (
          <span className="inline-flex items-center gap-1 text-[10px] text-text-muted bg-bg-secondary/80 rounded px-1.5 py-0.5 border border-glass-border">
            <Building2 className="w-2.5 h-2.5" />
            {user.company_name}
          </span>
        )}
        {user.plan_name && (
          <span className="inline-flex items-center gap-1 text-[10px] text-brand-primary bg-brand-primary/5 rounded px-1.5 py-0.5 border border-brand-primary/20">
            <CreditCard className="w-2.5 h-2.5" />
            {user.plan_name}
          </span>
        )}
        {user.activation_code && (
          <span className="inline-flex items-center gap-1 text-[10px] text-chart-cyan bg-chart-cyan/5 rounded px-1.5 py-0.5 border border-chart-cyan/20">
            <Key className="w-2.5 h-2.5" />
            {t('sa.activationCode')}
          </span>
        )}
        {user.stripe_subscription_id && (
          <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success/5 rounded px-1.5 py-0.5 border border-success/20">
            <CreditCard className="w-2.5 h-2.5" />
            {t('sa.stripeLabel')}
          </span>
        )}
      </div>

      {/* Date */}
      <div className="mt-2 text-[10px] text-text-muted">
        {formatDate(user.created_at)}
      </div>

      {/* Full view action — always visible on mobile, hover-reveal on desktop */}
      <button
        onClick={(e) => { e.stopPropagation(); onFullView(); }}
        className="absolute top-2 right-2 p-1.5 rounded bg-bg-secondary/90 border border-glass-border text-text-muted hover:text-brand-primary transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        title={t('sa.viewFullDetails')}
      >
        <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  );
}
