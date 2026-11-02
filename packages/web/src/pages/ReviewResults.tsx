import { ArrowLeft, ArrowRight, Circle, CircleCheckBig, CircleX, Sparkles } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type {
  AiIssueVerdict,
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
import { Button, ModeBadge, Spinner, StatusScreen } from '../components/ui';
import { challengePath, navigate } from '../router';
import { lineLabel } from '../workspace/DiffView';
import { nextChallenge } from '../workspace/results';
import { formatDuration } from '../workspace/timer';

const SEVERITY_LABELS: Record<ReviewSeverity, string> = {
  must: 'Must fix',
  should: 'Should fix',
  nit: 'Nit',
};

const SEVERITY_TAG: Record<ReviewSeverity, string> = {
  must: 'tag-must',
  should: 'tag-should',
  nit: 'tag-nit',
};

const AI_VERDICT_LABELS: Record<AiIssueVerdict, string> = {
  caught: 'caught',
  partly: 'partly',
  missed: 'missed',
};

const AI_VERDICT_TAG: Record<AiIssueVerdict, string> = {
  caught: 'tag-caught',
  partly: 'tag-partly',
  missed: 'tag-missed',
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
  // Ticks are saved one request at a time, latest state wins: the server refuses a second
  // save while one is running, and an older answer must not undo a newer tick.
  const unsavedTicks = useRef<string[] | null>(null);
  const saving = useRef(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [judging, setJudging] = useState(false);
  const [judgeError, setJudgeError] = useState<string | null>(null);

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
    api
      .aiStatus()
      .then((s) => !cancelled && setAiEnabled(s.enabled))
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
  const caughtCount = review.issues.filter((o) => o.caught).length;
  // The primary action is Next when the player passed and there is one; otherwise going
  // back is, and the header has no second copy of it.
  const nextIsPrimary = review.passed && next !== null;

  // Ticking saves at once; the page shows the tick straight away and the server's score
  // when it answers.
  const showReview = (next: ReviewResult) =>
    setLoad((l) => (l.state === 'ready' ? { ...l, review: next } : l));

  const saveTicks = async () => {
    if (saving.current) return;
    saving.current = true;
    try {
      while (unsavedTicks.current) {
        const ticks = unsavedTicks.current;
        unsavedTicks.current = null;
        const updated = await api.setCaught(id, ticks, lang);
        // Show the server's answer only when nothing newer is waiting to be saved.
        if (!unsavedTicks.current) showReview(updated);
      }
    } catch (err) {
      unsavedTicks.current = null;
      setSaveError(`Not saved: ${(err as Error).message}`);
      // Show what the server really has.
      api
        .reviewResult(id, lang)
        .then(showReview)
        .catch(() => undefined);
    } finally {
      saving.current = false;
    }
  };

  // The AI judges every issue and pre-ticks the caught ones; a slow local model can take a minute.
  const askAi = async () => {
    setJudging(true);
    setJudgeError(null);
    try {
      showReview(await api.judgeReview(id, lang));
    } catch (err) {
      setJudgeError((err as Error).message);
    } finally {
      setJudging(false);
    }
  };

  // The tick shows at once (with its score); saving follows.
  const toggle = (issueId: string, caught: boolean) => {
    const issues = review.issues.map((o) => (o.issue.id === issueId ? { ...o, caught } : o));
    setSaveError(null);
    showReview({ ...review, issues, score: scoreOf(issues, review) });
    unsavedTicks.current = issues.filter((o) => o.caught).map((o) => o.issue.id);
    void saveTicks();
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

      <main className="mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col gap-7 overflow-auto px-6 pt-12 pb-18">
        <section className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${
                review.passed ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
              }`}
            >
              {review.passed ? (
                <CircleCheckBig className="i size-6 stroke-2 animate-pop-in" aria-hidden="true" />
              ) : (
                <CircleX className="i size-6 stroke-2 animate-pop-in" aria-hidden="true" />
              )}
            </span>
            <div role="status" className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[26px] leading-8 font-semibold tracking-tight">
                  {review.passed ? 'Passed: the right call' : 'Not passed: the wrong call'}
                </h1>
                <ModeBadge mode={challenge.mode} />
              </div>
              <p className="muted text-[15px] leading-[22px]">
                You chose{' '}
                <strong className="font-semibold text-fg">
                  {VERDICT_LABELS[review.verdict.given]}
                </strong>
                .{' '}
                {review.verdict.expected === 'request_changes'
                  ? 'This pull request has something that must change before it can merge.'
                  : 'Nothing here blocks merging: it deserved an approval.'}
              </p>
            </div>
          </div>
          {nextIsPrimary && (
            <Button onClick={() => navigate(challengePath(id))}>
              <ArrowLeft className="i i-sm" aria-hidden="true" /> Back to the review
            </Button>
          )}
        </section>

        <div className="grid items-start gap-7 min-[900px]:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-7">
            <section aria-label="Answer key" className="flex min-w-0 flex-col gap-4">
              <div>
                <h2 className="text-[20px] leading-7 font-semibold">What the key says</h2>
                <p className="muted mt-1 text-[14px] leading-[21px]">
                  {review.issues.length === 0
                    ? 'Nothing to find: this pull request was good to merge.'
                    : 'Read each issue next to your comments and tick the ones you really caught. Must-fix issues count most. Comments never lower your score.'}
                </p>
                {saveError && (
                  <p role="alert" className="mt-1 text-danger">
                    {saveError}
                  </p>
                )}
              </div>

              {review.issues.length > 0 && (
                <div
                  className={`flex flex-wrap items-center gap-3 rounded-lg px-3.5 py-3 ${
                    aiEnabled ? 'bg-accent-soft' : 'border border-dashed border-line-strong'
                  }`}
                >
                  <Sparkles
                    className={`i shrink-0 ${aiEnabled ? 'text-accent' : 'text-fg-3'}`}
                    aria-hidden="true"
                  />
                  {aiEnabled ? (
                    <>
                      <span className="min-w-0 flex-1 basis-[320px] text-[14px] leading-[21px]">
                        {review.ai
                          ? 'The AI judged your comments and ticked what it says you caught ("partly" adds no tick). Your own ticks stay, and you can change every one.'
                          : 'Let the AI read your comments and judge each issue: caught, partly or missed.'}
                      </span>
                      <Button onClick={() => void askAi()} disabled={judging}>
                        {judging ? <Spinner /> : null}
                        {judging
                          ? 'Judging… (can take a minute)'
                          : review.ai
                            ? 'Judge again'
                            : 'Ask AI to judge'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="muted min-w-0 flex-1 basis-[320px] text-[14px] leading-[21px]">
                        AI is off. Connect a provider and it can check your comments against the key
                        for you.
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() => navigate('/settings')}
                        className="text-accent"
                      >
                        Open Settings <ArrowRight className="i i-sm" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                  {judgeError && (
                    <p role="alert" className="w-full text-danger">
                      {judgeError}
                    </p>
                  )}
                </div>
              )}

              {review.issues.map((outcome) => (
                <IssueCard
                  key={outcome.issue.id}
                  outcome={outcome}
                  typeLabel={typeLabel}
                  nearby={outcome.nearby.flatMap((cid) => commentById.get(cid) ?? [])}
                  ai={review.ai?.issues.find((j) => j.issueId === outcome.issue.id)}
                  locked={judging}
                  onToggle={(caught) => toggle(outcome.issue.id, caught)}
                />
              ))}
            </section>

            {review.others.length > 0 && (
              <section aria-label="Your other comments" className="flex flex-col gap-3">
                <div>
                  <h2 className="text-[17px] leading-6 font-semibold">Your other comments</h2>
                  <p className="muted mt-1 text-[14px] leading-[21px]">
                    These are near no issue in the key. They may still be good points: the key lists
                    what the pull request must or should fix, not everything worth saying.
                  </p>
                </div>
                {review.others.flatMap((cid) => {
                  const c = commentById.get(cid);
                  return c ? [<CommentQuote key={cid} comment={c} />] : [];
                })}
              </section>
            )}
          </div>

          <aside
            aria-label="Your score"
            className="card card-raised order-first flex flex-col gap-4 p-5 min-[900px]:sticky min-[900px]:top-6 min-[900px]:order-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="stat-label">Your score</div>
                <div
                  className="mono mt-1 text-[44px] leading-[52px] font-medium tracking-[-0.02em] tabular-nums"
                  aria-live="polite"
                >
                  {review.score}%
                </div>
                <div className="muted text-[13px]">
                  {review.passed ? 'Right verdict' : 'Wrong verdict'}
                  {review.issues.length > 0 &&
                    ` · caught ${caughtCount} of ${review.issues.length}`}
                </div>
              </div>
              <span className={`tag mt-1 ${review.passed ? 'tag-good' : 'tag-risk'}`}>
                {review.passed ? 'Passed' : 'Not passed'}
              </span>
            </div>

            {review.issues.length > 0 && (
              <ul aria-label="Issues" className="flex flex-col">
                {review.issues.map((o) => (
                  <li
                    key={o.issue.id}
                    className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-line py-2"
                  >
                    {o.caught ? (
                      <span role="img" aria-label="Caught" className="flex text-success">
                        <CircleCheckBig className="i size-[18px]" aria-hidden="true" />
                      </span>
                    ) : (
                      <span role="img" aria-label="Not ticked" className="flex text-fg-3">
                        <Circle className="i size-[18px]" aria-hidden="true" />
                      </span>
                    )}
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px] leading-[18px]">{o.issue.title}</span>
                      <span className="subtle text-[12px]">
                        {SEVERITY_LABELS[o.issue.severity]} · {o.caught ? 'caught' : 'not ticked'}
                      </span>
                    </span>
                    <span className={`mono text-[12.5px] ${o.caught ? 'text-success' : 'subtle'}`}>
                      {Math.round(o.weight)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <dl className="grid grid-cols-3 gap-2 border-t border-line pt-4">
              <Figure label="Best score">
                {progress.bestScore !== undefined ? `${progress.bestScore}%` : '–'}
              </Figure>
              <Figure label="Attempts">{progress.attempts}</Figure>
              <Figure label="Best time">
                {progress.bestTimeMs !== undefined ? formatDuration(progress.bestTimeMs) : '–'}
              </Figure>
            </dl>

            {nextIsPrimary ? (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => navigate(challengePath(next.id))}
              >
                Next: {next.title} <ArrowRight className="i i-sm" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => navigate(challengePath(id))}
              >
                <ArrowLeft className="i i-sm" aria-hidden="true" /> Back to the review
              </Button>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function IssueCard({
  outcome,
  typeLabel,
  nearby,
  ai,
  locked,
  onToggle,
}: {
  outcome: IssueOutcome;
  typeLabel: (type: string) => string;
  nearby: ReviewComment[];
  ai: { verdict: AiIssueVerdict; reason: string } | undefined;
  /** While the AI judges: it's about to set the ticks. */
  locked: boolean;
  onToggle: (caught: boolean) => void;
}) {
  const checkId = useId();
  const titleId = useId();
  const { issue, caught, weight } = outcome;
  return (
    <article
      className={`card flex flex-col gap-3 p-4 transition-colors ${caught ? 'border-success-line' : ''}`}
    >
      {/* First, and prominent: ticking the issue is the answer. Locked while the AI judges. */}
      <label
        htmlFor={checkId}
        className={`flex items-center gap-2.5 self-start rounded-lg border px-3 py-2 ${
          caught
            ? 'border-success-line bg-success-bg font-semibold text-success'
            : 'border-border-strong bg-surface-2'
        } ${locked ? 'opacity-60' : ''}`}
      >
        <input
          id={checkId}
          aria-describedby={titleId}
          type="checkbox"
          checked={caught}
          disabled={locked}
          onChange={(e) => onToggle(e.target.checked)}
          className="size-4 accent-[var(--success)]"
        />
        I caught this
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={`tag ${SEVERITY_TAG[issue.severity]}`}>
            {SEVERITY_LABELS[issue.severity]}
          </span>
          <span className="mono subtle text-[12px]">{Math.round(weight)}% of the score</span>
        </div>
        <h3 id={titleId} className="text-[17px] leading-6 font-semibold">
          {issue.title}
        </h3>
        <p className="mono subtle text-[12.5px]">
          {issue.file} · {lineLabel(issue.lines)} · {typeLabel(issue.type)}
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-3">
        <p className="text-[14px] leading-[21px] text-fg-2">{issue.explanation}</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="subtle text-[12px] font-medium">Your comments on these lines</span>
            {nearby.length > 0 ? (
              nearby.map((c) => <CommentQuote key={c.id} comment={c} />)
            ) : (
              <div className="quote border-dashed bg-transparent">
                <p className="subtle text-[14px]">None.</p>
              </div>
            )}
          </div>
          {ai && (
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="subtle text-[12px] font-medium">AI verdict</span>
              <div className="quote flex flex-col items-start gap-1.5">
                <span className={`tag ${AI_VERDICT_TAG[ai.verdict]}`}>
                  AI: {AI_VERDICT_LABELS[ai.verdict]}
                </span>
                <p className="text-[14px] leading-[21px]">{ai.reason}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CommentQuote({ comment }: { comment: ReviewComment }): ReactNode {
  return (
    <blockquote className="quote flex flex-col gap-1">
      <p className="mono muted text-[12px]">
        {comment.file} · {lineLabel(comment.lines)}
      </p>
      <p className="text-[14px] leading-[21px] whitespace-pre-wrap">{comment.why}</p>
    </blockquote>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="stat-label">{label}</dt>
      <dd className="mono mt-1 text-[16px] tabular-nums">{children}</dd>
    </div>
  );
}

/** The score the server will compute for these ticks, to show it before it answers. */
function scoreOf(issues: IssueOutcome[], review: ReviewResult): number {
  if (issues.length === 0) return review.score;
  return Math.round(issues.reduce((sum, o) => sum + (o.caught ? o.weight : 0), 0));
}
