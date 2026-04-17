import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import type { Email, Filter, FlagsUpdate, Meta, Target } from './types';

const PAGE_SIZE = 30;

const INITIAL_META: Meta = {
  page: 1,
  pageSize: PAGE_SIZE,
  totalFiltered: 0,
  total: 0,
  unread: 0,
  starred: 0,
};

export function useInbox() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [emails, setEmails] = useState<Email[]>([]);
  const [meta, setMeta] = useState<Meta>(INITIAL_META);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('inbox');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);

  const [selectedThread, setSelectedThread] = useState<Email[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const initializedThreadRef = useRef<string | null>(null);

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Target | null>(null);
  const [deleting, setDeleting] = useState(false);

  const threadKey = selectedThread?.[0]?.thread_id || selectedThread?.[0]?.id || null;

  /* ── Debounce search ───────────────────────────── */
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  /* ── Fetch list ────────────────────────────────── */
  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter, page: String(page), pageSize: String(PAGE_SIZE) });
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

  /* ── Expand latest on thread change ────────────── */
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

  /* ── Actions ───────────────────────────────────── */

  const openEmail = useCallback(async (email: Email) => {
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
  }, []);

  const closeThread = useCallback(() => setSelectedThread(null), []);

  const updateFlags = useCallback(async (target: Target, flags: FlagsUpdate) => {
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
      setSelectedThread(prev => prev ? prev.map(e => matches(e) ? { ...e, ...flags } : e) : null);
      fetchEmails();
    } catch (err) {
      console.error('Failed to update email:', err);
    }
  }, [fetchEmails]);

  const requestDelete = useCallback((target: Target) => {
    if (!target.threadIds?.length && !target.ids?.length) return;
    setPendingDelete(target);
  }, []);

  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { EDGE_FUNCTION_BASE, SUPABASE_ANON_KEY } = await import('@/lib/constants');
      const { supabase } = await import('@/lib/supabase');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || '';

      const body: Record<string, unknown> = {};
      if (pendingDelete.threadIds?.length) body.thread_ids = pendingDelete.threadIds;
      else if (pendingDelete.ids?.length) body.ids = pendingDelete.ids;

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
          Boolean(pendingDelete.threadIds && e.thread_id && pendingDelete.threadIds.includes(e.thread_id)) ||
          Boolean(pendingDelete.ids && pendingDelete.ids.includes(e.id));
        setEmails(prev => prev.filter(e => !matches(e)));
        setSelectedThread(prev => (prev && prev.some(matches)) ? null : prev);
        fetchEmails();
      }
    } catch (err) {
      console.error('Failed to delete email:', err);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }, [pendingDelete, fetchEmails]);

  const sendReply = useCallback(async (emailId: string) => {
    if (!replyContent.trim()) return;
    setSendingReply(true);
    try {
      const htmlContent = replyContent.replace(/\n/g, '<br/>');
      const res = await apiClient.post<{ success: boolean; email: Email }>('/admin-inbox', { emailId, content: htmlContent });

      setReplyContent('');
      setReplyOpen(false);

      if (res.data?.email) {
        setSelectedThread(prev => prev ? [...prev, res.data.email] : prev);
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
  }, [replyContent, showToast, t, fetchEmails]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandCollapseAll = useCallback(() => {
    if (!selectedThread) return;
    const allIds = selectedThread.map(e => e.id);
    const allExpanded = allIds.every(id => expandedIds.has(id));
    setExpandedIds(allExpanded ? new Set() : new Set(allIds));
  }, [selectedThread, expandedIds]);

  return {
    // data
    emails,
    meta,
    loading,
    // list filters
    filter,
    setFilter,
    search,
    setSearch,
    // pagination
    page,
    setPage,
    // thread
    selectedThread,
    detailLoading,
    expandedIds,
    openEmail,
    closeThread,
    toggleExpanded,
    expandCollapseAll,
    // reply
    replyOpen,
    setReplyOpen,
    replyContent,
    setReplyContent,
    sendingReply,
    sendReply,
    // mutations
    updateFlags,
    requestDelete,
    cancelDelete,
    confirmDelete,
    pendingDelete,
    deleting,
    // utils
    fetchEmails,
  };
}
