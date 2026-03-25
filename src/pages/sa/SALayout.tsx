import { Outlet } from 'react-router-dom';
import { SASidebar } from './SASidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { useLayout } from '@/contexts/LayoutContext';

export function SALayout() {
  const { setSidebarOpen } = useLayout();

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col lg:flex-row">
      <MobileHeader onOpenSidebar={() => setSidebarOpen(true)} />
      
      <SASidebar />
      
      {/* Main content — offset by sidebar width on lg screens */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <main className="p-4 sm:p-6 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
