import { ArrowLeft, FilePlus, RotateCcw, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
import { Button, DifficultyBadge, Spinner, StatusScreen } from '../components/ui';
import type { monaco } from '../editor/monacoSetup';
import { navigate, resultsPath } from '../router';
import { useResolvedTheme } from '../theme';
import { DiffView, functionAround, lineLabel } from '../workspace/DiffView';
import { ReviewDraftStore } from '../workspace/reviewDraft';
import { ReviewPanel, type CommentEdit } from '../workspace/ReviewPanel';
import { ActiveTimer } from '../workspace/timer';
import { TimerDisplay } from '../workspace/TimerDisplay';
import { layoutStorage } from './Workspace';

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
    if (!draft.verdict) {
      setMessage('Pick a verdict first: approve, or request changes.');
      return;
    }
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

  return (
    <div className="flex h-full min-w-[720px] flex-col">
      <TopBar
        right={
          <>
            <SaveState state={saveState} error={saveError} />
            <TimerDisplay timer={timer} />
          </>
        }
      >
        <span className="text-muted">/</span>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex shrink-0 items-center gap-1 rounded px-1 text-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Challenges
        </button>
        <span className="text-muted">/</span>
        <h1 className="min-w-0 truncate">{challenge.title}</h1>
        <DifficultyBadge difficulty={challenge.difficulty} />
        <span className="shrink-0 text-muted">Review</span>
        <LanguageSwitch available={challenge.languages} beforeChange={() => store.flush()} />
        {challenge.progress.attempts > 0 && (
          <button
            type="button"
            onClick={() => navigate(resultsPath(id))}
            className="shrink-0 rounded px-1 text-muted underline-offset-2 hover:bg-hover hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Results
          </button>
        )}
      </TopBar>

      <Group
        orientation="horizontal"
        className="min-h-0 flex-1"
        defaultLayout={columns.defaultLayout}
        onLayoutChanged={columns.onLayoutChanged}
      >
        <Panel id="task" defaultSize="22" minSize={180}>
          <TaskPanel challenge={challenge} />
        </Panel>
        <ResizeHandle />
        <Panel id="diff" minSize={320}>
          <div className="flex h-full flex-col">
            <nav
              aria-label="Changed files"
              className="flex shrink-0 overflow-x-auto border-b border-line bg-bar"
            >
              {pr.files.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  aria-current={f.path === activePath ? 'page' : undefined}
                  onClick={() => setActivePath(f.path)}
                  className={`flex h-9 shrink-0 items-center gap-1.5 border-r border-line px-3 font-mono text-[12px] focus-visible:outline-2 focus-visible:outline-accent ${
                    f.path === activePath ? 'bg-bg text-fg' : 'text-muted hover:bg-hover'
                  }`}
                >
                  {f.base === null && (
                    <FilePlus size={12} className="text-success" aria-label="New file" />
                  )}
                  {f.path}
                  {countIn(f.path) > 0 && (
                    <span className="rounded bg-accent-bg px-1 text-[10px] text-on-accent">
                      {countIn(f.path)}
                    </span>
                  )}
                </button>
              ))}
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
                theme={theme}
                onSelect={setSelection}
                onCommentClick={setFocusedId}
                onModels={onModels}
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
            verdict={draft.verdict}
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
            onVerdict={(v) => store.setVerdict(v)}
          />
        </Panel>
      </Group>

      <footer className="flex h-11 shrink-0 items-center gap-2 border-t border-line bg-bar px-3">
        <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={busy}>
          <RotateCcw size={14} aria-hidden="true" /> Reset
        </Button>
        {message && (
          <span role="alert" className="min-w-0 truncate text-danger">
            {message}
          </span>
        )}
        {editing && !message && (
          <span className="min-w-0 truncate text-muted">
            Writing a comment on {lineLabel(editing.lines)}…
          </span>
        )}
        <Button variant="primary" className="ml-auto" onClick={() => void submit()} disabled={busy}>
          {submitting ? <Spinner /> : <Send size={14} aria-hidden="true" />}
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
        Every comment and your verdict are deleted. Your progress and revealed hints are kept.
      </ConfirmDialog>
    </div>
  );
}

function SaveState({ state, error }: { state: string; error: string | null }) {
  if (state === 'error') {
    return (
      <span role="alert" className="text-danger" title={error ?? undefined}>
        Not saved
      </span>
    );
  }
  return (
    <span className="text-muted" aria-live="polite">
      {state === 'saving' ? 'Saving…' : 'Saved'}
    </span>
  );
}

function ResizeHandle() {
  return (
    <Separator className="w-px bg-line transition-colors duration-100 hover:bg-accent focus-visible:bg-accent data-[separator=active]:bg-accent" />
  );
}
