import { Menu } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

interface MobileHeaderProps {
  onOpenSidebar: () => void;
}

export function MobileHeader({ onOpenSidebar }: MobileHeaderProps) {
  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-bg-secondary/80 backdrop-blur-xl border-b border-glass-border">
      <div className="flex items-center gap-2">
        <img src="/logo-purple.png" alt="Ainalytics" className="w-8 h-8" />
        <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
          {APP_NAME}
        </span>
      </div>
      
      <button 
        onClick={onOpenSidebar}
        className="p-2 -mr-2 text-text-muted hover:text-text-primary transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>
    </header>
  );
}
