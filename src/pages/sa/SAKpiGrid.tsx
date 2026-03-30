import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface SAKpiGridProps {
  children: ReactNode;
  /** Desktop grid class, e.g. "lg:grid-cols-6" */
  desktopCols?: string;
}

/**
 * Collapsible KPI card grid for SA pages.
 * - Mobile (<lg): shows a compact, horizontally scrollable strip of mini cards.
 *   Tap the toggle to expand into a full vertical grid.
 * - Desktop (lg+): always shows the full grid layout.
 */
export function SAKpiGrid({ children, desktopCols = 'lg:grid-cols-4' }: SAKpiGridProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* ── Mobile: collapsible strip ── */}
      <div className="lg:hidden">
        {/* Collapsed: horizontal scroll of mini cards */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2 sa-kpi-grid-expanded">
            {children}
          </div>
        </div>

        {/* Collapsed: compact inline summary */}
        {!expanded && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory scrollbar-none [&>*]:min-w-[130px] [&>*]:snap-start [&>*]:shrink-0 [&_.dashboard-card]:!p-3 [&_.text-2xl]:!text-lg [&_.text-sm]:!text-xs [&_p.text-xs]:!text-[10px] [&_svg]:!w-3.5 [&_svg]:!h-3.5 sa-kpi-strip">
            {children}
          </div>
        )}

        {/* Toggle button */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex items-center justify-center gap-1.5 w-full mt-2 py-2 bg-glass-element border border-glass-border/50 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary hover:bg-glass-element/80 transition-all shadow-sm active:scale-[0.98]"
        >
          <span>{expanded ? 'Fechar' : 'Ver detalhes'}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* ── Desktop: full grid ── */}
      <div className={`hidden lg:grid grid-cols-1 sm:grid-cols-2 ${desktopCols} gap-4`}>
        {children}
      </div>
    </>
  );
}
