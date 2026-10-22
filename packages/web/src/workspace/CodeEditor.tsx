import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Spinner } from '../components/ui';
import { languageFor, monaco } from '../editor/monacoSetup';
import type { ResolvedTheme } from '../theme';
import type { FileBuffer } from './fileStore';

interface ModelEntry {
  model: monaco.editor.ITextModel;
  diskRevision: number;
  listener: monaco.IDisposable;
}

/**
 * Monaco, with one model per open file of this workspace. The models belong to this
 * component and are disposed with it, so another challenge never sees them. Content
 * from disk (load, "load their version") is pushed in by `diskRevision`; the user's
 * typing goes out through `onEdit`.
 */
export function CodeEditor({
  workspaceId,
  activePath,
  buffers,
  theme,
  onEdit,
  onSaveShortcut,
  onRunShortcut,
}: {
  workspaceId: string;
  activePath: string | null;
  buffers: Record<string, FileBuffer>;
  theme: ResolvedTheme;
  onEdit: (path: string, content: string) => void;
  onSaveShortcut: () => void;
  onRunShortcut: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const models = useRef(new Map<string, ModelEntry>());
  const viewStates = useRef(new Map<string, monaco.editor.ICodeEditorViewState | null>());
  const shownPath = useRef<string | null>(null);
  const applyingDisk = useRef(false);

  const callbacks = useRef({ onEdit, onSaveShortcut, onRunShortcut });
  useLayoutEffect(() => {
    callbacks.current = { onEdit, onSaveShortcut, onRunShortcut };
  });

  // Create the editor once.
  useEffect(() => {
    if (!container.current) return;
    const instance = monaco.editor.create(container.current, {
      model: null,
      fontFamily: "'JetBrains Mono Variable', monospace",
      fontSize: 13,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      smoothScrolling: true,
    });
    const { KeyMod, KeyCode } = monaco;
    instance.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, () => callbacks.current.onSaveShortcut());
    instance.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, () => callbacks.current.onRunShortcut());
    setEditor(instance);

    const owned = models.current;
    return () => {
      instance.dispose();
      for (const entry of owned.values()) {
        entry.listener.dispose();
        entry.model.dispose();
      }
      owned.clear();
      shownPath.current = null;
    };
  }, []);

  useEffect(() => {
    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
  }, [theme]);

  // Keep one model per open buffer; apply content that came from disk.
  useEffect(() => {
    for (const [path, buf] of Object.entries(buffers)) {
      const entry = models.current.get(path);
      if (!entry) {
        const uri = monaco.Uri.from({ scheme: 'bughunt', path: `/${workspaceId}/${path}` });
        const model = monaco.editor.createModel(buf.content, languageFor(path), uri);
        const listener = model.onDidChangeContent(() => {
          if (!applyingDisk.current) callbacks.current.onEdit(path, model.getValue());
        });
        models.current.set(path, { model, diskRevision: buf.diskRevision, listener });
      } else if (entry.diskRevision !== buf.diskRevision) {
        applyingDisk.current = true;
        entry.model.setValue(buf.content);
        applyingDisk.current = false;
        entry.diskRevision = buf.diskRevision;
      }
    }
    for (const [path, entry] of models.current) {
      if (path in buffers) continue;
      if (editor?.getModel() === entry.model) {
        editor.setModel(null);
        shownPath.current = null;
      }
      entry.listener.dispose();
      entry.model.dispose();
      models.current.delete(path);
      viewStates.current.delete(path);
    }
  }, [buffers, editor, workspaceId]);

  // Show the active file, keeping scroll and cursor per file. Runs after the model
  // effect above, so a file that just loaded already has its model.
  useEffect(() => {
    const entry = activePath ? models.current.get(activePath) : undefined;
    if (!editor || !activePath || !entry || shownPath.current === activePath) return;
    if (shownPath.current) viewStates.current.set(shownPath.current, editor.saveViewState());
    editor.setModel(entry.model);
    const saved = viewStates.current.get(activePath);
    if (saved) editor.restoreViewState(saved);
    shownPath.current = activePath;
  }, [editor, activePath, buffers]);

  const loading = activePath !== null && !(activePath in buffers);

  return (
    <div className="relative h-full">
      <div ref={container} className="h-full" />
      {activePath === null && (
        <p className="absolute inset-0 bg-bg p-4 text-muted">Pick a file on the left.</p>
      )}
      {loading && (
        <div className="absolute inset-0 flex items-start bg-bg/60 p-4">
          <Spinner className="text-muted" />
        </div>
      )}
    </div>
  );
}
