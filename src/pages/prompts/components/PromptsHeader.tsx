import { useTranslation } from 'react-i18next';

interface PromptsHeaderProps {
  totalPrompts: number;
}

export function PromptsHeader({ totalPrompts }: PromptsHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-text-primary">
          {t('prompts.title')}
        </h1>
        <span className="badge">{totalPrompts}</span>
      </div>
    </div>
  );
}
