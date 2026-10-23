import { ArrowLeft, ArrowRight, CircleCheckBig, CircleDot, CircleX, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  ChallengeDetail,
  ChallengeSummary,
  IssueOutcome,
  IssueType,
  Language,
  ReviewComment,
  ReviewIssue,
  ReviewResult,
  ReviewSeverity,
} from '@devdrill/shared';
import { CATEGORY_LABELS } from '@devdrill/shared/review';
import { api, ApiRequestError } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TopBar } from '../components/TopBar';
import { Button, DifficultyBadge, Spinner, StatusScreen } from '../components/ui';
import { challengePath, navigate } from '../router';
import { lineLabel } from '../workspace/DiffView';
import {
  clearResult,
  loadReviewResult,
  nextChallenge,
  type StoredReviewResult,
} from '../workspace/results';
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

type Load =
  | { state: 'loading' }
  | { state: 'notFound' }
  | { state: 'error'; message: string }
  | {
      state: 'ready';
      challenge: ChallengeDetail;
      stored: StoredReviewResult | null;
      issueTypes: IssueType[];
    };

/** The results of a review: what was found, missed and flagged wrongly. */
export function ReviewResults({ id, lang }: { id: string; lang: Language }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [all, setAll] = useState<ChallengeSummary[] | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [confirmKey, setConfirmKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.challenge(id, lang), api.reviewPullRequest(id, lang)])
      .then(([challenge, pr]) => {
        if (cancelled) return;
        // A result older than the latest submit (another tab), or from before "Reset all
        // progress", is not shown.
        let stored = loadReviewResult(id, lang);
        if (stored && stored.review.progress.attempts !== challenge.progress.attempts) {
          clearResult(id, lang);
          stored = null;
        }
        setLoad({ state: 'ready', challenge, stored, issueTypes: pr.issueTypes });
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

  const { challenge, stored, issueTypes } = load;
  const { progress } = challenge;
  if (!stored && progress.attempts === 0) {
    return (
      <StatusScreen
        title="No results yet"
        action={<Button onClick={() => navigate(challengePath(id))}>Back to the review</Button>}
      >
        Submit your review to see results here.
      </StatusScreen>
    );
  }

  const review = stored?.review ?? null;
  const solved = review ? review.solved : progress.status === 'solved';
  const everSolved = progress.status === 'solved' || solved;
  const next = all ? nextChallenge(all, id) : null;
  const typeOf = (typeId: string) => issueTypes.find((t) => t.id === typeId);

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
          ) : review ? (
            <CircleX size={40} className="animate-pop-in shrink-0 text-danger" aria-hidden="true" />
          ) : (
            <CircleDot size={40} className="shrink-0 text-accent" aria-hidden="true" />
          )}
          <div role="status">
            <h1 className="text-[20px] font-semibold tracking-tight">
              {solved ? 'Good review' : review ? 'Not quite yet' : 'In progress'}
            </h1>
            <p className="mt-1 text-muted">
              {review
                ? summaryText(review)
                : solved
                  ? 'You solved this one earlier.'
                  : "Your last review didn't pass yet."}
            </p>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {review &&
            (['must', 'should', 'nit'] as const).map((severity) => {
              const of = review.issues.filter((i) => i.severity === severity);
              return of.length > 0 ? (
                <Stat key={severity} label={`${SEVERITY_LABELS[severity]} found`}>
                  {of.filter((i) => i.found).length} / {of.length}
                </Stat>
              ) : null;
            })}
          {review && <Stat label="False alarms">{review.falseAlarms.length}</Stat>}
          {review && <Stat label="Active time">{formatDuration(stored?.elapsedMs ?? 0)}</Stat>}
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
              <ArrowLeft size={14} aria-hidden="true" /> Back to the review
            </Button>
          )}
          {solved && (
            <Button onClick={() => navigate(challengePath(id))}>
              <ArrowLeft size={14} aria-hidden="true" /> Back to the review
            </Button>
          )}
          <Button
            onClick={() => (showKey || everSolved ? setShowKey((v) => !v) : setConfirmKey(true))}
            aria-expanded={showKey}
          >
            <Eye size={14} aria-hidden="true" />
            {showKey ? 'Hide the answer key' : 'Show the answer key'}
          </Button>
        </div>

        <ConfirmDialog
          open={confirmKey}
          title="See the answer key?"
          confirmLabel="Show it"
          tone="primary"
          onConfirm={() => {
            setConfirmKey(false);
            setShowKey(true);
          }}
          onCancel={() => setConfirmKey(false)}
        >
          You haven't solved this review yet. Finding the issues yourself is the practice, so a hint
          or one more look may help first. You can't unsee it.
        </ConfirmDialog>

        {showKey && <AnswerKey id={id} lang={lang} typeOf={typeOf} />}

        {review && (
          <>
            <section aria-label="Verdict" className="rounded border border-line p-3">
              <h2 className="font-semibold">
                Verdict: {review.verdict.given === 'approve' ? 'Approve' : 'Request changes'}{' '}
                <span className={review.verdict.correct ? 'text-success' : 'text-danger'}>
                  {review.verdict.correct ? '· right call' : '· not the right call'}
                </span>
              </h2>
              {!review.verdict.correct && (
                <p className="mt-1 text-muted">
                  {review.verdict.given === 'approve'
                    ? 'Something in this pull request must change before it can merge.'
                    : 'Nothing here blocks merging: a pull request without must-fix issues deserves an approval.'}
                </p>
              )}
            </section>

            <section aria-label="Issues" className="flex flex-col gap-2">
              <h2 className="font-semibold">Issues</h2>
              {review.issues.length === 0 && (
                <p className="text-muted">This pull request had no issues to find.</p>
              )}
              {review.issues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  comment={review.comments.find((c) => c.id === issue.commentId)}
                  typeOf={typeOf}
                />
              ))}
            </section>

            {review.falseAlarms.length > 0 && (
              <section aria-label="False alarms" className="flex flex-col gap-2">
                <h2 className="font-semibold">Not in the answer key</h2>
                <p className="text-muted">
                  These comments point at no planted issue: a wrong place, or a wrong kind of issue.
                  One is forgiven; more fail the review.
                </p>
                {review.comments
                  .filter((c) => review.falseAlarms.includes(c.id))
                  .map((c) => (
                    <CommentQuote key={c.id} comment={c} typeOf={typeOf} />
                  ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function summaryText(review: ReviewResult): string {
  const must = review.issues.filter((i) => i.severity === 'must');
  const mustMissed = must.filter((i) => !i.found).length;
  if (review.solved) {
    return must.length === 0
      ? 'A clean pull request, and you let it through.'
      : 'You caught every must-fix issue and made the right call.';
  }
  const problems: string[] = [];
  if (mustMissed > 0) {
    problems.push(`${mustMissed} must-fix ${mustMissed === 1 ? 'issue' : 'issues'} missed`);
  }
  if (!review.verdict.correct) problems.push('the verdict is off');
  if (review.falseAlarms.length > 1) problems.push(`${review.falseAlarms.length} false alarms`);
  const text = problems.join(', ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function IssueCard({
  issue,
  comment,
  typeOf,
}: {
  issue: IssueOutcome;
  comment: ReviewComment | undefined;
  typeOf: (id: string) => IssueType | undefined;
}) {
  const { details } = issue;
  return (
    <article className={`rounded border p-3 ${issue.found ? 'border-success/50' : 'border-line'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-1.5 py-px text-[11px] font-medium ${SEVERITY_STYLE[issue.severity]}`}
        >
          {SEVERITY_LABELS[issue.severity]}
        </span>
        <span className="text-muted">{CATEGORY_LABELS[issue.category]}</span>
        <span className={`ml-auto ${issue.found ? 'text-success' : 'text-danger'}`}>
          {issue.found ? 'Found' : 'Missed'}
        </span>
      </div>
      {details ? (
        <>
          <h3 className="mt-2 font-semibold">{details.title}</h3>
          <p className="text-[12px] text-muted">
            {details.file} · {lineLabel(details.lines)} · {typeOf(details.type)?.label}
          </p>
          <p className="mt-1 leading-relaxed">{details.explanation}</p>
        </>
      ) : (
        <p className="mt-2 text-muted">
          A missed {CATEGORY_LABELS[issue.category].toLowerCase()} issue. Solve the review to see
          where and what it is.
        </p>
      )}
      {comment && (
        <div className="mt-2">
          <span className="text-[12px] text-muted">Your comment</span>
          <CommentQuote comment={comment} typeOf={typeOf} />
        </div>
      )}
    </article>
  );
}

function CommentQuote({
  comment,
  typeOf,
}: {
  comment: ReviewComment;
  typeOf: (id: string) => IssueType | undefined;
}) {
  return (
    <blockquote className="rounded border-l-2 border-accent bg-side px-3 py-2">
      <p className="text-[12px] text-muted">
        {comment.file} · {lineLabel(comment.lines)} · {typeOf(comment.type)?.label ?? comment.type}
      </p>
      <p className="leading-relaxed">{comment.why}</p>
    </blockquote>
  );
}

function AnswerKey({
  id,
  lang,
  typeOf,
}: {
  id: string;
  lang: Language;
  typeOf: (id: string) => IssueType | undefined;
}) {
  const [issues, setIssues] = useState<ReviewIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .answerKey(id, lang)
      .then((key) => !cancelled && setIssues(key))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id, lang]);

  if (error) return <p className="text-danger">Couldn't load the answer key: {error}</p>;
  if (!issues) return <Spinner className="text-muted" />;
  return (
    <section aria-label="Answer key" className="animate-fade-in flex flex-col gap-2">
      <h2 className="font-semibold">Answer key</h2>
      {issues.length === 0 && (
        <p className="text-muted">Nothing to find: this pull request was good to merge.</p>
      )}
      {issues.map((issue) => (
        <article key={issue.id} className="rounded border border-line p-3">
          <span
            className={`rounded px-1.5 py-px text-[11px] font-medium ${SEVERITY_STYLE[issue.severity]}`}
          >
            {SEVERITY_LABELS[issue.severity]}
          </span>
          <h3 className="mt-2 font-semibold">{issue.title}</h3>
          <p className="text-[12px] text-muted">
            {issue.file} · {lineLabel(issue.lines)} · {typeOf(issue.type)?.label}
          </p>
          <p className="mt-1 leading-relaxed">{issue.explanation}</p>
        </article>
      ))}
    </section>
  );
}
