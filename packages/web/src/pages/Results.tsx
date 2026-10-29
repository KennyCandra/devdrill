import {
  ArrowLeft,
  ArrowRight,
  CircleCheckBig,
  CircleDot,
  CircleX,
  Eye,
  FlaskConical,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { ChallengeDetail, ChallengeSummary, Language } from '@devdrill/shared';
import { api, ApiRequestError } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TestResultList } from '../components/TestPanel';
import { TopBar } from '../components/TopBar';
import { Button, DifficultyBadge, Spinner, StatusScreen } from '../components/ui';
import { challengePath, navigate } from '../router';
import { clearResult, loadResult, nextChallenge, type StoredResult } from '../workspace/results';
import { HiddenTestsView } from '../workspace/HiddenTestsView';
import { SolutionView } from '../workspace/SolutionView';
import { AiFeedback } from '../workspace/AiFeedback';
import { formatDuration } from '../workspace/timer';

type Load =
  | { state: 'loading' }
  | { state: 'notFound' }
  | { state: 'error'; message: string }
  | { state: 'ready'; challenge: ChallengeDetail; stored: StoredResult | null };

/** `lang` is fixed for this screen, like the workspace's. */
export function Results({ id, lang }: { id: string; lang: Language }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [all, setAll] = useState<ChallengeSummary[] | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [confirmSolution, setConfirmSolution] = useState(false);
  const [showHiddenTests, setShowHiddenTests] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .challenge(id, lang)
      .then((challenge) => {
        if (cancelled) return;
        // The server is the source of truth: a result from before "Reset all progress",
        // or older than the latest submit (another tab), is not shown.
        let stored = loadResult(id, lang);
        if (stored && stored.submit.progress.attempts !== challenge.progress.attempts) {
          clearResult(id, lang);
          stored = null;
        }
        setLoad({ state: 'ready', challenge, stored });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoad(
          err instanceof ApiRequestError && err.status === 404
            ? { state: 'notFound' }
            : { state: 'error', message: (err as Error).message },
        );
      });
    api
      .challenges()
      .then((list) => !cancelled && setAll(list))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id, lang]);

  if (load.state === 'loading') {
    return (
      <StatusScreen title="Loading results">
        <Spinner />
      </StatusScreen>
    );
  }
  if (load.state === 'notFound' || load.state === 'error') {
    return (
      <StatusScreen
        title={load.state === 'notFound' ? 'Challenge not found' : "Couldn't load results"}
        action={<Button onClick={() => navigate('/')}>All challenges</Button>}
      >
        {load.state === 'error' ? load.message : "That challenge doesn't exist."}
      </StatusScreen>
    );
  }

  const { challenge, stored } = load;
  const { progress } = challenge;

  if (!stored && progress.attempts === 0) {
    return (
      <StatusScreen
        title="No results yet"
        action={<Button onClick={() => navigate(challengePath(id))}>Back to the code</Button>}
      >
        Submit your solution from the challenge to see results here.
      </StatusScreen>
    );
  }

  const solved = stored ? stored.submit.solved : progress.status === 'solved';
  // The server only unlocks the hidden tests once the challenge is solved.
  const progressSolved = progress.status === 'solved' || Boolean(stored?.submit.solved);
  const next = all ? nextChallenge(all, id) : null;

  return (
    <div className="flex h-full flex-col">
      <TopBar>
        <span className="text-muted">/</span>
        <span className="min-w-0 truncate">{challenge.title}</span>
        <DifficultyBadge difficulty={challenge.difficulty} />
      </TopBar>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 overflow-auto px-6 py-8">
        <header className="flex items-start gap-4">
          {solved ? (
            <CircleCheckBig
              size={40}
              className="animate-pop-in shrink-0 text-success"
              aria-hidden="true"
            />
          ) : stored ? (
            <CircleX size={40} className="animate-pop-in shrink-0 text-danger" aria-hidden="true" />
          ) : (
            <CircleDot size={40} className="shrink-0 text-accent" aria-hidden="true" />
          )}
          <div role="status">
            <h1 className="text-[20px] font-semibold tracking-tight">
              {solved ? 'Solved' : stored ? 'Not quite yet' : 'In progress'}
            </h1>
            <p className="mt-1 text-muted">
              {stored
                ? summaryText(stored)
                : solved
                  ? 'You solved this one earlier.'
                  : "Your last submit didn't pass every test yet."}
            </p>
          </div>
        </header>

        <dl className="grid grid-cols-3 gap-3">
          {stored && (
            <Stat label="Tests passed">
              {stored.submit.run.total === 0
                ? '—'
                : `${stored.submit.run.passed} / ${stored.submit.run.total}`}
            </Stat>
          )}
          {stored && <Stat label="Active time">{formatDuration(stored.elapsedMs)}</Stat>}
          <Stat label="Attempts">{progress.attempts}</Stat>
          {progress.bestTimeMs !== undefined && (
            <Stat label="Best time">{formatDuration(progress.bestTimeMs)}</Stat>
          )}
        </dl>

        <div className="flex flex-wrap gap-2">
          {solved && next ? (
            <Button variant="primary" onClick={() => navigate(challengePath(next.id))}>
              Next: {next.title} <ArrowRight size={14} aria-hidden="true" />
            </Button>
          ) : solved ? (
            <Button variant="primary" onClick={() => navigate('/')}>
              All challenges
            </Button>
          ) : (
            <Button variant="primary" onClick={() => navigate(challengePath(id))}>
              <ArrowLeft size={14} aria-hidden="true" /> Back to the code
            </Button>
          )}
          {solved && (
            <Button onClick={() => navigate(challengePath(id))}>
              <ArrowLeft size={14} aria-hidden="true" /> Back to the code
            </Button>
          )}
          <Button
            onClick={() =>
              // Not solved yet: one extra step, so peeking is a choice and not a reflex.
              showSolution || solved ? setShowSolution((v) => !v) : setConfirmSolution(true)
            }
            aria-expanded={showSolution}
          >
            <Eye size={14} aria-hidden="true" />
            {showSolution
              ? 'Hide the solution'
              : solved
                ? 'Compare with the solution'
                : 'Show the solution'}
          </Button>
          {/* Hidden tests unlock with the solve, like their failure details. */}
          {progressSolved && (
            <Button onClick={() => setShowHiddenTests((v) => !v)} aria-expanded={showHiddenTests}>
              <FlaskConical size={14} aria-hidden="true" />
              {showHiddenTests ? 'Hide the hidden tests' : 'See the hidden tests'}
            </Button>
          )}
        </div>

        {progressSolved && <AiFeedback id={id} lang={lang} />}

        {showSolution && <SolutionView id={id} lang={lang} />}

        {showHiddenTests && <HiddenTestsView id={id} lang={lang} />}

        <ConfirmDialog
          open={confirmSolution}
          title="See the solution?"
          confirmLabel="Show it"
          tone="primary"
          onConfirm={() => {
            setConfirmSolution(false);
            setShowSolution(true);
          }}
          onCancel={() => setConfirmSolution(false)}
        >
          You haven't solved this one yet. Working it out yourself is the practice, so a hint or one
          more attempt may help first. You can't unsee it.
        </ConfirmDialog>

        {stored && (
          <section
            aria-label="Test results"
            className="rounded border border-line p-3 font-mono text-[12px]"
          >
            <TestResultList result={stored.submit.run} />
          </section>
        )}
      </main>
    </div>
  );
}

function summaryText({ submit }: StoredResult): string {
  const { run, solved } = submit;
  if (solved) return 'Every test passes, including the hidden ones.';
  if (run.status === 'timeout') return 'The tests timed out. Look for an infinite loop.';
  if (run.fileErrors.length > 0 || run.status === 'error') {
    return "Some tests couldn't run at all. Look for a syntax error in your code.";
  }
  const visibleFailed = run.tests.filter((t) => !t.hidden && t.status !== 'passed').length;
  if (visibleFailed > 0) {
    return `${visibleFailed} visible ${plural(visibleFailed, 'test')} still ${visibleFailed === 1 ? 'fails' : 'fail'}.`;
  }
  const hiddenFailed = run.tests.filter((t) => t.hidden && t.status !== 'passed').length;
  return `The visible tests pass, but ${hiddenFailed} hidden ${plural(hiddenFailed, 'test')} ${hiddenFailed === 1 ? 'fails' : 'fail'}. Hidden tests check edge cases the visible ones don't; re-read the task for clues.`;
}

export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded bg-side px-3 py-2">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-[18px] tabular-nums">{children}</dd>
    </div>
  );
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}
