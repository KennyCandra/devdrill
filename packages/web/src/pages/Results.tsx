import { ArrowLeft, ArrowRight, CircleCheckBig, CircleX, Eye } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { ChallengeDetail, ChallengeSummary } from '@bughunt/shared';
import { api } from '../api/client';
import { TestResultList } from '../components/TestPanel';
import { TopBar } from '../components/TopBar';
import { Button, DifficultyBadge, StatusScreen } from '../components/ui';
import { challengePath, navigate } from '../router';
import { loadResult, nextChallenge } from '../workspace/results';
import { SolutionView } from '../workspace/SolutionView';
import { formatDuration } from '../workspace/timer';

export function Results({ id }: { id: string }) {
  const [stored] = useState(() => loadResult(id));
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [all, setAll] = useState<ChallengeSummary[] | null>(null);
  const [showSolution, setShowSolution] = useState(false);

  useEffect(() => {
    api
      .challenge(id)
      .then(setChallenge)
      .catch(() => undefined);
    api
      .challenges()
      .then(setAll)
      .catch(() => undefined);
  }, [id]);

  if (!stored) {
    return (
      <StatusScreen
        title="No results yet"
        action={<Button onClick={() => navigate(challengePath(id))}>Back to the code</Button>}
      >
        Submit your solution from the challenge to see results here.
      </StatusScreen>
    );
  }

  const { submit, elapsedMs } = stored;
  const { run, solved, progress } = submit;
  const hidden = run.tests.filter((t) => t.hidden);
  const hiddenFailed = hidden.filter((t) => t.status !== 'passed').length;
  const visibleFailed = run.tests.filter((t) => !t.hidden && t.status !== 'passed').length;
  const next = all ? nextChallenge(all, id) : null;

  const summaryText = (): string => {
    if (solved) return 'Every test passes, including the hidden ones.';
    if (run.status === 'timeout') return 'The tests timed out. Look for an infinite loop.';
    if (run.fileErrors.length > 0 || run.status === 'error') {
      return "Some tests couldn't run at all. Look for a syntax error in your code.";
    }
    if (visibleFailed > 0) {
      return `${visibleFailed} visible ${plural(visibleFailed, 'test')} still ${visibleFailed === 1 ? 'fails' : 'fail'}.`;
    }
    return `The visible tests pass, but ${hiddenFailed} hidden ${plural(hiddenFailed, 'test')} ${hiddenFailed === 1 ? 'fails' : 'fail'}. Hidden tests check cases the visible ones don't.`;
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar>
        <span className="text-muted">/</span>
        <span className="min-w-0 truncate">{challenge?.title ?? id}</span>
        {challenge && <DifficultyBadge difficulty={challenge.difficulty} />}
      </TopBar>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 overflow-auto px-6 py-8">
        <header className="flex items-start gap-4">
          {solved ? (
            <CircleCheckBig
              size={40}
              className="animate-pop-in shrink-0 text-success"
              aria-hidden="true"
            />
          ) : (
            <CircleX size={40} className="animate-pop-in shrink-0 text-danger" aria-hidden="true" />
          )}
          <div role="status">
            <h1 className="text-[20px] font-semibold tracking-tight">
              {solved ? 'Solved' : 'Not quite yet'}
            </h1>
            <p className="mt-1 text-muted">{summaryText()}</p>
          </div>
        </header>

        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Tests passed">
            {run.passed} / {run.total}
          </Stat>
          <Stat label="Time">{formatDuration(elapsedMs)}</Stat>
          <Stat label="Attempts">{progress.attempts}</Stat>
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
          <Button onClick={() => setShowSolution((v) => !v)} aria-expanded={showSolution}>
            <Eye size={14} aria-hidden="true" />
            {showSolution
              ? 'Hide the solution'
              : solved
                ? 'Compare with the solution'
                : 'Show the solution'}
          </Button>
        </div>

        {showSolution && <SolutionView id={id} />}

        <section
          aria-label="Test results"
          className="rounded border border-line p-3 font-mono text-[12px]"
        >
          <TestResultList result={run} />
        </section>
      </main>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
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
