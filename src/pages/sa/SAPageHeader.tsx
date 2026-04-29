import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useIsEmbedded } from './blog/modals/EmbedPageModal';

interface SAPageHeaderProps {
  title: string;
  subtitle: string;
  icon?: ReactNode;
  children?: ReactNode;
}

/**
 * Collapsible page header for SA admin pages.
 * - Mobile (< lg): starts collapsed, smaller title, tap to expand subtitle
 * - Desktop (lg+): always fully visible with original sizing
 */
export function SAPageHeader({ title, subtitle, icon, children }: SAPageHeaderProps) {
  const [expanded, setExpanded] = useState(false);
  const embedded = useIsEmbedded();

  // When the page is hosted inside an EmbedPageModal the modal renders its
  // own title bar — collapse our header to a thin action row so we don't
  // get a double-header. Children (action buttons) still render.
  if (embedded) {
    return children ? <div className="flex items-center justify-end gap-2 -mt-2 mb-2">{children}</div> : null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="min-w-0">
        {/* Mobile: collapsible header */}
        <button
          type="button"
          className="lg:hidden flex items-center gap-2 w-full text-left"
          onClick={() => setExpanded(v => !v)}
        >
          {icon && <span className="shrink-0">{icon}</span>}
          <h1 className="text-base font-bold text-text-primary truncate">{title}</h1>
          <ChevronDown
            className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Mobile: expandable subtitle */}
        <div
          className={`lg:hidden overflow-hidden transition-all duration-200 ease-in-out ${
            expanded ? 'max-h-20 opacity-100 mt-1' : 'max-h-0 opacity-0'
          }`}
        >
          <p className="text-xs text-text-secondary pl-0.5">{subtitle}</p>
        </div>

        {/* Desktop: always visible full header */}
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            {icon}
            {title}
          </h1>
          <p className="text-sm text-text-secondary mt-1">{subtitle}</p>
        </div>
      </div>

      {/* Right-side controls (always visible) */}
      {children && (
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          {children}
        </div>
      )}
    </div>
  );
}
