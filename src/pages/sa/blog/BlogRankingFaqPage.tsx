import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Plus, Save, Trash2, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { blogAdmin } from './useBlogAdmin';
import { SAPageHeader } from '../SAPageHeader';
import { TemplateDownloadButton } from './JsonToolbar';
import { RANKING_FAQ_TEMPLATE } from './templates';
import { LANGS, type Lang, type RankingFaq } from './types';
import { useDialog } from '@/contexts/DialogContext';

export function BlogRankingFaqPage() {
  const { t } = useTranslation();
  const { alert } = useDialog();
  const [activeLang, setActiveLang] = useState<Lang>('pt');
  const [region, setRegion] = useState<string>('');     // '' = NULL = global
  const [sector, setSector] = useState<string>('');     // '' = NULL = global
  const [items, setItems] = useState<RankingFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    blogAdmin.list<RankingFaq>('ranking_faq', {
      lang: activeLang,
      region: region || 'null',
      sector: sector || 'null',
    })
      .then((res) => setItems(res.data.slice().sort((a, b) => a.position - b.position)))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [activeLang, region, sector]);

  const addRow = () => {
    setItems((p) => [
      ...p,
      {
        id: 0, lang: activeLang,
        region: region || null,
        sector: sector || null,
        position: p.length + 1,
        question: '',
        answer: '',
        created_at: '',
        updated_at: '',
      },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<RankingFaq>) => {
    setItems((p) => p.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const a = items[idx];
    const b = items[idx - 1];
    if (!a || !b) return;
    setItems((p) => p.map((r, i) => {
      if (i === idx) return { ...r, position: b.position };
      if (i === idx - 1) return { ...r, position: a.position };
      return r;
    }).slice().sort((x, y) => x.position - y.position));
  };

  const moveDown = (idx: number) => {
    if (idx >= items.length - 1) return;
    const a = items[idx];
    const b = items[idx + 1];
    if (!a || !b) return;
    setItems((p) => p.map((r, i) => {
      if (i === idx) return { ...r, position: b.position };
      if (i === idx + 1) return { ...r, position: a.position };
      return r;
    }).slice().sort((x, y) => x.position - y.position));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Two-pass: insert new (id=0), update existing
      for (const r of items) {
        if (!r.question.trim() || !r.answer.trim()) continue;
        if (r.id && r.id > 0) {
          await blogAdmin.update<RankingFaq>('ranking_faq', r.id, {
            lang: r.lang,
            region: r.region,
            sector: r.sector,
            position: r.position,
            question: r.question,
            answer: r.answer,
          });
        } else {
          await blogAdmin.create<RankingFaq>('ranking_faq', {
            lang: r.lang,
            region: r.region,
            sector: r.sector,
            position: r.position,
            question: r.question,
            answer: r.answer,
          });
        }
      }
      reload();
    } catch (err) {
      void alert({ message: `Save failed: ${(err as Error).message}`, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (idx: number) => {
    const r = items[idx];
    if (!r) return;
    if (r.id && r.id > 0) {
      await blogAdmin.remove('ranking_faq', r.id);
    }
    setItems((p) => p.filter((_, i) => i !== idx));
  };

  return (
    <div className="stagger-enter space-y-6">
      <SAPageHeader
        title={t('sa.blog.modules.rankingFaq.title')}
        subtitle={t('sa.blog.modules.rankingFaq.description')}
        icon={<HelpCircle className="w-6 h-6 text-brand-primary" />}
      >
        <TemplateDownloadButton template={RANKING_FAQ_TEMPLATE} filename="ranking-faq-template.json" />
        <button onClick={handleSave} disabled={saving || items.length === 0} className="btn btn-primary flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('sa.blog.save')}
        </button>
      </SAPageHeader>

      <div className="dashboard-card p-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {LANGS.map((l) => (
            <button
              key={l}
              onClick={() => setActiveLang(l)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase ${activeLang === l ? 'bg-brand-primary text-white' : 'text-text-secondary hover:bg-glass-hover'}`}
            >{l}</button>
          ))}
        </div>
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder={t('sa.blog.faq.regionPlaceholder')}
          className="input-field !py-2 !text-sm w-32"
        />
        <input
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          placeholder={t('sa.blog.faq.sectorPlaceholder')}
          className="input-field !py-2 !text-sm w-44 font-mono"
        />
        <span className="text-xs text-text-muted">{t('sa.blog.faq.scopeHint')}</span>
      </div>

      <div className="dashboard-card p-5 space-y-3">
        {loading ? (
          <div className="text-center text-text-muted p-6"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : items.length === 0 ? (
          <p className="text-xs text-text-muted italic">{t('sa.blog.faq.empty')}</p>
        ) : (
          items.map((row, idx) => (
            <div key={row.id || `new-${idx}`} className="border border-glass-border rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-muted w-12">#{row.position}</span>
                <input
                  value={row.question}
                  onChange={(e) => updateRow(idx, { question: e.target.value })}
                  placeholder={t('sa.blog.faq.questionPlaceholder')}
                  className="input-field !py-1.5 !text-sm flex-1"
                />
                <button onClick={() => moveUp(idx)} disabled={idx === 0} className="icon-btn"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveDown(idx)} disabled={idx === items.length - 1} className="icon-btn"><ArrowDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => removeRow(idx)} className="icon-btn text-error/70 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <textarea
                value={row.answer}
                onChange={(e) => updateRow(idx, { answer: e.target.value })}
                rows={3}
                placeholder={t('sa.blog.faq.answerPlaceholder')}
                className="input-field !py-2 !text-sm w-full resize-none"
              />
            </div>
          ))
        )}
        <button onClick={addRow} className="btn btn-secondary btn-sm">
          <Plus className="w-3.5 h-3.5" />{t('sa.blog.add')}
        </button>
      </div>
    </div>
  );
}
