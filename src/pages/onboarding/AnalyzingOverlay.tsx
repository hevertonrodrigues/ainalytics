import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface AnalyzingOverlayProps {
  domain: string;
  visible: boolean;
}

const PHRASE_KEYS = [
  'onboarding.analyzing.checkingGrowth',
  'onboarding.analyzing.discoveringOpportunities',
  'onboarding.analyzing.mappingStrategies',
  'onboarding.analyzing.evaluatingPotential',
  'onboarding.analyzing.identifyingStrengths',
  'onboarding.analyzing.analyzingVisibility',
  'onboarding.analyzing.scanningPresence',
  'onboarding.analyzing.assessingReadiness',
];

const CYCLE_INTERVAL_MS = 3000;

export function AnalyzingOverlay({ domain, visible }: AnalyzingOverlayProps) {
  const { t } = useTranslation();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Favicon URL via Google's service
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`;

  // Cycle through phrases
  useEffect(() => {
    if (!visible) {
      setPhraseIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % PHRASE_KEYS.length);
        setIsTransitioning(false);
      }, 400); // fade out duration before switching
    }, CYCLE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const currentPhrase = t(PHRASE_KEYS[phraseIndex]!, { domain: cleanDomain });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-primary/95 backdrop-blur-md animate-in fade-in duration-300">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-primary/5 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-brand-accent/5 blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative flex flex-col items-center gap-8 px-6 max-w-lg text-center">
        {/* Favicon with pulsing ring */}
        <div className="relative">
          {/* Outer pulsing ring */}
          <div className="absolute inset-0 -m-3 rounded-full border-2 border-brand-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-0 -m-1.5 rounded-full border border-brand-primary/30 animate-pulse" />
          
          {/* Favicon container */}
          <div className="w-16 h-16 rounded-full bg-bg-secondary border-2 border-glass-border flex items-center justify-center shadow-lg shadow-brand-primary/10 overflow-hidden">
            <img
              src={faviconUrl}
              alt={cleanDomain}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                // Fallback to a globe icon if favicon fails to load
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = `
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-brand-primary"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                `;
              }}
            />
          </div>
        </div>

        {/* Rotating phrase */}
        <div className="min-h-[3rem] flex items-center justify-center">
          <h2
            className={`text-xl md:text-2xl font-bold text-text-primary transition-all duration-400 ${
              isTransitioning
                ? 'opacity-0 translate-y-2'
                : 'opacity-100 translate-y-0'
            }`}
          >
            {currentPhrase}
          </h2>
        </div>

        {/* Subtle progress dots */}
        <div className="flex items-center gap-1.5">
          {PHRASE_KEYS.map((_, idx) => (
            <div
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                idx === phraseIndex
                  ? 'bg-brand-primary w-6'
                  : idx < phraseIndex
                  ? 'bg-brand-primary/40'
                  : 'bg-glass-border'
              }`}
            />
          ))}
        </div>

        {/* Sub-text */}
        <p className="text-sm text-text-muted animate-pulse">
          {t('onboarding.analyzing.wait', 'This may take a few moments...')}
        </p>
      </div>
    </div>
  );
}
