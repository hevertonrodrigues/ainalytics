import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Plus, Trash2, Copy, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdminCrud } from './useAdminCrud';
import { apiClient } from '@/lib/api';

interface ActivationCode {
  id: string;
  plan_id: string | null;
  tenant_id: string | null;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  plan_name?: string | null;
  tenant_name?: string | null;
}

interface Plan { id: string; name: string; }

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const values = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}

export function ActivationCodesPage() {
  const { t } = useTranslation();
  const { data: codes, isLoading, create, update, remove } = useAdminCrud<ActivationCode>('activation_codes');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [creating, setCreating] = useState(false);
  const [newPlanId, setNewPlanId] = useState('');
  const [newCode, setNewCode] = useState(generateCode());
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<Plan[]>('/admin-settings?entity=plans').then(r => setPlans(r.data));
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await create({ plan_id: newPlanId || null, code: newCode } as unknown as Partial<ActivationCode>);
      setCreating(false);
      setNewCode(generateCode());
    } finally { setSaving(false); }
  };

  const copyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (id: string) => { if (confirm(t('sa.confirmDelete'))) await remove(id); };

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="dashboard-card p-6 h-20 animate-pulse bg-glass-element" />)}</div>;

  return (
    <div className="stagger-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2"><Key className="w-6 h-6 text-brand-primary" />{t('sa.activationTitle')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('sa.activationSubtitle')}</p>
        </div>
        <button onClick={() => { setCreating(true); setNewCode(generateCode()); }} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />{t('sa.addNew')}</button>
      </div>

      {creating && (
        <div className="dashboard-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">{t('sa.newCode')}</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.colLinkedPlan')}</label>
              <select value={newPlanId} onChange={e => setNewPlanId(e.target.value)} className="input-field !py-2 !text-sm w-48">
                <option value="">{t('sa.noPlanAssigned')}</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[250px]">
              <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.colCode')}</label>
              <div className="flex items-center gap-1">
                <input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} maxLength={12}
                  className="input-field !py-2 !text-sm font-mono tracking-widest flex-1" />
                <button onClick={() => setNewCode(generateCode())} className="icon-btn text-text-secondary text-xs px-2" title={t('sa.regenerate')}>↻</button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving || newCode.length !== 12} className="btn btn-primary btn-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{t('sa.save')}
            </button>
            <button onClick={() => setCreating(false)} className="btn btn-secondary btn-sm">{t('sa.cancel')}</button>
          </div>
        </div>
      )}

      <div className="dashboard-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left">{t('sa.colCode')}</th>
              <th className="text-left">{t('sa.colLinkedPlan')}</th>
              <th className="text-left">{t('sa.colClaimedBy')}</th>
              <th className="text-center">{t('sa.colActive')}</th>
              <th className="text-left">{t('sa.colCreated')}</th>
              <th className="text-right">{t('sa.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
              <tr><td colSpan={6} className="!text-center !font-body !text-text-secondary">{t('sa.noCodes')}</td></tr>
            ) : codes.map(c => {
              const isExpanded = expandedId === c.id;
              return (
                <Fragment key={c.id}>
                  <tr className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                    <td>
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp className="w-3 h-3 text-text-secondary" /> : <ChevronDown className="w-3 h-3 text-text-secondary" />}
                        <code className="text-brand-primary tracking-wider font-semibold">{c.code}</code>
                        <button onClick={(e) => copyCode(c.code, e)} className="icon-btn !p-1">
                          {copied === c.code ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3 text-text-secondary" />}
                        </button>
                      </div>
                    </td>
                    <td className="!font-body">{c.plan_name || <span className="text-text-secondary italic">—</span>}</td>
                    <td className="!font-body">{c.tenant_name || <span className="text-text-secondary italic">{t('sa.unclaimed')}</span>}</td>
                    <td className="text-center">
                      <button onClick={(e) => { e.stopPropagation(); update(c.id, { is_active: !c.is_active } as unknown as Partial<ActivationCode>); }}
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.is_active ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                        {c.is_active ? t('sa.active') : t('sa.inactive')}
                      </button>
                    </td>
                    <td className="!font-body text-sm">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleDelete(c.id)} className="icon-btn text-error/70 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="!font-body !text-sm !p-4 bg-bg-tertiary/30">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div><span className="text-xs font-semibold text-text-secondary block mb-1">ID</span><code className="text-xs text-text-primary break-all">{c.id}</code></div>
                          <div><span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.planIdLabel')}</span><code className="text-xs text-text-primary break-all">{c.plan_id || '—'}</code></div>
                          <div><span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.tenantIdLabel')}</span><code className="text-xs text-text-primary break-all">{c.tenant_id || '—'}</code></div>
                          <div><span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.colUpdated')}</span><span className="text-text-primary">{c.updated_at ? new Date(c.updated_at).toLocaleString() : '—'}</span></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
