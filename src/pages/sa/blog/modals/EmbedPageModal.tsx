import { createContext, useContext, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';

/**
 * Lightweight wrapper that hosts an existing full-page admin component inside
 * a scrolling modal. Used to avoid forking each CRUD page into a "modal-only"
 * variant — we get the same rich editor (translations, drag-and-drop, etc.)
 * inline on the hub pages.
 *
 * The hosted component renders its own SAPageHeader; that header is
 * suppressed via the EmbedContext (consumed inside SAPageHeader) so we don't
 * get a double-header inside the modal.
 */

const EmbedContext = createContext(false);

// eslint-disable-next-line react-refresh/only-export-components
export function useIsEmbedded() {
  return useContext(EmbedContext);
}

export function EmbedPageModal({
  title, children, onClose,
}: { title: string; children: ReactNode; onClose: () => void }) {
  useScrollLock(true);
  return (
    <EmbedContext.Provider value={true}>
      <div className="fixed inset-0 z-[80] flex items-start justify-center p-2 sm:p-6">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col dashboard-card animate-in fade-in zoom-in-95">
          <div className="px-5 py-3 border-b border-glass-border flex items-center justify-between gap-3 sticky top-0 bg-bg-primary/90 backdrop-blur-sm z-10">
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
            <button onClick={onClose} className="icon-btn" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </EmbedContext.Provider>
  );
}
