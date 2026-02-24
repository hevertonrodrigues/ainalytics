import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, FileText, Search, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';

export function LlmTextPage() {
  const { t } = useTranslation();
  const { currentTenant, refreshTenant } = useTenant();
  const { showToast } = useToast();
  const [fetchingDomainInfo, setFetchingDomainInfo] = useState(false);

  const handleGetInformation = async () => {
    if (!currentTenant?.main_domain) {
      showToast(t('llmText.errorNoDomain', 'No main domain configured. Please add one in Settings.'), 'error');
      return;
    }

    setFetchingDomainInfo(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-website-information', {});

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error?.message || 'Failed to fetch information');

      showToast(t('llmText.fetchSuccess', 'Website information extracted successfully!'), 'success');
      await refreshTenant(); // Reload data to show populated fields
    } catch (err: any) {
      console.error(err);
      showToast(err.message || t('llmText.fetchError', 'An error occurred while fetching information'), 'error');
    } finally {
      setFetchingDomainInfo(false);
    }
  };

  const handleDownload = () => {
    if (!currentTenant?.llm_txt) return;

    const blob = new Blob([currentTenant.llm_txt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary capitalize flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-primary" />
            {t('nav.llmText', 'LLM.TXT Generator')}
          </h1>
          <p className="text-text-secondary mt-1">
            {t('llmText.description', 'Analyze your main domain to automatically generate context for AI models.')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Actions & Domain Info) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-text-secondary" />
              {t('llmText.domainStatus', 'Domain Analysis')}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1">
                  {t('tenant.mainDomain', 'Main Domain')}
                </label>
                <div className="p-3 bg-bg-primary border border-glass-border rounded-lg text-text-primary font-medium">
                  {currentTenant?.main_domain || (
                    <span className="text-text-muted italic">{t('common.notSet', 'Not configured')}</span>
                  )}
                </div>
              </div>

              {!currentTenant?.main_domain && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-2 text-warning text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{t('llmText.missingDomainPrompt', 'Configure your main domain in Tenant Settings to use this feature.')}</p>
                </div>
              )}

              {/* Actions Section */}
              <button
                onClick={handleGetInformation}
                disabled={fetchingDomainInfo || !currentTenant?.main_domain}
                className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
              >
                {fetchingDomainInfo ? (
                  <>
                    <Search className="w-4 h-4 animate-spin" />
                    {t('llmText.analyzing', 'Analyzing website...')}
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    {t('llmText.getInformation', 'Get Information')}
                  </>
                )}
              </button>

              {currentTenant?.llm_txt && (
                <div className="pt-4 border-t border-glass-border space-y-3">
                  <div className="flex items-center gap-2 text-success text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('llmText.upToDate', 'Analysis complete')}</span>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="btn bg-bg-secondary hover:bg-glass-hover border border-glass-border text-text-primary w-full py-2 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {t('llmText.download', 'Download llm.txt')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Results) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              {t('llmText.extractedData', 'Extracted Data')}
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wider block">
                    {t('llmText.websiteTitle', 'Website Title')}
                  </label>
                  <div className="p-3 bg-bg-primary border border-glass-border rounded-lg min-h-[46px] text-sm text-text-primary">
                    {currentTenant?.website_title || <span className="text-text-muted italic">{t('common.empty', 'No data')}</span>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wider block">
                    {t('llmText.metatags', 'Meta Tags')}
                  </label>
                  <div className="p-3 bg-bg-primary border border-glass-border rounded-lg min-h-[46px] text-sm text-text-primary overflow-x-auto whitespace-pre-wrap">
                    {currentTenant?.metatags || <span className="text-text-muted italic">{t('common.empty', 'No data')}</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block">
                  {t('llmText.extractedContent', 'Extracted Content Details')}
                </label>
                <div className="p-3 bg-bg-primary border border-glass-border rounded-lg min-h-[100px] text-sm text-text-primary whitespace-pre-wrap">
                  {currentTenant?.extracted_content || <span className="text-text-muted italic">{t('common.empty', 'No data')}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                {t('llmText.previewTitle', 'llm.txt Preview')}
              </h2>
            </div>
            
            <div className="bg-[#1e1e1e] rounded-lg border border-glass-border p-4 overflow-x-auto">
              {currentTenant?.llm_txt ? (
                <pre className="text-sm font-mono text-[#d4d4d4] whitespace-pre-wrap">
                  {currentTenant.llm_txt}
                </pre>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center text-text-muted">
                  <FileText className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-sm">{t('llmText.noPreview', 'Run extraction to generate llm.txt preview')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
