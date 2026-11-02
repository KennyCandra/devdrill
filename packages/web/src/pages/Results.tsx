import {
  ArrowLeft,
  ArrowRight,
  CircleCheckBig,
  CircleDot,
  CircleX,
  Eye,
  FlaskConical,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { ChallengeDetail, ChallengeSummary, Language } from '@devdrill/shared';
import { api, ApiRequestError } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RunSummary, TestResultList } from '../components/TestPanel';
import { TopBar } from '../components/TopBar';
import { Button, ModeBadge, Spinner, StatusScreen } from '../components/ui';
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

type Tab = 'tests' | 'solution' | 'hidden' | 'ai';

/** Why the locked tabs are locked, for the tooltip and the screen reader. */
const LOCKED_HINT = 'Solve the challenge to unlock this';

/** `lang` is fixed for this screen, like the workspace's. */
export function Results({ id, lang }: { id: string; lang: Language }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [all, setAll] = useState<ChallengeSummary[] | null>(null);
  const [tab, setTab] = useState<Tab>('tests');
  // Once the person has confirmed the dialog, the solution tab opens without asking again.
  const [solutionConfirmed, setSolutionConfirmed] = useState(false);
  const [confirmSolution, setConfirmSolution] = useState(false);

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
  const run = stored?.submit.run;
  const hiddenCount = run ? run.tests.filter((t) => t.hidden).length : 0;
  const newBest = Boolean(stored?.submit.solved) && stored?.elapsedMs === progress.bestTimeMs;

  const Icon = solved ? CircleCheckBig : stored ? CircleX : CircleDot;
  const iconTone = solved
    ? 'bg-success-bg text-success'
    : stored
      ? 'bg-danger-bg text-danger'
      : 'bg-accent-soft text-accent';
  const heading = solved ? 'Solved' : stored ? 'Not quite yet' : 'In progress';
  const summary = stored
    ? summaryText(stored)
    : solved
      ? 'You solved this one earlier.'
      : "Your last submit didn't pass every test yet.";

  // Only what the person has earned or chosen is shown. Stats come from the last submit.
  const stats: { label: string; value: ReactNode; dash?: boolean; tag?: ReactNode }[] = [];
  if (stored && run) {
    stats.push({
      label: 'Tests passed',
      value:
        run.total === 0 ? (
          '–'
        ) : (
          <>
            {run.passed}
            <span className="subtle"> / {run.total}</span>
          </>
        ),
    });
    stats.push({ label: 'Active time', value: formatDuration(stored.elapsedMs) });
  }
  stats.push({ label: 'Attempts', value: progress.attempts });
  stats.push({
    label: 'Best time',
    value: progress.bestTimeMs === undefined ? '–' : formatDuration(progress.bestTimeMs),
    dash: progress.bestTimeMs === undefined,
    tag: newBest ? (
      <span className="tag tag-good h-[18px] px-1.5 text-[11px]">New best</span>
    ) : undefined,
  });

  // Opens the solution at once once solved; before that, the dialog asks first.
  const openSolution = () => {
    if (solved || solutionConfirmed) setTab('solution');
    else setConfirmSolution(true);
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar iconOnly>
        <button type="button" onClick={() => navigate('/')} className="crumb shrink-0">
          Challenges
        </button>
        <span className="crumb-sep">/</span>
        <button
          type="button"
          onClick={() => navigate(challengePath(id))}
          className="crumb min-w-0 truncate text-fg"
        >
          {challenge.title}
        </button>
        <span className="crumb-sep">/</span>
        <span className="muted shrink-0">Results</span>
      </TopBar>

      <main className="mx-auto flex min-h-0 w-full max-w-[960px] flex-1 flex-col gap-7 overflow-auto px-6 pt-12 pb-18">
        <section className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${iconTone}`}
            >
              <Icon className="i size-6 stroke-2" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[26px] leading-8 font-semibold tracking-tight">{heading}</h1>
                <ModeBadge mode={challenge.mode} />
              </div>
              <p role="status" className="muted text-[15px] leading-[22px]">
                {summary}
              </p>
            </div>
          </div>

          {/* One primary action. When solved, going back to the code is the secondary one. */}
          <div className="flex flex-wrap gap-2">
            {solved && (
              <Button size="lg" onClick={() => navigate(challengePath(id))}>
                <ArrowLeft className="i i-sm" aria-hidden="true" />
                Back to the code
              </Button>
            )}
            {solved && next && (
              <Button variant="primary" size="lg" onClick={() => navigate(challengePath(next.id))}>
                Next: {next.title}
                <ArrowRight className="i i-sm" aria-hidden="true" />
              </Button>
            )}
            {solved && !next && (
              <Button variant="primary" size="lg" onClick={() => navigate('/')}>
                All challenges
              </Button>
            )}
            {!solved && (
              <Button variant="primary" size="lg" onClick={() => navigate(challengePath(id))}>
                <ArrowLeft className="i i-sm" aria-hidden="true" />
                Back to the code
              </Button>
            )}
          </div>
        </section>

        <dl
          className={`card grid shrink-0 grid-cols-2 gap-px overflow-hidden bg-border ${
            stats.length === 4 ? 'sm:grid-cols-4' : ''
          }`}
        >
          {stats.map((s) => (
            <div key={s.label} className="stat bg-surface">
              <dt className="stat-label flex items-center gap-2">
                {s.label}
                {s.tag}
              </dt>
              <dd className={`stat-value ${s.dash ? 'subtle' : ''}`}>{s.value}</dd>
            </div>
          ))}
        </dl>

        <section className="flex flex-col">
          <div className="tabs overflow-x-auto">
            <button
              type="button"
              className={`tab ${tab === 'tests' ? 'on' : ''}`}
              aria-pressed={tab === 'tests'}
              onClick={() => setTab('tests')}
            >
              Tests
              {run && <span className="seg-count">{run.total}</span>}
            </button>
            <button
              type="button"
              className={`tab ${tab === 'solution' ? 'on' : ''}`}
              aria-pressed={tab === 'solution'}
              onClick={openSolution}
            >
              {solved || solutionConfirmed ? (
                <Eye className="i i-sm" aria-hidden="true" />
              ) : (
                <Lock className="i i-sm" aria-hidden="true" />
              )}
              {solved ? 'Compare with the solution' : 'Show the solution'}
            </button>
            <button
              type="button"
              className={`tab disabled:cursor-not-allowed disabled:opacity-50 ${tab === 'hidden' ? 'on' : ''}`}
              aria-pressed={tab === 'hidden'}
              disabled={!progressSolved}
              title={progressSolved ? undefined : LOCKED_HINT}
              onClick={() => setTab('hidden')}
            >
              {progressSolved ? (
                <FlaskConical className="i i-sm" aria-hidden="true" />
              ) : (
                <Lock className="i i-sm" aria-hidden="true" />
              )}
              Hidden tests
              {progressSolved && run && <span className="seg-count">{hiddenCount}</span>}
            </button>
            <button
              type="button"
              className={`tab disabled:cursor-not-allowed disabled:opacity-50 ${tab === 'ai' ? 'on' : ''}`}
              aria-pressed={tab === 'ai'}
              disabled={!progressSolved}
              title={progressSolved ? undefined : LOCKED_HINT}
              onClick={() => setTab('ai')}
            >
              {progressSolved ? (
                <Sparkles className="i i-sm" aria-hidden="true" />
              ) : (
                <Lock className="i i-sm" aria-hidden="true" />
              )}
              AI feedback
            </button>
          </div>
          {!progressSolved && (
            <p className="subtle mt-3 text-[13px]">
              Hidden tests and AI feedback open once you solve it. The solution asks first.
            </p>
          )}

          {tab === 'tests' && (
            <section
              aria-label="Test results"
              className="card animate-fade-in mt-4 overflow-hidden"
            >
              {run ? (
                <>
                  <div className="flex flex-wrap items-center gap-3.5 border-b border-line px-4 py-2.5 text-[13px]">
                    <RunSummary result={run} />
                  </div>
                  <div className="py-1.5 font-mono text-[13px]">
                    <TestResultList result={run} />
                  </div>
                </>
              ) : (
                <p className="muted px-4 py-6 text-center text-[14px]">
                  Submit again to see your test results here.
                </p>
              )}
            </section>
          )}

          {/* Mounted only while selected: Monaco can't lay out inside a hidden element. */}
          {tab === 'solution' && (
            <div className="mt-4">
              <SolutionView id={id} lang={lang} />
            </div>
          )}
          {tab === 'hidden' && progressSolved && (
            <div className="mt-4">
              <HiddenTestsView id={id} lang={lang} />
            </div>
          )}
          {/* Kept mounted once solved, so an answer survives switching tabs. */}
          {progressSolved && (
            <div className="mt-4" hidden={tab !== 'ai'}>
              <AiFeedback id={id} lang={lang} />
            </div>
          )}
        </section>

        <ConfirmDialog
          open={confirmSolution}
          title="See the solution?"
          confirmLabel="Show it"
          tone="primary"
          onConfirm={() => {
            setConfirmSolution(false);
            setSolutionConfirmed(true);
            setTab('solution');
          }}
          onCancel={() => setConfirmSolution(false)}
        >
          You haven't solved this one yet. Working it out yourself is the practice, so a hint or one
          more attempt may help first. You can't unsee it.
        </ConfirmDialog>
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
