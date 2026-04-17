import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Archive, ChevronDown, Eye, EyeOff, Star, StarOff, Trash2,
} from 'lucide-react';

interface ThreadToolbarProps {
  messageCount: number;
  anyStarred: boolean;
  anyUnread: boolean;
  isArchived: boolean;
  allExpanded: boolean;
  onBack: () => void;
  onToggleStar: () => void;
  onToggleRead: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  onExpandCollapseAll: () => void;
}

export function ThreadToolbar({
  messageCount,
  anyStarred,
  anyUnread,
  isArchived,
  allExpanded,
  onBack,
  onToggleStar,
  onToggleRead,
  onToggleArchive,
  onDelete,
  onExpandCollapseAll,
}: ThreadToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 flex items-center justify-between gap-3 py-3 border-b border-glass-border bg-bg-primary/85 backdrop-blur-md">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">{t('sa.inbox.backToList')}</span>
      </button>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleStar}
          className="icon-btn"
          title={anyStarred ? t('sa.inbox.unstar') : t('sa.inbox.star')}
        >
          {anyStarred
            ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            : <StarOff className="w-4 h-4" />}
        </button>
        <button
          onClick={onToggleRead}
          className="icon-btn"
          title={anyUnread ? t('sa.inbox.markRead') : t('sa.inbox.markUnread')}
        >
          {anyUnread ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          onClick={onToggleArchive}
          className="icon-btn"
          title={isArchived ? t('sa.inbox.unarchive') : t('sa.inbox.archive')}
        >
          <Archive className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="icon-btn text-error hover:text-error"
          title={t('sa.inbox.delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {messageCount > 1 && (
          <>
            <span className="mx-1 w-px h-5 bg-glass-border" />
            <button
              onClick={onExpandCollapseAll}
              className="icon-btn"
              title={allExpanded ? t('sa.inbox.collapseAll') : t('sa.inbox.expandAll')}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${allExpanded ? 'rotate-180' : ''}`} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
