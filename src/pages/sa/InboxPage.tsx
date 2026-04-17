import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mail, Search, X, Star, Archive, Trash2, Eye, EyeOff,
  ChevronLeft, ChevronRight, Loader2, Inbox, MailOpen,
  ArrowLeft, StarOff, Send, MessageSquareReply,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { SAPageHeader } from './SAPageHeader';
import { formatDateTime } from '@/lib/dateFormat';

/* ─── Types ────────────────────────────────────────────── */

interface Email {
  id: string;
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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch emails
  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        filter,
        page: String(page),
        pageSize: '30',
      });
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

  // Reset page when filter or search changes
  useEffect(() => { setPage(1); }, [filter, searchDebounced]);

  // Open email thread
  const openEmail = async (email: Email) => {
    setDetailLoading(true);
    setReplyOpen(false);
    setReplyContent('');
    try {
      const res = await apiClient.patch<Email[]>('/admin-inbox', { id: email.id });
      // The backend returns an array of the thread emails
      setSelectedThread(res.data);
      // Update list item to show as read
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_read: true } : e));
      setMeta(prev => ({ ...prev, unread: Math.max(0, prev.unread - (email.is_read ? 0 : 1)) }));
    } catch (err) {
      console.error('Failed to load thread:', err);
      // Fallback: show what we have as a thread of 1
      setSelectedThread([email]);
    } finally {
      setDetailLoading(false);
    }
  };

  // Update email flags
  const updateFlags = async (ids: string[], flags: Partial<Pick<Email, 'is_read' | 'is_starred' | 'is_archived'>>) => {
    try {
      await apiClient.put('/admin-inbox', { ids, ...flags });
      setEmails(prev => prev.map(e => ids.includes(e.id) || (selectedThread && selectedThread.some(te => ids.includes(te.id) && te.id === e.id)) ? { ...e, ...flags } : e));
      if (selectedThread) {
        setSelectedThread(prev => prev ? prev.map(e => ids.includes(e.id) ? { ...e, ...flags } : e) : null);
      }
      // Refresh counts
      fetchEmails();
    } catch (err) {
      console.error('Failed to update email:', err);
    }
  };

  // Delete email
  const deleteEmail = async (ids: string[]) => {
    if (!window.confirm(t('sa.inbox.deleteConfirm'))) return;
    try {
      // apiClient.delete doesn't support body, so we use a raw fetch
      const { EDGE_FUNCTION_BASE } = await import('@/lib/constants');
      const { supabase } = await import('@/lib/supabase');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || '';

      const res = await fetch(`${EDGE_FUNCTION_BASE}/admin-inbox`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'apikey': (await import('@/lib/constants')).SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        setEmails(prev => prev.filter(e => !ids.includes(e.id)));
        if (selectedThread && selectedThread.some(e => ids.includes(e.id))) {
          setSelectedThread(null);
        }
        fetchEmails();
      }
    } catch (err) {
      console.error('Failed to delete email:', err);
    }
  };

  // Send reply
  const sendReply = async (emailId: string) => {
    if (!replyContent.trim()) return;
    setSendingReply(true);
    try {
      // Content could contain paragraphs. Replace newlines with <br> for HTML email.
      const htmlContent = replyContent.replace(/\n/g, '<br/>');
      const res = await apiClient.post<{ success: boolean; email: Email }>('/admin-inbox', { emailId, content: htmlContent });
      
      setReplyContent('');
      setReplyOpen(false);
      
      // Attempt to append to thread immediately for snappier UI
      if (res.data?.email && selectedThread) {
        setSelectedThread([...selectedThread, res.data.email]);
      }
      
      showToast(t('sa.inbox.replySuccess') || 'Reply sent successfully');
      
      // Return to inbox
      setSelectedThread(null);
      fetchEmails();
    } catch (err) {
      console.error('Failed to send reply:', err);
      showToast(t('sa.inbox.replyError') || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  // Helpers
  const senderDisplay = (e: Email) => e.from_name || e.from_email;
  const previewText = (e: Email) => {
    if (!e.body_text) return '';
    return e.body_text.slice(0, 120).replace(/\n/g, ' ');
  };

  const totalPages = Math.ceil(meta.totalFiltered / meta.pageSize) || 1;

  // ─── Detail View ─────────────────────────────────────
  if (selectedThread && selectedThread.length > 0) {
    const latestEmail = selectedThread[selectedThread.length - 1]!; // The most recent message usually controls the display flags (read, star, archive)
    const rootEmail = selectedThread[0]!;
    const threadSubject = rootEmail.subject || t('sa.inbox.noSubject');
    
    // We treat bulk actions (archive, trash, star, mark read) on ALL ids in the thread
    const threadIds = selectedThread.map(e => e.id);

    return (
      <div className="stagger-enter space-y-4">
        {/* Back + actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => setSelectedThread(null)}
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('sa.inbox.backToList')}
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateFlags(threadIds, { is_starred: !latestEmail.is_starred })}
              className="icon-btn"
              title={latestEmail.is_starred ? t('sa.inbox.unstar') : t('sa.inbox.star')}
            >
              {latestEmail.is_starred
                ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                : <StarOff className="w-4 h-4" />
              }
            </button>
            <button
              onClick={() => updateFlags(threadIds, { is_read: !latestEmail.is_read })}
              className="icon-btn"
              title={latestEmail.is_read ? t('sa.inbox.markUnread') : t('sa.inbox.markRead')}
            >
              {latestEmail.is_read ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                updateFlags(threadIds, { is_archived: !latestEmail.is_archived });
                setSelectedThread(null);
              }}
              className="icon-btn"
              title={latestEmail.is_archived ? t('sa.inbox.unarchive') : t('sa.inbox.archive')}
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={() => deleteEmail(threadIds)}
              className="icon-btn text-error hover:text-error"
              title={t('sa.inbox.delete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thread Header */}
        <div className="px-6 py-4 bg-glass-element border border-glass-border rounded-xl">
           <h2 className="text-xl font-bold text-text-primary">
             {threadSubject}
           </h2>
           <span className="text-sm text-text-muted">{selectedThread.length} message{selectedThread.length > 1 ? 's' : ''} in thread</span>
        </div>

        {/* Thread emails */}
        <div className="space-y-4">
          {detailLoading ? (
            <div className="flex items-center justify-center py-16 dashboard-card">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            </div>
          ) : (
            selectedThread.map((email) => (
              <div key={email.id} className="dashboard-card overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-glass-border">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0">
                        <span className="font-bold text-brand-primary">
                          {(email.from_name || email.from_email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-text-primary block">
                          {email.from_name || email.from_email}
                        </span>
                        <span className="text-xs text-text-muted">&lt;{email.from_email}&gt;</span>
                      </div>
                    </div>
                    <div className="text-text-muted text-xs sm:ml-auto">
                      {formatDateTime(email.received_at, 'dateTime')}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-text-muted">
                    {t('sa.inbox.to')}: {email.to_email}
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
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
                </div>
              </div>
            ))
          )}
        </div>

        {/* Reply section */}
        {!detailLoading && selectedThread.length > 0 && (
          <div className="px-6 py-4 bg-glass-element rounded-xl border border-glass-border">
            {!replyOpen ? (
              <button
                onClick={() => setReplyOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary/10 text-brand-primary text-sm font-medium hover:bg-brand-primary/20 transition-colors"
              >
                <MessageSquareReply className="w-4 h-4" />
                {t('sa.inbox.replyBtn')}
              </button>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <textarea
                  value={replyContent}
                  onChange={e => setReplyContent(e.target.value)}
                  placeholder={t('sa.inbox.replyPlaceholder')}
                  className="w-full min-h-[150px] p-4 bg-background border border-glass-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/50 resize-y"
                  disabled={sendingReply}
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => sendReply(latestEmail.id)}
                    disabled={sendingReply || !replyContent.trim()}
                    className="btn-primary"
                  >
                    {sendingReply ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('sa.inbox.sending')}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        {t('sa.inbox.sendReply')}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setReplyOpen(false)}
                    disabled={sendingReply}
                    className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {t('common.cancel') || 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── List View ───────────────────────────────────────
  return (
    <div className="stagger-enter space-y-6">
      <SAPageHeader
        title={t('sa.inbox.title')}
        subtitle={t('sa.inbox.subtitle')}
        icon={<Mail className="w-6 h-6 text-brand-primary" />}
      />

      {/* KPI pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => {
          const count =
            f.key === 'inbox' ? meta.total - (meta.starred || 0) :
            f.key === 'unread' ? meta.unread :
            f.key === 'starred' ? meta.starred :
            undefined;

          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filter === f.key
                  ? f.key === 'unread'
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
                    : f.key === 'starred'
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                    : f.key === 'archived'
                    ? 'bg-violet-500/15 text-violet-400 border-violet-500/25'
                    : 'bg-brand-primary/15 text-brand-primary border-brand-primary/30'
                  : 'bg-glass-element text-text-secondary border-glass-border hover:border-text-muted'
              }`}
            >
              {t(f.translationKey)}
              {count !== undefined && ` (${count})`}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
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

      {/* Email list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="dashboard-card p-4 h-18 animate-pulse bg-glass-element" />
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
          {emails.map(email => (
            <div
              key={email.id}
              onClick={() => openEmail(email)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-glass-hover/50 ${
                !email.is_read ? 'bg-brand-primary/[0.03]' : ''
              }`}
            >
              {/* Star toggle */}
              <button
                onClick={e => { e.stopPropagation(); updateFlags([email.id], { is_starred: !email.is_starred }); }}
                className="shrink-0 p-1 -m-1 hover:scale-110 transition-transform"
              >
                {email.is_starred
                  ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  : <Star className="w-4 h-4 text-text-muted/30 hover:text-amber-400/60" />
                }
              </button>

              {/* Read indicator */}
              <div className="shrink-0 w-2">
                {!email.is_read && (
                  <div className="w-2 h-2 rounded-full bg-brand-primary" />
                )}
              </div>

              {/* Avatar */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                !email.is_read
                  ? 'bg-brand-primary/15 text-brand-primary'
                  : 'bg-glass-element text-text-muted'
              }`}>
                {(email.from_name || email.from_email).charAt(0).toUpperCase()}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={`text-sm truncate ${!email.is_read ? 'font-bold text-text-primary' : 'font-medium text-text-primary'}`}>
                    {senderDisplay(email)}
                  </span>
                  <span className="text-xs text-text-muted shrink-0 ml-auto hidden sm:inline">
                    {formatDateTime(email.received_at, 'shortDate')}
                  </span>
                </div>
                <div className={`text-sm truncate ${!email.is_read ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                  {email.subject || t('sa.inbox.noSubject')}
                </div>
                <div className="text-xs text-text-muted truncate mt-0.5 hidden md:block">
                  {previewText(email)}
                </div>
              </div>

              {/* Mobile date */}
              <span className="text-xs text-text-muted shrink-0 sm:hidden">
                {formatDateTime(email.received_at, 'shortDate')}
              </span>

              {/* Quick actions */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:flex">
                <button
                  onClick={e => { e.stopPropagation(); updateFlags([email.id], { is_archived: true }); }}
                  className="icon-btn !p-1"
                  title={t('sa.inbox.archive')}
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); updateFlags([email.id], { is_read: !email.is_read }); }}
                  className="icon-btn !p-1"
                  title={email.is_read ? t('sa.inbox.markUnread') : t('sa.inbox.markRead')}
                >
                  {email.is_read ? <MailOpen className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>
            {t('sa.inbox.prev') ? '' : ''}
            {((page - 1) * meta.pageSize) + 1}–{Math.min(page * meta.pageSize, meta.totalFiltered)} {t('sa.inbox.of')} {meta.totalFiltered}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="icon-btn disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="icon-btn disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
