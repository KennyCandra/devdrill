import { ArrowLeft, ArrowRight, CircleCheckBig, CircleX } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import type {
  ChallengeDetail,
  ChallengeSummary,
  IssueOutcome,
  IssueType,
  Language,
  ReviewComment,
  ReviewResult,
  ReviewSeverity,
  ReviewVerdict,
} from '@devdrill/shared';
import { api, ApiRequestError } from '../api/client';
import { TopBar } from '../components/TopBar';
import { Button, DifficultyBadge, Spinner, StatusScreen } from '../components/ui';
import { challengePath, navigate } from '../router';
import { lineLabel } from '../workspace/DiffView';
import { nextChallenge } from '../workspace/results';
import { formatDuration } from '../workspace/timer';
import { Stat } from './Results';

const SEVERITY_LABELS: Record<ReviewSeverity, string> = {
  must: 'Must fix',
  should: 'Should fix',
  nit: 'Nit',
};

const SEVERITY_STYLE: Record<ReviewSeverity, string> = {
  must: 'text-danger bg-danger-bg',
  should: 'text-warning bg-warning-bg',
  nit: 'text-muted bg-hover',
};

const VERDICT_LABELS: Record<ReviewVerdict, string> = {
  approve: 'Approve',
  request_changes: 'Request changes',
};

type Load =
  | { state: 'loading' }
  | { state: 'notFound' }
  | { state: 'error'; message: string }
  | {
      state: 'ready';
      challenge: ChallengeDetail;
      review: ReviewResult | null;
      issueTypes: IssueType[];
    };

/**
 * A submitted review next to the answer key. Only the verdict is checked; the player
 * ticks the issues they caught, which sets their score. Everything is saved on the
 * server, so this page can be reopened later.
 */
export function ReviewResults({ id, lang }: { id: string; lang: Language }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [all, setAll] = useState<ChallengeSummary[] | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.challenge(id, lang),
      api.reviewPullRequest(id, lang),
      // Not submitted yet (or the workspace isn't started) is not an error here.
      api.reviewResult(id, lang).catch((err: unknown) => {
        if (err instanceof ApiRequestError && err.status === 404) return null;
        throw err;
      }),
    ])
      .then(([challenge, pr, review]) => {
        if (!cancelled) setLoad({ state: 'ready', challenge, review, issueTypes: pr.issueTypes });
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

  const { challenge, review, issueTypes } = load;
  if (!review) {
    return (
      <StatusScreen
        title="No results yet"
        action={<Button onClick={() => navigate(challengePath(id))}>Back to the review</Button>}
      >
        Submit your review to compare it with the answer key here.
      </StatusScreen>
    );
  }

  const next = all ? nextChallenge(all, id) : null;
  const typeLabel = (type: string) => issueTypes.find((t) => t.id === type)?.label ?? type;
  const commentById = new Map(review.comments.map((c) => [c.id, c]));
  const { progress } = review;

  // Ticking saves at once; the page shows the tick straight away and the server's score
  // when it answers.
  const toggle = (issueId: string, caught: boolean) => {
    const ticked = review.issues
      .filter((o) => (o.issue.id === issueId ? caught : o.caught))
      .map((o) => o.issue.id);
    setSaveError(null);
    setLoad({
      ...load,
      review: {
        ...review,
        issues: review.issues.map((o) => (o.issue.id === issueId ? { ...o, caught } : o)),
      },
    });
    api
      .setCaught(id, ticked, lang)
      .then((updated) => setLoad((l) => (l.state === 'ready' ? { ...l, review: updated } : l)))
      .catch((err: Error) => setSaveError(`Not saved: ${err.message}`));
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar>
        <span className="text-muted">/</span>
        <span className="min-w-0 truncate">{challenge.title}</span>
        <DifficultyBadge difficulty={challenge.difficulty} />
      </TopBar>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 overflow-auto px-6 py-8">
        <header className="flex items-start gap-4">
          {review.passed ? (
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
              {review.passed ? 'Passed: the right call' : 'Not passed: the wrong call'}
            </h1>
            <p className="mt-1 text-muted">
              You chose <strong>{VERDICT_LABELS[review.verdict.given]}</strong>.{' '}
              {review.verdict.expected === 'request_changes'
                ? 'This pull request has something that must change before it can merge.'
                : 'Nothing here blocks merging: it deserved an approval.'}
            </p>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Your score">{review.score}%</Stat>
          {progress.bestScore !== undefined && (
            <Stat label="Best score">{progress.bestScore}%</Stat>
          )}
          <Stat label="Attempts">{progress.attempts}</Stat>
          {progress.bestTimeMs !== undefined && (
            <Stat label="Best time">{formatDuration(progress.bestTimeMs)}</Stat>
          )}
        </dl>

        <div className="flex flex-wrap gap-2">
          {review.passed && next ? (
            <Button variant="primary" onClick={() => navigate(challengePath(next.id))}>
              Next: {next.title} <ArrowRight size={14} aria-hidden="true" />
            </Button>
          ) : (
            <Button variant="primary" onClick={() => navigate(challengePath(id))}>
              <ArrowLeft size={14} aria-hidden="true" /> Back to the review
            </Button>
          )}
          {review.passed && next && (
            <Button onClick={() => navigate(challengePath(id))}>
              <ArrowLeft size={14} aria-hidden="true" /> Back to the review
            </Button>
          )}
        </div>

        <section aria-label="Answer key" className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">Compare with the answer key</h2>
            <p className="text-muted">
              {review.issues.length === 0
                ? 'Nothing to find: this pull request was good to merge.'
                : 'Read each issue next to your comments, and tick the ones you really caught. Your score is the share you tick; must-fix issues count most.'}
            </p>
            {saveError && (
              <p role="alert" className="mt-1 text-danger">
                {saveError}
              </p>
            )}
          </div>
          {review.issues.map((outcome) => (
            <IssueCard
              key={outcome.issue.id}
              outcome={outcome}
              typeLabel={typeLabel}
              nearby={outcome.nearby.flatMap((cid) => commentById.get(cid) ?? [])}
              onToggle={(caught) => toggle(outcome.issue.id, caught)}
            />
          ))}
        </section>

        {review.others.length > 0 && (
          <section aria-label="Your other comments" className="flex flex-col gap-2">
            <h2 className="font-semibold">Your other comments</h2>
            <p className="text-muted">
              These are near no issue in the key. They may still be good points: the key lists what
              the pull request must or should fix, not everything worth saying.
            </p>
            {review.others.flatMap((cid) => {
              const c = commentById.get(cid);
              return c ? [<CommentQuote key={cid} comment={c} />] : [];
            })}
          </section>
        )}
      </main>
    </div>
  );
}

function IssueCard({
  outcome,
  typeLabel,
  nearby,
  onToggle,
}: {
  outcome: IssueOutcome;
  typeLabel: (type: string) => string;
  nearby: ReviewComment[];
  onToggle: (caught: boolean) => void;
}) {
  const checkId = useId();
  const { issue, caught, weight } = outcome;
  return (
    <article
      className={`rounded border p-3 transition-colors ${caught ? 'border-success/60' : 'border-line'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-1.5 py-px text-[11px] font-medium ${SEVERITY_STYLE[issue.severity]}`}
        >
          {SEVERITY_LABELS[issue.severity]}
        </span>
        <span className="text-[12px] text-muted">{Math.round(weight)}% of the score</span>
      </div>
      <h3 className="mt-2 font-semibold">{issue.title}</h3>
      <p className="text-[12px] text-muted">
        {issue.file} · {lineLabel(issue.lines)} · {typeLabel(issue.type)}
      </p>
      <p className="mt-1 leading-relaxed">{issue.explanation}</p>

      <div className="mt-3 flex flex-col gap-1.5">
        <span className="text-[12px] text-muted">Your comments on these lines</span>
        {nearby.length > 0 ? (
          nearby.map((c) => <CommentQuote key={c.id} comment={c} />)
        ) : (
          <p className="text-muted italic">None.</p>
        )}
      </div>

      <label
        htmlFor={checkId}
        className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded border px-2.5 py-1.5 ${
          caught ? 'border-success/60 bg-success-bg text-success' : 'border-line-strong'
        }`}
      >
        <input
          id={checkId}
          type="checkbox"
          checked={caught}
          onChange={(e) => onToggle(e.target.checked)}
          className="size-4 accent-[var(--success)]"
        />
        I caught this
      </label>
    </article>
  );
}

function CommentQuote({ comment }: { comment: ReviewComment }): ReactNode {
  return (
    <blockquote className="rounded border-l-2 border-accent bg-side px-3 py-2">
      <p className="text-[12px] text-muted">
        {comment.file} · {lineLabel(comment.lines)}
      </p>
      <p className="leading-relaxed whitespace-pre-wrap">{comment.why}</p>
    </blockquote>
  );
}
