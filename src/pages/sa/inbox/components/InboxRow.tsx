import { useTranslation } from 'react-i18next';
import { Archive, Eye, MailOpen, Star, Trash2 } from 'lucide-react';
import { Avatar } from './Avatar';
import { isOutgoing, previewText } from '../utils';
import type { Email, Target } from '../types';

interface InboxRowProps {
  email: Email;
  smartDate: (iso: string) => string;
  onOpen: (email: Email) => void;
  onUpdateFlags: (target: Target, flags: Partial<Email>) => void;
  onRequestDelete: (target: Target) => void;
}

export function InboxRow({ email, smartDate, onOpen, onUpdateFlags, onRequestDelete }: InboxRowProps) {
  const { t } = useTranslation();
  const hasThread = (email.message_count ?? 1) > 1;
  const outgoing = isOutgoing(email);
  const threadTarget: Target = { threadIds: [email.thread_id || email.id] };
  const senderDisplay = outgoing ? t('sa.inbox.you') : (email.from_name || email.from_email);

  return (
    <div
      onClick={() => onOpen(email)}
      className={`group relative flex items-center gap-3 px-3 sm:px-4 py-2.5 cursor-pointer transition-colors ${
        !email.is_read ? 'bg-brand-primary/[0.04]' : ''
      } hover:bg-glass-hover/60`}
    >
      {!email.is_read && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-brand-primary" />
      )}

      <button
        onClick={e => {
          e.stopPropagation();
          onUpdateFlags(threadTarget, { is_starred: !email.is_starred });
        }}
        className="shrink-0 p-1 -m-1 hover:scale-110 transition-transform"
        title={email.is_starred ? t('sa.inbox.unstar') : t('sa.inbox.star')}
      >
        {email.is_starred ? (
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
        ) : (
          <Star className="w-4 h-4 text-text-muted/30 hover:text-amber-400/60 transition-colors" />
        )}
      </button>

      <Avatar email={email.from_email} name={email.from_name} />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`text-sm truncate ${!email.is_read ? 'font-bold text-text-primary' : 'font-medium text-text-primary'}`}>
            {senderDisplay}
          </span>
          {outgoing && (
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

      <div className="hidden lg:flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => {
            e.stopPropagation();
            onUpdateFlags(threadTarget, { is_archived: !email.is_archived });
          }}
          className="icon-btn !p-1.5"
          title={email.is_archived ? t('sa.inbox.unarchive') : t('sa.inbox.archive')}
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            onUpdateFlags(threadTarget, { is_read: !email.is_read });
          }}
          className="icon-btn !p-1.5"
          title={email.is_read ? t('sa.inbox.markUnread') : t('sa.inbox.markRead')}
        >
          {email.is_read ? <MailOpen className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            onRequestDelete(threadTarget);
          }}
          className="icon-btn !p-1.5 text-text-muted hover:text-error"
          title={t('sa.inbox.delete')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
