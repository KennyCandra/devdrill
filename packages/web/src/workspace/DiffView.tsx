import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { IssueType, LineRange, ReviewComment, ReviewFile } from '@devdrill/shared';
import { CATEGORY_LABELS } from '@devdrill/shared/review';
import { languageFor, monaco } from '../editor/monacoSetup';
import type { ResolvedTheme } from '../theme';
import { holdsFunction } from './functionText';

interface FileModels {
  original: monaco.editor.ITextModel;
  modified: monaco.editor.ITextModel;
}

/**
 * A pull request's changes, one file at a time, in Monaco's diff editor (read-only).
 * Comments show under their lines in the new code; selecting lines there is how a
 * comment starts. Models belong to this component and are disposed with it.
 */
export function DiffView({
  reviewId,
  files,
  activePath,
  comments,
  issueTypes,
  pending,
  focusedId,
  theme,
  onSelect,
  onCommentClick,
  clearSelection,
  onCommentShortcut,
  onAddComment,
  onModels,
}: {
  /** Unique per challenge and language, for model URIs. */
  reviewId: string;
  files: ReviewFile[];
  activePath: string;
  comments: ReviewComment[];
  issueTypes: IssueType[];
  /** Lines being commented on right now, highlighted. */
  pending: LineRange | null;
  focusedId: string | null;
  theme: ResolvedTheme;
  onSelect: (lines: LineRange | null) => void;
  onCommentClick: (id: string) => void;
  /** Changes when the parent wants the selection cleared (e.g. after commenting). */
  clearSelection?: number;
  /** Ctrl/Cmd+Enter in the new code: comment on the selection, without the mouse. */
  onCommentShortcut?: () => void;
  /** The + beside a line was clicked: comment on that line, or on the selection around it. */
  onAddComment?: (lines: LineRange) => void;
  /** The new-code model of each file, for "whole function". */
  onModels?: (models: Map<string, monaco.editor.ITextModel>) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneDiffEditor | null>(null);
  // A ref, not state: every effect that uses the models also depends on `files`, and
  // effects run in order, so they always see the models made for the current files.
  const models = useRef<Map<string, FileModels>>(new Map());
  const zoneIds = useRef<string[]>([]);
  /** Cleanups run in either order on unmount; a disposed editor must not be touched. */
  const editorDisposed = useRef(false);
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);

  const callbacks = useRef({ onSelect, onCommentClick, onCommentShortcut, onAddComment });
  useLayoutEffect(() => {
    callbacks.current = { onSelect, onCommentClick, onCommentShortcut, onAddComment };
  });

  // The editor, once.
  useEffect(() => {
    if (!container.current) return;
    const diff = monaco.editor.createDiffEditor(container.current, {
      readOnly: true,
      originalEditable: false,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontFamily: "'JetBrains Mono Variable', monospace",
      fontSize: 13,
      // Only the changed files are here, so imports can't resolve: errors would be noise.
      renderValidationDecorations: 'off',
      // Side by side when there's room, one column when the panel is narrow.
      useInlineViewWhenSpaceIsLimited: true,
      renderSideBySideInlineBreakpoint: 760,
      hideUnchangedRegions: { enabled: false },
      // Room for the + that starts a comment, like on GitHub.
      glyphMargin: true,
      // The diff editor's own gutter menu (revert arrows) sits where the + goes and would
      // take its clicks; nothing here can be reverted anyway.
      renderGutterMenu: false,
      renderMarginRevertIcon: false,
    });
    const modified = diff.getModifiedEditor();
    decorations.current = modified.createDecorationsCollection();
    // Selecting in the new code picks the lines to comment on. Clicking a line number
    // selects up to column 1 of the next line; that next line isn't meant.
    const selection = modified.onDidChangeCursorSelection(({ selection: s }) => {
      if (s.isEmpty()) {
        callbacks.current.onSelect(null);
        return;
      }
      const end =
        s.endColumn === 1 && s.endLineNumber > s.startLineNumber
          ? s.endLineNumber - 1
          : s.endLineNumber;
      callbacks.current.onSelect([s.startLineNumber, end]);
    });
    modified.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      callbacks.current.onCommentShortcut?.(),
    );

    // A + beside the line under the mouse; clicking it comments on that line, or on the
    // selected lines when it's inside the selection.
    const hover = modified.createDecorationsCollection();
    const showPlus = (line: number | null) =>
      hover.set(
        line === null
          ? []
          : [
              {
                range: new monaco.Range(line, 1, line, 1),
                options: {
                  glyphMarginClassName: 'review-add',
                  glyphMarginHoverMessage: { value: 'Comment on this line' },
                },
              },
            ],
      );
    const move = modified.onMouseMove((e) => showPlus(e.target.position?.lineNumber ?? null));
    const leave = modified.onMouseLeave(() => showPlus(null));
    const down = modified.onMouseDown((e) => {
      const line = e.target.position?.lineNumber;
      if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN || !line) return;
      const s = modified.getSelection();
      const end =
        s && s.endColumn === 1 && s.endLineNumber > s.startLineNumber
          ? s.endLineNumber - 1
          : s?.endLineNumber;
      const inSelection =
        s && !s.isEmpty() && end !== undefined && s.startLineNumber <= line && line <= end;
      callbacks.current.onAddComment?.(inSelection ? [s.startLineNumber, end] : [line, line]);
    });
    editorDisposed.current = false;
    setEditor(diff);
    return () => {
      selection.dispose();
      move.dispose();
      leave.dispose();
      down.dispose();
      diff.setModel(null);
      diff.dispose();
      editorDisposed.current = true;
    };
  }, []);

  // One pair of models per file.
  useEffect(() => {
    const next = new Map<string, FileModels>();
    for (const file of files) {
      const language = languageFor(file.path);
      const uri = (side: string) =>
        monaco.Uri.from({ scheme: 'file', path: `/review/${reviewId}/${side}/${file.path}` });
      next.set(file.path, {
        original: monaco.editor.createModel(file.base ?? '', language, uri('base')),
        modified: monaco.editor.createModel(file.head, language, uri('head')),
      });
    }
    models.current = next;
    onModels?.(new Map([...next].map(([path, m]) => [path, m.modified])));
    return () => {
      // Detach before disposing: an editor must never show a disposed model.
      if (
        editor &&
        !editorDisposed.current &&
        [...next.values()].some((m) => m.modified === editor.getModel()?.modified)
      ) {
        editor.setModel(null);
      }
      for (const m of next.values()) {
        m.original.dispose();
        m.modified.dispose();
      }
    };
    // onModels is a setter from the parent; reruns would recreate every model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, reviewId, editor]);

  // Show the active file.
  useEffect(() => {
    const pair = models.current.get(activePath);
    if (!editor || !pair) return;
    if (editor.getModel()?.modified !== pair.modified) {
      editor.setModel(pair);
      callbacks.current.onSelect(null);
    }
  }, [editor, files, activePath]);

  // Comments on this file: highlighted lines, and the comment itself underneath.
  useEffect(() => {
    if (!editor || !models.current.get(activePath)) return;
    const modified = editor.getModifiedEditor();
    const here = comments.filter((c) => c.file === activePath);

    decorations.current?.set([
      ...here.map((c) => ({
        range: new monaco.Range(c.lines[0], 1, c.lines[1], 1),
        options: {
          isWholeLine: true,
          className: c.id === focusedId ? 'review-range review-range-focused' : 'review-range',
          linesDecorationsClassName: 'review-range-gutter',
        },
      })),
      ...(pending
        ? [
            {
              range: new monaco.Range(pending[0], 1, pending[1], 1),
              options: { isWholeLine: true, className: 'review-range-pending' },
            },
          ]
        : []),
    ]);

    modified.changeViewZones((zones) => {
      for (const id of zoneIds.current) zones.removeZone(id);
      zoneIds.current = here.map((c) =>
        zones.addZone({
          afterLineNumber: c.lines[1],
          heightInLines: 2 + Math.min(3, Math.ceil(c.why.length / 90)),
          domNode: commentNode(c, issueTypes, c.id === focusedId, () =>
            callbacks.current.onCommentClick(c.id),
          ),
          suppressMouseDown: true,
        }),
      );
    });
  }, [editor, files, activePath, comments, issueTypes, pending, focusedId]);

  useEffect(() => {
    if (!editor || clearSelection === undefined || clearSelection === 0) return;
    const modified = editor.getModifiedEditor();
    const at = modified.getSelection()?.getStartPosition();
    if (at) modified.setSelection(monaco.Selection.fromPositions(at, at));
  }, [editor, clearSelection]);

  // Bring a focused comment into view.
  useEffect(() => {
    const comment = comments.find((c) => c.id === focusedId);
    if (!editor || !comment || comment.file !== activePath) return;
    editor.getModifiedEditor().revealLinesInCenterIfOutsideViewport(...comment.lines);
  }, [editor, focusedId, comments, activePath]);

  useEffect(() => {
    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
  }, [theme]);

  return <div ref={container} className="h-full w-full" />;
}

/** A comment shown inside the editor. Plain DOM (Monaco owns it); text only, no HTML. */
function commentNode(
  comment: ReviewComment,
  issueTypes: IssueType[],
  focused: boolean,
  onClick: () => void,
): HTMLElement {
  const type = issueTypes.find((t) => t.id === comment.type);
  const node = document.createElement('div');
  node.className = focused ? 'review-zone review-zone-focused' : 'review-zone';
  const head = document.createElement('div');
  head.className = 'review-zone-head';
  head.textContent = [
    type ? CATEGORY_LABELS[type.category] : null,
    type?.label ?? comment.type,
    lineLabel(comment.lines),
  ]
    .filter(Boolean)
    .join(' · ');
  const why = document.createElement('div');
  why.className = 'review-zone-why';
  why.textContent = comment.why;
  node.append(head, why);
  node.addEventListener('click', onClick);
  return node;
}

export function lineLabel([first, last]: LineRange): string {
  return first === last ? `line ${first}` : `lines ${first}–${last}`;
}

const FUNCTION_KINDS = new Set([
  'function',
  'local function',
  'method',
  'constructor',
  'getter',
  'setter',
]);
/** Variables and properties count when they hold a function (`const total = () => …`). */
const HOLDER_KINDS = new Set(['const', 'let', 'var', 'property']);

interface NavigationTree {
  text: string;
  kind: string;
  spans: { start: number; length: number }[];
  childItems?: NavigationTree[];
}

/**
 * The innermost function around `lines` in a file of the new code, using the editor's
 * TypeScript service (it reads JavaScript too). Null when the lines aren't in a function.
 */
export async function functionAround(
  model: monaco.editor.ITextModel,
  lines: LineRange,
): Promise<LineRange | null> {
  const language = model.getLanguageId();
  if (language !== 'typescript' && language !== 'javascript') return null;
  const getWorker =
    language === 'typescript'
      ? monaco.typescript.getTypeScriptWorker
      : monaco.typescript.getJavaScriptWorker;
  const worker = await (await getWorker())(model.uri);
  const tree = (await worker.getNavigationTree(model.uri.toString())) as NavigationTree | undefined;
  if (!tree || model.isDisposed()) return null;

  let best: LineRange | null = null;
  const visit = (node: NavigationTree) => {
    for (const span of node.spans) {
      const first = model.getPositionAt(span.start).lineNumber;
      const last = model.getPositionAt(span.start + span.length).lineNumber;
      const isFunction =
        FUNCTION_KINDS.has(node.kind) ||
        (HOLDER_KINDS.has(node.kind) &&
          holdsFunction(
            model.getValueInRange(
              monaco.Range.fromPositions(
                model.getPositionAt(span.start),
                model.getPositionAt(span.start + span.length),
              ),
            ),
          ));
      const contains = first <= lines[0] && lines[1] <= last;
      if (isFunction && contains && (!best || last - first < best[1] - best[0])) {
        best = [first, last];
      }
    }
    node.childItems?.forEach(visit);
  };
  visit(tree);
  return best;
}
