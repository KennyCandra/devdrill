import { useState, type ReactNode } from 'react';
import type { Settings } from '@bughunt/shared';
import { api } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/ui';
import { useSettings } from '../settings';
import { clearAllResults } from '../workspace/results';

const THEMES: { value: Settings['theme']; label: string }[] = [
  { value: 'system', label: 'Match system' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

export function SettingsPage() {
  const { settings, update } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const change = (patch: Partial<Settings>) => {
    setError(null);
    update(patch).catch((err: Error) => setError(`Couldn't save: ${err.message}`));
  };

  const resetProgress = async () => {
    setConfirmReset(false);
    try {
      await api.resetProgress();
      // Revealed hints are per-browser; clear them too so it's a real fresh start.
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('bughunt-hints-') || key.startsWith('bughunt-time-')) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        // Storage unavailable: nothing stored there.
      }
      clearAllResults();
      setResetDone(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 overflow-auto px-6 py-8">
        <h1 className="text-[20px] font-semibold tracking-tight">Settings</h1>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}

        <Section title="Appearance">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Theme</legend>
            {THEMES.map((t) => (
              <label
                key={t.value}
                className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5 transition-colors duration-100 has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                  settings.theme === t.value
                    ? 'border-accent bg-active'
                    : 'border-line hover:bg-hover'
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={t.value}
                  checked={settings.theme === t.value}
                  onChange={() => change({ theme: t.value })}
                  className="sr-only"
                />
                {t.label}
              </label>
            ))}
          </fieldset>
        </Section>

        <Section title="Practice">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={settings.timerEnabled}
              onChange={(e) => change({ timerEnabled: e.target.checked })}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            <span>
              Show a timer
              <span className="block text-muted">
                Counts the time you spend on a challenge, like a timed interview. Your best time is
                saved either way.
              </span>
            </span>
          </label>
        </Section>

        <Section title="Progress">
          <p className="mb-3 text-muted">
            Start over: every challenge goes back to "Not started", your code goes back to the
            starting files, and revealed hints are hidden again.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              Reset all progress
            </Button>
            {resetDone && (
              <span role="status" className="text-muted">
                Progress reset.
              </span>
            )}
          </div>
        </Section>
      </main>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all progress?"
        confirmLabel="Reset everything"
        onConfirm={() => void resetProgress()}
        onCancel={() => setConfirmReset(false)}
      >
        Every challenge and all your code go back to the start. This can't be undone.
      </ConfirmDialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <h2 className="mb-3 text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}
