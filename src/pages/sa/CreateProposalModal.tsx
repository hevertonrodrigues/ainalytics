import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, Copy, Check, FileText, Moon, Sun, Globe } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface Plan {
  id: string;
  name: string;
  price: number;
  billing_interval: string;
  features: Record<string, string[]>;
  settings: Record<string, { description?: string }>;
}

interface CreateProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  userId?: string;
  tenantId?: string;
  userName?: string;
}

const LANGS = ['en', 'es', 'pt-br'] as const;

/* Shared input classes — solid bg that works in both themes */
const inputBase =
  'bg-bg-tertiary border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-colors';
const inputCls = `w-full ${inputBase}`;

const CURRENCY_CONFIG: Record<string, { locale: string; currency: string; symbol: string }> = {
  usd: { locale: 'en-US', currency: 'USD', symbol: '$' },
  brl: { locale: 'pt-BR', currency: 'BRL', symbol: 'R$' },
  eur: { locale: 'de-DE', currency: 'EUR', symbol: '€' },
};

function formatCurrency(value: number, currencyCode: string): string {
  const cfg = CURRENCY_CONFIG[currencyCode] ?? CURRENCY_CONFIG['usd']!;
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Calculate default validity (7 days from now)
function getDefaultValidity(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0] ?? '';
}

export function CreateProposalModal({ isOpen, onClose, onCreated, userId, tenantId, userName }: CreateProposalModalProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language as typeof LANGS[number];

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planName, setPlanName] = useState('');
  const [price, setPrice] = useState('');
  const [basePriceUsd, setBasePriceUsd] = useState<number | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [currency, setCurrency] = useState('usd');
  const [exchangeRates, setExchangeRates] = useState<{ USD_BRL: number; USD_EUR: number }>({ USD_BRL: 5.0, USD_EUR: 1.2 });
  const [features, setFeatures] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState(getDefaultValidity);
  const [newFeature, setNewFeature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [defaultLang, setDefaultLang] = useState<string>(currentLang || 'en');

  // Fetch plans and exchange rates on open
  useEffect(() => {
    if (!isOpen) return;
    async function fetchPlans() {
      try {
        const res = await apiClient.get<Plan[]>('/admin-settings?entity=plans');
        setPlans(res.data || []);
      } catch { /* ignore */ }
    }
    async function fetchRates() {
      try {
        const { data } = await supabase
          .from('general_settings')
          .select('key, value')
          .in('key', ['USD_BRL', 'USD_EUR']);
        if (data) {
          const r = { ...exchangeRates };
          data.forEach((row: { key: string; value: string }) => {
            if (row.key === 'USD_BRL') r.USD_BRL = parseFloat(row.value);
            if (row.key === 'USD_EUR') r.USD_EUR = parseFloat(row.value);
          });
          setExchangeRates(r);
        }
      } catch { /* ignore */ }
    }
    fetchPlans();
    fetchRates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Convert price when currency changes
  const convertPrice = useCallback((usdPrice: number, toCurrency: string): string => {
    let converted = usdPrice;
    if (toCurrency === 'brl') converted = usdPrice * exchangeRates.USD_BRL;
    if (toCurrency === 'eur') converted = usdPrice * exchangeRates.USD_EUR;
    return converted.toFixed(2);
  }, [exchangeRates]);

  function handleCurrencyChange(newCurrency: string) {
    setCurrency(newCurrency);
    if (basePriceUsd !== null) {
      setPrice(convertPrice(basePriceUsd, newCurrency));
    }
  }

  // When a base plan is selected, prefill features
  function handlePlanSelect(planId: string) {
    setSelectedPlanId(planId);
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      setPlanName(plan.name);
      setBasePriceUsd(plan.price);
      setPrice(convertPrice(plan.price, currency));
      setBillingInterval((plan.billing_interval as 'monthly' | 'yearly') || 'monthly');
      if (plan.features) {
        const planFeats = plan.features?.[defaultLang] || plan.features?.['en'] || [];
        setFeatures([...planFeats]);
      }
      if (plan.settings) {
        const desc = plan.settings[defaultLang]?.description || plan.settings['en']?.description || '';
        setDescription(desc);
      }
    }
  }

  function addFeature() {
    if (!newFeature.trim()) return;
    setFeatures(prev => [...prev, newFeature.trim()]);
    setNewFeature('');
  }

  function removeFeature(idx: number) {
    setFeatures(prev => prev.filter((_: string, i: number) => i !== idx));
  }

  async function handleSubmit(submitStatus: 'draft' | 'sent') {
    if (!planName || !price) return;
    setIsSubmitting(true);

    try {
      const res = await apiClient.post<{ slug: string }>('/proposals', {
        user_id: userId || null,
        tenant_id: tenantId || null,
        plan_id: selectedPlanId || null,
        custom_plan_name: planName,
        custom_price: parseFloat(price),
        billing_interval: billingInterval,
        currency,
        custom_features: { [defaultLang]: features },
        custom_description: { [defaultLang]: description },
        notes: notes || null,
        valid_until: validUntil || null,
        status: submitStatus,
        theme,
        default_lang: defaultLang,
      });

      if (submitStatus === 'sent') {
        setCreatedSlug(res.data.slug);
      } else {
        resetAndClose();
      }
      onCreated();
    } catch {
      // TODO: toast
    } finally {
      setIsSubmitting(false);
    }
  }

  function getPublicUrl(slug: string) {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${siteUrl}/proposal/${slug}`;
  }



  function resetAndClose() {
    setCreatedSlug(null);
    setPlanName('');
    setPrice('');
    setBasePriceUsd(null);
    setSelectedPlanId('');
    setCurrency('usd');
    setFeatures([]);
    setDescription('');
    setNotes('');
    setValidUntil(getDefaultValidity());
    setNewFeature('');
    setTheme('dark');
    setDefaultLang(currentLang || 'en');
    onClose();
  }

  if (!isOpen) return null;

  // ── Success state ──
  if (createdSlug) {
    const simpleUrl = getPublicUrl(createdSlug);
    const fullUrl = `${simpleUrl}/full`;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetAndClose}>
        <div
          className="bg-bg-secondary border border-glass-border rounded-2xl shadow-2xl w-full max-w-md p-8"
          style={{ animation: 'scale-in .2s ease-out' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-bold text-text-primary">{t('proposal.created')}</h2>

            {/* Simple link */}
            <div className="bg-bg-tertiary rounded-lg p-3 border border-glass-border text-left">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-text-muted font-medium">{t('proposal.simpleLink')}</p>
                <button
                  onClick={async () => { await navigator.clipboard.writeText(simpleUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="text-xs text-brand-primary hover:text-brand-hover flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? t('proposal.linkCopied') : t('proposal.copyLink')}
                </button>
              </div>
              <p className="text-xs font-mono text-brand-primary break-all">{simpleUrl}</p>
            </div>

            {/* Full presentation link */}
            <div className="bg-bg-tertiary rounded-lg p-3 border border-glass-border text-left">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-text-muted font-medium">{t('proposal.fullLink')}</p>
                <button
                  onClick={async () => { await navigator.clipboard.writeText(fullUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="text-xs text-brand-primary hover:text-brand-hover flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? t('proposal.linkCopied') : t('proposal.copyLink')}
                </button>
              </div>
              <p className="text-xs font-mono text-brand-primary break-all">{fullUrl}</p>
            </div>

            <button onClick={resetAndClose} className="text-sm text-text-muted hover:text-text-primary transition-colors">
              {t('sa.close')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form state ──
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetAndClose}>
      <div
        className="bg-bg-secondary border border-glass-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">{t('proposal.newProposal')}</h2>
              {userName && <p className="text-xs text-text-muted">{userName}</p>}
            </div>
          </div>
          <button onClick={resetAndClose} className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <form onSubmit={e => e.preventDefault()} className="space-y-5">
          {/* Base plan selector */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('proposal.basePlan')}</label>
            <select
              value={selectedPlanId}
              onChange={e => handlePlanSelect(e.target.value)}
              className={inputCls}
            >
              <option value="">{t('proposal.selectPlan')}</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price, currency)}</option>
              ))}
            </select>
          </div>

          {/* Plan name + Price row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('proposal.planName')} *</label>
              <input
                type="text"
                value={planName}
                onChange={e => setPlanName(e.target.value)}
                placeholder={t('proposal.planNamePlaceholder')}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('proposal.customPrice')} *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={e => {
                  setPrice(e.target.value);
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    let usd = val;
                    if (currency === 'brl') usd = val / exchangeRates.USD_BRL;
                    if (currency === 'eur') usd = val / exchangeRates.USD_EUR;
                    setBasePriceUsd(usd);
                  }
                }}
                placeholder="99.00"
                className={inputCls}
                required
              />
            </div>
          </div>

          {/* Billing + Currency + Valid until row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('proposal.billingInterval')}</label>
              <select
                value={billingInterval}
                onChange={e => setBillingInterval(e.target.value as 'monthly' | 'yearly')}
                className={inputCls}
              >
                <option value="monthly">{t('proposal.monthly')}</option>
                <option value="yearly">{t('proposal.yearly')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('proposal.currency')}</label>
              <select
                value={currency}
                onChange={e => handleCurrencyChange(e.target.value)}
                className={inputCls}
              >
                <option value="usd">USD ($)</option>
                <option value="brl">BRL (R$)</option>
                <option value="eur">EUR (€)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('proposal.validUntil')}</label>
              <input
                type="date"
                value={validUntil}
                onChange={e => setValidUntil(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Theme + Default Language row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('proposal.theme')}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    theme === 'dark'
                      ? 'bg-gray-900 text-white border-indigo-500/40 ring-2 ring-indigo-500/20'
                      : 'bg-bg-tertiary text-text-muted border-glass-border hover:border-glass-border/80'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  {t('proposal.themeDark')}
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    theme === 'light'
                      ? 'bg-white text-gray-900 border-indigo-500/40 ring-2 ring-indigo-500/20'
                      : 'bg-bg-tertiary text-text-muted border-glass-border hover:border-glass-border/80'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  {t('proposal.themeLight')}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                <Globe className="w-3.5 h-3.5 inline mr-1" />
                {t('proposal.defaultLang')}
              </label>
              <select
                value={defaultLang}
                onChange={e => setDefaultLang(e.target.value)}
                className={inputCls}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="pt-br">Português (BR)</option>
              </select>
            </div>
          </div>

          {/* Features (single list, no language tabs) */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('proposal.features')}</label>
            <div className="space-y-1.5 mb-2">
              {features.map((feat: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2 bg-bg-tertiary border border-glass-border rounded-lg px-3 py-1.5 text-sm">
                  <span className="flex-1 text-text-primary">{feat}</span>
                  <button type="button" onClick={() => removeFeature(idx)} className="text-error/60 hover:text-error transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newFeature}
                onChange={e => setNewFeature(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                placeholder={t('proposal.featuresPlaceholder')}
                className={`flex-1 ${inputBase}`}
              />
              <button type="button" onClick={addFeature} className="px-3 py-1.5 rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors text-sm flex items-center gap-1 shrink-0">
                <Plus className="w-3.5 h-3.5" /> {t('proposal.addFeature')}
              </button>
            </div>
          </div>

          {/* Description (single, no tabs) */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('proposal.description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('proposal.descriptionPlaceholder')}
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Internal notes */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('proposal.internalNotes')}</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('proposal.notesPlaceholder')}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 pt-4 border-t border-glass-border">
            <button type="button" onClick={resetAndClose} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-bg-tertiary w-full sm:w-auto order-3 sm:order-1">
              {t('sa.cancel')}
            </button>
            <button
              type="button"
              disabled={isSubmitting || !planName || !price}
              onClick={() => handleSubmit('draft')}
              className="px-4 py-2 rounded-lg border border-glass-border bg-bg-tertiary text-text-secondary hover:text-text-primary text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto order-2"
            >
              <FileText className="w-4 h-4" />
              {isSubmitting ? t('proposal.creating') : t('proposal.saveDraft')}
            </button>
            <button
              type="button"
              disabled={isSubmitting || !planName || !price}
              onClick={() => handleSubmit('sent')}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto order-1 sm:order-3"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? t('proposal.creating') : t('proposal.finishGenerate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
