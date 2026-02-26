import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, Loader2, Sparkles, PlusCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useScrollLock } from '@/hooks/useScrollLock';

interface SuggestedPrompt {
  text: string;
  description: string;
}

interface SuggestedTopic {
  name: string;
  description: string;
  prompts: SuggestedPrompt[];
}

interface SuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: SuggestedTopic[];
}

export const SuggestionsModal: React.FC<SuggestionsModalProps> = ({
  isOpen,
  onClose,
  suggestions,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  useScrollLock();
  const [acceptedItems, setAcceptedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);

  if (!isOpen) return null;

  const handleAcceptItem = async (topicIndex: number, promptIndex?: number) => {
    const isTopic = promptIndex === undefined;
    const key = isTopic ? `t-${topicIndex}` : `p-${topicIndex}-${promptIndex}`;
    
    if (acceptedItems.has(key)) return;

    const topic = suggestions[topicIndex];
    if (!topic || !topic.prompts) return;

    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      // 1. Ensure topic exists or create it
      const topicRes = await apiClient.post<{ id: string }>('/topics-prompts', {
        name: topic.name,
        description: topic.description
      }).catch(async (err) => {
        if (err.status === 409) {
          const topics = await apiClient.get<any[]>('/topics-prompts');
          const found = topics.data.find(t => t.name === topic.name);
          if (found) return { data: found };
        }
        throw err;
      });

      const topicId = topicRes.data.id;

      if (isTopic) {
        // Create all prompts for this topic
        for (let i = 0; i < topic.prompts.length; i++) {
          const pKey = `p-${topicIndex}-${i}`;
          if (acceptedItems.has(pKey)) continue;

          const prompt = topic.prompts[i];
          if (!prompt) continue;

          await apiClient.post('/topics-prompts/prompts', {
            topic_id: topicId,
            text: prompt.text,
            description: prompt.description,
          }).catch(err => {
            if (err.status !== 409) throw err;
          });
          
          setAcceptedItems(prev => new Set(prev).add(pKey));
        }
        setAcceptedItems(prev => new Set(prev).add(key));
      } else {
        // Create single prompt
        const prompt = topic.prompts[promptIndex!];
        if (!prompt) return;

        await apiClient.post('/topics-prompts/prompts', {
          topic_id: topicId,
          text: prompt.text,
          description: prompt.description,
        }).catch(err => {
          if (err.status !== 409) throw err;
        });
        setAcceptedItems(prev => new Set(prev).add(key));
      }

      if (!isAcceptingAll) {
        showToast(t('common.success'), 'success');
      }
    } catch (err: any) {
      if (!isAcceptingAll) {
        showToast(err.message || t('common.error'), 'error');
      }
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleAcceptAll = async () => {
    setIsAcceptingAll(true);
    try {
      for (let i = 0; i < suggestions.length; i++) {
        await handleAcceptItem(i);
      }
      showToast(t('common.success'), 'success');
    } catch (err: any) {
      showToast(err.message || t('common.error'), 'error');
    } finally {
      setIsAcceptingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Modal Container */}
      <div className="relative bg-[#1e1e1e] border border-glass-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white leading-none">
                {t('llmText.suggestionsTitle')}
              </h2>
              <p className="text-sm text-text-secondary mt-1.5">
                {t('llmText.suggestionsSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <Sparkles className="w-12 h-12 mb-4 opacity-10" />
              <p className="text-sm">{t('common.noResults', 'No suggestions found.')}</p>
            </div>
          ) : (
            suggestions.map((topic, tIdx) => (
              <div key={tIdx} className="space-y-4">
                <div className="flex items-center justify-between group">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      {topic.name}
                      {acceptedItems.has(`t-${tIdx}`) && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          {t('llmText.accepted')}
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {topic.description}
                    </p>
                  </div>
                  {!acceptedItems.has(`t-${tIdx}`) && (
                    <button
                      onClick={() => handleAcceptItem(tIdx)}
                      disabled={loading[`t-${tIdx}`]}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors disabled:opacity-50 border border-brand-primary/20"
                    >
                      {loading[`t-${tIdx}`] ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <PlusCircle className="w-3.5 h-3.5" />
                      )}
                      {t('llmText.accept')}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4 border-l border-white/5 ml-2">
                  {topic.prompts?.map((prompt, pIdx) => {
                    const pKey = `p-${tIdx}-${pIdx}`;
                    const isAccepted = acceptedItems.has(pKey);
                    
                    return (
                      <div
                        key={pIdx}
                        className={`p-4 rounded-xl border transition-all ${
                          isAccepted
                            ? 'bg-success/5 border-success/20'
                            : 'bg-white/5 border-white/5 hover:border-brand-primary/30'
                        }`}
                      >
                        <div className="flex justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-white line-clamp-2">
                              {prompt.text}
                            </p>
                            <p className="text-xs text-text-secondary line-clamp-2">
                              {prompt.description}
                            </p>
                          </div>
                          <button
                            onClick={() => handleAcceptItem(tIdx, pIdx)}
                            disabled={isAccepted || loading[pKey]}
                            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                              isAccepted
                                ? 'text-success cursor-default'
                                : 'text-text-muted hover:text-brand-primary hover:bg-brand-primary/10'
                            }`}
                          >
                            {loading[pKey] ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isAccepted ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <PlusCircle className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 flex items-center justify-end gap-3 bg-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors"
          >
            {t('common.close')}
          </button>
          <button
            onClick={handleAcceptAll}
            disabled={isAcceptingAll || suggestions.length === 0 || suggestions.every((_, i) => acceptedItems.has(`t-${i}`))}
            className="btn btn-primary flex items-center gap-2"
          >
            {isAcceptingAll ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {t('llmText.acceptAll')}
          </button>
        </div>
      </div>
    </div>
  );
};
