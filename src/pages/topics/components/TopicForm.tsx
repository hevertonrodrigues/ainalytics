import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { FormMode } from '@/types/dashboard';

interface TopicFormProps {
  formMode: FormMode;
  onClose: () => void;
  error: string;
  formName: string;
  setFormName: (val: string) => void;
  formDesc: string;
  setFormDesc: (val: string) => void;
  saving: boolean;
  onSubmit: () => void;
}

export function TopicForm({
  formMode,
  onClose,
  error,
  formName,
  setFormName,
  formDesc,
  setFormDesc,
  saving,
  onSubmit,
}: TopicFormProps) {
  const { t } = useTranslation();

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="dashboard-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">
          {formMode === 'create' ? t('topics.newTopic') : t('topics.editTopic')}
        </h2>
        <button onClick={onClose} type="button" className="icon-btn">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xs bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          {t('topics.name')} *
        </label>
        <input
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder={t('topics.namePlaceholder')}
          className="input-field"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          {t('topics.description')}
        </label>
        <input
          type="text"
          value={formDesc}
          onChange={(e) => setFormDesc(e.target.value)}
          placeholder={t('topics.descriptionPlaceholder')}
          className="input-field"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || !formName.trim()}
          className="btn btn-primary btn-sm"
        >
          {saving ? t('common.loading') : formMode === 'create' ? t('common.create') : t('common.save')}
        </button>
        <button onClick={onClose} type="button" className="btn btn-ghost btn-sm">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
