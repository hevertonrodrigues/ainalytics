import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FreeAnalysisResults, type FreeAnalysisData } from '@/components/FreeAnalysisResults';
import { useTheme } from '@/contexts/ThemeContext';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

/**
 * Standalone results page for the free GEO analysis.
 * Receives analysis data via React Router location state.
 * If no data is present (e.g. direct URL access), redirects to the form page.
 */
export function FreeAnalysisResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme: currentTheme, setTheme } = useTheme();

  const state = location.state as { data?: FreeAnalysisData; error?: string; domain?: string } | null;

  // Force light theme
  useEffect(() => {
    const prev = currentTheme;
    if (prev !== 'light') setTheme('light');
    return () => {
      if (prev !== 'light') setTheme(prev);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect if no data and no error (direct URL access)
  useEffect(() => {
    if (!state?.data && !state?.error) {
      navigate('/analise-gratuita', { replace: true });
    }
  }, [state, navigate]);

  if (!state?.data && !state?.error) return null;

  if (state?.error) {
    return (
      <div className="sales-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="sales-container" style={{ textAlign: 'center', maxWidth: 600 }}>
          <div className="glass-card" style={{ padding: '3rem 2rem' }}>
            <AlertCircle className="w-16 h-16 mx-auto mb-6 text-danger" />
            <h1 className="sales-section-title" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              Oops! Algo deu errado.
            </h1>
            <p className="sales-subtitle" style={{ fontSize: '1.125rem', marginBottom: '2rem' }}>
              Não conseguimos concluir a análise para o site <strong>{state.domain}</strong>.<br />
              <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>{state.error}</span>
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/analise-gratuita')}
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Tentar Novamente
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Voltar ao Início
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!state?.data) return null;

  return (
    <FreeAnalysisResults
      data={state.data}
      onRestart={() => navigate('/analise-gratuita')}
    />
  );
}
