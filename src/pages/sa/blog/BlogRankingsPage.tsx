import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Plus, Loader2, Check, X, Trash2 } from 'lucide-react';
import { useBlogAdmin, blogAdmin } from './useBlogAdmin';
import { SAPageHeader } from '../SAPageHeader';
import { TemplateDownloadButton } from './JsonToolbar';
import { RANKINGS_TEMPLATE } from './templates';
import type { RankingSnapshot, RankingItem, BlogBrand } from './types';
import { useDialog } from '@/contexts/DialogContext';

interface NewSnapshotState {
  period_label: string;
  period_from: string;
  period_to: string;
  region: string;
  sector: string;
  queries_analyzed: number;
  sectors_covered: number;
  engines_monitored: string;
}

const EMPTY: NewSnapshotState = {
  period_label: 'weekly',
  period_from: '', period_to: '',
  region: 'br', sector: 'financial-services',
  queries_analyzed: 0, sectors_covered: 0,
  engines_monitored: 'chatgpt,gemini,claude,perplexity,grok',
};

export function BlogRankingsPage() {
  const { t } = useTranslation();
  const { alert, confirm } = useDialog();
  const { data: snapshots, isLoading, refetch, remove } = useBlogAdmin<RankingSnapshot>('rankings');
  const { data: brands } = useBlogAdmin<BlogBrand>('brands');
  const [showNew, setShowNew] = useState(false);
  const [newSnap, setNewSnap] = useState<NewSnapshotState>(EMPTY);
  const [items, setItems] = useState<RankingItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<RankingItem[]>([]);

  // Load detail items for selected snapshot
  useEffect(() => {
    if (selectedId === null) { setSelectedItems([]); return; }
    blogAdmin.list<RankingItem>('rankings_items', { snapshot_id: selectedId })
      .then((r) => setSelectedItems(r.data));
  }, [selectedId]);

  const addItem = () => {
    setItems((prev) => [...prev, { snapshot_id: 0, rank: prev.length + 1, brand_id: brands[0]?.id || '', score: 50, delta: '0', direction: 'flat' }]);
  };
  const updateItem = (idx: number, patch: Partial<RankingItem>) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleCreate = async () => {
    setSaving(true);
    try {
      await blogAdmin.call('POST', '/blog-admin/rankings/snapshots', {
        period_label: newSnap.period_label,
        period_from: newSnap.period_from,
        period_to: newSnap.period_to,
        region: newSnap.region,
        sector: newSnap.sector,
        queries_analyzed: newSnap.queries_analyzed,
        sectors_covered: newSnap.sectors_covered,
        engines_monitored: newSnap.engines_monitored.split(',').map((s) => s.trim()).filter(Boolean),
        items: items.map((i) => ({ rank: i.rank, brandId: i.brand_id, score: i.score, delta: i.delta, direction: i.direction })),
      });
      setShowNew(false); setNewSnap(EMPTY); setItems([]);
      refetch();
    } catch (err) {
      void alert({ message: `Save failed: ${(err as Error).message}`, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReplaceItems = async (snapshotId: number) => {
    setSaving(true);
    try {
      await blogAdmin.call('POST', `/blog-admin?entity=rankings_items&snapshot_id=${snapshotId}`, { items: selectedItems });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="dashboard-card p-6 h-32 animate-pulse bg-glass-element" />;

  return (
    <div className="stagger-enter space-y-6">
      <SAPageHeader
        title={t('sa.blog.modules.rankings.title')}
        subtitle={t('sa.blog.modules.rankings.description')}
        icon={<Trophy className="w-6 h-6 text-brand-primary" />}
      >
        <TemplateDownloadButton template={RANKINGS_TEMPLATE} filename="rankings-template.json" />
        <button onClick={() => setShowNew(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />{t('sa.blog.rankings.newSnapshot')}
        </button>
      </SAPageHeader>

      {showNew && (
        <div className="dashboard-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">{t('sa.blog.rankings.newSnapshot')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input value={newSnap.period_label} onChange={(e) => setNewSnap({ ...newSnap, period_label: e.target.value })} placeholder="period_label (weekly)" className="input-field !py-2 !text-sm" />
            <input type="date" value={newSnap.period_from} onChange={(e) => setNewSnap({ ...newSnap, period_from: e.target.value })} className="input-field !py-2 !text-sm" />
            <input type="date" value={newSnap.period_to} onChange={(e) => setNewSnap({ ...newSnap, period_to: e.target.value })} className="input-field !py-2 !text-sm" />
            <input value={newSnap.region} onChange={(e) => setNewSnap({ ...newSnap, region: e.target.value })} placeholder="region (br/es/...)" className="input-field !py-2 !text-sm" />
            <input value={newSnap.sector} onChange={(e) => setNewSnap({ ...newSnap, sector: e.target.value })} placeholder="sector" className="input-field !py-2 !text-sm" />
            <input type="number" value={newSnap.queries_analyzed} onChange={(e) => setNewSnap({ ...newSnap, queries_analyzed: Number(e.target.value) })} placeholder="queries_analyzed" className="input-field !py-2 !text-sm" />
            <input type="number" value={newSnap.sectors_covered} onChange={(e) => setNewSnap({ ...newSnap, sectors_covered: Number(e.target.value) })} placeholder="sectors_covered" className="input-field !py-2 !text-sm" />
            <input value={newSnap.engines_monitored} onChange={(e) => setNewSnap({ ...newSnap, engines_monitored: e.target.value })} placeholder="engines (comma)" className="input-field !py-2 !text-sm sm:col-span-2" />
          </div>

          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-text-secondary">{t('sa.blog.rankings.itemsHeader')}</h4>
            <button onClick={addItem} className="btn btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" />{t('sa.blog.add')}</button>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>rank</th><th>brand</th><th>score</th><th>delta</th><th>direction</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td><input type="number" value={it.rank} onChange={(e) => updateItem(idx, { rank: Number(e.target.value) })} className="input-field !py-1.5 !text-xs w-16" /></td>
                  <td>
                    <select value={it.brand_id} onChange={(e) => updateItem(idx, { brand_id: e.target.value })} className="input-field !py-1.5 !text-xs">
                      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </td>
                  <td><input type="number" value={it.score} onChange={(e) => updateItem(idx, { score: Number(e.target.value) })} className="input-field !py-1.5 !text-xs w-16" /></td>
                  <td><input value={it.delta} onChange={(e) => updateItem(idx, { delta: e.target.value })} className="input-field !py-1.5 !text-xs w-16" /></td>
                  <td>
                    <select value={it.direction} onChange={(e) => updateItem(idx, { direction: e.target.value as 'up' | 'down' | 'flat' })} className="input-field !py-1.5 !text-xs">
                      <option value="up">up</option>
                      <option value="flat">flat</option>
                      <option value="down">down</option>
                    </select>
                  </td>
                  <td><button onClick={() => removeItem(idx)} className="icon-btn text-error/70 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !newSnap.period_from} className="btn btn-primary btn-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{t('sa.blog.save')}
            </button>
            <button onClick={() => { setShowNew(false); setNewSnap(EMPTY); setItems([]); }} className="btn btn-secondary btn-sm">
              <X className="w-4 h-4" />{t('sa.blog.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>id</th><th>period</th><th>region</th><th>sector</th><th>queries</th><th>generated_at</th><th className="text-right">actions</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.id} className={selectedId === s.id ? 'bg-brand-primary/5' : ''}>
                <td className="font-mono text-xs">{s.id}</td>
                <td className="text-xs">{s.period_label} {s.period_from} → {s.period_to}</td>
                <td>{s.region}</td>
                <td>{s.sector}</td>
                <td>{s.queries_analyzed.toLocaleString()}</td>
                <td className="text-xs">{new Date(s.generated_at).toLocaleString()}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setSelectedId(selectedId === s.id ? null : s.id)} className="text-xs px-2 py-1 rounded-md bg-glass-element">
                      {selectedId === s.id ? t('sa.blog.rankings.hideItems') : t('sa.blog.rankings.editItems')}
                    </button>
                    <button onClick={async () => { if (await confirm({ message: t('sa.blog.confirmDelete'), variant: 'danger' })) remove(s.id); }} className="icon-btn text-error/70 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId !== null && (
        <div className="dashboard-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">{t('sa.blog.rankings.itemsHeader')} #{selectedId}</h3>
          <table className="data-table">
            <thead>
              <tr><th>rank</th><th>brand</th><th>score</th><th>delta</th><th>direction</th><th></th></tr>
            </thead>
            <tbody>
              {selectedItems.map((it, idx) => (
                <tr key={idx}>
                  <td><input type="number" value={it.rank} onChange={(e) => setSelectedItems((p) => p.map((x, i) => i === idx ? { ...x, rank: Number(e.target.value) } : x))} className="input-field !py-1.5 !text-xs w-16" /></td>
                  <td>
                    <select value={it.brand_id} onChange={(e) => setSelectedItems((p) => p.map((x, i) => i === idx ? { ...x, brand_id: e.target.value } : x))} className="input-field !py-1.5 !text-xs">
                      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </td>
                  <td><input type="number" value={it.score} onChange={(e) => setSelectedItems((p) => p.map((x, i) => i === idx ? { ...x, score: Number(e.target.value) } : x))} className="input-field !py-1.5 !text-xs w-16" /></td>
                  <td><input value={it.delta} onChange={(e) => setSelectedItems((p) => p.map((x, i) => i === idx ? { ...x, delta: e.target.value } : x))} className="input-field !py-1.5 !text-xs w-16" /></td>
                  <td>
                    <select value={it.direction} onChange={(e) => setSelectedItems((p) => p.map((x, i) => i === idx ? { ...x, direction: e.target.value as 'up' | 'down' | 'flat' } : x))} className="input-field !py-1.5 !text-xs">
                      <option value="up">up</option>
                      <option value="flat">flat</option>
                      <option value="down">down</option>
                    </select>
                  </td>
                  <td><button onClick={() => setSelectedItems((p) => p.filter((_, i) => i !== idx))} className="icon-btn text-error/70 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2">
            <button onClick={() => setSelectedItems((p) => [...p, { snapshot_id: selectedId, rank: p.length + 1, brand_id: brands[0]?.id || '', score: 50, delta: '0', direction: 'flat' }])} className="btn btn-secondary btn-sm">
              <Plus className="w-3.5 h-3.5" />{t('sa.blog.add')}
            </button>
            <button onClick={() => handleReplaceItems(selectedId)} disabled={saving} className="btn btn-primary btn-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{t('sa.blog.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
