import { useState } from 'react';
import type { Language } from '@devdrill/shared';
import { useSettings } from '../settings';

export const LANGUAGE_LABELS: Record<Language, string> = {
  js: 'JavaScript',
  ts: 'TypeScript',
};

/** JavaScript / TypeScript. Progress, code and results are kept separately for each. */
export function LanguageSwitch() {
  const { settings, update } = useSettings();
  const [error, setError] = useState<string | null>(null);

  const choose = (language: Language) => {
    if (language === settings.language) return;
    setError(null);
    update({ language }).catch((err: Error) => setError(err.message));
  };

  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label="Language" className="flex rounded border border-line">
        {(Object.keys(LANGUAGE_LABELS) as Language[]).map((language) => (
          <button
            key={language}
            type="button"
            aria-pressed={settings.language === language}
            onClick={() => choose(language)}
            className={`px-3 py-1 font-mono text-[12px] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-accent ${
              settings.language === language ? 'bg-active text-fg' : 'text-muted hover:bg-hover'
            }`}
          >
            {LANGUAGE_LABELS[language]}
          </button>
        ))}
      </div>
      {error && (
        <span role="alert" className="text-[12px] text-danger">
          Couldn't switch: {error}
        </span>
      )}
    </div>
  );
}
