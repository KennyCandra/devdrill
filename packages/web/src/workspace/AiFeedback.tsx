import { FileCode, RotateCcw, Sparkles } from 'lucide-react';
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

const KIND_TAG: Record<FeedbackKind, string> = {
  good: 'tag-good',
  risk: 'tag-risk',
  readability: 'tag-readability',
  simpler: 'tag-simpler',
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
      className="card animate-fade-in flex flex-col overflow-hidden"
    >
      {enabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="tag tag-ai">
              <Sparkles className="i" aria-hidden="true" />
              AI
            </span>
            <span className="muted text-[13px]">
              Passing is step one. Ask the AI how your code could be better: risks the tests miss,
              readability, a simpler way.
            </span>
          </div>
          <Button size="sm" onClick={() => void ask()} disabled={busy}>
            {busy ? <Spinner /> : feedback && <RotateCcw className="i i-sm" aria-hidden="true" />}
            {busy
              ? 'Reading your code… (can take a minute)'
              : feedback
                ? 'Ask again'
                : 'Get AI feedback on your code'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-3">
          <span className="tag tag-nit">
            <Sparkles className="i" aria-hidden="true" />
            AI feedback · off
          </span>
          <span className="muted text-[13px]">
            Set up an AI provider in{' '}
            <button type="button" onClick={() => navigate('/settings')} className="link">
              Settings
            </button>{' '}
            to get feedback on your code.
          </span>
        </div>
      )}

      {error && (
        <p role="alert" className="px-4 pt-3 text-danger">
          {error}
        </p>
      )}
      {/* Mounted before the answer arrives, so screen readers announce it. */}
      <div aria-live="polite">
        {feedback && (
          <div className="animate-fade-in">
            <p className="px-4 pt-4 pb-2 text-[16px] leading-[25px] font-medium">
              {feedback.summary}
            </p>
            {feedback.points.length === 0 && (
              <p className="muted px-4 pb-4">Nothing to add: the AI had no points.</p>
            )}
            <ul className="flex flex-col px-4 pb-2">
              {feedback.points.map((p, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 border-t border-line py-3.5"
                >
                  <span>
                    <span className={`tag ${KIND_TAG[p.kind]}`}>{KIND_LABELS[p.kind]}</span>
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[15px] leading-[23px]">{p.text}</span>
                    {p.file && (
                      <span className="mono subtle inline-flex items-center gap-1.5 text-[12.5px]">
                        <FileCode className="i i-sm" aria-hidden="true" />
                        {p.file}
                        {p.line ? `:${p.line}` : ''}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {enabled && (
        <p className="subtle border-t border-line bg-surface-2 px-4 py-2.5 text-[12.5px]">
          The AI comments on your code; it never decides pass or fail.
        </p>
      )}
    </section>
  );
}
