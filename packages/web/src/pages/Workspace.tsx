import Editor, { type OnMount } from '@monaco-editor/react';
import { ArrowLeft, Play, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { ChallengeDetail, TestRunResult } from '@bughunt/shared';
import { api, ApiRequestError } from '../api/client';
import { useResolvedTheme } from '../App';
import { FileTree } from '../components/FileTree';
import { TaskPanel } from '../components/TaskPanel';
import { TestPanel } from '../components/TestPanel';
import { TopBar } from '../components/TopBar';
import { Button, DifficultyBadge, Kbd, modKey, Spinner, StatusScreen } from '../components/ui';
import { languageFor, monaco } from '../editor/monacoSetup';
import { navigate } from '../router';

const AUTOSAVE_DELAY_MS = 600;

type SaveState = 'saved' | 'dirty' | 'saving' | 'conflict' | 'error';

interface Buffer {
  content: string;
  mtimeMs: number;
  state: SaveState;
}

export function Workspace({ id }: { id: string }) {
  const theme = useResolvedTheme();
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [buffers, setBuffers] = useState<Record<string, Buffer>>({});
  const [result, setResult] = useState<TestRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Latest buffers and pending autosave timers, for save/run callbacks.
  const buffersRef = useRef(buffers);
  useLayoutEffect(() => {
    buffersRef.current = buffers;
  });
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const updateBuffer = (path: string, patch: Partial<Buffer>) =>
    setBuffers((prev) => {
      const current = prev[path];
      return current ? { ...prev, [path]: { ...current, ...patch } } : prev;
    });

  const openFile = useCallback(
    async (path: string) => {
      setTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
      setActive(path);
      if (buffersRef.current[path]) return;
      try {
        const file = await api.readFile(id, path);
        setBuffers((prev) => ({
          ...prev,
          [path]: { content: file.content, mtimeMs: file.mtimeMs, state: 'saved' },
        }));
      } catch (err) {
        setRunError((err as Error).message);
      }
    },
    [id],
  );

  // Load the challenge and create its workspace on first visit.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.challenge(id), api.start(id)])
      .then(([detail, ws]) => {
        if (cancelled) return;
        setChallenge(detail);
        setFiles(ws.files);
        const first = ws.files.find((f) => f.startsWith('src/')) ?? ws.files[0];
        if (first) void openFile(first);
      })
      .catch((err: Error) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id, openFile]);

  const save = useCallback(
    async (path: string) => {
      clearTimeout(timers.current.get(path));
      timers.current.delete(path);
      const buf = buffersRef.current[path];
      if (!buf || buf.state === 'saved' || buf.state === 'conflict') return;

      updateBuffer(path, { state: 'saving' });
      try {
        const saved = await api.saveFile(id, path, {
          content: buf.content,
          baseMtimeMs: buf.mtimeMs,
        });
        // Only mark saved if nothing was typed while the request was in flight.
        setBuffers((prev) => {
          const current = prev[path];
          if (!current) return prev;
          const unchanged = current.content === buf.content;
          return {
            ...prev,
            [path]: { ...current, mtimeMs: saved.mtimeMs, state: unchanged ? 'saved' : 'dirty' },
          };
        });
      } catch (err) {
        const conflict = err instanceof ApiRequestError && err.status === 409;
        updateBuffer(path, { state: conflict ? 'conflict' : 'error' });
        if (!conflict) setRunError(`Couldn't save ${path}: ${(err as Error).message}`);
      }
    },
    [id],
  );

  const saveAll = useCallback(async () => {
    await Promise.all(
      Object.entries(buffersRef.current)
        .filter(([, b]) => b.state === 'dirty' || b.state === 'error')
        .map(([path]) => save(path)),
    );
  }, [save]);

  const onChange = (value: string | undefined) => {
    if (!active || value === undefined) return;
    const path = active;
    updateBuffer(path, { content: value, state: 'dirty' });
    clearTimeout(timers.current.get(path));
    timers.current.set(
      path,
      setTimeout(() => void save(path), AUTOSAVE_DELAY_MS),
    );
  };

  const reloadFromDisk = async (path: string) => {
    const file = await api.readFile(id, path);
    setBuffers((prev) => ({
      ...prev,
      [path]: { content: file.content, mtimeMs: file.mtimeMs, state: 'saved' },
    }));
  };

  const runTests = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setRunError(null);
    try {
      await saveAll();
      setResult(await api.run(id));
    } catch (err) {
      setRunError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }, [id, running, saveAll]);

  const reset = async () => {
    if (!window.confirm('Reset all files to the starting code? Your changes will be lost.')) return;
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    try {
      const ws = await api.reset(id);
      setFiles(ws.files);
      setBuffers({});
      setResult(null);
      setRunError(null);
      // Monaco keeps a model per path; drop them so the editor shows the starter code.
      for (const model of monaco.editor.getModels()) model.dispose();
      const keep = tabs.filter((t) => ws.files.includes(t));
      setTabs(keep);
      setActive(null);
      const next = keep[0] ?? ws.files.find((f) => f.startsWith('src/'));
      if (next) void openFile(next);
    } catch (err) {
      setRunError((err as Error).message);
    }
  };

  const closeTab = (path: string) => {
    void save(path);
    setTabs((prev) => {
      const next = prev.filter((t) => t !== path);
      if (active === path) setActive(next[next.length - 1] ?? null);
      return next;
    });
  };

  // Shortcuts outside the editor; inside it, Monaco commands handle them (see onMount).
  const shortcuts = useRef({ runTests, saveAll });
  useLayoutEffect(() => {
    shortcuts.current = { runTests, saveAll };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 's') {
        e.preventDefault();
        void shortcuts.current.saveAll();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void shortcuts.current.runTests();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onMount: OnMount = (editor) => {
    const { KeyMod, KeyCode } = monaco;
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, () => void shortcuts.current.saveAll());
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, () => void shortcuts.current.runTests());
  };

  // Save before the tab closes or the user navigates away.
  useEffect(() => () => void shortcuts.current.saveAll(), []);

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

  const activeBuffer = active ? buffers[active] : undefined;
  const dirtyPaths = new Set(
    Object.entries(buffers)
      .filter(([, b]) => b.state !== 'saved')
      .map(([p]) => p),
  );

  return (
    <div className="flex h-full flex-col">
      <TopBar>
        <span className="text-muted">/</span>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1 rounded px-1 text-muted hover:bg-hover hover:text-fg"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Challenges
        </button>
        <span className="text-muted">/</span>
        <h1 className="truncate">{challenge.title}</h1>
        <DifficultyBadge difficulty={challenge.difficulty} />
        <span className="text-muted capitalize">{challenge.mode}</span>
        <SaveIndicator buffers={buffers} />
      </TopBar>

      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel defaultSize="24" minSize={200}>
          <TaskPanel challenge={challenge} />
        </Panel>
        <ResizeHandle />
        <Panel defaultSize="16" minSize={140}>
          <FileTree
            files={files}
            activePath={active}
            dirtyPaths={dirtyPaths}
            onOpen={(p) => void openFile(p)}
          />
        </Panel>
        <ResizeHandle />
        <Panel minSize={300}>
          <Group orientation="vertical">
            <Panel minSize={120}>
              <div className="flex h-full flex-col">
                <EditorTabs
                  tabs={tabs}
                  active={active}
                  dirtyPaths={dirtyPaths}
                  onSelect={setActive}
                  onClose={closeTab}
                />
                {activeBuffer?.state === 'conflict' && active && (
                  <div className="flex items-center gap-3 border-b border-line bg-danger-bg px-3 py-1.5">
                    <span>{active} changed outside BugHunt.</span>
                    <Button onClick={() => void reloadFromDisk(active)}>Load their version</Button>
                  </div>
                )}
                <div className="min-h-0 flex-1">
                  {active && activeBuffer ? (
                    <Editor
                      path={active}
                      language={languageFor(active)}
                      value={activeBuffer.content}
                      onChange={onChange}
                      onMount={onMount}
                      theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                      loading={<Spinner className="m-4 text-muted" />}
                      options={{
                        fontFamily: "'JetBrains Mono Variable', monospace",
                        fontSize: 13,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        renderLineHighlight: 'line',
                        smoothScrolling: true,
                      }}
                    />
                  ) : (
                    <p className="p-4 text-muted">Pick a file on the left.</p>
                  )}
                </div>
              </div>
            </Panel>
            <ResizeHandle vertical />
            <Panel defaultSize="32" minSize={80}>
              <TestPanel result={result} running={running} error={runError} />
            </Panel>
          </Group>
        </Panel>
      </Group>

      <footer className="flex h-11 shrink-0 items-center gap-2 border-t border-line bg-bar px-3">
        <Button variant="ghost" onClick={() => void reset()}>
          <RotateCcw size={14} aria-hidden="true" /> Reset
        </Button>
        <span className="ml-auto flex items-center gap-1 text-muted">
          <Kbd>{modKey}</Kbd>
          <Kbd>Enter</Kbd>
        </span>
        <Button variant="primary" onClick={() => void runTests()} disabled={running}>
          {running ? <Spinner /> : <Play size={14} aria-hidden="true" />}
          Run tests
        </Button>
      </footer>
    </div>
  );
}

function ResizeHandle({ vertical = false }: { vertical?: boolean }) {
  return (
    <Separator
      className={`bg-line transition-colors duration-100 hover:bg-accent data-[separator=active]:bg-accent ${
        vertical ? 'h-px' : 'w-px'
      }`}
    />
  );
}

function EditorTabs({
  tabs,
  active,
  dirtyPaths,
  onSelect,
  onClose,
}: {
  tabs: string[];
  active: string | null;
  dirtyPaths: Set<string>;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Open files"
      className="flex h-8 shrink-0 overflow-x-auto bg-bar"
    >
      {tabs.map((path) => {
        const selected = path === active;
        return (
          <div
            key={path}
            className={`group flex items-center gap-1 border-r border-line pr-1 pl-3 font-mono text-[12px] ${
              selected ? 'bg-bg text-fg' : 'text-muted hover:bg-hover'
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(path)}
            >
              {path.split('/').pop()}
            </button>
            <button
              type="button"
              onClick={() => onClose(path)}
              aria-label={`Close ${path}`}
              className="flex size-5 items-center justify-center rounded hover:bg-active"
            >
              {dirtyPaths.has(path) ? (
                <span className="size-2 rounded-full bg-fg group-hover:hidden" />
              ) : null}
              <X
                size={12}
                className={dirtyPaths.has(path) ? 'hidden group-hover:block' : ''}
                aria-hidden="true"
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SaveIndicator({ buffers }: { buffers: Record<string, Buffer> }) {
  const states = Object.values(buffers).map((b) => b.state);
  let label = 'All changes saved';
  let tone = 'text-muted';
  if (states.includes('conflict')) {
    label = 'Conflict';
    tone = 'text-danger';
  } else if (states.includes('error')) {
    label = "Couldn't save";
    tone = 'text-danger';
  } else if (states.includes('saving') || states.includes('dirty')) {
    label = 'Saving…';
  }
  return (
    <span className={`ml-auto text-[12px] ${tone}`} aria-live="polite">
      {label}
    </span>
  );
}
