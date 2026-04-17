import { useTranslation } from 'react-i18next';
import { Loader2, MessagesSquare, Reply } from 'lucide-react';
import { ThreadToolbar } from './ThreadToolbar';
import { ThreadMessage } from './ThreadMessage';
import { ReplyComposer } from './ReplyComposer';
import type { Email, FlagsUpdate, Target } from '../types';

interface ThreadViewProps {
  thread: Email[];
  detailLoading: boolean;
  expandedIds: Set<string>;
  smartDate: (iso: string) => string;

  onBack: () => void;
  onToggleExpand: (id: string) => void;
  onExpandCollapseAll: () => void;

  onUpdateFlags: (target: Target, flags: FlagsUpdate) => void;
  onRequestDelete: (target: Target) => void;

  replyOpen: boolean;
  onOpenReply: () => void;
  onCloseReply: () => void;
  replyContent: string;
  onChangeReply: (value: string) => void;
  onSendReply: () => void;
  sendingReply: boolean;
}

export function ThreadView({
  thread,
  detailLoading,
  expandedIds,
  smartDate,
  onBack,
  onToggleExpand,
  onExpandCollapseAll,
  onUpdateFlags,
  onRequestDelete,
  replyOpen,
  onOpenReply,
  onCloseReply,
  replyContent,
  onChangeReply,
  onSendReply,
  sendingReply,
}: ThreadViewProps) {
  const { t } = useTranslation();

  const rootEmail = thread[0]!;
  const latestEmail = thread[thread.length - 1]!;
  const threadSubject = rootEmail.subject || t('sa.inbox.noSubject');
  const threadTargetId = rootEmail.thread_id || rootEmail.id;
  const threadTarget: Target = { threadIds: [threadTargetId] };
  const msgCount = thread.length;

  const allExpanded = thread.every(e => expandedIds.has(e.id));
  const anyStarred = thread.some(e => e.is_starred);
  const anyUnread = thread.some(e => !e.is_read);
  const isArchived = thread.every(e => e.is_archived);

  return (
    <div className="stagger-enter space-y-3">
      <ThreadToolbar
        messageCount={msgCount}
        anyStarred={anyStarred}
        anyUnread={anyUnread}
        isArchived={isArchived}
        allExpanded={allExpanded}
        onBack={onBack}
        onToggleStar={() => onUpdateFlags(threadTarget, { is_starred: !anyStarred })}
        onToggleRead={() => onUpdateFlags(threadTarget, { is_read: anyUnread ? true : false })}
        onToggleArchive={() => {
          onUpdateFlags(threadTarget, { is_archived: !isArchived });
          onBack();
        }}
        onDelete={() => onRequestDelete(threadTarget)}
        onExpandCollapseAll={onExpandCollapseAll}
      />

      <div className="space-y-3 pt-2">
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
          thread.map((email, idx) => (
            <ThreadMessage
              key={email.id}
              email={email}
              isExpanded={expandedIds.has(email.id)}
              isLast={idx === thread.length - 1}
              collapsible={msgCount > 1}
              smartDate={smartDate}
              onToggleExpand={() => onToggleExpand(email.id)}
              onStartReply={onOpenReply}
              replyOpen={replyOpen}
            />
          ))
        )}

        {!detailLoading && thread.length > 0 && replyOpen && (
          <ReplyComposer
            latestEmail={latestEmail}
            value={replyContent}
            onChange={onChangeReply}
            onSend={onSendReply}
            onCancel={onCloseReply}
            sending={sendingReply}
          />
        )}

        {!detailLoading && thread.length > 0 && !replyOpen && (
          <button
            onClick={onOpenReply}
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
