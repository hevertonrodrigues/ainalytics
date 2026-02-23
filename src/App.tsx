import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { TenantProvider } from '@/contexts/TenantContext';
import { ProtectedRoute } from '@/components/guards/ProtectedRoute';
import { GuestRoute } from '@/components/guards/GuestRoute';
import { AppLayout } from '@/components/layout/AppLayout';

// Auth pages
import { SignIn } from '@/pages/auth/SignIn';
import { SignUp } from '@/pages/auth/SignUp';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { ResetPassword } from '@/pages/auth/ResetPassword';

// App pages
import { Dashboard } from '@/pages/dashboard/Dashboard';
import { ProfilePage } from '@/pages/profile/Profile';
import { TenantSettings } from '@/pages/settings/TenantSettings';

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public (guest) routes */}
            <Route path="/signin" element={<GuestRoute><SignIn /></GuestRoute>} />
            <Route path="/signup" element={<GuestRoute><SignUp /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes with app shell */}
            <Route element={<ProtectedRoute><TenantProvider><AppLayout /></TenantProvider></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<TenantSettings />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
