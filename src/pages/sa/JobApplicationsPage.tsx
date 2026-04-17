import { useState, useEffect, useCallback, Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Briefcase, Search, X, ExternalLink, FileText,
  User, Mail, Phone, Linkedin, Loader2,
  ChevronDown, Eye, Send,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { SAPageHeader } from './SAPageHeader';
import { formatDateTime } from '@/lib/dateFormat';
import { useToast } from '@/contexts/ToastContext';

/* ─── Types ────────────────────────────────────────────── */

interface OpportunityRef {
  id: string;
  title: string;
  slug: string;
  department: string | null;
}

interface Application {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  answers: Record<string, string>;
  status: string;
  created_at: string;
  opportunity: OpportunityRef;
}

interface QuestionRef {
  id: string;
  question_text: string;
  opportunity_id: string;
}

type Status = 'new' | 'reviewing' | 'interview' | 'rejected' | 'hired';
const ALL_STATUSES: Status[] = ['new', 'reviewing', 'interview', 'rejected', 'hired'];

const STATUS_COLORS: Record<Status, string> = {
  new: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  reviewing: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  interview: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  rejected: 'bg-error/15 text-error border-error/25',
  hired: 'bg-success/15 text-success border-success/25',
};

/* ─── Component ────────────────────────────────────────── */

export function JobApplicationsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [applications, setApplications] = useState<Application[]>([]);
  const [questions, setQuestions] = useState<QuestionRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ applications: Application[]; questions: QuestionRef[] }>('/admin-careers');
      setApplications(res.data.applications);
      setQuestions(res.data.questions);
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await apiClient.put<Application>('/admin-careers', { id, status });
      setApplications(prev => prev.map(a => a.id === id ? res.data : a));
      if (selectedApp?.id === id) setSelectedApp(res.data);
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdating(null);
    }
  };

  const filtered = applications.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.full_name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.opportunity.title.toLowerCase().includes(q) ||
        (a.phone && a.phone.includes(q))
      );
    }
    return true;
  });

  const selectedApps = useMemo(
    () => applications.filter(a => selectedIds.has(a.id)),
    [applications, selectedIds],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allVisibleSelected = filtered.length > 0 && filtered.every(a => selectedIds.has(a.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach(a => next.delete(a.id));
      } else {
        filtered.forEach(a => next.add(a.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const sendBulkEmail = async (subject: string, content: string) => {
    const ids = Array.from(selectedIds);
    const res = await apiClient.post<{ sent: number; failed: number; total: number }>(
      '/admin-careers',
      { ids, subject, content },
    );
    const { sent, failed } = res.data;
    if (failed > 0) {
      showToast(t('sa.jobApps.email.sentWithFailures', { sent, failed }), 'error');
    } else {
      showToast(t('sa.jobApps.email.sentSuccess', { count: sent }), 'success');
    }
    setEmailModalOpen(false);
    clearSelection();
  };

  const getQuestionsForOpp = (oppId: string) => questions.filter(q => q.opportunity_id === oppId);

  const allVisibleSelected = filtered.length > 0 && filtered.every(a => selectedIds.has(a.id));
  const someVisibleSelected = filtered.some(a => selectedIds.has(a.id));

  const statusCounts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = applications.filter(a => a.status === s).length;
    return acc;
  }, {} as Record<Status, number>);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="dashboard-card p-6 h-20 animate-pulse bg-glass-element" />
        ))}
      </div>
    );
  }

  return (
    <div className="stagger-enter space-y-6">
      <SAPageHeader
        title={t('sa.jobApps.title')}
        subtitle={t('sa.jobApps.subtitle', { count: applications.length })}
        icon={<Briefcase className="w-6 h-6 text-brand-primary" />}
      />

      {/* KPI pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            statusFilter === 'all'
              ? 'bg-brand-primary/15 text-brand-primary border-brand-primary/30'
              : 'bg-glass-element text-text-secondary border-glass-border hover:border-text-muted'
          }`}
        >
          {t('sa.filterAll')} ({applications.length})
        </button>
        {ALL_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              statusFilter === s
                ? STATUS_COLORS[s]
                : 'bg-glass-element text-text-secondary border-glass-border hover:border-text-muted'
            }`}
          >
            {t(`sa.jobApps.status.${s}`)} ({statusCounts[s] || 0})
          </button>
        ))}
      </div>

      {/* Search + Bulk actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('sa.jobApps.searchPlaceholder')}
            className="input-field !pl-10 !py-2 !text-sm w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-primary/10 border border-brand-primary/25">
            <span className="text-sm font-medium text-brand-primary">
              {t('sa.jobApps.selectedCount', { count: selectedIds.size })}
            </span>
            <button
              onClick={() => setEmailModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-brand-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <Send className="w-3.5 h-3.5" />
              {t('sa.jobApps.email.sendButton')}
            </button>
            <button
              onClick={clearSelection}
              className="text-text-muted hover:text-text-primary"
              title={t('sa.jobApps.clearSelection')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="dashboard-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={el => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                    onChange={toggleSelectAll}
                    aria-label={t('sa.jobApps.selectAll')}
                    className="w-4 h-4 cursor-pointer accent-brand-primary"
                  />
                </th>
                <th className="text-left">{t('sa.jobApps.colName')}</th>
                <th className="text-left hidden md:table-cell">{t('sa.jobApps.colEmail')}</th>
                <th className="text-left hidden lg:table-cell">{t('sa.jobApps.colOpportunity')}</th>
                <th className="text-center">{t('sa.jobApps.colStatus')}</th>
                <th className="text-left hidden sm:table-cell">{t('sa.jobApps.colDate')}</th>
                <th className="text-center">{t('sa.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="!text-center !font-body !text-text-secondary py-8">
                    {t('sa.jobApps.noApplications')}
                  </td>
                </tr>
              ) : (
                filtered.map(app => (
                  <Fragment key={app.id}>
                    <tr className="cursor-pointer hover:bg-glass-hover/50 transition-colors" onClick={() => setSelectedApp(app)}>
                      <td className="text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(app.id)}
                          onChange={() => toggleSelect(app.id)}
                          aria-label={t('sa.jobApps.selectRow')}
                          className="w-4 h-4 cursor-pointer accent-brand-primary"
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-brand-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-text-primary truncate">{app.full_name}</div>
                            <div className="text-xs text-text-muted md:hidden truncate">{app.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell !font-body text-sm">{app.email}</td>
                      <td className="hidden lg:table-cell !font-body text-sm">
                        <span className="text-text-secondary">{app.opportunity.title}</span>
                      </td>
                      <td className="text-center" onClick={e => e.stopPropagation()}>
                        <div className="relative inline-block">
                          <select
                            value={app.status}
                            onChange={e => updateStatus(app.id, e.target.value)}
                            disabled={updating === app.id}
                            className={`appearance-none px-3 py-1 pr-7 rounded-full text-xs font-semibold border cursor-pointer outline-none transition-colors ${STATUS_COLORS[app.status as Status] || STATUS_COLORS.new}`}
                          >
                            {ALL_STATUSES.map(s => (
                              <option key={s} value={s}>{t(`sa.jobApps.status.${s}`)}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" />
                        </div>
                      </td>
                      <td className="hidden sm:table-cell !font-body text-sm text-text-secondary">
                        {formatDateTime(app.created_at, 'dateTime')}
                      </td>
                      <td className="text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedApp(app); }}
                          className="icon-btn"
                          title={t('sa.jobApps.viewDetails')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedApp && (
        <ApplicationModal
          app={selectedApp}
          questions={getQuestionsForOpp(selectedApp.opportunity.id)}
          updating={updating === selectedApp.id}
          onUpdateStatus={(status) => updateStatus(selectedApp.id, status)}
          onClose={() => setSelectedApp(null)}
          t={t}
        />
      )}

      {/* Bulk Email Modal */}
      {emailModalOpen && (
        <BulkEmailModal
          recipients={selectedApps}
          onClose={() => setEmailModalOpen(false)}
          onSend={sendBulkEmail}
          t={t}
        />
      )}
    </div>
  );
}

/* ─── Bulk Email Modal ─────────────────────────────────────── */

interface BulkEmailModalProps {
  recipients: Application[];
  onClose: () => void;
  onSend: (subject: string, content: string) => Promise<void>;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function BulkEmailModal({ recipients, onClose, onSend, t }: BulkEmailModalProps) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, sending]);

  const canSend = subject.trim().length > 0 && content.trim().length > 0 && recipients.length > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await onSend(subject.trim(), content);
    } catch (err) {
      console.error('Failed to send bulk email:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={sending ? undefined : onClose}>
      <div className="absolute inset-0 bg-bg-primary/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-bg-secondary border border-glass-border rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-bg-secondary/95 backdrop-blur-sm border-b border-glass-border px-6 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Mail className="w-5 h-5 text-brand-primary" />
              {t('sa.jobApps.email.modalTitle')}
            </h2>
            <p className="text-sm text-text-secondary">
              {t('sa.jobApps.email.modalSubtitle', { count: recipients.length })}
            </p>
          </div>
          <button onClick={onClose} disabled={sending} className="icon-btn shrink-0 ml-4 disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2">
              {t('sa.jobApps.email.recipientsLabel')}
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-glass-element rounded-lg border border-glass-border">
              {recipients.map(r => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary text-xs border border-brand-primary/20"
                  title={r.email}
                >
                  {r.full_name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2">
              {t('sa.jobApps.email.subjectLabel')}
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              disabled={sending}
              placeholder={t('sa.jobApps.email.subjectPlaceholder')}
              className="input-field w-full !text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2">
              {t('sa.jobApps.email.bodyLabel')}
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              disabled={sending}
              placeholder={t('sa.jobApps.email.bodyPlaceholder')}
              rows={10}
              className="input-field w-full !text-sm resize-y min-h-[200px]"
            />
            <p className="text-xs text-text-muted mt-1">
              {t('sa.jobApps.email.bodyHelp')}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-glass-border">
            <button
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-glass-element transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending
                ? t('sa.jobApps.email.sending')
                : t('sa.jobApps.email.sendToCount', { count: recipients.length })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Detail Modal ─────────────────────────────────────── */

interface ModalProps {
  app: Application;
  questions: QuestionRef[];
  updating: boolean;
  onUpdateStatus: (status: string) => void;
  onClose: () => void;
  t: (key: string) => string;
}

function ApplicationModal({ app, questions, updating, onUpdateStatus, onClose, t }: ModalProps) {
  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const questionMap = new Map(questions.map(q => [q.id, q.question_text]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg-primary/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-bg-secondary border border-glass-border rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-secondary/95 backdrop-blur-sm border-b border-glass-border px-6 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-text-primary truncate">{app.full_name}</h2>
            <p className="text-sm text-text-secondary truncate">{app.opportunity.title}</p>
          </div>
          <button onClick={onClose} className="icon-btn shrink-0 ml-4">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status changer */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-text-secondary">{t('sa.jobApps.colStatus')}:</span>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => onUpdateStatus(s)}
                  disabled={updating || app.status === s}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    app.status === s
                      ? STATUS_COLORS[s] + ' ring-2 ring-current/20'
                      : 'bg-glass-element text-text-secondary border-glass-border hover:border-text-muted'
                  } ${updating ? 'opacity-50 cursor-wait' : ''}`}
                >
                  {updating && app.status !== s ? (
                    <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                  ) : null}
                  {t(`sa.jobApps.status.${s}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Personal info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoItem icon={<Mail className="w-4 h-4" />} label={t('sa.jobApps.colEmail')} value={app.email} href={`mailto:${app.email}`} />
            <InfoItem icon={<Phone className="w-4 h-4" />} label={t('sa.jobApps.colPhone')} value={app.phone || '—'} href={app.phone ? `tel:${app.phone}` : undefined} />
            {app.linkedin_url && (
              <InfoItem icon={<Linkedin className="w-4 h-4" />} label="LinkedIn" value={app.linkedin_url} href={app.linkedin_url} external />
            )}
            {app.resume_url && (
              <InfoItem icon={<FileText className="w-4 h-4" />} label={t('sa.jobApps.resume')} value={t('sa.jobApps.viewResume')} href={app.resume_url} external />
            )}
          </div>

          {/* Answers */}
          {Object.keys(app.answers).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary border-b border-glass-border pb-2">
                {t('sa.jobApps.answers')}
              </h3>
              {Object.entries(app.answers).map(([qId, answer]) => (
                <div key={qId} className="bg-glass-element rounded-lg p-3">
                  <p className="text-xs font-semibold text-text-secondary mb-1">
                    {questionMap.get(qId) || qId}
                  </p>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">{answer}</p>
                </div>
              ))}
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-text-muted pt-2 border-t border-glass-border flex items-center justify-between">
            <span>{t('sa.jobApps.appliedAt')}: {formatDateTime(app.created_at, 'dateTime')}</span>
            <code className="text-text-muted/60">{app.id.slice(0, 8)}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Info Item ─────────────────────────────────────────── */

function InfoItem({ icon, label, value, href, external }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-glass-element rounded-lg">
      <div className="shrink-0 mt-0.5 text-text-muted">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-text-muted mb-0.5">{label}</p>
        {href ? (
          <a
            href={href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className="text-sm text-brand-primary hover:underline truncate block"
          >
            {value}
            {external && <ExternalLink className="w-3 h-3 inline ml-1 -mt-0.5" />}
          </a>
        ) : (
          <p className="text-sm text-text-primary truncate">{value}</p>
        )}
      </div>
    </div>
  );
}
