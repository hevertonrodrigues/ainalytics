import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PageExplanationProps {
  message: string;
}

export function PageExplanation({ message }: PageExplanationProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  if (!isExpanded) {
    return (
      <button 
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 p-3 w-full rounded-xs border border-glass-border bg-bg-secondary/40 mb-6 group hover:bg-glass-hover transition-colors stagger-in"
      >
        <HelpCircle className="w-4 h-4 text-brand-primary" />
        <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
          {t('common.aboutThisPage')}
        </span>
        <ChevronDown className="w-4 h-4 text-text-muted ml-auto" />
      </button>
    );
  }

  return (
    <div className="relative p-4 rounded-xs border-l-2 border-brand-primary bg-bg-secondary/40 mb-6 stagger-in">
      <div className="flex items-start gap-3.5 pr-8">
        <div className="mt-1 p-1.5 rounded-full bg-brand-primary/10 text-brand-primary shrink-0">
          <HelpCircle className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-text-secondary leading-relaxed font-medium">
            {message}
          </p>
        </div>
      </div>
      
      {/* Collapse button - always visible */}
      <button 
        onClick={() => setIsExpanded(false)}
        className="absolute top-2 right-2 p-1 rounded-md hover:bg-glass-hover text-text-muted transition-colors"
        title={t('common.close')}
      >
        <ChevronUp className="w-4 h-4" />
      </button>
    </div>
  );
}
