import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet, useParams, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { TenantProvider } from '@/contexts/TenantContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { LayoutProvider } from '@/contexts/LayoutContext';
import i18n from '@/i18n';

const ProtectedRoute = lazy(() => import('@/components/guards/ProtectedRoute').then(m => ({ default: m.ProtectedRoute })));
const GuestRoute = lazy(() => import('@/components/guards/GuestRoute').then(m => ({ default: m.GuestRoute })));
const FlowGate = lazy(() => import('@/components/guards/FlowGate').then(m => ({ default: m.FlowGate })));
const SuperAdminGate = lazy(() => import('@/components/guards/SuperAdminGate').then(m => ({ default: m.SuperAdminGate })));
const AppLayout = lazy(() => import('@/components/layout/AppLayout').then(m => ({ default: m.AppLayout })));
const LandingPage = lazy(() => import('@/pages/landing/LandingPage').then(m => ({ default: m.LandingPage })));

// Lazy-loaded page components (route-level code splitting)
const SignIn = lazy(() => import('@/pages/auth/SignIn').then(m => ({ default: m.SignIn })));
const SignUp = lazy(() => import('@/pages/auth/SignUp').then(m => ({ default: m.SignUp })));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword').then(m => ({ default: m.ResetPassword })));
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const ProfilePage = lazy(() => import('@/pages/profile/Profile').then(m => ({ default: m.ProfilePage })));
const TenantSettings = lazy(() => import('@/pages/settings/TenantSettings').then(m => ({ default: m.TenantSettings })));
const TopicsPage = lazy(() => import('@/pages/topics/TopicsPage').then(m => ({ default: m.TopicsPage })));
const TopicDetailPage = lazy(() => import('@/pages/topics/TopicDetailPage').then(m => ({ default: m.TopicDetailPage })));
const TopicAnswersPage = lazy(() => import('@/pages/topics/TopicAnswersPage').then(m => ({ default: m.TopicAnswersPage })));
const PromptsPage = lazy(() => import('@/pages/prompts/PromptsPage').then(m => ({ default: m.PromptsPage })));
const PromptDetailPage = lazy(() => import('@/pages/prompts/PromptDetailPage').then(m => ({ default: m.PromptDetailPage })));
const InsightsPage = lazy(() => import('@/pages/dashboard/InsightsPage').then(m => ({ default: m.InsightsPage })));
const AnalysesPage = lazy(() => import('@/pages/dashboard/AnalysesPage').then(m => ({ default: m.AnalysesPage })));
const SourcesPage = lazy(() => import('@/pages/sources/SourcesPage').then(m => ({ default: m.SourcesPage })));
const SourceDetailPage = lazy(() => import('@/pages/sources/SourceDetailPage').then(m => ({ default: m.SourceDetailPage })));
const PlatformsPage = lazy(() => import('@/pages/platforms/PlatformsPage').then(m => ({ default: m.PlatformsPage })));
const ModelsPage = lazy(() => import('@/pages/models/ModelsPage').then(m => ({ default: m.ModelsPage })));
const PlansPage = lazy(() => import('@/pages/plans/PlansPage').then(m => ({ default: m.PlansPage })));
const LlmTextPage = lazy(() => import('@/pages/llmtext/LlmTextPage').then(m => ({ default: m.LlmTextPage })));
const MyCompanyPage = lazy(() => import('@/pages/company/MyCompanyPage').then(m => ({ default: m.MyCompanyPage })));
const OnboardingPage = lazy(() => import('@/pages/onboarding/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const SupportPage = lazy(() => import('@/pages/support/SupportPage').then(m => ({ default: m.SupportPage })));
const DeepAnalyzePage = lazy(() => import('@/pages/deep-analyze/DeepAnalyzePage').then(m => ({ default: m.DeepAnalyzePage })));
const ContactPage = lazy(() => import('@/pages/contact/ContactPage').then(m => ({ default: m.ContactPage })));
const NotFoundPage = lazy(() => import('@/pages/error/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const LegalPage = lazy(() => import('@/pages/legal/LegalPage').then(m => ({ default: m.LegalPage })));
const SalesPage = lazy(() => import('@/pages/sales/SalesPage').then(m => ({ default: m.SalesPage })));

const SUPPORTED_LANGS = new Set(
  (Array.isArray(i18n.options.supportedLngs) ? i18n.options.supportedLngs : ['en', 'es', 'pt-br']).filter(
    (l: string) => l !== 'cimode',
  ),
);

/** Route wrapper: reads /:lang param and switches language */
function LandingWithLang() {
  const { lang } = useParams<{ lang: string }>();
  const normalizedLang = lang?.toLowerCase();

  useEffect(() => {
    if (normalizedLang && SUPPORTED_LANGS.has(normalizedLang)) {
      i18n.changeLanguage(normalizedLang);
    }
  }, [normalizedLang]);

  if (!normalizedLang || !SUPPORTED_LANGS.has(normalizedLang)) {
    return <Navigate to="/" replace />;
  }

  return <LandingPage />;
}

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
        <Suspense fallback={null}>
        <Routes>
          {/* Public landing page — no auth provider needed */}
          <Route index element={<LandingPage />} />
          <Route path="/:lang" element={<LandingWithLang />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/terms" element={<LegalPage />} />
          <Route path="/privacy" element={<LegalPage />} />

          {/* All other routes require AuthProvider */}
          <Route element={<AuthProvider><AuthOutlet /></AuthProvider>}>
            {/* Public (guest) routes */}
            <Route path="/signin" element={<GuestRoute><SignIn /></GuestRoute>} />
            <Route path="/signup" element={<GuestRoute><SignUp /></GuestRoute>} />
            <Route path="/oferta-marco" element={<GuestRoute><SalesPage /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes with app shell */}
            <Route path="/dashboard" element={<ProtectedRoute><TenantProvider><AppLayout /></TenantProvider></ProtectedRoute>}>
              {/* Always accessible — even without a plan */}
              <Route path="onboarding" element={<OnboardingPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="support" element={<SupportPage />} />

              {/* Flow-gated — sequential: plan → company → models */}
              <Route element={<FlowGate />}>
                {/* Company & Models accessible at their gate step */}
                <Route path="company" element={<MyCompanyPage />} />
                <Route path="models" element={<ModelsPage />} />

                {/* Fully-gated — requires all setup steps complete */}
                <Route index element={<Dashboard />} />
                <Route path="settings" element={<TenantSettings />} />
                <Route path="topics" element={<TopicsPage />} />
                <Route path="topics/:id" element={<TopicDetailPage />} />
                <Route path="topics/:id/answers" element={<TopicAnswersPage />} />
                <Route path="prompts" element={<PromptsPage />} />
                <Route path="prompts/:id" element={<PromptDetailPage />} />
                <Route path="insights" element={<InsightsPage />} />
                <Route path="analyses" element={<AnalysesPage />} />
                <Route path="sources" element={<SourcesPage />} />
                <Route path="sources/:id" element={<SourceDetailPage />} />
                <Route path="llmtext" element={<LlmTextPage />} />

                {/* SuperAdmin-only */}
                <Route element={<SuperAdminGate />}>
                  <Route path="deep-analyze" element={<DeepAnalyzePage />} />
                  <Route path="platforms" element={<PlatformsPage />} />
                </Route>
              </Route>
            </Route>
          </Route>

          {/* Catch-all 404 Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </ToastProvider>
      </LayoutProvider>
    </ThemeProvider>
  );
}
