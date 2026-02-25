import { HelpCircle } from 'lucide-react';

interface PageExplanationProps {
  message: string;
}

export function PageExplanation({ message }: PageExplanationProps) {
  return (
    <div className="flex items-start gap-3.5 p-4 rounded-xs border-l-2 border-brand-primary bg-bg-secondary/40 mb-6 stagger-in">
      <div className="mt-1 p-1.5 rounded-full bg-brand-primary/10 text-brand-primary shrink-0">
        <HelpCircle className="w-4 h-4" />
      </div>
      <div className="space-y-1">
        <p className="text-sm text-text-secondary leading-relaxed font-medium">
          {message}
        </p>
      </div>
    </div>
  );
}
