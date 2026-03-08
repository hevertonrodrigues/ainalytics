/**
 * CollapsibleSection — A dashboard-card wrapper with a clickable header
 * that toggles collapse/expand of its children.
 */
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react';

interface Props {
  /** Section title */
  title: string;
  /** Icon component to show next to title */
  icon?: LucideIcon;
  /** Icon color */
  iconColor?: string;
  /** Small badge text to show after the title (e.g. count) */
  badge?: string;
  /** Extra elements in the header (right side) */
  headerRight?: ReactNode;
  /** Whether the section starts collapsed. Defaults to false (expanded). */
  defaultCollapsed?: boolean;
  /** Extra className on the outer wrapper */
  className?: string;
  /** Padding override. Defaults to "p-5" */
  padding?: string;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  icon: Icon,
  iconColor = 'var(--brand-primary)',
  badge,
  headerRight,
  defaultCollapsed = false,
  className = '',
  padding = 'p-5',
  children,
}: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`dashboard-card ${padding} ${className}`}>
      <button
        type="button"
        className="w-full flex items-center gap-2 text-left group"
        onClick={() => setCollapsed((c) => !c)}
      >
        {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: iconColor }} />}
        <h3 className="text-sm font-semibold text-text-primary flex-1">
          {title}
          {badge && (
            <span className="text-xs text-text-muted font-normal ml-1.5">{badge}</span>
          )}
        </h3>
        {headerRight && <span className="mr-2">{headerRight}</span>}
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-text-muted shrink-0 transition-transform" />
        ) : (
          <ChevronUp className="w-4 h-4 text-text-muted shrink-0 transition-transform" />
        )}
      </button>
      {!collapsed && <div className="mt-4">{children}</div>}
    </div>
  );
}
