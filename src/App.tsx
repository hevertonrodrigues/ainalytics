import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { TenantProvider } from '@/contexts/TenantContext';
import { ToastProvider } from '@/contexts/ToastContext';
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
import { TopicsPage } from '@/pages/topics/TopicsPage';
import { TopicDetailPage } from '@/pages/topics/TopicDetailPage';
import { TopicAnswersPage } from '@/pages/topics/TopicAnswersPage';
import { PromptsPage } from '@/pages/prompts/PromptsPage';
import { PromptDetailPage } from '@/pages/prompts/PromptDetailPage';
import { PlatformsPage } from '@/pages/platforms/PlatformsPage';
import { ModelsPage } from '@/pages/models/ModelsPage';
import { LandingPage } from '@/pages/landing/LandingPage';
import { PlansPage } from '@/pages/plans/PlansPage';

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public landing page */}
            <Route index element={<LandingPage />} />
            {/* Public (guest) routes */}
            <Route path="/signin" element={<GuestRoute><SignIn /></GuestRoute>} />
            <Route path="/signup" element={<GuestRoute><SignUp /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes with app shell */}
            <Route path="/dashboard" element={<ProtectedRoute><TenantProvider><AppLayout /></TenantProvider></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<TenantSettings />} />
              <Route path="topics" element={<TopicsPage />} />
              <Route path="topics/:id" element={<TopicDetailPage />} />
              <Route path="topics/:id/answers" element={<TopicAnswersPage />} />
              <Route path="prompts" element={<PromptsPage />} />
              <Route path="prompts/:id" element={<PromptDetailPage />} />
              <Route path="platforms" element={<PlatformsPage />} />
              <Route path="models" element={<ModelsPage />} />
              <Route path="plans" element={<PlansPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
