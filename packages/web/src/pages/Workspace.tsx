import { ArrowLeft, Play, RotateCcw, Send, TriangleAlert } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  type LayoutStorage,
} from 'react-resizable-panels';
import type { ChallengeDetail, Language, TestRunResult } from '@devdrill/shared';
import { api } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { FileTree } from '../components/FileTree';
import { ReadmeTab } from '../components/ReadmeTab';
import { TestPanel, TestsBar } from '../components/TestPanel';
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

/** Whether the Tests panel is hidden, remembered like the panel sizes. */
export const TESTS_HIDDEN_KEY = 'devdrill-tests-hidden';

/**
 * The challenge README: a tab and a file-tree entry, but not a file on disk. It is never
 * read, saved or sent to the server, so it never goes through FileStore.
 */
export const README_PATH = 'README.md';

/** The file to open first: the first source file, else the first file. */
function defaultFile(files: string[]): string | undefined {
  return files.find((f) => f.startsWith('src/')) ?? files[0];
}

/**
 * The files the editor needs along with `open`. TypeScript checks imports across files,
 * so every .ts file needs to be in the editor (not opened as a tab) for its types to be known.
 */
function editorFiles(files: string[], lang: Language, open: string[]): string[] {
  return lang === 'ts' ? [...new Set([...open, ...files.filter(isTsFile)])] : open;
}

function isTsFile(path: string): boolean {
  return path.endsWith('.ts');
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
  // The layout ids changed when the task column went: sizes saved for the old panels are not reused.
  const columns = useDefaultLayout({ id: 'devdrill-files-columns', storage: layoutStorage });
  const [timer] = useState(() => new ActiveTimer(id, lang));
  useEffect(() => {
    timer.start();
    return () => timer.stop();
  }, [timer]);

  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  // The panels are only on screen once the challenge has loaded.
  const testsArea = useRef<HTMLDivElement>(null);
  const tests = useTestsFold(testsArea);
  const { reveal: revealTests } = tests;
  // Each set of panels keeps its own sizes: the editor alone, and the editor with the tests.
  const rows = useDefaultLayout({
    id: tests.hidden ? 'devdrill-editor-rows-folded' : 'devdrill-editor-rows',
    storage: layoutStorage,
  });
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

  const showFile = useCallback((path: string) => {
    setTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActive(path);
  }, []);

  const openFile = useCallback(
    (path: string) => {
      showFile(path);
      if (path === README_PATH) return; // nothing on disk to load
      store.load(path).catch((err: Error) => setMessage(`Couldn't open ${path}: ${err.message}`));
    },
    [showFile, store],
  );

  // Load the challenge and create its workspace on first visit. The README is the tab shown;
  // the code file that opens today is a second tab.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.challenge(id, lang), api.start(id, lang)])
      .then(([detail, ws]) => {
        if (cancelled) return;
        setChallenge(detail);
        setFiles(ws.files);
        const first = defaultFile(ws.files);
        setTabs(first ? [README_PATH, first] : [README_PATH]);
        setActive(README_PATH);
        return store.loadAll(editorFiles(ws.files, lang, first ? [first] : []));
      })
      .catch((err: Error) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id, lang, store]);

  const runTests = useCallback(async () => {
    if (busy) return;
    revealTests(); // a run is for reading, so the panel opens if it was folded
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
  }, [id, lang, busy, store, revealTests]);

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
    revealTests();
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
  }, [id, lang, busy, store, timer, revealTests]);

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
      const keep = tabs.filter((t) => t === README_PATH || ws.files.includes(t));
      const next = active && keep.includes(active) ? active : (keep[0] ?? defaultFile(ws.files));
      const open = next && !keep.includes(next) ? [...keep, next] : keep;
      setTabs(open);
      setActive(next ?? null);
      await store.loadAll(
        editorFiles(
          ws.files,
          lang,
          open.filter((t) => t !== README_PATH),
        ),
      );
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const closeTab = (path: string) => {
    const remaining = tabs.filter((t) => t !== path);
    setTabs(remaining);
    if (active === path) setActive(remaining[remaining.length - 1] ?? null);
    // A closed .ts file stays in the editor: other files may still import its types.
    if (path !== README_PATH && (lang !== 'ts' || !isTsFile(path))) void store.close(path);
  };

  // Keyboard shortcuts outside the editor (CodeEditor handles them inside).
  // While the reset dialog is open, Run and Submit shortcuts do nothing.
  const actions = () => ({
    runTests: confirmReset ? () => Promise.resolve() : runTests,
    submit: confirmReset ? () => Promise.resolve() : submit,
    save: () => store.flush(),
    toggleTests: () => tests.toggle(),
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
      } else if (e.key === 'j') {
        e.preventDefault();
        shortcuts.current.toggleTests();
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
        <Panel id="files" defaultSize="16" minSize={120} maxSize={360}>
          <FileTree
            files={files}
            virtualFiles={[README_PATH]}
            activePath={active}
            unsaved={unsaved}
            onOpen={openFile}
          />
        </Panel>
        <ResizeHandle />
        <Panel id="main" minSize={280}>
          <div className="flex h-full flex-col">
            <Group
              orientation="vertical"
              className="min-h-0 flex-1"
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
                  <div className="flex min-h-0 flex-1 flex-col">
                    {/* Hidden, not unmounted, when another tab is shown: the hints keep their state. */}
                    <div hidden={active !== README_PATH} className="min-h-0 flex-1 overflow-auto">
                      <ReadmeTab
                        challenge={challenge}
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
                    {/* Monaco keeps its models while hidden; the README is never one of them. */}
                    <div hidden={active === README_PATH} className="min-h-0 flex-1">
                      <CodeEditor
                        workspaceId={`${lang}/${id}`}
                        activePath={active === README_PATH ? null : active}
                        buffers={buffers}
                        theme={theme}
                        onEdit={(path, content) => store.edit(path, content)}
                        onSaveShortcut={() => void store.flush()}
                        onRunShortcut={() => void shortcuts.current.runTests()}
                        onSubmitShortcut={() => void shortcuts.current.submit()}
                        onTestsShortcut={() => shortcuts.current.toggleTests()}
                      />
                    </div>
                  </div>
                </div>
              </Panel>
              {!tests.hidden && <ResizeHandle vertical />}
              {!tests.hidden && (
                <Panel id="tests" defaultSize="32" minSize={80}>
                  <div ref={testsArea} className="h-full">
                    <TestPanel
                      result={result}
                      running={busy}
                      error={message}
                      onHide={() => tests.hide(true)}
                      hideRef={tests.hideRef}
                    />
                  </div>
                </Panel>
              )}
            </Group>
            {/* Hidden, the bar stands below the editor, outside the layout. */}
            {tests.hidden && (
              <div ref={testsArea} className="h-10 shrink-0">
                <TestsBar
                  result={result}
                  running={busy}
                  onShow={() => tests.show(true)}
                  showRef={tests.showRef}
                />
              </div>
            )}
          </div>
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

/**
 * The Tests panel is shown or hidden as one choice, remembered like the panel sizes. Hidden, the
 * panel leaves the layout and a bar takes its place. A click on either toggle moves focus to the
 * toggle still on screen, since the one pressed is gone. A shortcut moves focus only from inside
 * the tests area, so typing in the editor stays there.
 */
function useTestsFold(area: RefObject<HTMLDivElement | null>) {
  const [hidden, setHidden] = useState(() => layoutStorage.getItem(TESTS_HIDDEN_KEY) === 'true');
  const showRef = useRef<HTMLButtonElement>(null);
  const hideRef = useRef<HTMLButtonElement>(null);
  // Set before the choice changes, and read once it has rendered.
  const focusNext = useRef<'show' | 'hide' | null>(null);

  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === 'show') showRef.current?.focus();
    else if (target === 'hide') hideRef.current?.focus();
  }, [hidden]);

  useEffect(() => {
    layoutStorage.setItem(TESTS_HIDDEN_KEY, String(hidden));
  }, [hidden]);

  const focusInside = () => area.current?.contains(document.activeElement) ?? false;

  const hide = (fromClick = false) => {
    if (hidden) return;
    if (fromClick || focusInside()) focusNext.current = 'show';
    setHidden(true);
  };
  const show = (fromClick = false) => {
    if (!hidden) return;
    if (fromClick || focusInside()) focusNext.current = 'hide';
    setHidden(false);
  };
  const toggle = () => (hidden ? show() : hide());
  // A run or submit opens the panel, so its results can be read.
  const reveal = useCallback(() => setHidden(false), []);

  return { hidden, showRef, hideRef, hide, show, toggle, reveal };
}
