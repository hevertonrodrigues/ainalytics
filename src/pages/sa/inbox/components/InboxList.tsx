import { useTranslation } from 'react-i18next';
import { Inbox } from 'lucide-react';
import { InboxRow } from './InboxRow';
import type { Email, Target } from '../types';

interface InboxListProps {
  emails: Email[];
  loading: boolean;
  smartDate: (iso: string) => string;
  onOpen: (email: Email) => void;
  onUpdateFlags: (target: Target, flags: Partial<Email>) => void;
  onRequestDelete: (target: Target) => void;
}

function ListSkeleton() {
  return (
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
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="dashboard-card p-12 text-center">
      <Inbox className="w-12 h-12 text-text-muted/30 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-text-primary mb-1">{t('sa.inbox.emptyInbox')}</h3>
      <p className="text-sm text-text-secondary">{t('sa.inbox.emptyInboxDesc')}</p>
    </div>
  );
}

export function InboxList({ emails, loading, smartDate, onOpen, onUpdateFlags, onRequestDelete }: InboxListProps) {
  if (loading) return <ListSkeleton />;
  if (emails.length === 0) return <EmptyState />;

  return (
    <div className="dashboard-card overflow-hidden divide-y divide-glass-border/50">
      {emails.map(email => (
        <InboxRow
          key={email.id}
          email={email}
          smartDate={smartDate}
          onOpen={onOpen}
          onUpdateFlags={onUpdateFlags}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </div>
  );
}
