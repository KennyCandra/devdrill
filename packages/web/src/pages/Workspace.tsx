import { ArrowLeft, Play, RotateCcw, Send } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  type LayoutStorage,
} from 'react-resizable-panels';
import type { ChallengeDetail, TestRunResult } from '@devdrill/shared';
import { api, currentLanguage } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LANGUAGE_LABELS } from '../components/LanguageSwitch';
import { FileTree } from '../components/FileTree';
import { TaskPanel } from '../components/TaskPanel';
import { TestPanel } from '../components/TestPanel';
import { TopBar } from '../components/TopBar';
import { Button, DifficultyBadge, Kbd, modKey, Spinner, StatusScreen } from '../components/ui';
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
const layoutStorage: LayoutStorage = {
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

/** The file to open first: the first source file, else the first file. */
function defaultFile(files: string[]): string | undefined {
  return files.find((f) => f.startsWith('src/')) ?? files[0];
}

export function Workspace({ id }: { id: string }) {
  const theme = useResolvedTheme();
  const [store] = useState(
    () =>
      new FileStore({
        read: (path) => api.readFile(id, path),
        save: (path, body) => api.saveFile(id, path, body),
      }),
  );
  const buffers = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const columns = useDefaultLayout({ id: 'devdrill-columns', storage: layoutStorage });
  const rows = useDefaultLayout({ id: 'devdrill-editor-rows', storage: layoutStorage });
  const [timer] = useState(() => new ActiveTimer(id));
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
    Promise.all([api.challenge(id), api.start(id)])
      .then(([detail, ws]) => {
        if (cancelled) return;
        setChallenge(detail);
        setFiles(ws.files);
        const first = defaultFile(ws.files);
        if (first) openFile(first);
        // TypeScript checks imports across files, so every .ts file needs to be in the
        // editor (not opened as a tab) for its types to be known.
        if (currentLanguage() === 'ts') {
          for (const file of ws.files.filter((f) => f.endsWith('.ts'))) void store.load(file);
        }
      })
      .catch((err: Error) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id, openFile, store]);

  const runTests = useCallback(async () => {
    if (busy) return;
    setRunning(true);
    setMessage(null);
    try {
      await store.flush();
      setResult(await api.run(id));
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setRunning(false);
    }
  }, [id, busy, store]);

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
      const result = await api.submit(id, { elapsedMs: elapsed });
      saveResult(id, { submit: result, elapsedMs: elapsed });
      if (result.solved) timer.reset(); // the next try is a new attempt
      if (mounted.current) navigate(resultsPath(id));
    } catch (err) {
      if (!mounted.current) return;
      setMessage((err as Error).message);
      setSubmitting(false);
    }
  }, [id, busy, store, timer]);

  const reset = async () => {
    setConfirmReset(false);
    if (busy) return;
    try {
      await store.clear(); // lets in-flight saves finish first
      const ws = await api.reset(id);
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
        api.saveFileOnUnload(id, file.path, { content: file.content, baseMtimeMs: file.mtimeMs });
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
  }, [id, store]);

  if (loadError) {
    return (
      <StatusScreen
        title="Couldn't open this challenge"
        action={<Button onClick={() => navigate('/')}>All challenges</Button>}
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
        right={
          <>
            <SaveIndicator buffers={buffers} />
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
        <span className="shrink-0 text-muted capitalize">{challenge.mode}</span>
        <span className="shrink-0 rounded border border-line px-1.5 font-mono text-[11px] text-muted">
          {LANGUAGE_LABELS[currentLanguage()]}
        </span>
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
        <Panel id="task" defaultSize="24" minSize={180}>
          <TaskPanel challenge={challenge} />
        </Panel>
        <ResizeHandle />
        <Panel id="files" defaultSize="16" minSize={120}>
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
                    className="flex flex-wrap items-center gap-2 border-b border-line bg-danger-bg px-3 py-1.5"
                  >
                    <span className="mr-auto">
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
                    workspaceId={`${currentLanguage()}/${id}`}
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

      <footer className="flex h-11 shrink-0 items-center gap-2 border-t border-line bg-bar px-3">
        <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={busy}>
          <RotateCcw size={14} aria-hidden="true" /> Reset
        </Button>
        <Button
          className="ml-auto"
          onClick={() => void runTests()}
          disabled={busy}
          title={`Run the visible tests (${modKey} Enter)`}
          aria-keyshortcuts="Control+Enter Meta+Enter"
        >
          {running ? <Spinner /> : <Play size={14} aria-hidden="true" />}
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
          {submitting ? <Spinner /> : <Send size={14} aria-hidden="true" />}
          {submitting ? 'Submitting…' : 'Submit'}
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
        progress and revealed hints are kept.
      </ConfirmDialog>
    </div>
  );
}

function ResizeHandle({ vertical = false }: { vertical?: boolean }) {
  return (
    <Separator
      className={`bg-line transition-colors duration-100 hover:bg-accent focus-visible:bg-accent data-[separator=active]:bg-accent ${
        vertical ? 'h-px' : 'w-px'
      }`}
    />
  );
}
