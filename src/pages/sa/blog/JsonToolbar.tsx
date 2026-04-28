import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload, Loader2 } from 'lucide-react';
import { downloadJson, readJsonFile } from './jsonIO';
import { blogAdmin } from './useBlogAdmin';
import { normalizeBody } from './bodyConversion';
import { useDialog } from '@/contexts/DialogContext';

interface TemplateProps {
  template: unknown;
  filename: string;
}

/** Single button — emits the matching JSON template as a download. */
export function TemplateDownloadButton({ template, filename }: TemplateProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => downloadJson(filename, template)}
      className="btn btn-secondary btn-sm flex items-center gap-1.5"
      title={t('sa.blog.io.downloadHint')}
    >
      <Download className="w-4 h-4" />
      <span className="hidden sm:inline">{t('sa.blog.io.template')}</span>
    </button>
  );
}

interface NewsImportProps {
  /** Called with the result counts after the bulk import finishes. */
  onImported: (result: { ok: number; failed: Array<{ index: number; error: string }>; total: number }) => void;
}

/**
 * News page bulk-import button: file picker → parses JSON → POSTs each
 * `articles[]` entry through the existing admin endpoint.
 */
export function NewsImportButton({ onImported }: NewsImportProps) {
  const { t } = useTranslation();
  const { alert } = useDialog();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const data = await readJsonFile<{ articles?: unknown[] }>(file);
      const articles = data?.articles;
      if (!Array.isArray(articles)) {
        void alert({ message: t('sa.blog.io.expectedShape', { shape: '{ "articles": [...] }' }), variant: 'warning' });
        return;
      }
      let ok = 0;
      const failed: Array<{ index: number; error: string }> = [];
      for (let i = 0; i < articles.length; i++) {
        try {
          // Pre-normalize body in every translation so legacy block-array
          // shapes are converted to HTML before they leave the browser.
          await blogAdmin.create('articles', preNormalizeImport(articles[i]));
          ok++;
        } catch (err) {
          failed.push({ index: i, error: (err as Error).message });
        }
      }
      onImported({ ok, failed, total: articles.length });
    } catch (err) {
      void alert({ message: `${t('sa.blog.io.importFailed')}: ${(err as Error).message}`, variant: 'error' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <input
        type="file"
        accept=".json,application/json"
        hidden
        ref={fileRef}
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="btn btn-secondary btn-sm flex items-center gap-1.5"
        title={t('sa.blog.io.importHint')}
      >
        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        <span className="hidden sm:inline">{t('sa.blog.io.import')}</span>
      </button>
    </>
  );
}

/**
 * Walk an imported article payload and replace any legacy block-array
 * `body` (under `translations.<lang>.body`) with the HTML conversion. Other
 * fields pass through untouched.
 */
function preNormalizeImport(article: unknown): unknown {
  if (!article || typeof article !== 'object') return article;
  const a = article as { translations?: Record<string, unknown> };
  if (!a.translations || typeof a.translations !== 'object') return article;
  const next: Record<string, unknown> = {};
  for (const [lang, tr] of Object.entries(a.translations)) {
    if (tr && typeof tr === 'object') {
      next[lang] = { ...(tr as Record<string, unknown>), body: normalizeBody((tr as { body?: unknown }).body) };
    } else {
      next[lang] = tr;
    }
  }
  return { ...(a as Record<string, unknown>), translations: next };
}
