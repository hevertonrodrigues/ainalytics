import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Reply, Send, X } from 'lucide-react';
import { isOutgoing } from '../utils';
import type { Email } from '../types';

interface ReplyComposerProps {
  latestEmail: Email;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  sending: boolean;
}

export function ReplyComposer({
  latestEmail,
  value,
  onChange,
  onSend,
  onCancel,
  sending,
}: ReplyComposerProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const recipient = isOutgoing(latestEmail)
    ? latestEmail.to_email
    : (latestEmail.from_name || latestEmail.from_email);

  const charCount = value.trim().length;

  return (
    <div className="rounded-xl border border-brand-primary/30 bg-glass-element overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="px-4 sm:px-5 py-2.5 border-b border-glass-border/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-text-secondary min-w-0">
          <Reply className="w-3.5 h-3.5 text-brand-primary shrink-0" />
          <span className="font-medium shrink-0">{t('sa.inbox.composing')}:</span>
          <span className="truncate text-text-muted">{recipient}</span>
        </div>
        <button
          onClick={onCancel}
          disabled={sending}
          className="icon-btn !p-1 shrink-0"
          title={t('sa.inbox.cancel')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={t('sa.inbox.replyPlaceholder')}
        className="w-full min-h-[160px] p-4 bg-transparent text-sm text-text-primary focus:outline-none resize-y border-0"
        disabled={sending}
      />
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 border-t border-glass-border/60 bg-bg-primary/40">
        <span className="text-xs text-text-muted hidden sm:inline">
          {charCount > 0 && `${charCount} chars`}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onCancel}
            disabled={sending}
            className="px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
          >
            {t('sa.inbox.cancel')}
          </button>
          <button
            onClick={onSend}
            disabled={sending || !value.trim()}
            className="btn-primary !px-4 !py-1.5 !text-xs"
          >
            {sending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t('sa.inbox.sending')}
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                {t('sa.inbox.sendReply')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
