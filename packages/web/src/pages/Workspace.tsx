import { ArrowLeft, ChevronRight, Play, RotateCcw, Send, TriangleAlert } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from 'react';
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  usePanelRef,
  type LayoutStorage,
} from 'react-resizable-panels';
import type { ChallengeDetail, Language, TestRunResult } from '@devdrill/shared';
import { api } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { FileTree } from '../components/FileTree';
import { TaskPanel } from '../components/TaskPanel';
import { TestPanel } from '../components/TestPanel';
import { TopBar } from '../components/TopBar';
import {
  Button,
  DifficultyBadge,
  Kbd,
  ModeBadge,
  modKey,
  Spinner,
  StatusScreen,
} from '../components/ui';
import { navigate, resultsPath } from '../router';
import { useResolvedTheme } from '../theme';
import { CodeEditor } from '../workspace/CodeEditor';
import { EditorTabs } from '../workspace/EditorTabs';
import { FileStore } from '../workspace/fileStore';
import { SaveIndicator } from '../workspace/SaveIndicator';
import { saveResult } from '../workspace/results';
import { ActiveTimer } from '../workspace/timer';
import { TimerDisplay } from '../workspace/TimerDisplay';
import { PRODUCT_NAME } from '../brand';

/** Panel sizes are a per-browser convenience; storage may be blocked (private mode). */
export const layoutStorage: LayoutStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Not saved; the default layout is used next time.
    }
  },
};

/** The task panel folded to this many pixels: a strip with one button to bring it back. */
export const TASK_RAIL = 44;

/** The file to open first: the first source file, else the first file. */
function defaultFile(files: string[]): string | undefined {
  return files.find((f) => f.startsWith('src/')) ?? files[0];
}

/**
 * `lang` is fixed for the life of this screen: everything it saves goes to that
 * language's workspace, even if the language setting changes while a save is running.
 */
export function Workspace({ id, lang }: { id: string; lang: Language }) {
  const theme = useResolvedTheme();
  const [store] = useState(
    () =>
      new FileStore({
        read: (path) => api.readFile(id, path, lang),
        save: (path, body) => api.saveFile(id, path, body, lang),
      }),
  );
  const buffers = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const columns = useDefaultLayout({ id: 'devdrill-columns', storage: layoutStorage });
  const rows = useDefaultLayout({ id: 'devdrill-editor-rows', storage: layoutStorage });
  const [timer] = useState(() => new ActiveTimer(id, lang));
  useEffect(() => {
    timer.start();
    return () => timer.stop();
  }, [timer]);

  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [result, setResult] = useState<TestRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const busy = running || submitting;
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const task = useTaskFold();
  const [aiEnabled, setAiEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api
      .aiStatus()
      .then((s) => !cancelled && setAiEnabled(s.enabled))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const openFile = useCallback(
    (path: string) => {
      setTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
      setActive(path);
      store.load(path).catch((err: Error) => setMessage(`Couldn't open ${path}: ${err.message}`));
    },
    [store],
  );

  // Load the challenge and create its workspace on first visit.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.challenge(id, lang), api.start(id, lang)])
      .then(([detail, ws]) => {
        if (cancelled) return;
        setChallenge(detail);
        setFiles(ws.files);
        const first = defaultFile(ws.files);
        if (first) openFile(first);
        // TypeScript checks imports across files, so every .ts file needs to be in the
        // editor (not opened as a tab) for its types to be known.
        if (lang === 'ts') {
          for (const file of ws.files.filter((f) => f.endsWith('.ts'))) void store.load(file);
        }
      })
      .catch((err: Error) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id, lang, openFile, store]);

  const runTests = useCallback(async () => {
    if (busy) return;
    setRunning(true);
    setMessage(null);
    try {
      await store.flush();
      setResult(await api.run(id, lang));
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setRunning(false);
    }
  }, [id, lang, busy, store]);

  // Submit can finish after the user left this screen; don't pull them back.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = useCallback(async () => {
    if (busy) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await store.flush();
      const elapsed = timer.get();
      const result = await api.submit(id, { elapsedMs: elapsed }, lang);
      saveResult(id, lang, { submit: result, elapsedMs: elapsed });
      if (result.solved) timer.reset(); // the next try is a new attempt
      if (mounted.current) navigate(resultsPath(id));
    } catch (err) {
      if (!mounted.current) return;
      setMessage((err as Error).message);
      setSubmitting(false);
    }
  }, [id, lang, busy, store, timer]);

  const reset = async () => {
    setConfirmReset(false);
    if (busy) return;
    try {
      await store.clear(); // lets in-flight saves finish first
      const ws = await api.reset(id, lang);
      timer.reset(); // starting over is a new attempt
      setFiles(ws.files);
      setResult(null);
      setMessage(null);
      const keep = tabs.filter((t) => ws.files.includes(t));
      const next = active && keep.includes(active) ? active : (keep[0] ?? defaultFile(ws.files));
      setTabs(next && !keep.includes(next) ? [...keep, next] : keep);
      setActive(next ?? null);
      for (const path of keep) void store.load(path);
      if (next) void store.load(next);
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const closeTab = (path: string) => {
    const remaining = tabs.filter((t) => t !== path);
    setTabs(remaining);
    if (active === path) setActive(remaining[remaining.length - 1] ?? null);
    void store.close(path);
  };

  // Keyboard shortcuts outside the editor (CodeEditor handles them inside).
  // While the reset dialog is open, Run and Submit shortcuts do nothing.
  const actions = () => ({
    runTests: confirmReset ? () => Promise.resolve() : runTests,
    submit: confirmReset ? () => Promise.resolve() : submit,
    save: () => store.flush(),
  });
  const shortcuts = useRef(actions());
  useLayoutEffect(() => {
    shortcuts.current = actions();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 's') {
        e.preventDefault();
        void shortcuts.current.save();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void (e.shiftKey ? shortcuts.current.submit() : shortcuts.current.runTests());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Don't lose typing when the page closes, reloads or goes to the background.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      for (const file of store.unsaved()) {
        api.saveFileOnUnload(
          id,
          file.path,
          { content: file.content, baseMtimeMs: file.mtimeMs },
          lang,
        );
      }
      // A conflict or failed save can't be fixed by saving now; ask the user to stay.
      const stuck = Object.values(store.getSnapshot()).some(
        (b) => b.state === 'conflict' || b.state === 'error',
      );
      if (stuck) e.preventDefault();
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void store.flush();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onHidden);
      void store.flush(); // leaving for another screen in the app
    };
  }, [id, lang, store]);

  if (loadError) {
    return (
      <StatusScreen
        title="Couldn't open this challenge"
        action={
          // E.g. the challenge isn't in this language: switching is the way out.
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
  if (!challenge) {
    return (
      <StatusScreen title="Opening challenge">
        <Spinner />
      </StatusScreen>
    );
  }

  const unsaved = new Set(
    Object.entries(buffers)
      .filter(([, b]) => b.state !== 'saved')
      .map(([p]) => p),
  );
  const conflict = active && buffers[active]?.state === 'conflict' ? active : null;

  return (
    <div className="flex h-full min-w-[720px] flex-col">
      <TopBar
        iconOnly
        right={
          <>
            <SaveIndicator buffers={buffers} />
            {challenge.progress.attempts > 0 && (
              <button
                type="button"
                onClick={() => navigate(resultsPath(id))}
                className="btn btn-ghost btn-sm shrink-0"
              >
                Results
              </button>
            )}
            {/* Switching saves your code (the workspace flushes on leave) and reopens this
                challenge in the other language. */}
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
          defaultSize="24"
          minSize={180}
          collapsible
          collapsedSize={TASK_RAIL}
          onResize={task.onResize}
        >
          {task.collapsed && <TaskRail expandRef={task.expandRef} onExpand={task.expand} />}
          {/* Hidden, not unmounted, when folded: the hints and AI answers keep their state. */}
          <div hidden={task.collapsed} className="h-full">
            <TaskPanel
              challenge={challenge}
              collapseRef={task.collapseRef}
              onCollapse={task.collapse}
              askAi={
                aiEnabled
                  ? async (shown) => {
                      await store.flush(); // the AI reads the saved code
                      return (await api.aiHint(id, shown, lang)).hint;
                    }
                  : undefined
              }
            />
          </div>
        </Panel>
        <ResizeHandle />
        <Panel id="files" defaultSize="16" minSize={120} maxSize={360}>
          <FileTree files={files} activePath={active} unsaved={unsaved} onOpen={openFile} />
        </Panel>
        <ResizeHandle />
        <Panel id="main" minSize={280}>
          <Group
            orientation="vertical"
            defaultLayout={rows.defaultLayout}
            onLayoutChanged={rows.onLayoutChanged}
          >
            <Panel id="editor" minSize={120}>
              <div className="flex h-full flex-col">
                <EditorTabs
                  tabs={tabs}
                  active={active}
                  unsaved={unsaved}
                  onSelect={setActive}
                  onClose={closeTab}
                />
                {conflict && (
                  <div
                    role="alert"
                    className="flex flex-wrap items-center gap-2 border-b border-danger-line bg-danger-bg px-3 py-2"
                  >
                    <span className="mr-auto flex items-center gap-2 text-danger">
                      <TriangleAlert className="i i-sm" aria-hidden="true" />
                      {conflict} changed outside {PRODUCT_NAME}.
                    </span>
                    <Button onClick={() => void store.save(conflict, { overwrite: true })}>
                      Keep mine
                    </Button>
                    <Button onClick={() => void store.load(conflict, { force: true })}>
                      Load their version
                    </Button>
                  </div>
                )}
                <div className="min-h-0 flex-1">
                  <CodeEditor
                    workspaceId={`${lang}/${id}`}
                    activePath={active}
                    buffers={buffers}
                    theme={theme}
                    onEdit={(path, content) => store.edit(path, content)}
                    onSaveShortcut={() => void store.flush()}
                    onRunShortcut={() => void shortcuts.current.runTests()}
                    onSubmitShortcut={() => void shortcuts.current.submit()}
                  />
                </div>
              </div>
            </Panel>
            <ResizeHandle vertical />
            <Panel id="tests" defaultSize="32" minSize={80}>
              <TestPanel result={result} running={busy} error={message} />
            </Panel>
          </Group>
        </Panel>
      </Group>

      <footer className="bottombar shrink-0">
        <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={busy}>
          <RotateCcw className="i i-sm" aria-hidden="true" /> Reset
        </Button>
        <span className="muted ml-auto text-[13px]">Submit also runs hidden tests.</span>
        <Button
          onClick={() => void runTests()}
          disabled={busy}
          title={`Run the visible tests (${modKey} Enter)`}
          aria-keyshortcuts="Control+Enter Meta+Enter"
        >
          {running ? <Spinner /> : <Play className="i i-sm" aria-hidden="true" />}
          {running ? 'Running…' : 'Run tests'}
          <Kbd>{modKey} ↵</Kbd>
        </Button>
        <Button
          variant="primary"
          onClick={() => void submit()}
          disabled={busy}
          title={`Run all tests, including hidden ones (${modKey} Shift Enter)`}
          aria-keyshortcuts="Control+Shift+Enter Meta+Shift+Enter"
        >
          {submitting ? <Spinner /> : <Send className="i i-sm" aria-hidden="true" />}
          {submitting ? 'Submitting…' : 'Submit'}
          <Kbd>{modKey} ⇧ ↵</Kbd>
        </Button>
      </footer>

      <ConfirmDialog
        open={confirmReset}
        title="Reset to the starting code?"
        confirmLabel="Reset files"
        onConfirm={() => void reset()}
        onCancel={() => setConfirmReset(false)}
      >
        Every file in this challenge goes back to how it started, and your edits are lost. Your
        progress is kept.
      </ConfirmDialog>
    </div>
  );
}

function ResizeHandle({ vertical = false }: { vertical?: boolean }) {
  return <Separator className={vertical ? 'resize resize-h' : 'resize'} />;
}

/** The task panel folded away: one button to open it again, and its name running down the strip. */
export function TaskRail({
  onExpand,
  expandRef,
  label = 'Task',
}: {
  onExpand: () => void;
  expandRef?: Ref<HTMLButtonElement>;
  label?: string;
}) {
  return (
    <div className="panel flex h-full flex-col items-center gap-3 py-2">
      <Button
        ref={expandRef}
        variant="ghost"
        size="sm"
        onClick={onExpand}
        aria-label={`Expand ${label.toLowerCase()} panel`}
        title={`Expand ${label.toLowerCase()} panel`}
        className="btn-icon"
      >
        <ChevronRight className="i i-sm" aria-hidden="true" />
      </Button>
      <span className="panel-title [writing-mode:vertical-rl]">{label}</span>
    </div>
  );
}

/**
 * The task panel folds to a rail. A click on either toggle moves focus to the toggle still on
 * screen, since the one pressed is now hidden or gone. Restoring the layout on load and
 * dragging the separator don't move focus, because nothing was clicked.
 */
export function useTaskFold() {
  const panel = usePanelRef();
  const [collapsed, setCollapsed] = useState(false);
  const expandRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  // Set by a click, and read once the fold has changed.
  const focusNext = useRef<'expand' | 'collapse' | null>(null);

  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === 'expand') expandRef.current?.focus();
    else if (target === 'collapse') collapseRef.current?.focus();
  }, [collapsed]);

  return {
    panelRef: panel,
    collapsed,
    expandRef,
    collapseRef,
    // Only the panel's size is needed: it is TASK_RAIL exactly when folded.
    onResize: (size: { inPixels: number }) => setCollapsed(size.inPixels <= TASK_RAIL),
    collapse: () => {
      focusNext.current = 'expand';
      panel.current?.collapse();
    },
    expand: () => {
      focusNext.current = 'collapse';
      panel.current?.expand();
    },
  };
}
