import { ArrowLeft, CircleCheck, Monitor, Moon, Sun, Trash2, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Settings } from '@devdrill/shared';
import { api } from '../api/client';
import { AiSettingsSection } from '../components/AiSettingsSection';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TopBar } from '../components/TopBar';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { Button } from '../components/ui';
import { navigate } from '../router';
import { useSettings } from '../settings';
import { clearAllResults } from '../workspace/results';

const THEMES: { value: Settings['theme']; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Match system', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
];

/** The section list on the left. Each one scrolls its section into view. */
const SECTIONS: { id: string; label: string; danger?: boolean }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'language', label: 'Language' },
  { id: 'practice', label: 'Practice' },
  { id: 'ai', label: 'AI' },
  { id: 'progress', label: 'Progress', danger: true },
];

/** Scrolls a section into view inside the page; a jump, not a slide, when motion is reduced. */
function jumpTo(id: string) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document
    .getElementById(id)
    ?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
}

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
          if (key.startsWith('devdrill-hints-') || key.startsWith('devdrill-time-')) {
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
      <TopBar
        right={
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="i i-sm" aria-hidden="true" />
            Back to challenges
          </Button>
        }
      >
        <span className="crumb-sep">/</span>
        <span className="shrink-0 font-medium">Settings</span>
      </TopBar>

      <main className="mx-auto flex min-h-0 w-full max-w-[1000px] flex-1 flex-col gap-7 overflow-auto px-6 pt-12 pb-18">
        <h1 className="text-[26px] leading-8 font-semibold tracking-tight">Settings</h1>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
          <nav
            aria-label="Settings sections"
            className="flex shrink-0 flex-wrap gap-1 md:w-[180px] md:flex-col"
          >
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => jumpTo(s.id)}
                className={`flex h-8 shrink-0 items-center rounded-md px-3 text-[14px] font-medium hover:bg-surface-hover hover:text-fg ${
                  s.danger ? 'text-danger' : 'text-fg-2'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <Section id="appearance" title="Appearance">
              <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">Theme</legend>
                {THEMES.map((t) => {
                  const selected = settings.theme === t.value;
                  const Icon = t.icon;
                  return (
                    <label
                      key={t.value}
                      className={`flex h-[34px] cursor-pointer items-center gap-2 rounded-md border px-3.5 text-[14px] font-medium transition-colors duration-100 has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                        selected
                          ? 'border-accent bg-accent-soft text-accent shadow-[0_0_0_1px_var(--accent)]'
                          : 'border-border-strong text-fg-2 hover:bg-surface-hover hover:text-fg'
                      }`}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={t.value}
                        checked={selected}
                        onChange={() => change({ theme: t.value })}
                        className="sr-only"
                      />
                      <Icon className="i i-sm" aria-hidden="true" />
                      {t.label}
                    </label>
                  );
                })}
              </fieldset>
            </Section>

            <Section id="language" title="Language">
              <LanguageSwitch />
              <p className="muted text-[14px] leading-[21px]">
                Every challenge comes in both. Your code, progress and results are kept separately
                for each language, so you can practice the same challenge in both.
              </p>
            </Section>

            <Section id="practice" title="Practice">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={settings.timerEnabled}
                  onChange={(e) => change({ timerEnabled: e.target.checked })}
                  className="mt-1 size-4 accent-[var(--accent)]"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">Show a timer</span>
                  <span className="muted text-[14px] leading-[21px]">
                    Counts the time you spend on a challenge, like a timed interview. Your best
                    solve time is saved either way.
                  </span>
                </span>
              </label>
            </Section>

            <Section id="ai" title="AI">
              <AiSettingsSection />
            </Section>

            <Section id="progress" title="Progress" className="border-danger-line">
              <p className="muted text-[14px] leading-[21px]">
                Start over: every challenge goes back to "Not started", your code goes back to the
                starting files, and revealed hints are hidden again.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="danger" onClick={() => setConfirmReset(true)}>
                  <Trash2 className="i i-sm" aria-hidden="true" />
                  Reset all progress
                </Button>
                {resetDone && (
                  <span
                    role="status"
                    className="flex items-center gap-1.5 text-[13px] text-success"
                  >
                    <CircleCheck className="i i-sm" aria-hidden="true" />
                    Progress reset.
                  </span>
                )}
              </div>
            </Section>
          </div>
        </div>
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

function Section({
  id,
  title,
  className = '',
  children,
}: {
  id: string;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={`card flex scroll-mt-6 flex-col gap-4 px-[22px] py-5 ${className}`}
    >
      <h2 id={`${id}-heading`} className="text-[17px] leading-6 font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
