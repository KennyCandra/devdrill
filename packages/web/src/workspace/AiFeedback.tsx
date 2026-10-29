import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FeedbackKind, Language, SolutionFeedback } from '@devdrill/shared';
import { api } from '../api/client';
import { Button, Spinner } from '../components/ui';
import { navigate } from '../router';

const KIND_LABELS: Record<FeedbackKind, string> = {
  good: 'Good',
  risk: 'Risk',
  readability: 'Readability',
  simpler: 'Simpler',
};

const KIND_STYLE: Record<FeedbackKind, string> = {
  good: 'text-success bg-success-bg',
  risk: 'text-danger bg-danger-bg',
  readability: 'text-warning bg-warning-bg',
  simpler: 'text-accent bg-hover',
};

/**
 * AI feedback on a solved challenge: how the passing code could be better. Shown only after
 * the solve (the server refuses before), and only when an AI provider is set up.
 */
export function AiFeedback({ id, lang }: { id: string; lang: Language }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<SolutionFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .aiStatus()
      .then((s) => !cancelled && setEnabled(s.enabled))
      .catch(() => !cancelled && setEnabled(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      setFeedback(await api.solutionFeedback(id, lang));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (enabled === null) return null;

  return (
    <section
      aria-label="AI feedback"
      className="flex flex-col gap-3 rounded border border-line bg-side p-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Sparkles size={16} className="shrink-0 text-accent" aria-hidden="true" />
        {enabled ? (
          <>
            <span className="mr-auto">
              Passing is step one. Ask the AI how your code could be better: risks the tests miss,
              readability, a simpler way.
            </span>
            <Button onClick={() => void ask()} disabled={busy}>
              {busy ? <Spinner /> : null}
              {busy
                ? 'Reading your code… (can take a minute)'
                : feedback
                  ? 'Ask again'
                  : 'Get AI feedback on your code'}
            </Button>
          </>
        ) : (
          <span className="mr-auto text-muted">
            Set up an AI provider in{' '}
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="underline underline-offset-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
            >
              Settings
            </button>{' '}
            to get feedback on your code.
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {/* Mounted before the answer arrives, so screen readers announce it. */}
      <div aria-live="polite">
        {feedback && (
          <div className="animate-fade-in flex flex-col gap-2">
            <p className="leading-relaxed">{feedback.summary}</p>
            {feedback.points.length === 0 && (
              <p className="text-muted">Nothing to add: the AI had no points.</p>
            )}
            <ul className="flex flex-col gap-2">
              {feedback.points.map((p, i) => (
                <li key={i} className="flex gap-2 rounded bg-bg p-2 leading-relaxed">
                  <span
                    className={`h-fit shrink-0 rounded px-1.5 py-px text-[11px] font-medium ${KIND_STYLE[p.kind]}`}
                  >
                    {KIND_LABELS[p.kind]}
                  </span>
                  <span>
                    {p.file && (
                      <span className="block font-mono text-[12px] text-muted">
                        {p.file}
                        {p.line ? `:${p.line}` : ''}
                      </span>
                    )}
                    {p.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
