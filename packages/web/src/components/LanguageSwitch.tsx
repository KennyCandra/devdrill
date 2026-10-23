import { useState } from 'react';
import type { Language } from '@devdrill/shared';
import { useSettings } from '../settings';
import { Dropdown } from './Dropdown';

export const LANGUAGE_LABELS: Record<Language, string> = {
  js: 'JavaScript',
  ts: 'TypeScript',
};

const ALL_LANGUAGES = Object.keys(LANGUAGE_LABELS) as Language[];

/**
 * Picks the language challenges open in. A dropdown, since more languages will come.
 * Code, progress and results are kept separately for each language.
 */
export function LanguageSwitch({
  available = ALL_LANGUAGES,
  beforeChange,
}: {
  /** Inside a challenge: only the languages it comes in. */
  available?: Language[];
  /** Runs (and is waited for) before switching, e.g. saving open files. */
  beforeChange?: () => Promise<void>;
}) {
  const { settings, update } = useSettings();
  const [error, setError] = useState<string | null>(null);

  const choose = (language: Language) => {
    if (language === settings.language) return;
    setError(null);
    Promise.resolve(beforeChange?.())
      .then(() => update({ language }))
      .catch((err: Error) => setError(err.message));
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Dropdown
        label="Language"
        value={settings.language}
        options={available.map((value) => ({ value, label: LANGUAGE_LABELS[value] }))}
        onChange={choose}
      />
      {error && (
        <span role="alert" className="text-[12px] text-danger">
          Couldn't switch: {error}
        </span>
      )}
    </div>
  );
}
