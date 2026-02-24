import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { TenantProvider } from '@/contexts/TenantContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ProtectedRoute } from '@/components/guards/ProtectedRoute';
import { GuestRoute } from '@/components/guards/GuestRoute';
import { PlanGate } from '@/components/guards/PlanGate';
import { SuperAdminGate } from '@/components/guards/SuperAdminGate';
import { AppLayout } from '@/components/layout/AppLayout';
import { LayoutProvider } from '@/contexts/LayoutContext';

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
import { SourcesPage } from '@/pages/sources/SourcesPage';
import { SourceDetailPage } from '@/pages/sources/SourceDetailPage';
import { PlatformsPage } from '@/pages/platforms/PlatformsPage';
import { ModelsPage } from '@/pages/models/ModelsPage';
import { LandingPage } from '@/pages/landing/LandingPage';
import { PlansPage } from '@/pages/plans/PlansPage';
import { LlmTextPage } from '@/pages/llmtext/LlmTextPage';

/** Simple layout route that passes through to child routes */
function AuthOutlet() {
  return <Outlet />;
}

export function App() {
  return (
    <ThemeProvider>
      <LayoutProvider>
        <ToastProvider>
        <BrowserRouter>
        <Routes>
          {/* Public landing page — no auth provider needed */}
          <Route index element={<LandingPage />} />

          {/* All other routes require AuthProvider */}
          <Route element={<AuthProvider><AuthOutlet /></AuthProvider>}>
            {/* Public (guest) routes */}
            <Route path="/signin" element={<GuestRoute><SignIn /></GuestRoute>} />
            <Route path="/signup" element={<GuestRoute><SignUp /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes with app shell */}
            <Route path="/dashboard" element={<ProtectedRoute><TenantProvider><AppLayout /></TenantProvider></ProtectedRoute>}>
              {/* Always accessible — even without a plan */}
              <Route path="plans" element={<PlansPage />} />
              <Route path="profile" element={<ProfilePage />} />

              {/* Plan-gated — requires tenant to have an active plan */}
              <Route element={<PlanGate />}>
                <Route index element={<Dashboard />} />
                <Route path="settings" element={<TenantSettings />} />
                <Route path="topics" element={<TopicsPage />} />
                <Route path="topics/:id" element={<TopicDetailPage />} />
                <Route path="topics/:id/answers" element={<TopicAnswersPage />} />
                <Route path="prompts" element={<PromptsPage />} />
                <Route path="prompts/:id" element={<PromptDetailPage />} />
                <Route path="sources" element={<SourcesPage />} />
                <Route path="sources/:id" element={<SourceDetailPage />} />
                <Route path="llmtext" element={<LlmTextPage />} />
                <Route path="models" element={<ModelsPage />} />

                {/* SuperAdmin-only */}
                <Route element={<SuperAdminGate />}>
                  <Route path="platforms" element={<PlatformsPage />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      </ToastProvider>
      </LayoutProvider>
    </ThemeProvider>
  );
}
