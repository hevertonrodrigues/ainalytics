import { useTranslation } from 'react-i18next';
import { Mail, RefreshCw } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SAPageHeader } from './SAPageHeader';
import { useInbox } from './inbox/useInbox';
import { useSmartDate } from './inbox/utils';
import { InboxToolbar } from './inbox/components/InboxToolbar';
import { InboxList } from './inbox/components/InboxList';
import { InboxPagination } from './inbox/components/InboxPagination';
import { ThreadView } from './inbox/components/ThreadView';

export function InboxPage() {
  const { t } = useTranslation();
  const smartDate = useSmartDate();
  const inbox = useInbox();

  if (inbox.selectedThread && inbox.selectedThread.length > 0) {
    return (
      <>
        <ThreadView
          thread={inbox.selectedThread}
          detailLoading={inbox.detailLoading}
          expandedIds={inbox.expandedIds}
          smartDate={smartDate}
          onBack={inbox.closeThread}
          onToggleExpand={inbox.toggleExpanded}
          onExpandCollapseAll={inbox.expandCollapseAll}
          onUpdateFlags={inbox.updateFlags}
          onRequestDelete={inbox.requestDelete}
          replyOpen={inbox.replyOpen}
          onOpenReply={() => inbox.setReplyOpen(true)}
          onCloseReply={() => { inbox.setReplyOpen(false); inbox.setReplyContent(''); }}
          replyContent={inbox.replyContent}
          onChangeReply={inbox.setReplyContent}
          onSendReply={() => inbox.sendReply(inbox.selectedThread![inbox.selectedThread!.length - 1]!.id)}
          sendingReply={inbox.sendingReply}
        />
        {inbox.pendingDelete && (
          <ConfirmModal
            message={t('sa.inbox.deleteConfirm')}
            onConfirm={inbox.confirmDelete}
            onCancel={inbox.cancelDelete}
            loading={inbox.deleting}
          />
        )}
      </>
    );
  }

  return (
    <div className="stagger-enter space-y-5">
      <SAPageHeader
        title={t('sa.inbox.title')}
        subtitle={t('sa.inbox.subtitle')}
        icon={<Mail className="w-6 h-6 text-brand-primary" />}
      >
        <button
          onClick={inbox.fetchEmails}
          disabled={inbox.loading}
          className="icon-btn"
          title={t('sa.inbox.refresh')}
        >
          <RefreshCw className={`w-4 h-4 ${inbox.loading ? 'animate-spin' : ''}`} />
        </button>
      </SAPageHeader>

      <InboxToolbar
        filter={inbox.filter}
        onFilterChange={inbox.setFilter}
        search={inbox.search}
        onSearchChange={inbox.setSearch}
        meta={inbox.meta}
      />

      <InboxList
        emails={inbox.emails}
        loading={inbox.loading}
        smartDate={smartDate}
        onOpen={inbox.openEmail}
        onUpdateFlags={inbox.updateFlags}
        onRequestDelete={inbox.requestDelete}
      />

      <InboxPagination
        page={inbox.page}
        onPageChange={inbox.setPage}
        meta={inbox.meta}
      />

      {inbox.pendingDelete && (
        <ConfirmModal
          message={t('sa.inbox.deleteConfirm')}
          onConfirm={inbox.confirmDelete}
          onCancel={inbox.cancelDelete}
          loading={inbox.deleting}
        />
      )}
    </div>
  );
}
