import { createContext, useContext, useEffect, useState } from 'react';

type LayoutMode = 'centered' | 'expanded';

interface LayoutContextType {
  layoutMode: LayoutMode;
  toggleLayoutMode: () => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('centered');
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ainalytics_layout_mode');
    if (saved === 'expanded') {
      setLayoutMode('expanded');
    }
  }, []);

  const toggleLayoutMode = () => {
    setLayoutMode((prev) => {
      const next: LayoutMode = prev === 'centered' ? 'expanded' : 'centered';
      localStorage.setItem('ainalytics_layout_mode', next);
      
      // Update data attribute for CSS targeting
      if (next === 'expanded') {
        document.documentElement.setAttribute('data-layout', 'expanded');
      } else {
        document.documentElement.setAttribute('data-layout', 'centered');
      }
      
      return next;
    });
  };

  // Initialize data attribute on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-layout', layoutMode);
  }, [layoutMode]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <LayoutContext.Provider 
      value={{ 
        layoutMode, 
        toggleLayoutMode, 
        isSidebarOpen, 
        setSidebarOpen, 
        toggleSidebar 
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
