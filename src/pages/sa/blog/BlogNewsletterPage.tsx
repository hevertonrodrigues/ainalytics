import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Search, Trash2 } from 'lucide-react';
import { useBlogAdmin, blogAdmin } from './useBlogAdmin';
import { SAPageHeader } from '../SAPageHeader';
import { TemplateDownloadButton } from './JsonToolbar';
import { NEWSLETTER_TEMPLATE } from './templates';
import { type NewsletterSubscriber, type SubscriberStatus } from './types';
import { formatDateTime } from '@/lib/dateFormat';

const STATUS_COLORS: Record<SubscriberStatus, string> = {
  pending:      'bg-yellow-500/15 text-yellow-500',
  active:       'bg-success/15 text-success',
  unsubscribed: 'bg-text-muted/20 text-text-secondary',
  bounced:      'bg-error/15 text-error',
};

export function BlogNewsletterPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<SubscriberStatus | ''>('');
  const [search, setSearch] = useState('');
  const { data, isLoading, refetch, remove } = useBlogAdmin<NewsletterSubscriber>('newsletter', {
    query: { status: statusFilter || undefined, q: search || undefined },
  });

  const handleDelete = async (id: number) => {
    if (!confirm(t('sa.blog.confirmDelete'))) return;
    await remove(id);
  };

  const handleSetStatus = async (id: number, status: SubscriberStatus) => {
    await blogAdmin.update<NewsletterSubscriber>('newsletter', id, { status });
    refetch();
  };

  if (isLoading) return <div className="dashboard-card p-6 h-32 animate-pulse bg-glass-element" />;

  const total = data.length;
  const active = data.filter((s) => s.status === 'active').length;
  const pending = data.filter((s) => s.status === 'pending').length;

  return (
    <div className="stagger-enter space-y-6">
      <SAPageHeader
        title={t('sa.blog.modules.newsletter.title')}
        subtitle={t('sa.blog.modules.newsletter.description')}
        icon={<Mail className="w-6 h-6 text-brand-primary" />}
      >
        <TemplateDownloadButton template={NEWSLETTER_TEMPLATE} filename="newsletter-template.json" />
      </SAPageHeader>

      <div className="grid grid-cols-3 gap-3">
        <div className="dashboard-card p-4">
          <div className="text-xs text-text-muted">{t('sa.blog.newsletter.totalSubscribers')}</div>
          <div className="text-2xl font-bold text-text-primary mt-1">{total}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-xs text-text-muted">{t('sa.blog.newsletter.activeSubscribers')}</div>
          <div className="text-2xl font-bold text-success mt-1">{active}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-xs text-text-muted">{t('sa.blog.newsletter.pendingSubscribers')}</div>
          <div className="text-2xl font-bold text-yellow-500 mt-1">{pending}</div>
        </div>
      </div>

      <div className="dashboard-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && refetch()}
            placeholder="email"
            className="input-field !pl-8 !py-2 !text-sm w-full"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as SubscriberStatus | '')} className="input-field !py-2 !text-sm">
          <option value="">{t('sa.blog.allStatuses')}</option>
          <option value="pending">pending</option>
          <option value="active">active</option>
          <option value="unsubscribed">unsubscribed</option>
          <option value="bounced">bounced</option>
        </select>
        <button onClick={refetch} className="btn btn-secondary btn-sm">{t('sa.blog.refresh')}</button>
      </div>

      <div className="dashboard-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>email</th>
              <th>lang</th>
              <th>status</th>
              <th className="hidden md:table-cell">topics</th>
              <th>source</th>
              <th>subscribed</th>
              <th className="text-right">actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id}>
                <td className="!font-body font-semibold text-xs">{s.email}</td>
                <td className="text-xs uppercase">{s.lang}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                </td>
                <td className="hidden md:table-cell text-xs">{(s.topics || []).join(', ')}</td>
                <td className="text-xs">{s.source || '—'}</td>
                <td className="text-xs">{formatDateTime(s.subscribed_at, 'dateTime')}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {s.status !== 'active' && (
                      <button onClick={() => handleSetStatus(s.id, 'active')} className="text-xs px-2 py-1 rounded-md bg-success/15 text-success hover:bg-success/25">activate</button>
                    )}
                    {s.status !== 'unsubscribed' && (
                      <button onClick={() => handleSetStatus(s.id, 'unsubscribed')} className="text-xs px-2 py-1 rounded-md bg-text-muted/20 text-text-secondary hover:bg-text-muted/30">unsub</button>
                    )}
                    <button onClick={() => handleDelete(s.id)} className="icon-btn text-error/70 hover:text-error">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
