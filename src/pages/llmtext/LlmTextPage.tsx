import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, FileText, Search, Download, AlertCircle, CheckCircle2, Upload, HelpCircle, RefreshCw, X, LayoutTemplate, Code, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { SuggestionsModal } from '@/components/suggestions/SuggestionsModal';
import { useScrollLock } from '@/hooks/useScrollLock';

export function LlmTextPage() {
  const { t } = useTranslation();
  const { currentTenant, refreshTenant } = useTenant();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [uploadingSitemap, setUploadingSitemap] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [previewTab, setPreviewTab] = useState<'preview' | 'raw'>('preview');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLanguage, setSuggestionLanguage] = useState(t('i18n.language', 'en'));

  const handleExtract = async () => {
    if (!currentTenant?.main_domain) {
      showToast(t('llmText.errorNoDomain', 'No main domain configured. Please add one in Settings.'), 'error');
      return;
    }

    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-website-information', {
        body: { action: 'extract' }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error?.message || 'Failed to extract information');

      showToast(t('llmText.extractSuccess', 'Website information extracted successfully!'), 'success');
      await refreshTenant();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || t('llmText.extractError', 'An error occurred while extracting information'), 'error');
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerate = async () => {
    if (!currentTenant?.extracted_content) {
      showToast(t('llmText.errorNoContent', 'Please extract information first.'), 'error');
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-website-information', {
        body: { action: 'generate' }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error?.message || 'Failed to generate LLM.txt');

      showToast(t('llmText.generateSuccess', 'LLM.txt generated successfully!'), 'success');
      await refreshTenant();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || t('llmText.generateError', 'An error occurred while generating LLM.txt'), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSuggest = async () => {
    if (!currentTenant?.extracted_content) {
      showToast(t('llmText.errorNoContent', 'Please extract information first.'), 'error');
      return;
    }

    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-website-information', {
        body: { 
          action: 'suggest_topics',
          language: suggestionLanguage
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error?.message || 'Failed to generate suggestions');

      setSuggestions(data.data.topics || []);
      setShowSuggestions(true);
      showToast(t('llmText.suggestionsSuccess', 'Suggestions generated successfully!'), 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || t('llmText.suggestionsError', 'An error occurred while generating suggestions'), 'error');
    } finally {
      setSuggesting(false);
    }
  };

  const handleVerify = async () => {
    if (!currentTenant?.main_domain) {
      showToast(t('llmText.errorNoDomain', 'No main domain configured.'), 'error');
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-website-information', {
        body: { action: 'verify' }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error?.message || 'Failed to verify llm.txt');

      showToast(t('llmText.verifySuccess', 'Status verified successfully!'), 'success');
      await refreshTenant();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || t('llmText.verifyError', 'An error occurred while verifying llm.txt'), 'error');
    } finally {
      setVerifying(false);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentTenant) return;

    if (!file.name.endsWith('.xml')) {
      showToast(t('llmText.invalidFileType', 'Please upload a valid .xml sitemap file.'), 'error');
      return;
    }

    setUploadingSitemap(true);
    try {
      const text = await file.text();

      const { error } = await supabase
        .from('tenants')
        .update({ sitemap_xml: text, updated_at: new Date().toISOString() })
        .eq('id', currentTenant.id);

      if (error) throw error;

      showToast(t('llmText.sitemapUploadSuccess', 'Sitemap uploaded successfully!'), 'success');
      await refreshTenant();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || t('llmText.sitemapUploadError', 'Failed to upload sitemap.'), 'error');
    } finally {
      setUploadingSitemap(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

              {currentTenant?.main_domain && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-text-muted uppercase tracking-wider block">
                      {t('llmText.llmTxtStatus', 'llm.txt Live Status')}
                    </label>
                    <button 
                      onClick={() => setShowInfoModal(true)}
                      className="text-text-muted hover:text-brand-primary transition-colors flex items-center gap-1 text-xs"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {t('llmText.deploymentTip', 'Deployment Tip')}
                    </button>
                  </div>
                  <div className="p-3 bg-bg-primary border border-glass-border rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       {currentTenant?.llm_txt_status === 'updated' && (
                          <span className="text-success font-medium flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            {t('llmText.statusUpdated', 'Updated & Live')}
                          </span>
                       )}
                       {currentTenant?.llm_txt_status === 'outdated' && (
                          <span className="text-warning font-medium flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {t('llmText.statusOutdated', 'Outdated Deployment')}
                          </span>
                       )}
                       {(!currentTenant?.llm_txt_status || currentTenant?.llm_txt_status === 'missing') && (
                          <span className="text-text-muted italic flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {t('llmText.statusMissing', 'Missing from Server')}
                          </span>
                       )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1">
                  {t('llmText.sitemapStatus', 'Sitemap Status')}
                </label>
                <div className="p-3 bg-bg-primary border border-glass-border rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentTenant?.sitemap_xml ? (
                      <span className="text-success font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        {t('llmText.sitemapPresent', 'Sitemap Present')}
                      </span>
                    ) : (
                      <span className="text-text-muted italic flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {t('llmText.sitemapMissing', 'Sitemap Not Uploaded')}
                      </span>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".xml"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingSitemap}
                      className="text-brand-primary hover:text-brand-secondary text-sm font-medium transition-colors flex items-center gap-1"
                    >
                      {uploadingSitemap ? (
                        <Search className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {t('common.upload', 'Upload')}
                    </button>
                  </div>
                </div>
                {!currentTenant?.sitemap_xml && (
                   <p className="text-xs text-text-muted mt-1 ml-1">{t('llmText.sitemapHint', 'We will try to fetch it automatically, but you can override it here.')}</p>
                )}
              </div>

              {!currentTenant?.main_domain && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-2 text-warning text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{t('llmText.missingDomainPrompt', 'Configure your main domain in Tenant Settings to use this feature.')}</p>
                </div>
              )}

              {/* Actions Section */}
              <div className="space-y-3">
                <button
                  onClick={handleExtract}
                  disabled={extracting || generating || suggesting || !currentTenant?.main_domain}
                  className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                >
                  {extracting ? (
                    <>
                      <Search className="w-4 h-4 animate-spin" />
                      {t('llmText.extracting', 'Extracting...')}
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      {t('llmText.extractInformation', 'Extract Information')}
                    </>
                  )}
                </button>

                <button
                  onClick={handleGenerate}
                  disabled={generating || extracting || suggesting || !currentTenant?.extracted_content}
                  className="btn bg-brand-secondary hover:bg-brand-primary text-white w-full py-2.5 flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <FileText className="w-4 h-4 animate-spin" />
                      {t('llmText.generating', 'Generating...')}
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      {t('llmText.generateLlmTxt', 'Generate LLM.txt')}
                    </>
                  )}
                </button>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wider block">
                    {t('llmText.suggestionLanguage', 'Suggestion Language')}
                  </label>
                  <div className="flex gap-2">
                    {['en', 'es', 'pt'].map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setSuggestionLanguage(lang)}
                        className={`flex-1 py-1 px-2 rounded-lg border text-xs font-medium transition-all ${
                          suggestionLanguage === lang
                            ? 'bg-brand-primary/10 border-brand-primary/40 text-brand-primary'
                            : 'bg-white/5 border-white/5 text-text-muted hover:bg-white/10'
                        }`}
                      >
                        {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSuggest}
                  disabled={suggesting || generating || extracting || !currentTenant?.extracted_content}
                  className="btn bg-bg-secondary hover:bg-glass-hover text-text-primary border border-glass-border w-full py-2.5 flex items-center justify-center gap-2 group"
                >
                  {suggesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-brand-primary" />
                      {t('llmText.generating', 'Generating...')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-brand-primary group-hover:animate-pulse" />
                      {t('llmText.generateSuggestions', 'Generate Topics & Prompts')}
                    </>
                  )}
                </button>

                {currentTenant?.llm_txt && (
                  <button
                    onClick={handleVerify}
                    disabled={verifying || extracting || generating || suggesting || !currentTenant?.main_domain}
                    className="btn bg-bg-secondary hover:bg-glass-hover text-text-primary border border-glass-border w-full py-2.5 flex items-center justify-center gap-2"
                  >
                    {verifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {t('llmText.verifying', 'Verifying...')}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        {t('llmText.verifyLive', 'Verify Live llm.txt')}
                      </>
                    )}
                  </button>
                )}
              </div>

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
            
            <div className="bg-[#1e1e1e] rounded-lg border border-glass-border overflow-hidden">
              {currentTenant?.llm_txt ? (
                <>
                  <div className="flex items-center gap-1 p-1.5 border-b border-white/5 bg-black/20">
                    <button
                      onClick={() => setPreviewTab('preview')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${previewTab === 'preview' ? 'bg-white/10 text-brand-secondary shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
                    >
                      <LayoutTemplate className="w-4 h-4" />
                      {t('llmText.renderedPreview', 'Rendered Preview')}
                    </button>
                    <button
                      onClick={() => setPreviewTab('raw')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${previewTab === 'raw' ? 'bg-white/10 text-brand-secondary shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
                    >
                      <Code className="w-4 h-4" />
                      {t('llmText.rawMarkdown', 'Raw Markdown')}
                    </button>
                  </div>
                  <div className="p-4 overflow-y-auto max-h-[600px] custom-scrollbar">
                    {previewTab === 'raw' ? (
                      <pre className="text-sm font-mono text-[#d4d4d4] whitespace-pre-wrap">
                        {currentTenant.llm_txt}
                      </pre>
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none prose-a:text-brand-primary prose-a:no-underline hover:prose-a:underline">
                        <ReactMarkdown>{currentTenant.llm_txt}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center text-text-muted p-4">
                  <FileText className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-sm">{t('llmText.noPreview', 'Run extraction to generate llm.txt preview')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Modals */}
      {showInfoModal && (
        <DeploymentHelpModal onClose={() => setShowInfoModal(false)} />
      )}

      {showSuggestions && (
        <SuggestionsModal 
          isOpen={showSuggestions} 
          onClose={() => setShowSuggestions(false)} 
          suggestions={suggestions} 
        />
      )}
    </div>
  );
}

function DeploymentHelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  useScrollLock();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1e1e1e] border border-glass-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-brand-primary" />
            {t('llmText.howToDeploy', 'How to Deploy llm.txt')}
          </h3>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 text-sm text-text-secondary leading-relaxed">
          <p>
            {t('llmText.deployInstruction1', 'To make this file available to AI scrapers and search platforms, you must host it at the root of your main domain.')}
          </p>
          <div className="bg-bg-primary border border-white/5 rounded-lg p-3 font-mono text-xs text-brand-primary/80">
            https://{currentTenant?.main_domain}/llm.txt
          </div>
          <ul className="list-disc pl-5 space-y-2">
            <li>{t('llmText.deployStep1', 'Download the generated llm.txt file using the download button.')}</li>
            <li>{t('llmText.deployStep2', 'Upload the text file to the "public" folder (or root directory) of your hosting provider.')}</li>
            <li>{t('llmText.deployStep3', 'Ensure it is publicly accessible without authentication.')}</li>
            <li>{t('llmText.deployStep4', 'Click "Verify Live llm.txt" to check if our servers can detect the correct version.')}</li>
          </ul>
        </div>
        <div className="p-5 border-t border-white/10 flex justify-end">
          <button 
            onClick={onClose}
            className="btn btn-primary"
          >
            {t('common.gotIt', 'Got it')}
          </button>
        </div>
      </div>
    </div>
  );
}
