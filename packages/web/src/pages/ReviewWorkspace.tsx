import {
  ArrowLeft,
  Check,
  FilePlus,
  MessageSquare,
  Pencil,
  RotateCcw,
  Send,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import type {
  ChallengeDetail,
  Language,
  LineRange,
  ReviewComment,
  ReviewPullRequest,
} from '@devdrill/shared';
import { MAX_COMMENT_LINES, MAX_REVIEW_COMMENTS } from '@devdrill/shared/review';
import { api } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { TaskPanel } from '../components/TaskPanel';
import { TopBar } from '../components/TopBar';
import { Button, DifficultyBadge, ModeBadge, Spinner, StatusScreen } from '../components/ui';
import type { monaco } from '../editor/monacoSetup';
import { navigate, resultsPath } from '../router';
import { useResolvedTheme } from '../theme';
import { DiffView, functionAround, lineLabel, type LineCounts } from '../workspace/DiffView';
import { ReviewDraftStore } from '../workspace/reviewDraft';
import { ReviewPanel, type CommentEdit } from '../workspace/ReviewPanel';
import { ActiveTimer } from '../workspace/timer';
import { TimerDisplay } from '../workspace/TimerDisplay';
import { layoutStorage, TASK_RAIL, TaskRail, useTaskFold } from './Workspace';

function newCommentId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A review challenge: the PR description, the diff, and the review being written.
 * Like Workspace, `lang` is fixed for the life of this screen.
 */
export function ReviewWorkspace({ id, lang }: { id: string; lang: Language }) {
  const theme = useResolvedTheme();
  const verdictLabelId = useId();
  const statusId = useId();
  const [store] = useState(() => new ReviewDraftStore((d) => api.saveReview(id, d, lang)));
  const {
    draft,
    state: saveState,
    error: saveError,
  } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const columns = useDefaultLayout({ id: 'devdrill-review-columns', storage: layoutStorage });
  const [timer] = useState(() => new ActiveTimer(id, lang));
  useEffect(() => {
    timer.start();
    return () => timer.stop();
  }, [timer]);

  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [pr, setPr] = useState<ReviewPullRequest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePath, setActivePath] = useState('');
  const [selection, setSelection] = useState<LineRange | null>(null);
  const [editing, setEditing] = useState<CommentEdit | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const busy = submitting || resetting;
  /** Bumped to clear the selection in the diff, e.g. after a comment is added. */
  const [clearSelection, setClearSelection] = useState(0);
  const models = useRef(new Map<string, monaco.editor.ITextModel>());
  const task = useTaskFold();
  /** Lines added and removed in the file on screen. */
  const [lineCounts, setLineCounts] = useState<LineCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.challenge(id, lang), api.start(id, lang), api.reviewPullRequest(id, lang)])
      .then(async ([detail, , pullRequest]) => {
        const saved = await api.reviewDraft(id, lang);
        if (cancelled) return;
        store.load(saved);
        setChallenge(detail);
        setPr(pullRequest);
        setActivePath(pullRequest.files[0]?.path ?? '');
      })
      .catch((err: Error) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id, lang, store]);

  // Submit can finish after the user left this screen; don't pull them back.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Don't lose the review when the page closes or goes to the background.
  useEffect(() => {
    const onBeforeUnload = () => {
      if (store.isDirty()) api.saveReviewOnUnload(id, store.getSnapshot().draft, lang);
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void store.flush().catch(() => undefined);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onHidden);
      void store.flush().catch(() => undefined); // leaving for another screen in the app
    };
  }, [id, lang, store]);

  const onModels = useCallback((m: Map<string, monaco.editor.ITextModel>) => {
    models.current = m;
  }, []);

  const openComment = (lines: LineRange | null) => {
    if (!lines || busy || editing) return;
    if (draft.comments.length >= MAX_REVIEW_COMMENTS) {
      setMessage(`You've used all ${MAX_REVIEW_COMMENTS} comments. Remove one to add another.`);
      return;
    }
    if (lines[1] - lines[0] + 1 > MAX_COMMENT_LINES) {
      setMessage(`A comment covers at most ${MAX_COMMENT_LINES} lines. Select fewer.`);
      return;
    }
    setMessage(null);
    setEditing({ file: activePath, lines, why: '' });
  };
  const startComment = () => openComment(selection);

  /** Widens the comment to the function around it; returns why it couldn't, or null. */
  const wholeFunction = async (): Promise<string | null> => {
    if (!editing) return null;
    const { file, id: commentId } = editing;
    const model = models.current.get(file);
    if (!model) return null;
    try {
      const range = await functionAround(model, editing.lines);
      if (!range) return "These lines aren't inside a function.";
      if (range[1] - range[0] + 1 > MAX_COMMENT_LINES) {
        return `That function is longer than ${MAX_COMMENT_LINES} lines; comment on the lines that matter.`;
      }
      // The form may have closed or moved to another comment while the lookup ran.
      setEditing((e) => (e && e.file === file && e.id === commentId ? { ...e, lines: range } : e));
      return null;
    } catch {
      return "Couldn't find the function. Select its lines instead.";
    }
  };

  const saveComment = () => {
    if (!editing) return;
    const comment: ReviewComment = {
      id: editing.id ?? newCommentId(),
      file: editing.file,
      lines: editing.lines,
      why: editing.why.trim(),
    };
    if (editing.id) store.updateComment(comment);
    else store.addComment(comment);
    setFocusedId(comment.id);
    setEditing(null);
    setSelection(null);
    setClearSelection((n) => n + 1);
  };

  const focusComment = (comment: ReviewComment) => {
    setActivePath(comment.file);
    setFocusedId(comment.id);
  };

  const submit = async () => {
    if (submitting) return;
    if (editing) {
      setMessage('Add or cancel the comment you are writing first.');
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await store.flush();
      const elapsed = timer.get();
      const review = await api.submitReview(id, { elapsedMs: elapsed }, lang);
      if (review.passed) timer.reset(); // the next try is a new attempt
      if (mounted.current) navigate(resultsPath(id));
    } catch (err) {
      if (!mounted.current) return;
      setMessage((err as Error).message);
      setSubmitting(false);
    }
  };

  const reset = async () => {
    setConfirmReset(false);
    if (busy) return;
    // Nothing can change while the reset runs, or a save could bring old comments back.
    setResetting(true);
    try {
      await store.flush().catch(() => undefined);
      await api.reset(id, lang);
      store.load({ comments: [], verdict: null });
      timer.reset();
      setEditing(null);
      setFocusedId(null);
      setMessage(null);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setResetting(false);
    }
  };

  if (loadError) {
    return (
      <StatusScreen
        title="Couldn't open this challenge"
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <LanguageSwitch />
            <Button onClick={() => navigate('/')}>All challenges</Button>
          </div>
        }
      >
        {loadError}
      </StatusScreen>
    );
  }
  if (!challenge || !pr) {
    return (
      <StatusScreen title="Opening pull request">
        <Spinner />
      </StatusScreen>
    );
  }

  const countIn = (path: string) => draft.comments.filter((c) => c.file === path).length;
  // What the footer says, after any message: the comment being written, else the verdict.
  const status = editing
    ? `Writing a comment on ${lineLabel(editing.lines)}…`
    : draft.verdict
      ? null
      : 'Pick a verdict to submit';

  return (
    <div className="flex h-full min-w-[720px] flex-col">
      <TopBar
        iconOnly
        right={
          <>
            <SaveState state={saveState} error={saveError} />
            {challenge.progress.attempts > 0 && (
              <button
                type="button"
                onClick={() => navigate(resultsPath(id))}
                className="btn btn-ghost btn-sm shrink-0"
              >
                Results
              </button>
            )}
            <LanguageSwitch available={challenge.languages} beforeChange={() => store.flush()} />
            <TimerDisplay timer={timer} />
          </>
        }
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          className="crumb shrink-0 hover:bg-hover"
        >
          <ArrowLeft className="i i-sm" aria-hidden="true" /> Challenges
        </button>
        <span className="crumb-sep">/</span>
        <h1 className="min-w-0 truncate text-[14px] leading-5 font-semibold">{challenge.title}</h1>
        <ModeBadge mode={challenge.mode} />
        <DifficultyBadge difficulty={challenge.difficulty} />
      </TopBar>

      <Group
        orientation="horizontal"
        className="min-h-0 flex-1"
        defaultLayout={columns.defaultLayout}
        onLayoutChanged={columns.onLayoutChanged}
      >
        <Panel
          id="task"
          panelRef={task.panelRef}
          defaultSize="22"
          minSize={180}
          collapsible
          collapsedSize={TASK_RAIL}
          onResize={task.onResize}
        >
          {task.collapsed && (
            <TaskRail label="Pull request" expandRef={task.expandRef} onExpand={task.expand} />
          )}
          {/* Hidden, not unmounted, when folded: the hints keep their state. */}
          <div hidden={task.collapsed} className="h-full">
            <TaskPanel
              challenge={challenge}
              title="Pull request"
              collapseRef={task.collapseRef}
              onCollapse={task.collapse}
            />
          </div>
        </Panel>
        <ResizeHandle />
        <Panel id="diff" minSize={320}>
          <div className="flex h-full flex-col">
            <nav
              aria-label="Changed files"
              className="flex shrink-0 overflow-x-auto border-b border-line bg-bar"
            >
              {pr.files.map((f) => {
                const on = f.path === activePath;
                const comments = countIn(f.path);
                return (
                  <button
                    key={f.path}
                    type="button"
                    aria-current={on ? 'page' : undefined}
                    onClick={() => setActivePath(f.path)}
                    className={`ftab shrink-0 focus-visible:outline-2 focus-visible:outline-accent ${on ? 'on' : ''}`}
                  >
                    {f.base === null && (
                      <FilePlus className="i i-sm text-success" aria-label="New file" />
                    )}
                    {f.path}
                    {comments > 0 && (
                      <span className="mono inline-flex items-center gap-1 text-[11px] text-accent">
                        <MessageSquare className="i i-sm" aria-hidden="true" />
                        {comments}
                        <span className="sr-only">comments</span>
                      </span>
                    )}
                  </button>
                );
              })}
              {lineCounts && (
                <span className="mono ml-auto flex shrink-0 items-center gap-2.5 self-center px-3.5 text-[12px]">
                  <span className="text-success">+{lineCounts.added}</span>
                  <span className="text-danger">−{lineCounts.removed}</span>
                </span>
              )}
            </nav>
            <div className="min-h-0 flex-1">
              <DiffView
                reviewId={`${lang}/${id}`}
                files={pr.files}
                activePath={activePath}
                comments={draft.comments}
                pending={editing && editing.file === activePath ? editing.lines : null}
                clearSelection={clearSelection}
                onCommentShortcut={startComment}
                onAddComment={openComment}
                focusedId={focusedId}
                editingId={editing?.id ?? null}
                theme={theme}
                onSelect={setSelection}
                onCommentClick={setFocusedId}
                onModels={onModels}
                onLineCounts={setLineCounts}
              />
            </div>
          </div>
        </Panel>
        <ResizeHandle />
        <Panel id="review" defaultSize="26" minSize={240}>
          <ReviewPanel
            activePath={activePath}
            selection={selection}
            comments={draft.comments}
            editing={editing}
            focusedId={focusedId}
            disabled={busy}
            onStartComment={startComment}
            onWholeFunction={wholeFunction}
            onEditChange={setEditing}
            onSaveComment={saveComment}
            onCancelEdit={() => setEditing(null)}
            onEditComment={(c) => {
              focusComment(c);
              setEditing({ ...c });
            }}
            onDeleteComment={(commentId) => {
              store.removeComment(commentId);
              if (editing?.id === commentId) setEditing(null);
              if (focusedId === commentId) setFocusedId(null);
            }}
            onFocusComment={focusComment}
          />
        </Panel>
      </Group>

      <footer className="bottombar shrink-0">
        <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={busy}>
          <RotateCcw className="i i-sm" aria-hidden="true" /> Start over
        </Button>
        {message ? (
          <span
            id={statusId}
            role="alert"
            className="min-w-0 flex-1 truncate text-[13px] text-danger"
          >
            {message}
          </span>
        ) : (
          <span id={statusId} className="muted min-w-0 flex-1 truncate text-[13px]">
            {status}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <span id={verdictLabelId} className="text-[13px] font-semibold text-fg-2">
            Verdict
          </span>
          <div role="group" aria-labelledby={verdictLabelId} className="seg">
            <VerdictButton
              selected={draft.verdict === 'approve'}
              disabled={busy}
              onClick={() => store.setVerdict('approve')}
              icon={<Check className="i i-sm" aria-hidden="true" />}
            >
              Approve
            </VerdictButton>
            <VerdictButton
              selected={draft.verdict === 'request_changes'}
              disabled={busy}
              onClick={() => store.setVerdict('request_changes')}
              icon={<Pencil className="i i-sm text-warning" aria-hidden="true" />}
            >
              Request changes
            </VerdictButton>
          </div>
        </div>
        <Button
          variant="primary"
          className="shrink-0"
          onClick={() => void submit()}
          disabled={busy || !draft.verdict}
          aria-describedby={statusId}
        >
          {submitting ? <Spinner /> : <Send className="i i-sm" aria-hidden="true" />}
          {submitting ? 'Submitting…' : 'Submit review'}
        </Button>
      </footer>

      <ConfirmDialog
        open={confirmReset}
        title="Start the review over?"
        confirmLabel="Delete comments"
        onConfirm={() => void reset()}
        onCancel={() => setConfirmReset(false)}
      >
        Every comment and your verdict are deleted. Your progress is kept.
      </ConfirmDialog>
    </div>
  );
}

/** The verdict, one of two; `aria-pressed` says which is chosen. */
function VerdictButton({
  selected,
  disabled,
  onClick,
  icon,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`seg-item disabled:opacity-60 ${
        selected ? 'on bg-accent-soft text-accent shadow-[0_0_0_1px_var(--accent)]' : ''
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function SaveState({ state, error }: { state: string; error: string | null }) {
  if (state === 'error') {
    return (
      <span
        role="alert"
        className="flex items-center gap-1.5 text-[12px] whitespace-nowrap text-danger"
        title={error ?? undefined}
      >
        <TriangleAlert className="i i-sm" aria-hidden="true" />
        Not saved
      </span>
    );
  }
  const saving = state === 'saving';
  return (
    <span
      className="muted flex items-center gap-1.5 text-[12px] whitespace-nowrap"
      aria-live="polite"
    >
      {saving ? <Spinner /> : <Check className="i i-sm" aria-hidden="true" />}
      {saving ? 'Saving…' : 'Saved'}
    </span>
  );
}

function ResizeHandle() {
  return <Separator className="resize" />;
}
