import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Meta } from '../types';

interface InboxPaginationProps {
  page: number;
  onPageChange: (page: number) => void;
  meta: Meta;
}

export function InboxPagination({ page, onPageChange, meta }: InboxPaginationProps) {
  const { t } = useTranslation();
  const totalPages = Math.ceil(meta.totalFiltered / meta.pageSize) || 1;
  if (totalPages <= 1) return null;

  const start = (page - 1) * meta.pageSize + 1;
  const end = Math.min(page * meta.pageSize, meta.totalFiltered);

  return (
    <div className="flex items-center justify-between text-sm text-text-secondary">
      <span className="tabular-nums">
        {start}–{end} {t('sa.inbox.of')} {meta.totalFiltered}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="icon-btn disabled:opacity-30"
          title={t('sa.inbox.prev')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs tabular-nums">{page} / {totalPages}</span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="icon-btn disabled:opacity-30"
          title={t('sa.inbox.next')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
