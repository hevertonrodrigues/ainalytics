import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, Copy, Check, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api';

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

/* Shared input class — solid bg that works in both themes */
const inputCls =
  'w-full bg-bg-tertiary border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-colors';

export function CreateProposalModal({ isOpen, onClose, onCreated, userId, tenantId, userName }: CreateProposalModalProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language as typeof LANGS[number];

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planName, setPlanName] = useState('');
  const [price, setPrice] = useState('');
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [currency, setCurrency] = useState('usd');
  const [features, setFeatures] = useState<Record<string, string[]>>({ en: [], es: [], 'pt-br': [] });
  const [description, setDescription] = useState<Record<string, string>>({ en: '', es: '', 'pt-br': '' });
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [activeTab, setActiveTab] = useState<typeof LANGS[number]>(currentLang || 'en');
  const [newFeature, setNewFeature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch plans for the selector
  useEffect(() => {
    if (!isOpen) return;
    async function fetchPlans() {
      try {
        const res = await apiClient.get<Plan[]>('/admin-settings?resource=plans');
        setPlans(res.data || []);
      } catch { /* ignore */ }
    }
    fetchPlans();
  }, [isOpen]);

  // When a base plan is selected, prefill features
  function handlePlanSelect(planId: string) {
    setSelectedPlanId(planId);
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      setPlanName(plan.name);
      setPrice(String(plan.price));
      setBillingInterval((plan.billing_interval as 'monthly' | 'yearly') || 'monthly');
      if (plan.features) {
        const f: Record<string, string[]> = { en: [], es: [], 'pt-br': [] };
        for (const lang of LANGS) {
          f[lang] = plan.features[lang] || plan.features['en'] || [];
        }
        setFeatures(f);
      }
      if (plan.settings) {
        const d: Record<string, string> = { en: '', es: '', 'pt-br': '' };
        for (const lang of LANGS) {
          d[lang] = plan.settings[lang]?.description || plan.settings['en']?.description || '';
        }
        setDescription(d);
      }
    }
  }

  function addFeature() {
    if (!newFeature.trim()) return;
    setFeatures(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), newFeature.trim()],
    }));
    setNewFeature('');
  }

  function removeFeature(idx: number) {
    setFeatures(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).filter((_: string, i: number) => i !== idx),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        custom_features: features,
        custom_description: description,
        notes: notes || null,
        valid_until: validUntil || null,
        status: 'draft',
      });

      setCreatedSlug(res.data.slug);
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

  async function copyLink() {
    if (!createdSlug) return;
    await navigator.clipboard.writeText(getPublicUrl(createdSlug));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function resetAndClose() {
    setCreatedSlug(null);
    setPlanName('');
    setPrice('');
    setSelectedPlanId('');
    setFeatures({ en: [], es: [], 'pt-br': [] });
    setDescription({ en: '', es: '', 'pt-br': '' });
    setNotes('');
    setValidUntil('');
    setNewFeature('');
    onClose();
  }

  if (!isOpen) return null;

  // ── Success state ──
  if (createdSlug) {
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
            <div className="bg-bg-tertiary rounded-lg p-3 border border-glass-border">
              <p className="text-xs text-text-muted mb-1">{t('proposal.publicLink')}</p>
              <p className="text-sm font-mono text-brand-primary break-all">{getPublicUrl(createdSlug)}</p>
            </div>
            <button onClick={copyLink} className="btn-primary w-full flex items-center justify-center gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? t('proposal.linkCopied') : t('proposal.copyLink')}
            </button>
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

        <form onSubmit={handleSubmit} className="space-y-5">
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
                <option key={p.id} value={p.id}>{p.name} — ${p.price}</option>
              ))}
            </select>
          </div>

          {/* Plan name + Price row */}
          <div className="grid grid-cols-2 gap-4">
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
                onChange={e => setPrice(e.target.value)}
                placeholder="99.00"
                className={inputCls}
                required
              />
            </div>
          </div>

          {/* Billing + Currency + Valid until row */}
          <div className="grid grid-cols-3 gap-4">
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
                onChange={e => setCurrency(e.target.value)}
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

          {/* Multilingual tabs for Features + Description */}
          <div>
            <div className="flex items-center gap-1 mb-3 border-b border-glass-border">
              {LANGS.map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setActiveTab(lang)}
                  className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                    activeTab === lang
                      ? 'border-b-2 border-brand-primary text-brand-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* Features */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('proposal.features')}</label>
              <div className="space-y-1.5 mb-2">
                {(features[activeTab] || []).map((feat: string, idx: number) => (
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
                  className={`flex-1 ${inputCls}`}
                />
                <button type="button" onClick={addFeature} className="px-3 py-1.5 rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors text-sm flex items-center gap-1 shrink-0">
                  <Plus className="w-3.5 h-3.5" /> {t('proposal.addFeature')}
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('proposal.description')}</label>
              <textarea
                value={description[activeTab] || ''}
                onChange={e => setDescription(prev => ({ ...prev, [activeTab]: e.target.value }))}
                placeholder={t('proposal.descriptionPlaceholder')}
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>
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
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-glass-border">
            <button type="button" onClick={resetAndClose} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-bg-tertiary">
              {t('sa.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !planName || !price}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              {isSubmitting ? t('proposal.creating') : t('proposal.createProposal')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
