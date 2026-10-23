import { TEST_GLOBALS_DTS } from '@devdrill/shared/testGlobals';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';

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
// but never stop the tests (they run with types stripped). Same settings as the
// challenge validator's check, so a valid starter shows no errors.
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

export { monaco };

export function languageFor(path: string): string {
  if (/\.[cm]?js$/.test(path)) return 'javascript';
  if (/\.[cm]?ts$/.test(path)) return 'typescript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.md')) return 'markdown';
  return 'plaintext';
}
