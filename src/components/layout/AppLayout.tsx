import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar />
      {/* Main content — offset by sidebar width (w-64 = 16rem) */}
      <div style={{ marginLeft: '16rem' }}>
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
