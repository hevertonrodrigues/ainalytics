import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mail, Search, X, Star, Archive, Trash2, Eye, EyeOff,
  ChevronLeft, ChevronRight, Loader2, Inbox, MailOpen,
  ArrowLeft, StarOff, Send, Reply, MessagesSquare,
  ChevronDown, RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { SAPageHeader } from './SAPageHeader';
import { formatDate, formatDateTime } from '@/lib/dateFormat';

/* ─── Types ────────────────────────────────────────────── */

interface Email {
  id: string;
  thread_id?: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  received_at: string;
  message_count?: number;
}

interface Meta {
  page: number;
  pageSize: number;
  totalFiltered: number;
  total: number;
  unread: number;
  starred: number;
}

type Filter = 'inbox' | 'unread' | 'starred' | 'archived' | 'all';

const FILTERS: { key: Filter; translationKey: string }[] = [
  { key: 'inbox', translationKey: 'sa.inbox.filterInbox' },
  { key: 'unread', translationKey: 'sa.inbox.filterUnread' },
  { key: 'starred', translationKey: 'sa.inbox.filterStarred' },
  { key: 'archived', translationKey: 'sa.inbox.filterArchived' },
];

const OUR_EMAIL = 'contato@mail.ainalytics.tech';

/* ─── Helpers ──────────────────────────────────────────── */

// Deterministic avatar palette. Hashing the email means a given sender
// always lands on the same color across the app.
const AVATAR_COLORS = [
  'bg-violet-500/15 text-violet-400 border-violet-500/25',
  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  'bg-amber-500/15 text-amber-400 border-amber-500/25',
  'bg-rose-500/15 text-rose-400 border-rose-500/25',
  'bg-sky-500/15 text-sky-400 border-sky-500/25',
  'bg-orange-500/15 text-orange-400 border-orange-500/25',
  'bg-pink-500/15 text-pink-400 border-pink-500/25',
  'bg-teal-500/15 text-teal-400 border-teal-500/25',
  'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function avatarColor(email: string): string {
  if (email === OUR_EMAIL) return 'bg-brand-primary/15 text-brand-primary border-brand-primary/30';
  return AVATAR_COLORS[hashString(email.toLowerCase()) % AVATAR_COLORS.length]!;
}

function initials(name: string | null, email: string): string {
  const source = (name || email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

/* ─── Component ────────────────────────────────────────── */

export function InboxPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [emails, setEmails] = useState<Email[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, pageSize: 30, totalFiltered: 0, total: 0, unread: 0, starred: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('inbox');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [selectedThread, setSelectedThread] = useState<Email[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const initializedThreadRef = useRef<string | null>(null);

  const threadKey = selectedThread?.[0]?.thread_id || selectedThread?.[0]?.id || null;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch emails
  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter, page: String(page), pageSize: '30' });
      if (searchDebounced.trim()) params.set('search', searchDebounced.trim());

      const res = await apiClient.get<Email[]>(`/admin-inbox?${params.toString()}`);
      setEmails(res.data);
      if (res.meta) setMeta(res.meta as unknown as Meta);
    } catch (err) {
      console.error('Failed to load inbox:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, page, searchDebounced]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);
  useEffect(() => { setPage(1); }, [filter, searchDebounced]);

  // When a thread opens, keep only the LAST message expanded by default (gmail-style).
  // Re-runs only when the underlying thread_id changes, not on every flag-update.
  useEffect(() => {
    if (!selectedThread || selectedThread.length === 0) {
      initializedThreadRef.current = null;
      setExpandedIds(new Set());
      return;
    }
    if (initializedThreadRef.current === threadKey) return;
    initializedThreadRef.current = threadKey;
    const latest = selectedThread[selectedThread.length - 1]!;
    setExpandedIds(new Set([latest.id]));
  }, [selectedThread, threadKey]);

  // Focus reply textarea when it opens.
  useEffect(() => {
    if (replyOpen) {
      const id = requestAnimationFrame(() => replyTextareaRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [replyOpen]);

  /* ─── Actions ────────────────────────────────────────── */

  const openEmail = async (email: Email) => {
    setDetailLoading(true);
    setReplyOpen(false);
    setReplyContent('');
    try {
      const res = await apiClient.patch<Email[]>('/admin-inbox', { id: email.id });
      setSelectedThread(res.data);
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_read: true } : e));
      setMeta(prev => ({ ...prev, unread: Math.max(0, prev.unread - (email.is_read ? 0 : 1)) }));
    } catch (err) {
      console.error('Failed to load thread:', err);
      setSelectedThread([email]);
    } finally {
      setDetailLoading(false);
    }
  };

  const updateFlags = async (
    target: { threadIds?: string[]; ids?: string[] },
    flags: Partial<Pick<Email, 'is_read' | 'is_starred' | 'is_archived'>>,
  ) => {
    try {
      const payload: Record<string, unknown> = { ...flags };
      if (target.threadIds?.length) payload.thread_ids = target.threadIds;
      else if (target.ids?.length) payload.ids = target.ids;
      else return;

      await apiClient.put('/admin-inbox', payload);

      const matches = (e: Email): boolean =>
        Boolean(target.threadIds && e.thread_id && target.threadIds.includes(e.thread_id)) ||
        Boolean(target.ids && target.ids.includes(e.id));

      setEmails(prev => prev.map(e => matches(e) ? { ...e, ...flags } : e));
      if (selectedThread) {
        setSelectedThread(prev => prev ? prev.map(e => matches(e) ? { ...e, ...flags } : e) : null);
      }
      fetchEmails();
    } catch (err) {
      console.error('Failed to update email:', err);
    }
  };

  const deleteEmail = async (target: { threadIds?: string[]; ids?: string[] }) => {
    if (!window.confirm(t('sa.inbox.deleteConfirm'))) return;
    try {
      const { EDGE_FUNCTION_BASE, SUPABASE_ANON_KEY } = await import('@/lib/constants');
      const { supabase } = await import('@/lib/supabase');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || '';

      const body: Record<string, unknown> = {};
      if (target.threadIds?.length) body.thread_ids = target.threadIds;
      else if (target.ids?.length) body.ids = target.ids;
      else return;

      const res = await fetch(`${EDGE_FUNCTION_BASE}/admin-inbox`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const matches = (e: Email) =>
          Boolean(target.threadIds && e.thread_id && target.threadIds.includes(e.thread_id)) ||
          Boolean(target.ids && target.ids.includes(e.id));
        setEmails(prev => prev.filter(e => !matches(e)));
        if (selectedThread && selectedThread.some(matches)) setSelectedThread(null);
        fetchEmails();
      }
    } catch (err) {
      console.error('Failed to delete email:', err);
    }
  };

  const sendReply = async (emailId: string) => {
    if (!replyContent.trim()) return;
    setSendingReply(true);
    try {
      const htmlContent = replyContent.replace(/\n/g, '<br/>');
      const res = await apiClient.post<{ success: boolean; email: Email }>('/admin-inbox', { emailId, content: htmlContent });

      setReplyContent('');
      setReplyOpen(false);

      if (res.data?.email && selectedThread) {
        const appended = [...selectedThread, res.data.email];
        setSelectedThread(appended);
        // Auto-expand the new outgoing message so the user sees it immediately.
        setExpandedIds(prev => {
          const next = new Set(prev);
          next.add(res.data.email.id);
          return next;
        });
      }

      showToast(t('sa.inbox.replySuccess') || 'Reply sent successfully');
      fetchEmails();
    } catch (err) {
      console.error('Failed to send reply:', err);
      showToast(t('sa.inbox.replyError') || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandCollapseAll = () => {
    if (!selectedThread) return;
    const allIds = selectedThread.map(e => e.id);
    const allExpanded = allIds.every(id => expandedIds.has(id));
    setExpandedIds(allExpanded ? new Set() : new Set(allIds));
  };

  /* ─── Helpers ────────────────────────────────────────── */

  // Gmail-style smart date: today → HH:mm; yesterday → "Yesterday"; this week → weekday; this year → Mon DD; else → Mon DD, YYYY.
  const smartDate = useCallback((iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const dayDiff = Math.round((startOf(now) - startOf(d)) / 86_400_000);

    if (dayDiff === 0) return formatDateTime(d, { hour: '2-digit', minute: '2-digit' });
    if (dayDiff === 1) return t('sa.inbox.yesterday');
    if (dayDiff < 7) return formatDate(d, { weekday: 'short' });
    if (d.getFullYear() === now.getFullYear()) return formatDate(d, 'shortDate');
    return formatDate(d, 'shortDateYear');
  }, [t]);

  const totalPages = Math.ceil(meta.totalFiltered / meta.pageSize) || 1;

  const previewText = (e: Email) => {
    if (!e.body_text) return '';
    return e.body_text.slice(0, 160).replace(/\s+/g, ' ').trim();
  };

  const senderDisplay = (e: Email) =>
    e.from_email === OUR_EMAIL ? t('sa.inbox.you') : (e.from_name || e.from_email);

  const filterCount = useMemo(() => ({
    inbox: meta.total,
    unread: meta.unread,
    starred: meta.starred,
    archived: undefined,
    all: undefined,
  }), [meta]);

  /* ─── Detail View ────────────────────────────────────── */

  if (selectedThread && selectedThread.length > 0) {
    const latestEmail = selectedThread[selectedThread.length - 1]!;
    const rootEmail = selectedThread[0]!;
    const threadSubject = rootEmail.subject || t('sa.inbox.noSubject');
    const threadTargetId = rootEmail.thread_id || rootEmail.id;
    const msgCount = selectedThread.length;
    const allExpanded = selectedThread.every(e => expandedIds.has(e.id));

    // The "state" of the thread for top toolbar reflects the aggregate.
    const anyStarred = selectedThread.some(e => e.is_starred);
    const anyUnread = selectedThread.some(e => !e.is_read);
    const isArchived = selectedThread.every(e => e.is_archived);

    return (
      <div className="stagger-enter space-y-3">
        {/* Sticky action bar */}
        <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 flex items-center justify-between gap-3 py-3 border-b border-glass-border bg-bg-primary/85 backdrop-blur-md">
          <button
            onClick={() => setSelectedThread(null)}
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t('sa.inbox.backToList')}</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => updateFlags({ threadIds: [threadTargetId] }, { is_starred: !anyStarred })}
              className="icon-btn"
              title={anyStarred ? t('sa.inbox.unstar') : t('sa.inbox.star')}
            >
              {anyStarred
                ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                : <StarOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => updateFlags({ threadIds: [threadTargetId] }, { is_read: anyUnread ? true : false })}
              className="icon-btn"
              title={anyUnread ? t('sa.inbox.markRead') : t('sa.inbox.markUnread')}
            >
              {anyUnread ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                updateFlags({ threadIds: [threadTargetId] }, { is_archived: !isArchived });
                setSelectedThread(null);
              }}
              className="icon-btn"
              title={isArchived ? t('sa.inbox.unarchive') : t('sa.inbox.archive')}
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={() => deleteEmail({ threadIds: [threadTargetId] })}
              className="icon-btn text-error hover:text-error"
              title={t('sa.inbox.delete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {msgCount > 1 && (
              <>
                <span className="mx-1 w-px h-5 bg-glass-border" />
                <button
                  onClick={expandCollapseAll}
                  className="icon-btn"
                  title={allExpanded ? t('sa.inbox.collapseAll') : t('sa.inbox.expandAll')}
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${allExpanded ? 'rotate-180' : ''}`} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Thread area */}
        <div className="space-y-3 pt-2">
          {/* Thread subject */}
          <div className="pb-3 border-b border-glass-border/60">
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary leading-tight break-words">
              {threadSubject}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
              <MessagesSquare className="w-3.5 h-3.5" />
              <span>{t('sa.inbox.messages', { count: msgCount })}</span>
            </div>
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center py-16 dashboard-card">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            </div>
          ) : (
            selectedThread.map((email, idx) => {
              const isOutgoing = email.from_email === OUR_EMAIL;
              const isExpanded = expandedIds.has(email.id);
              const isLast = idx === selectedThread.length - 1;

              return (
                <div
                  key={email.id}
                  className={`rounded-xl border transition-colors ${
                    isOutgoing
                      ? 'border-brand-primary/20 bg-brand-primary/[0.04]'
                      : 'border-glass-border bg-glass-element'
                  } ${isLast ? 'shadow-lg shadow-brand-primary/5' : ''}`}
                >
                  {/* Collapsed preview OR expanded header */}
                  <button
                    type="button"
                    onClick={() => msgCount > 1 && toggleExpanded(email.id)}
                    disabled={msgCount === 1}
                    className={`w-full flex items-start gap-3 px-4 sm:px-5 py-3 text-left ${
                      msgCount > 1 ? 'hover:bg-glass-hover/30 cursor-pointer' : 'cursor-default'
                    } ${isExpanded ? 'border-b border-glass-border/70' : ''} transition-colors`}
                  >
                    {/* Avatar */}
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold border ${avatarColor(email.from_email)}`}>
                      {initials(email.from_name, email.from_email)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-text-primary truncate max-w-[220px]">
                          {isOutgoing ? t('sa.inbox.you') : (email.from_name || email.from_email)}
                        </span>
                        {isOutgoing && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-brand-primary/15 text-brand-primary">
                            {t('sa.inbox.you')}
                          </span>
                        )}
                        {!email.is_read && !isOutgoing && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-blue-500/15 text-blue-400">
                            {t('sa.inbox.filterUnread')}
                          </span>
                        )}
                        <span className="text-xs text-text-muted ml-auto shrink-0 tabular-nums">
                          {smartDate(email.received_at)}
                        </span>
                      </div>

                      {isExpanded ? (
                        <div className="mt-0.5 space-y-0.5 text-xs text-text-muted">
                          <div className="truncate">
                            <span className="text-text-secondary/80">&lt;{email.from_email}&gt;</span>
                          </div>
                          <div className="truncate">
                            {t('sa.inbox.to')}: <span className="text-text-secondary/90">{email.to_email}</span>
                            <span className="mx-1.5">·</span>
                            <span>{formatDateTime(email.received_at, 'dateTime')}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-0.5 text-xs text-text-muted truncate">
                          {previewText(email) || <span className="italic">(empty body)</span>}
                        </div>
                      )}
                    </div>

                    {msgCount > 1 && (
                      <ChevronDown
                        className={`w-4 h-4 text-text-muted shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    )}
                  </button>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="px-4 sm:px-5 py-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      {email.body_html ? (
                        <div
                          className="prose prose-sm prose-invert max-w-none [&_a]:text-brand-primary [&_img]:max-w-full [&_img]:rounded-lg"
                          dangerouslySetInnerHTML={{ __html: email.body_html }}
                        />
                      ) : email.body_text ? (
                        <pre className="whitespace-pre-wrap text-sm text-text-primary font-body leading-relaxed">
                          {email.body_text}
                        </pre>
                      ) : (
                        <p className="text-sm text-text-muted italic">(empty body)</p>
                      )}

                      {/* Per-message reply shortcut (only on last message) */}
                      {isLast && !replyOpen && !isOutgoing && (
                        <div className="mt-4 pt-3 border-t border-glass-border/60">
                          <button
                            onClick={() => setReplyOpen(true)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-primary/10 text-brand-primary text-xs font-semibold hover:bg-brand-primary/20 transition-colors"
                          >
                            <Reply className="w-3.5 h-3.5" />
                            {t('sa.inbox.replyBtn')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Reply composer */}
          {!detailLoading && selectedThread.length > 0 && replyOpen && (
            <div className="rounded-xl border border-brand-primary/30 bg-glass-element overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="px-4 sm:px-5 py-2.5 border-b border-glass-border/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-text-secondary min-w-0">
                  <Reply className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                  <span className="font-medium shrink-0">{t('sa.inbox.composing')}:</span>
                  <span className="truncate text-text-muted">
                    {latestEmail.from_email === OUR_EMAIL
                      ? latestEmail.to_email
                      : (latestEmail.from_name || latestEmail.from_email)}
                  </span>
                </div>
                <button
                  onClick={() => setReplyOpen(false)}
                  disabled={sendingReply}
                  className="icon-btn !p-1 shrink-0"
                  title={t('sa.inbox.cancel')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                ref={replyTextareaRef}
                value={replyContent}
                onChange={e => setReplyContent(e.target.value)}
                placeholder={t('sa.inbox.replyPlaceholder')}
                className="w-full min-h-[160px] p-4 bg-transparent text-sm text-text-primary focus:outline-none resize-y border-0"
                disabled={sendingReply}
              />
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 border-t border-glass-border/60 bg-bg-primary/40">
                <span className="text-xs text-text-muted hidden sm:inline">
                  {replyContent.trim().length > 0 && `${replyContent.trim().length} chars`}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => { setReplyOpen(false); setReplyContent(''); }}
                    disabled={sendingReply}
                    className="px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {t('sa.inbox.cancel')}
                  </button>
                  <button
                    onClick={() => sendReply(latestEmail.id)}
                    disabled={sendingReply || !replyContent.trim()}
                    className="btn-primary !px-4 !py-1.5 !text-xs"
                  >
                    {sendingReply ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {t('sa.inbox.sending')}
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        {t('sa.inbox.sendReply')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reply CTA (when composer closed) */}
          {!detailLoading && selectedThread.length > 0 && !replyOpen && (
            <button
              onClick={() => setReplyOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-glass-border text-text-secondary hover:border-brand-primary/40 hover:text-brand-primary hover:bg-brand-primary/5 transition-colors text-sm font-medium"
            >
              <Reply className="w-4 h-4" />
              {t('sa.inbox.replyBtn')}
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ─── List View ──────────────────────────────────────── */

  return (
    <div className="stagger-enter space-y-5">
      <SAPageHeader
        title={t('sa.inbox.title')}
        subtitle={t('sa.inbox.subtitle')}
        icon={<Mail className="w-6 h-6 text-brand-primary" />}
      >
        <button
          onClick={fetchEmails}
          disabled={loading}
          className="icon-btn"
          title={t('sa.inbox.refresh')}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </SAPageHeader>

      {/* Filter pills + search share a toolbar row */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {FILTERS.map(f => {
            const count = filterCount[f.key];
            const active = filter === f.key;
            const accent =
              f.key === 'unread'   ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
              f.key === 'starred'  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
              f.key === 'archived' ? 'bg-violet-500/15 text-violet-400 border-violet-500/30' :
                                     'bg-brand-primary/15 text-brand-primary border-brand-primary/30';
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  active ? accent : 'bg-glass-element text-text-secondary border-glass-border hover:border-text-muted'
                }`}
              >
                {t(f.translationKey)}
                {count !== undefined && count > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full text-[10px] font-bold tabular-nums ${
                    active ? 'bg-current/20' : 'bg-glass-border text-text-muted'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 max-w-md lg:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('sa.inbox.searchPlaceholder')}
            className="input-field !pl-10 !py-2 !text-sm w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Email list */}
      {loading ? (
        <div className="dashboard-card overflow-hidden divide-y divide-glass-border/50">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
              <div className="w-4 h-4 rounded bg-glass-element" />
              <div className="w-9 h-9 rounded-full bg-glass-element" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 rounded bg-glass-element" />
                <div className="h-3 w-2/3 rounded bg-glass-element" />
              </div>
              <div className="h-3 w-10 rounded bg-glass-element" />
            </div>
          ))}
        </div>
      ) : emails.length === 0 ? (
        <div className="dashboard-card p-12 text-center">
          <Inbox className="w-12 h-12 text-text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-1">{t('sa.inbox.emptyInbox')}</h3>
          <p className="text-sm text-text-secondary">{t('sa.inbox.emptyInboxDesc')}</p>
        </div>
      ) : (
        <div className="dashboard-card overflow-hidden divide-y divide-glass-border/50">
          {emails.map(email => {
            const hasThread = (email.message_count ?? 1) > 1;
            const isOutgoing = email.from_email === OUR_EMAIL;
            return (
              <div
                key={email.id}
                onClick={() => openEmail(email)}
                className={`group relative flex items-center gap-3 px-3 sm:px-4 py-2.5 cursor-pointer transition-colors ${
                  !email.is_read ? 'bg-brand-primary/[0.04]' : ''
                } hover:bg-glass-hover/60`}
              >
                {/* Unread left bar */}
                {!email.is_read && (
                  <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-brand-primary" />
                )}

                {/* Star */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    updateFlags({ threadIds: [email.thread_id || email.id] }, { is_starred: !email.is_starred });
                  }}
                  className="shrink-0 p-1 -m-1 hover:scale-110 transition-transform"
                  title={email.is_starred ? t('sa.inbox.unstar') : t('sa.inbox.star')}
                >
                  {email.is_starred
                    ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    : <Star className="w-4 h-4 text-text-muted/30 hover:text-amber-400/60 transition-colors" />}
                </button>

                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold border ${avatarColor(email.from_email)}`}>
                  {initials(email.from_name, email.from_email)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm truncate ${!email.is_read ? 'font-bold text-text-primary' : 'font-medium text-text-primary'}`}>
                      {senderDisplay(email)}
                    </span>
                    {isOutgoing && (
                      <span className="px-1 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-brand-primary/10 text-brand-primary/80 shrink-0 hidden sm:inline-block">
                        {t('sa.inbox.me')}
                      </span>
                    )}
                    {hasThread && (
                      <span className="shrink-0 inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded text-[10px] font-bold bg-glass-border/70 text-text-secondary tabular-nums">
                        {email.message_count}
                      </span>
                    )}
                    <span className="text-xs text-text-muted shrink-0 ml-auto tabular-nums">
                      {smartDate(email.received_at)}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className={`text-sm truncate ${!email.is_read ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                      {email.subject || t('sa.inbox.noSubject')}
                    </span>
                    <span className="text-xs text-text-muted truncate hidden md:inline">
                      <span className="mx-1 text-text-muted/40">·</span>
                      {previewText(email)}
                    </span>
                  </div>
                </div>

                {/* Hover actions */}
                <div className="hidden lg:flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      updateFlags({ threadIds: [email.thread_id || email.id] }, { is_archived: !email.is_archived });
                    }}
                    className="icon-btn !p-1.5"
                    title={email.is_archived ? t('sa.inbox.unarchive') : t('sa.inbox.archive')}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      updateFlags({ threadIds: [email.thread_id || email.id] }, { is_read: !email.is_read });
                    }}
                    className="icon-btn !p-1.5"
                    title={email.is_read ? t('sa.inbox.markUnread') : t('sa.inbox.markRead')}
                  >
                    {email.is_read ? <MailOpen className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      deleteEmail({ threadIds: [email.thread_id || email.id] });
                    }}
                    className="icon-btn !p-1.5 text-text-muted hover:text-error"
                    title={t('sa.inbox.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span className="tabular-nums">
            {((page - 1) * meta.pageSize) + 1}–{Math.min(page * meta.pageSize, meta.totalFiltered)} {t('sa.inbox.of')} {meta.totalFiltered}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="icon-btn disabled:opacity-30"
              title={t('sa.inbox.prev')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs tabular-nums">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="icon-btn disabled:opacity-30"
              title={t('sa.inbox.next')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
