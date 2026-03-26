import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen,
  GripVertical,
} from 'lucide-react';
import type { CRMPipelineUser, KanbanStage } from './types';
import { KANBAN_STAGES } from './types';
import { apiClient } from '@/lib/api';

interface KanbanBoardProps {
  users: CRMPipelineUser[];
  searchQuery: string;
  onUserClick: (user: CRMPipelineUser) => void;
}

interface KanbanCustomizations {
  columnOrder?: KanbanStage[];
  collapsedColumns?: KanbanStage[];
}

const STAGE_CONFIG: Record<KanbanStage, { color: string; borderColor: string; bgColor: string; dotColor: string }> = {
  registered:         { color: 'text-warning',        borderColor: 'border-warning/30',        bgColor: 'bg-warning/5',         dotColor: 'bg-warning' },
  email_confirmed:    { color: 'text-chart-cyan',     borderColor: 'border-chart-cyan/30',     bgColor: 'bg-chart-cyan/5',      dotColor: 'bg-chart-cyan' },
  proposal_accepted:  { color: 'text-brand-accent',    borderColor: 'border-brand-accent/30',    bgColor: 'bg-brand-accent/5',     dotColor: 'bg-brand-accent' },
  trial_activation:   { color: 'text-brand-primary',  borderColor: 'border-brand-primary/30',  bgColor: 'bg-brand-primary/5',   dotColor: 'bg-brand-primary' },
  trial_stripe:       { color: 'text-chart-purple',   borderColor: 'border-chart-purple/30',   bgColor: 'bg-chart-purple/5',    dotColor: 'bg-chart-purple' },
  active_activation:  { color: 'text-success',        borderColor: 'border-success/30',        bgColor: 'bg-success/5',         dotColor: 'bg-success' },
  active_stripe:      { color: 'text-chart-green',    borderColor: 'border-chart-green/30',    bgColor: 'bg-chart-green/5',     dotColor: 'bg-chart-green' },
  cancelled:          { color: 'text-error',          borderColor: 'border-error/30',          bgColor: 'bg-error/5',           dotColor: 'bg-error' },
};

// ─── Persistence helpers ─────────────────────────────────────
async function loadCustomizations(): Promise<KanbanCustomizations> {
  try {
    const res = await apiClient.get<{ profile?: { sa_customizations?: KanbanCustomizations } }>('/users-me');
    return res.data?.profile?.sa_customizations || {};
  } catch { return {}; }
}

async function saveCustomizations(c: KanbanCustomizations) {
  try {
    await apiClient.put('/users-me', { sa_customizations: c });
  } catch { /* silent */ }
}

// ─── Main component ──────────────────────────────────────────
export function KanbanBoard({ users, searchQuery, onUserClick }: KanbanBoardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Activation-code group collapse (within column)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (code: string) => {
    setCollapsedGroups(prev => ({ ...prev, [code]: !prev[code] }));
  };

  // Column order & collapsed state
  const [columnOrder, setColumnOrder] = useState<KanbanStage[]>(KANBAN_STAGES);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<KanbanStage>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Load saved customizations on mount
  useEffect(() => {
    loadCustomizations().then(c => {
      if (c.columnOrder?.length) {
        // Ensure all stages are present even if new ones were added
        const ordered = c.columnOrder.filter(s => KANBAN_STAGES.includes(s));
        KANBAN_STAGES.forEach(s => { if (!ordered.includes(s)) ordered.push(s); });
        setColumnOrder(ordered);
      }
      if (c.collapsedColumns?.length) {
        setCollapsedColumns(new Set(c.collapsedColumns));
      }
      setLoaded(true);
    });
  }, []);

  // Persist customizations (debounced)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistCustomizations = useCallback((order: KanbanStage[], collapsed: Set<KanbanStage>) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveCustomizations({ columnOrder: order, collapsedColumns: Array.from(collapsed) });
    }, 500);
  }, []);

  const toggleColumn = (stage: KanbanStage) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage); else next.add(stage);
      persistCustomizations(columnOrder, next);
      return next;
    });
  };

  // Drag-and-drop column reorder
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx !== null && idx !== dragIdx) setDragOverIdx(idx);
  };
  const handleDragEnd = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      setColumnOrder(prev => {
        const next = [...prev];
        const [moved] = next.splice(dragIdx, 1);
        if (moved !== undefined) next.splice(dragOverIdx, 0, moved);
        persistCustomizations(next, collapsedColumns);
        return next;
      });
    }
    setDragIdx(null);
    setDragOverIdx(null);
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

  if (!loaded) return null;

  return (
    <div className="flex gap-2 overflow-x-auto h-[calc(100vh-320px)] min-h-[400px]">
      {columnOrder.map((stage, idx) => {
        const cfg = STAGE_CONFIG[stage];
        const stageUsers = columns[stage] || [];
        const isCollapsed = collapsedColumns.has(stage);
        const isDragTarget = dragOverIdx === idx && dragIdx !== idx;

        if (isCollapsed) {
          return (
            <div
              key={stage}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={`flex flex-col items-center w-10 shrink-0 rounded-lg border ${cfg.borderColor} ${cfg.bgColor} transition-all cursor-grab active:cursor-grabbing ${isDragTarget ? 'ring-2 ring-brand-primary' : ''}`}
            >
              <button
                onClick={() => toggleColumn(stage)}
                className={`p-2 ${cfg.color} hover:opacity-80 transition-opacity`}
                title={t(`sa.stage_${stage}`)}
              >
                <PanelLeftOpen className="w-3.5 h-3.5" />
              </button>
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${cfg.color} [writing-mode:vertical-lr] rotate-180 flex-1 whitespace-nowrap mt-1`}>
                {t(`sa.stage_${stage}`)}
              </span>
              <span className="text-[10px] text-text-muted font-medium bg-bg-secondary/60 rounded-full px-1.5 py-0.5 mb-2">
                {stageUsers.length}
              </span>
            </div>
          );
        }

        return (
          <div
            key={stage}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex flex-col min-w-[260px] w-[260px] shrink-0 transition-all ${isDragTarget ? 'ring-2 ring-brand-primary rounded-lg' : ''}`}
          >
            {/* Column header */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border-t-2 ${cfg.borderColor} ${cfg.bgColor} cursor-grab active:cursor-grabbing`}>
              <GripVertical className="w-3 h-3 text-text-muted/50 shrink-0" />
              <div className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${cfg.color} truncate`}>
                {t(`sa.stage_${stage}`)}
              </span>
              <span className="ml-auto text-[10px] text-text-muted font-medium bg-bg-secondary/60 rounded-full px-1.5 py-0.5">
                {stageUsers.length}
              </span>
              <button
                onClick={() => toggleColumn(stage)}
                className={`p-0.5 rounded ${cfg.color} hover:opacity-70 transition-opacity`}
                title={t('sa.collapseColumn')}
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 p-2 bg-bg-secondary/30 rounded-b-lg border border-t-0 border-glass-border overflow-y-auto">
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
                    const isGroupCollapsed = collapsedGroups[code] ?? false;
                    return (
                      <div key={code} className="mb-1">
                        <button
                          onClick={() => toggleGroup(code)}
                          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-brand-primary/5 border border-brand-primary/15 hover:bg-brand-primary/10 transition-colors text-left group/header"
                        >
                          {isGroupCollapsed ? (
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
                        {!isGroupCollapsed && (
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
