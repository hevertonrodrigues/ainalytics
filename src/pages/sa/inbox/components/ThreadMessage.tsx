import { useTranslation } from 'react-i18next';
import { ChevronDown, Reply } from 'lucide-react';
import { formatDateTime } from '@/lib/dateFormat';
import { Avatar } from './Avatar';
import { isOutgoing, previewText } from '../utils';
import type { Email } from '../types';

interface ThreadMessageProps {
  email: Email;
  isExpanded: boolean;
  isLast: boolean;
  collapsible: boolean;
  smartDate: (iso: string) => string;
  onToggleExpand: () => void;
  onStartReply: () => void;
  replyOpen: boolean;
}

export function ThreadMessage({
  email,
  isExpanded,
  isLast,
  collapsible,
  smartDate,
  onToggleExpand,
  onStartReply,
  replyOpen,
}: ThreadMessageProps) {
  const { t } = useTranslation();
  const outgoing = isOutgoing(email);
  const displayName = outgoing ? t('sa.inbox.you') : (email.from_name || email.from_email);

  return (
    <div
      className={`rounded-xl border transition-colors ${
        outgoing
          ? 'border-brand-primary/20 bg-brand-primary/[0.04]'
          : 'border-glass-border bg-glass-element'
      } ${isLast ? 'shadow-lg shadow-brand-primary/5' : ''}`}
    >
      <button
        type="button"
        onClick={collapsible ? onToggleExpand : undefined}
        disabled={!collapsible}
        className={`w-full flex items-start gap-3 px-4 sm:px-5 py-3 text-left ${
          collapsible ? 'hover:bg-glass-hover/30 cursor-pointer' : 'cursor-default'
        } ${isExpanded ? 'border-b border-glass-border/70' : ''} transition-colors`}
      >
        <Avatar email={email.from_email} name={email.from_name} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="font-semibold text-sm text-text-primary truncate max-w-[220px]">
              {displayName}
            </span>
            {outgoing && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-brand-primary/15 text-brand-primary">
                {t('sa.inbox.you')}
              </span>
            )}
            {!email.is_read && !outgoing && (
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

        {collapsible && (
          <ChevronDown
            className={`w-4 h-4 text-text-muted shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        )}
      </button>

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

          {isLast && !replyOpen && !outgoing && (
            <div className="mt-4 pt-3 border-t border-glass-border/60">
              <button
                onClick={onStartReply}
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
}
