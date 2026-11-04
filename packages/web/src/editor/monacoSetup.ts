import { EXPRESS_DTS, TEST_GLOBALS_DTS } from '@devdrill/shared/testGlobals';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';
import type { ResolvedTheme } from '../theme';

// Monaco is bundled with the app (no CDN): it runs locally and must work offline.
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'typescript' || label === 'javascript') return new TsWorker();
    if (label === 'json') return new JsonWorker();
    return new EditorWorker();
  },
};

// Challenge code is plain JS without type info; semantic errors would only be noise.
monaco.typescript.javascriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: false,
});

// TypeScript challenges get real type checking, like in VS Code: errors are underlined
// but never stop the tests (they run with types stripped). Keep these in sync with
// typeCheck() in scripts/lib/validateChallenge.ts, so a valid starter shows no errors.
monaco.typescript.typescriptDefaults.setCompilerOptions({
  strict: true,
  target: monaco.typescript.ScriptTarget.ESNext,
  module: monaco.typescript.ModuleKind.ESNext,
  moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
  lib: ['esnext', 'dom'],
  noEmit: true,
  allowNonTsExtensions: true,
});
monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false,
  noSyntaxValidation: false,
});
// Imported files must be models for cross-file types; keep the worker in sync with all of them.
monaco.typescript.typescriptDefaults.setEagerModelSync(true);
monaco.typescript.typescriptDefaults.addExtraLib(TEST_GLOBALS_DTS, 'file:///__test-globals.d.ts');
// Workspaces have no node_modules, so Express challenges get its types from here.
monaco.typescript.typescriptDefaults.addExtraLib(EXPRESS_DTS, 'file:///__express.d.ts');
monaco.typescript.javascriptDefaults.addExtraLib(EXPRESS_DTS, 'file:///__express.d.ts');

// The two editor themes, from the design. The JavaScript and TypeScript tokenizer never emits
// `identifier.function`, so function names get the plain identifier colour.
monaco.editor.defineTheme('devdrill-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'd9dde5' },
    { token: 'comment', foreground: '737c8c', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c3a6ff' },
    { token: 'string', foreground: 'a6d99a' },
    { token: 'number', foreground: 'f5b871' },
    { token: 'type.identifier', foreground: '6fd3c7' },
    { token: 'delimiter', foreground: '9aa2b1' },
  ],
  colors: {
    'editor.background': '#111318',
    'editor.foreground': '#d9dde5',
    'editorLineNumber.foreground': '#5a6272',
    'editorLineNumber.activeForeground': '#c9ced8',
    'editor.lineHighlightBackground': '#171a21',
    'editor.selectionBackground': '#8c8aff40',
    'editorCursor.foreground': '#a3a1ff',
    'editorIndentGuide.background1': '#20242d',
    'diffEditor.insertedLineBackground': '#5fd08f1a',
    'diffEditor.insertedTextBackground': '#5fd08f33',
    'diffEditor.removedLineBackground': '#ff8a7a1a',
    'diffEditor.removedTextBackground': '#ff8a7a33',
    'scrollbarSlider.background': '#ffffff14',
  },
});

monaco.editor.defineTheme('devdrill-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: '', foreground: '1f232b' },
    { token: 'comment', foreground: '7a808b', fontStyle: 'italic' },
    { token: 'keyword', foreground: '6a3ccf' },
    { token: 'string', foreground: '2c7a3a' },
    { token: 'number', foreground: '9a5200' },
    { token: 'type.identifier', foreground: '0b7363' },
    { token: 'delimiter', foreground: '5d6370' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1f232b',
    'editorLineNumber.foreground': '#9aa0aa',
    'editorLineNumber.activeForeground': '#2a2e36',
    'editor.lineHighlightBackground': '#f6f6f3',
    'editor.selectionBackground': '#4b46d62e',
    'editorCursor.foreground': '#4b46d6',
    'editorIndentGuide.background1': '#ecece6',
    'diffEditor.insertedLineBackground': '#1d734114',
    'diffEditor.insertedTextBackground': '#1d734124',
    'diffEditor.removedLineBackground': '#b3261e12',
    'diffEditor.removedTextBackground': '#b3261e24',
    'scrollbarSlider.background': '#16181d1a',
  },
});

/** The Monaco theme for the app's resolved light or dark theme. */
export function editorThemeFor(theme: ResolvedTheme): string {
  return theme === 'dark' ? 'devdrill-dark' : 'devdrill-light';
}

export { monaco };

export function languageFor(path: string): string {
  if (/\.[cm]?js$/.test(path)) return 'javascript';
  if (/\.[cm]?ts$/.test(path)) return 'typescript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.md')) return 'markdown';
  return 'plaintext';
}
