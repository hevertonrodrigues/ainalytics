import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, HelpCircle } from 'lucide-react';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';

interface TutorialModalProps {
  title: string;
  paragraphs: string[];
  onClose: () => void;
}

export function TutorialModal({ title, paragraphs, onClose }: TutorialModalProps) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    setClosing(true);
    // Give time for any exit animation if added later
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-bg-primary/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="glass-card w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 relative border border-glass-border font-sans">
        
        {/* Top Controls (Selector + Close) */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          <LocaleSwitcher className="!bg-glass-card/50 backdrop-blur-sm p-1 rounded-lg border border-glass-border scale-90 origin-left" />
          <button 
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-glass-hover text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-glass-border text-center relative overflow-hidden bg-gradient-to-br from-brand-primary/5 to-transparent">
          <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8 text-brand-primary" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary px-6">
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-4">
          {paragraphs.map((text, idx) => (
            <p key={idx} className="text-text-secondary text-sm sm:text-base leading-relaxed">
              {text}
            </p>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 sm:p-8 border-t border-glass-border flex justify-end">
          <button
            onClick={handleClose}
            disabled={closing}
            className="btn btn-primary px-8 py-2.5 text-sm shadow-lg shadow-brand-primary/25 group relative overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              {t('common.gotIt')}
              <Check className="w-4 h-4 transition-transform group-hover:scale-110" />
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
