import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  Search,
  AlertCircle,
  CheckCircle2,
  Shield,
  Tag,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  RotateCcw,
  Loader2,
  FileText,
  Bot,
  Zap,
  Target,
  BarChart3,
  ShieldCheck,
  ShieldX,
  ExternalLink,
  Download,
  Radar,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import type { Company, AiReport, CompanyPage } from '@/types';
import { LANGUAGES, getLanguageByCode } from '@/lib/languages';
import {
  GeoScoreOverview,
  GeoFactorScorecard,
  GeoRecommendations,
  ScoreRing,
} from '@/components/geo';

// ─── Public email domains to skip for auto-fill ────────────
const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'aol.com', 'protonmail.com', 'icloud.com', 'mail.com', 'zoho.com',
  'yandex.com', 'gmx.com', 'fastmail.com', 'tutanota.com', 'pm.me',
  'msn.com', 'me.com', 'mac.com', 'inbox.com', 'hey.com',
]);

function getEmailDomain(email: string | undefined): string | null {
  if (!email) return null;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || PUBLIC_DOMAINS.has(domain)) return null;
  return domain;
}

function getStatusKey(status: string, progress = 0): string {
  if (status === 'error') return 'company.statusError';
  if (status === 'completed') return 'company.statusCompleted';
  if (status === 'pending') return 'company.statusPending';

  // Scraping phases (0–50%)
  if (status === 'scraping') {
    if (progress < 5) return 'company.phaseFetchingRobots';
    if (progress < 10) return 'company.phaseFetchingSitemap';
    if (progress < 15) return 'company.phaseBuildingPageList';
    if (progress < 45) return 'company.phaseScrapingPages';
    return 'company.phaseSavingScrapedData';
  }

  if (status === 'scraping_done') return 'company.statusScrapingDone';

  // Analyze phases (50–100%)
  if (status === 'analyzing') {
    if (progress < 55) return 'company.phaseAlgorithmicScoring';
    if (progress < 60) return 'company.phaseAlgorithmicScoring';
    if (progress < 65) return 'company.phaseBuildingPrompt';
    if (progress < 78) return 'company.phaseAiAnalysis';
    if (progress < 85) return 'company.phaseProcessingResults';
    if (progress < 90) return 'company.phaseComputingScores';
    if (progress < 95) return 'company.phaseSavingReport';
    return 'company.phaseFinishing';
  }

  return 'company.statusPending';
}

// ─── Safe JSON parse (handles double-serialized JSONB) ────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeParse<T>(value: any): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return null; }
  }
  return value as T;
}

// ScoreRing is now imported from @/components/geo

const LOCALE_TO_LANG_CODE: Record<string, string> = {
  'pt-br': 'pt',
  'es': 'es',
  'en': 'en'
};

// ─── Main Component ────────────────────────────────────────
export function MyCompanyPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const { setHasCompany } = useTenant();
  const { showToast } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [reAnalyzing, setReAnalyzing] = useState(false);
  const [confirmReAnalyze, setConfirmReAnalyze] = useState(false);
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [targetLanguage, setTargetLanguage] = useState(LOCALE_TO_LANG_CODE[i18n.language?.toLowerCase()] || 'en');
  const [reportLang, setReportLang] = useState(LOCALE_TO_LANG_CODE[i18n.language?.toLowerCase()] || 'en');
  const [editDescription, setEditDescription] = useState('');
  const [editLanguage, setEditLanguage] = useState(LOCALE_TO_LANG_CODE[i18n.language?.toLowerCase()] || 'en');
  const [startingAnalysis, setStartingAnalysis] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTriggeredRef = useRef(false);

  // ─── Fetch company on mount ─────────────────────────────
  const fetchCompany = useCallback(async () => {
    try {
      const res = await apiClient.get<Company | null>('/company');
      setCompany(res.data);
    } catch {
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  // Sync edit fields when company data loads
  useEffect(() => {
    if (company) {
      setEditDescription(company.description || '');
      // Always default language to the current UI language
      setEditLanguage(LOCALE_TO_LANG_CODE[i18n.language?.toLowerCase()] || 'en');
    }
  }, [company, i18n.language]);

  // ─── Auto-fill domain from email ────────────────────────
  useEffect(() => {
    if (!company) {
      const emailDomain = getEmailDomain(profile?.email);
      if (emailDomain) setDomain(emailDomain);
    }
  }, [company, profile?.email]);

  // ─── Polling for progress ───────────────────────────────
  useEffect(() => {
    if (!company) return;

    const analysis = company.latest_analysis;
    const analysisStatus = analysis?.status || 'pending';
    const isProcessing = ['pending', 'scraping', 'scraping_done', 'analyzing'].includes(analysisStatus);

    if (isProcessing) {
      const pollStartTime = Date.now();
      const MAX_POLL_MS = 10 * 60 * 1000; // 10 minutes max

      pollRef.current = setInterval(async () => {
        // Safety: stop polling after 10 minutes
        if (Date.now() - pollStartTime > MAX_POLL_MS) {
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }

        try {
          const res = await apiClient.get<Company | null>('/company');
          if (res.data) {
            setCompany(res.data);

            const latestStatus = res.data.latest_analysis?.status;
            // Auto-trigger analyze when scraping is done
            if (latestStatus === 'scraping_done' && !autoTriggeredRef.current) {
              autoTriggeredRef.current = true;
              try {
                await apiClient.post('/scrape-company', { action: 'analyze' });
              } catch (err) {
                console.error('Auto-analyze failed:', err);
              }
            }

            // Stop polling when done
            if (latestStatus === 'completed' || latestStatus === 'error') {
              if (pollRef.current) clearInterval(pollRef.current);
            }
          }
        } catch {
          // Ignore polling errors
        }
      }, 3000);

      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [company?.latest_analysis?.status]);

  // ─── Create company & start scraping ────────────────────
  const handleCreate = async () => {
    if (!domain.trim()) return;
    setCreating(true);
    setStartingAnalysis(true);
    try {
      const res = await apiClient.post<Company>('/company', {
        domain: domain.trim(),
        description: description.trim() || undefined,
        target_language: targetLanguage,
      });
      setCompany(res.data);
      setHasCompany(true);
      showToast(t('company.created'), 'success');

      // Trigger scraping
      try {
        await apiClient.post('/scrape-company', { action: 'scrape' });
      } catch {
        // Scraping may have started in background
      }

      // Start polling
      autoTriggeredRef.current = false;
      await fetchCompany();
    } catch (err: any) {
      showToast(err.message || t('company.createError'), 'error');
    } finally {
      setCreating(false);
      setStartingAnalysis(false);
    }
  };

  const handleRetry = async () => {
    if (!company) return;
    const analysis = company.latest_analysis;
    try {
      // Determine what to retry based on progress and status
      const canAnalyze = analysis?.status === 'error' || analysis?.status === 'scraping_done' || analysis?.status === 'analyzing';
      const needsRescrape = (analysis?.progress || 0) < 50; // Error happened during scrape phase

      if (needsRescrape) {
        // Re-scrape first, then analyze will auto-trigger
        autoTriggeredRef.current = false;
        await apiClient.post('/scrape-company', { action: 'scrape' });
      } else if (canAnalyze) {
        await apiClient.post('/scrape-company', { action: 'analyze' });
        autoTriggeredRef.current = true;
      }
      fetchCompany();
    } catch (err: any) {
      showToast(err.message || t('company.statusError'), 'error');
    }
  };

  // ─── Re-analyze (SA only) ── resets all data & restarts ─
  const handleReAnalyze = async () => {
    if (!company) return;

    setReAnalyzing(true);
    setConfirmReAnalyze(false);
    try {
      // 1. Reset all company data
      await apiClient.post('/scrape-company', { action: 'reset' });

      // 2. Re-fetch to get the clean state
      await fetchCompany();

      // 3. Trigger scraping
      autoTriggeredRef.current = false;
      await apiClient.post('/scrape-company', { action: 'scrape' });

      // 4. Re-fetch to start polling
      fetchCompany();
      showToast(t('company.reAnalyzeStarted') || 'Re-analysis started', 'success');
    } catch (err: any) {
      showToast(err.message || 'Re-analysis failed', 'error');
    } finally {
      setReAnalyzing(false);
    }
  };

  // ─── Export AI Report to PDF ─────────────────────────────
  const handleExportPdf = async () => {
    if (!reportRef.current || !company) return;
    setIsExporting(true);

    // Short delay to allow UI to settle
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // 🚨 WORKAROUND for html2canvas oklab parse error (Tailwind 4 native issue)
      // Some transparent/color-mixed colors use `oklab` which html2canvas 1.4.1 doesn't understand:
      // Search and replace style strings in the ref just for the export.
      
      const elements = reportRef.current.querySelectorAll('*');
      const originalStyles: { el: HTMLElement; style: string }[] = [];
      
      elements.forEach(el => {
        if (el instanceof HTMLElement) {
          const compStyle = window.getComputedStyle(el);
          if (compStyle.color.includes('oklab') || compStyle.backgroundColor.includes('oklab') || compStyle.borderColor.includes('oklab')) {
            originalStyles.push({ el, style: el.style.cssText });
            // Very simple fallback for elements that might have inherited an oklab transparent color-mix 
            // Often this is the placeholder color or standard hr border color
            el.style.color = compStyle.color.includes('oklab') ? 'inherit' : compStyle.color;
            el.style.backgroundColor = compStyle.backgroundColor.includes('oklab') ? 'transparent' : compStyle.backgroundColor;
            el.style.borderColor = compStyle.borderColor.includes('oklab') ? 'transparent' : compStyle.borderColor;
          }
        }
      });

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0a0a0b', // Match dark theme bg
      });

      // Restore original styles
      originalStyles.forEach(({ el, style }) => {
        el.style.cssText = style;
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${company.company_name || company.domain.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf`);

      showToast(t('company.exportSuccess', 'PDF exported successfully'), 'success');
    } catch (err: any) {
      console.error('PDF export error:', err);
      const msg = err?.message || err?.toString() || 'Unknown error';
      showToast(`${t('company.exportError', 'Failed to export PDF')}: ${msg}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Derive report data (must be above early returns for hooks rules) ──
  const analysis = company?.latest_analysis;
  const analysisStatus = analysis?.status || 'pending';
  const analysisProgress = analysis?.progress || 0;
  const bilingualReport = safeParse<Record<string, AiReport>>(analysis?.ai_report);
  const parsedPages = safeParse<CompanyPage[]>(analysis?.crawled_pages) || [];

  const availableLangs = useMemo(() => {
    if (!bilingualReport) return ['en'];
    return Object.keys(bilingualReport).filter((k) => bilingualReport[k]?.summary);
  }, [bilingualReport]);

  const report: AiReport | null = useMemo(() => {
    if (!bilingualReport) return null;
    return bilingualReport[reportLang] || bilingualReport['en'] || Object.values(bilingualReport)[0] || null;
  }, [bilingualReport, reportLang]);

  // ─── Loading state ──────────────────────────────────────
  if (loading) {
    return (
      <div className="stagger-enter space-y-6">
        <div className="dashboard-card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto" />
        </div>
      </div>
    );
  }

  // ─── Setup Form (no company) ─────────────────────────────
  if (!company) {
    return (
      <div className="stagger-enter space-y-8 max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary/20 via-bg-secondary to-brand-accent/10 border border-glass-border p-6 md:p-8">
          {/* Decorative blobs */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-brand-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-brand-accent/10 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-5 mb-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center shrink-0 shadow-lg shadow-brand-primary/20">
                <Radar className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
                {t('company.setupTitle')}
              </h1>
            </div>
            <p className="text-sm md:text-base text-text-secondary leading-relaxed">
              {t('company.setupSubtitle')}
            </p>
          </div>
        </div>

        {/* Steps & Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { step: 1, icon: Globe, titleKey: 'company.stepScanTitle', descKey: 'company.stepScanDesc', fIcon: Target, fLabel: t('company.geoScore'), fColor: 'text-success', fBg: 'bg-success/10' },
            { step: 2, icon: Bot, titleKey: 'company.stepAnalyzeTitle', descKey: 'company.stepAnalyzeDesc', fIcon: FileText, fLabel: 'LLM.txt', fColor: 'text-brand-secondary', fBg: 'bg-brand-secondary/10' },
            { step: 3, icon: BarChart3, titleKey: 'company.stepMonitorTitle', descKey: 'company.stepMonitorDesc', fIcon: Zap, fLabel: t('company.aiReadiness'), fColor: 'text-warning', fBg: 'bg-warning/10' },
          ].map(({ step, icon: StepIcon, titleKey, descKey, fIcon: FIcon, fLabel, fColor, fBg }) => (
            <div key={step} className="dashboard-card relative overflow-hidden group flex flex-col">
              <div className="p-5 flex-1">
                <div className="absolute top-3 right-3 text-4xl font-black text-text-muted/5 select-none">
                  {step}
                </div>
                <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center mb-3 group-hover:bg-brand-primary/20 transition-colors">
                  <StepIcon className="w-5 h-5 text-brand-primary" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">
                  {t(titleKey)}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {t(descKey)}
                </p>
              </div>
              <div className="border-t border-glass-border px-5 py-3 flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg ${fBg} flex items-center justify-center shrink-0`}>
                  <FIcon className={`w-3.5 h-3.5 ${fColor}`} />
                </div>
                <span className="text-xs font-medium text-text-secondary">{fLabel}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Setup Form Card */}
        <div className="dashboard-card p-8">
          <div className="space-y-4">
            <div>
              <label className="kpi-label block mb-1.5">{t('company.domain')} *</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder={t('company.domainPlaceholder')}
                  className="form-input pl-10"
                  id="company-domain-input"
                />
              </div>
            </div>

            <div>
              <label className="kpi-label block mb-1.5">{t('company.description')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('company.descriptionPlaceholder')}
                className="input-field min-h-[80px] resize-y"
                rows={3}
                id="company-description-input"
              />
            </div>

            <div>
              <label className="kpi-label block mb-1.5">{t('company.targetLanguage')} *</label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="form-input"
                id="company-language-select"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-muted mt-1">{t('company.targetLanguageHint')}</p>
            </div>

            <button
              onClick={handleCreate}
              disabled={creating || !domain.trim()}
              className="btn btn-primary w-full mt-2 py-3 text-base font-semibold"
              id="company-create-btn"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('company.creating')}
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  {t('company.createCompany')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Progress State ──────────────────────────────────────
  const isProcessing = (!!analysis && ['pending', 'scraping', 'scraping_done', 'analyzing'].includes(analysisStatus));

  if (isProcessing || (analysisStatus === 'error' && !hasReport(company))) {
    return (
      <div className="stagger-enter space-y-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('company.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('company.subtitle')}</p>
        </div>

        <div className="dashboard-card p-8 max-w-xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-4">
            {analysisStatus === 'error' ? (
              <AlertCircle className="w-8 h-8 text-error" />
            ) : (
              <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
            )}
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-1">
            {analysisStatus === 'error' ? t('company.statusError') : t('company.progressTitle')}
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            {analysisStatus === 'error'
              ? analysis?.error_message || t('company.statusError')
              : analysis?.status_message || t('company.progressSubtitle')}
          </p>

          {/* Progress bar */}
          <div className="w-full bg-glass-border rounded-full h-3 mb-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${analysisProgress}%`,
                background: analysisStatus === 'error'
                  ? 'var(--error)'
                  : 'linear-gradient(90deg, var(--brand-primary), var(--brand-accent))',
              }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>{t(getStatusKey(analysisStatus, analysisProgress))}</span>
            <span className="flex items-center gap-2">
              {analysis && analysis.total_pages > 0 && analysisStatus !== 'error' && (
                <span>{analysis.pages_crawled} / {analysis.total_pages} pages</span>
              )}
              <span>{analysisProgress}%</span>
            </span>
          </div>

          {analysisStatus === 'error' && (
            <div className="flex flex-col items-center gap-3 mt-6">
              <button onClick={handleRetry} className="btn btn-primary">
                <RefreshCw className="w-4 h-4" />
                {t('company.retryAnalysis')}
              </button>
              {profile?.is_sa && (
                <button
                  onClick={handleReAnalyze}
                  disabled={reAnalyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all hover:border-error/40 hover:bg-error/5"
                  style={{ borderColor: 'var(--glass-border)', color: 'var(--error)' }}
                >
                  {reAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  {reAnalyzing ? 'Resetting...' : 'Full Reset & Re-analyze'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── No analysis yet ─────────────────────────────────────
  if (!analysis || (!hasReport(company) && analysisStatus !== 'error')) {
    return (
      <div className="stagger-enter space-y-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('company.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('company.subtitle')}</p>
        </div>

        <div className="dashboard-card p-8 max-w-xl mx-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-brand-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              {company.company_name || company.domain}
            </h2>
            <div className="flex items-center justify-center gap-1.5 text-sm text-text-muted">
              <Globe className="w-3.5 h-3.5" />
              <span>{company.domain}</span>
            </div>
            <p className="text-sm text-text-secondary mt-3">
              {t('company.noAnalysisYet')}
            </p>
          </div>

          {/* Editable fields */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="kpi-label block mb-1.5">{t('company.editDescription')}</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t('company.descriptionPlaceholder')}
                className="input-field min-h-[80px] resize-y"
                rows={3}
                id="edit-description-input"
              />
            </div>

            <div>
              <label className="kpi-label block mb-1.5">{t('company.editLanguage')}</label>
              <select
                value={editLanguage}
                onChange={(e) => setEditLanguage(e.target.value)}
                className="input-field"
                id="edit-language-select"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
            </div>

          </div>

          <button
            onClick={async () => {
              try {
                setStartingAnalysis(true);
                autoTriggeredRef.current = false;
                await apiClient.patch('/company', {
                  description: editDescription,
                  target_language: editLanguage,
                });
                await apiClient.post('/scrape-company', { action: 'scrape' });
                await fetchCompany();
              } catch (err: any) {
                showToast(err.message || 'Failed to start analysis', 'error');
              } finally {
                setStartingAnalysis(false);
              }
            }}
            disabled={startingAnalysis}
            className="btn btn-primary w-full"
            id="start-analysis-btn"
          >
            {startingAnalysis ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Initiating the analyze...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                {t('company.startAnalysis')}
              </>
            )}
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="stagger-enter space-y-6" ref={reportRef}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">
            {company.company_name || company.website_title || company.domain}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Globe className="w-3.5 h-3.5 text-text-muted" />
            <a
              href={`https://${company.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-primary hover:underline flex items-center gap-1"
            >
              {company.domain}
              <ExternalLink className="w-3 h-3" />
            </a>
            {company.industry && (
              <>
                <span className="text-text-muted">·</span>
                <span className="text-sm text-text-secondary">{company.industry}</span>
              </>
            )}
            {company.country && (
              <>
                <span className="text-text-muted">·</span>
                <span className="text-sm text-text-secondary">{company.country}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* SA-only Re-analyze button */}
          {profile?.is_sa && (
            <div className="flex items-center gap-1.5" data-html2canvas-ignore="true">
              {confirmReAnalyze ? (
                <>
                  <span className="text-[10px] text-error font-medium">Delete all data?</span>
                  <button
                    onClick={handleReAnalyze}
                    disabled={reAnalyzing}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md bg-error/10 text-error border border-error/30 hover:bg-error/20 transition-all"
                    id="company-reanalyze-confirm-btn"
                  >
                    {reAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    {reAnalyzing ? 'Resetting...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmReAnalyze(false)}
                    className="px-2 py-1 text-[10px] font-medium rounded-md text-text-muted hover:text-text-secondary transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmReAnalyze(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all hover:border-error/40 hover:bg-error/5"
                  style={{
                    borderColor: 'var(--glass-border)',
                    color: 'var(--error)',
                  }}
                  id="company-reanalyze-btn"
                  title="System Admin: Delete all data and re-analyze from scratch"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Re-analyze
                </button>
              )}
            </div>
          )}
          
          {/* User conditionally rendered Re-analyze button */}
          {!profile?.is_sa && company.latest_analysis && company.latest_analysis.status === 'completed' && (
            <div className="flex items-center gap-1.5 ml-2" data-html2canvas-ignore="true">
              {(() => {
                const completedAt = company.latest_analysis.completed_at;
                if (!completedAt) return null;
                const daysSince = (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince >= 7) {
                  return (
                    <button
                      onClick={async () => {
                        try {
                          setStartingAnalysis(true);
                          autoTriggeredRef.current = false;
                          await apiClient.post('/scrape-company', { action: 'scrape' });
                          await fetchCompany();
                        } catch (err: any) {
                          showToast(err.message || 'Failed to start re-analysis', 'error');
                        } finally {
                          setStartingAnalysis(false);
                        }
                      }}
                      disabled={startingAnalysis}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg btn-secondary transition-all"
                      id="user-reanalyze-btn"
                    >
                      {startingAnalysis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      {startingAnalysis ? 'Initiating the analyze...' : t('company.reanalyze')}
                    </button>
                  );
                }
                return (
                  <span className="text-xs text-text-muted" title={`Next re-analysis available in ${Math.ceil(7 - daysSince)} days`}>
                    {t('company.reanalyzeIn', { days: Math.ceil(7 - daysSince) })}
                  </span>
                );
              })()}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-xs font-medium text-success">{t('company.statusCompleted')}</span>
          </div>

          {/* Export PDF Button */}
          {hasReport(company) && (
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 ml-2 text-xs font-medium rounded-lg text-white bg-brand-primary/90 hover:bg-brand-primary transition-all shadow-sm"
              id="export-pdf-btn"
              data-html2canvas-ignore="true"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {isExporting ? t('company.exporting', 'Exporting...') : t('company.exportPdf', 'Export PDF')}
            </button>
          )}
        </div>
      </div>

      {/* Language Toggle */}
      {availableLangs.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary">{t('company.reportLanguage')}:</span>
          <div className="flex gap-1 bg-bg-secondary rounded-lg p-0.5">
            {availableLangs.map((code) => {
              const lang = getLanguageByCode(code);
              return (
                <button
                  key={code}
                  onClick={() => setReportLang(code)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                    reportLang === code
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {lang ? `${lang.flag} ${lang.name}` : code}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* GEO Score Overview (new factor-based) */}
      {report?.factor_scores && report.composite_score !== undefined && report.readiness_level !== undefined && report.category_scores && (
        <GeoScoreOverview
          compositeScore={report.composite_score}
          readinessLevel={report.readiness_level}
          categoryScores={report.category_scores}
          pointsToNextLevel={report.points_to_next_level || 0}
          nextLevel={report.next_level || null}
        />
      )}

      {/* Fallback: old score cards row (if no factor scores yet) */}
      {report && !report.factor_scores && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="dashboard-card p-5 flex justify-center">
            <ScoreRing
              score={report.geo_score}
              label={t('company.geoScore')}
            />
          </div>
          <div className="dashboard-card p-5 text-center flex flex-col items-center justify-center gap-2">
            <FileText className="w-6 h-6 text-brand-primary" />
            <span className="text-lg font-bold text-text-primary capitalize">{report.content_quality}</span>
            <span className="text-xs text-text-secondary">{t('company.contentQuality')}</span>
          </div>
          <div className="dashboard-card p-5 text-center flex flex-col items-center justify-center gap-2">
            <Zap className="w-6 h-6 text-brand-accent" />
            <span className="text-lg font-bold text-text-primary capitalize">{report.structured_data_coverage}</span>
            <span className="text-xs text-text-secondary">{t('company.structuredData')}</span>
          </div>
        </div>
      )}

      {/* AI Summary */}
      {report?.summary && (
        <div className="dashboard-card p-6">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4 text-brand-primary" />
            {t('company.summary')}
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {report.summary}
          </p>
        </div>
      )}

      {/* 25-Factor Scorecard */}
      {report?.factor_scores && report.factor_scores.length > 0 && (
        <GeoFactorScorecard factors={report.factor_scores} />
      )}

      {/* Top Priority Recommendations (factor-based) */}
      {report?.top_recommendations && report.top_recommendations.length > 0 && (
        <GeoRecommendations recommendations={report.top_recommendations} />
      )}

      {/* Tags & Categories */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tags */}
          {report.tags?.length > 0 && (
            <div className="dashboard-card p-5">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-brand-primary" />
                {t('company.tags')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {report.tags.map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {report.categories?.length > 0 && (
            <div className="dashboard-card p-5">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-brand-accent" />
                {t('company.categories')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {report.categories.map((cat, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-brand-accent/10 text-brand-accent border border-brand-accent/20">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Products & Services */}
      {report?.products_services && report.products_services.length > 0 && (
        <div className="dashboard-card p-5">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-brand-primary" />
            {t('company.productsServices')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.products_services.map((ps, i) => (
              <div key={i} className="p-3 rounded-lg bg-bg-primary/50 border border-glass-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-text-primary">{ps.name}</span>
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${ps.type === 'product' ? 'bg-info/10 text-info' : 'bg-success/10 text-success'}`}>
                    {t(`company.${ps.type}`)}
                  </span>
                </div>
                <p className="text-xs text-text-secondary">{ps.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.strengths?.length > 0 && (
            <div className="dashboard-card p-5">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-success" />
                {t('company.strengths')}
              </h3>
              <ul className="space-y-2">
                {report.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.weaknesses?.length > 0 && (
            <div className="dashboard-card p-5">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-warning" />
                {t('company.weaknesses')}
              </h3>
              <ul className="space-y-2">
                {report.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <AlertCircle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 3-Column Grid for Bot Access, Pages, Competitors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AI Bot Access */}
        {report?.ai_bot_access && Object.keys(report.ai_bot_access).length > 0 && (
          <div className="dashboard-card p-5">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-brand-primary" />
              {t('company.aiBotAccess')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(report.ai_bot_access).map(([bot, allowed]) => (
                <div key={bot} className={`flex items-center gap-2 p-2.5 rounded-lg border ${allowed ? 'border-success/20 bg-success/5' : 'border-error/20 bg-error/5'}`}>
                  {allowed ? (
                    <ShieldCheck className="w-4 h-4 text-success shrink-0" />
                  ) : (
                    <ShieldX className="w-4 h-4 text-error shrink-0" />
                  )}
                  <div>
                    <span className="text-xs font-medium text-text-primary">{bot}</span>
                    <span className={`block text-[10px] ${allowed ? 'text-success' : 'text-error'}`}>
                      {t(allowed ? 'company.allowed' : 'company.blocked')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pages Analyzed */}
        {parsedPages.length > 0 && (
          <div className="dashboard-card p-5">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-brand-primary" />
              {t('company.pagesAnalyzed')}
              <span className="text-xs text-text-muted font-normal">({parsedPages.length})</span>
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {parsedPages.filter(p => p.status_code === 200).map((page, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-bg-primary/50 border border-glass-border text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary font-medium truncate">{page.title || page.url}</p>
                    <span className="text-xs text-text-muted truncate block">{page.url}</span>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                      <span>{page.word_count || 0} {t('company.words', 'words')}</span>
                      {page.load_time_ms && <span>{page.load_time_ms}ms</span>}
                      {page.is_client_rendered && <span className="text-warning">{t('company.csr', 'CSR')}</span>}
                      {page.has_captcha && <span className="text-error">{t('company.captcha', 'Captcha')}</span>}
                      {page.has_structured_data && <span className="text-success">{t('company.schema', 'Schema')}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competitors */}
        {report?.competitors && report.competitors.length > 0 && (
          <div className="dashboard-card p-5">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-warning" />
              {t('company.competitors')}
            </h3>
            <ul className="space-y-1.5">
              {report.competitors.map((c, i) => (
                <li key={i} className="text-sm text-text-secondary flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning/50 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Schema */}
      {report?.schema_markup_types && report.schema_markup_types.length > 0 && (
        <div className="dashboard-card p-5">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-success" />
            {t('company.schemaMarkup')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {report.schema_markup_types.map((type, i) => (
              <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
                {type}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function hasReport(company: Company): boolean {
  const analysis = company.latest_analysis;
  if (!analysis) return false;
  const parsed = safeParse<Record<string, AiReport>>(analysis.ai_report);
  if (!parsed) return false;
  // Bilingual: check if any language key has a summary
  return Object.values(parsed).some((r) => r?.summary);
}
