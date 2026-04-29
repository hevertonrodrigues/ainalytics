import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useDialog } from '@/contexts/DialogContext';
import { blogAdmin } from '../useBlogAdmin';

/**
 * Generic management modal for a "lookup" taxonomy: sectors, regions, engines.
 * Each row has:
 *   - id (slug/key, immutable once created)
 *   - position
 *   - is_active
 *   - per-locale label (and optional description)
 *   - extra parent fields (e.g. color for engines, sector_id for subsectors)
 *
 * Renders a compact table with inline edit + add. Heavier metadata (rich
 * descriptions, images, etc.) belongs in a dedicated page; this modal targets
 * the 80% case of "I just need to add/rename/sort the labels".
 */

export type TaxonomyEntity = 'sectors' | 'subsectors' | 'regions' | 'engines';

const LANGS = ['pt', 'es', 'en'] as const;
type Lang = (typeof LANGS)[number];

interface ParentField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'color';
  default?: unknown;
}

interface EntityConfig {
  title: string;
  description: string;
  showCount?: 'brands' | 'snapshots';
  parentFields: ParentField[];
  trFields: ('label' | 'description' | 'tags' | 'bias')[];
}

const CONFIGS: Record<TaxonomyEntity, EntityConfig> = {
  sectors: {
    title: 'Sectors',
    description: 'Top-level industry buckets used by rankings & brands.',
    showCount: 'brands',
    parentFields: [
      { name: 'position',  label: 'Pos',    type: 'number',  default: 0 },
      { name: 'is_active', label: 'Active', type: 'boolean', default: true },
    ],
    trFields: ['label', 'description'],
  },
  subsectors: {
    title: 'Subsectors',
    description: 'Drill-down inside a sector (e.g. banks ⊂ financial-services).',
    parentFields: [
      { name: 'sector_id', label: 'Sector', type: 'text' },
      { name: 'position',  label: 'Pos',    type: 'number',  default: 0 },
      { name: 'is_active', label: 'Active', type: 'boolean', default: true },
    ],
    trFields: ['label'],
  },
  regions: {
    title: 'Regions',
    description: 'Geographic markets covered by the rankings.',
    showCount: 'snapshots',
    parentFields: [
      { name: 'position',  label: 'Pos',    type: 'number',  default: 0 },
      { name: 'is_active', label: 'Active', type: 'boolean', default: true },
    ],
    trFields: ['label', 'description'],
  },
  engines: {
    title: 'Engines',
    description: 'AI engines tracked across rankings, ticker and engine profiles.',
    parentFields: [
      { name: 'label',     label: 'Label', type: 'text' },
      { name: 'color',     label: 'Color', type: 'color', default: '#7C7C7C' },
      { name: 'position',  label: 'Pos',   type: 'number',  default: 0 },
      { name: 'is_active', label: 'Active', type: 'boolean', default: true },
    ],
    trFields: ['tags', 'bias'],
  },
};

interface Row {
  id: string;
  count?: number;
  translations: Partial<Record<Lang, Record<string, unknown>>>;
  [k: string]: unknown;
}

interface Props {
  entity: TaxonomyEntity;
  onClose: () => void;
}

export function TaxonomyModal({ entity, onClose }: Props) {
  const cfg = CONFIGS[entity];
  useScrollLock(true);
  const { confirm } = useDialog();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLang, setActiveLang] = useState<Lang>('en');
  const [draft, setDraft] = useState<Row | null>(null); // row being edited (or new)
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const qs = cfg.showCount ? { with_counts: cfg.showCount } : undefined;
      const res = await blogAdmin.list<Row>(entity, qs);
      setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [entity]);

  function startNew() {
    const empty: Row = { id: '', translations: {} };
    for (const f of cfg.parentFields) empty[f.name] = f.default ?? '';
    setDraft(empty);
  }

  async function saveDraft() {
    if (!draft || !draft.id) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { row: { id: draft.id } };
      for (const f of cfg.parentFields) (body.row as Record<string, unknown>)[f.name] = draft[f.name];
      body.translations = draft.translations;
      await blogAdmin.create(entity, body);
      setDraft(null);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(id: string) {
    const ok = await confirm({
      message: `Delete "${id}"? This may fail if other records still reference it.`,
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await blogAdmin.remove(entity, id);
    } catch (err) {
      const e = err as Error & { code?: string; status?: number };
      // Backend returns 409 CONFLICT with a usage breakdown when FKs block
      // the delete. Show the message and offer a cascade retry that wipes
      // every dependent row first (irreversible — confirmed by the operator).
      if (e.code === 'CONFLICT' || e.status === 409) {
        const cascadeOk = await confirm({
          message:
            `${e.message}\n\n` +
            `Delete the dependent rows too? This cannot be undone.`,
          confirmLabel: 'Delete cascade',
          variant: 'danger',
        });
        if (!cascadeOk) return;
        await blogAdmin.remove(entity, id, { cascade: true });
      } else {
        throw err;
      }
    }
    await reload();
  }

  const editing = draft;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col dashboard-card animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-glass-border flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text-primary">{cfg.title}</h2>
            <p className="text-xs text-text-secondary mt-0.5 truncate">{cfg.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              className="input text-xs py-1 px-2"
              value={activeLang}
              onChange={(e) => setActiveLang(e.target.value as Lang)}
            >
              {LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
            </select>
            <button onClick={startNew} className="btn btn-primary btn-sm gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
            <button onClick={onClose} className="icon-btn" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-text-muted bg-bg-secondary/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">ID</th>
                  <th className="px-3 py-2 text-left font-medium">{`Label (${activeLang})`}</th>
                  {cfg.parentFields.map((f) => (
                    <th key={f.name} className="px-3 py-2 text-left font-medium">{f.label}</th>
                  ))}
                  {cfg.showCount && <th className="px-3 py-2 text-right font-medium">Used</th>}
                  <th className="px-3 py-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {editing && !rows.find((r) => r.id === editing.id) && (
                  <DraftRow
                    cfg={cfg} activeLang={activeLang} draft={editing}
                    onChange={setDraft} saving={saving}
                    onSave={saveDraft} onCancel={() => setDraft(null)}
                  />
                )}
                {rows.map((r) => editing?.id === r.id ? (
                  <DraftRow
                    key={r.id}
                    cfg={cfg} activeLang={activeLang} draft={editing}
                    onChange={setDraft} saving={saving}
                    onSave={saveDraft} onCancel={() => setDraft(null)}
                  />
                ) : (
                  <tr key={r.id} className="hover:bg-glass-hover">
                    <td className="px-3 py-2 font-mono text-xs text-text-secondary">{r.id}</td>
                    <td className="px-3 py-2">
                      {(r.translations?.[activeLang]?.label as string) || <span className="text-text-muted/60">—</span>}
                    </td>
                    {cfg.parentFields.map((f) => (
                      <td key={f.name} className="px-3 py-2">
                        {f.type === 'boolean'
                          ? (r[f.name] ? <span className="text-success">●</span> : <span className="text-text-muted/40">○</span>)
                          : f.type === 'color'
                          ? <span className="inline-block w-4 h-4 rounded border border-glass-border align-middle" style={{ backgroundColor: String(r[f.name] || '#000') }} />
                          : <span className="text-text-secondary">{String(r[f.name] ?? '—')}</span>}
                      </td>
                    ))}
                    {cfg.showCount && (
                      <td className="px-3 py-2 text-right font-mono text-xs">{r.count ?? 0}</td>
                    )}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setDraft(JSON.parse(JSON.stringify(r)))} className="icon-btn text-brand-primary/80 hover:text-brand-primary" title="Edit">
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeRow(r.id)} className="icon-btn text-error/70 hover:text-error" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !editing && (
                  <tr><td colSpan={2 + cfg.parentFields.length + (cfg.showCount ? 1 : 0) + 1} className="px-3 py-8 text-center text-text-muted text-sm">No entries yet — click <strong>Add</strong> to create one.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftRow({
  cfg, activeLang, draft, onChange, saving, onSave, onCancel,
}: {
  cfg: EntityConfig; activeLang: Lang; draft: Row;
  onChange: (r: Row) => void; saving: boolean;
  onSave: () => void; onCancel: () => void;
}) {
  const tr = (draft.translations?.[activeLang] as Record<string, unknown>) || {};
  const setTr = (k: string, v: unknown) => onChange({
    ...draft,
    translations: { ...draft.translations, [activeLang]: { ...tr, [k]: v } },
  });
  const setField = (k: string, v: unknown) => onChange({ ...draft, [k]: v });

  return (
    <tr className="bg-brand-primary/5">
      <td className="px-3 py-2">
        <input
          className="input text-xs py-1 px-2 w-full font-mono"
          placeholder="my-id"
          value={draft.id}
          onChange={(e) => setField('id', e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
        />
      </td>
      <td className="px-3 py-2">
        <input
          className="input text-xs py-1 px-2 w-full"
          placeholder="Label"
          value={(tr.label as string) || ''}
          onChange={(e) => setTr('label', e.target.value)}
        />
      </td>
      {cfg.parentFields.map((f) => (
        <td key={f.name} className="px-3 py-2">
          {f.type === 'boolean' ? (
            <input type="checkbox" checked={Boolean(draft[f.name])} onChange={(e) => setField(f.name, e.target.checked)} />
          ) : f.type === 'number' ? (
            <input type="number" className="input text-xs py-1 px-2 w-16" value={Number(draft[f.name] ?? 0)} onChange={(e) => setField(f.name, Number(e.target.value))} />
          ) : f.type === 'color' ? (
            <input type="color" className="w-8 h-7 p-0 border border-glass-border rounded cursor-pointer" value={String(draft[f.name] || '#000000')} onChange={(e) => setField(f.name, e.target.value)} />
          ) : (
            <input className="input text-xs py-1 px-2 w-full" value={String(draft[f.name] ?? '')} onChange={(e) => setField(f.name, e.target.value)} />
          )}
        </td>
      ))}
      {cfg.showCount && <td />}
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button onClick={onSave} disabled={saving || !draft.id} className="btn btn-primary btn-sm" title="Save">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onCancel} className="icon-btn" title="Cancel">
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
