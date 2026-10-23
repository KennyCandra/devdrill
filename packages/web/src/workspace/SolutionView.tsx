import { useEffect, useRef, useState } from 'react';
import type { Language, SolutionFile } from '@devdrill/shared';
import { api, ApiRequestError } from '../api/client';
import { Spinner } from '../components/ui';
import { languageFor, monaco } from '../editor/monacoSetup';
import { useResolvedTheme } from '../theme';

type Compare = 'yours' | 'starter';

interface FileVersions extends SolutionFile {
  /** The user's current file; null if they deleted it. */
  yours: string | null;
}

/** The reference solution as a read-only diff against the user's code or the starter code. */
export function SolutionView({ id, lang }: { id: string; lang: Language }) {
  const theme = useResolvedTheme();
  const [files, setFiles] = useState<FileVersions[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [compare, setCompare] = useState<Compare>('yours');
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .solution(id, lang)
      .then((solution) =>
        Promise.all(
          solution.map(async (file) => ({
            ...file,
            yours: await api
              .readFile(id, file.path)
              .then((f) => f.content)
              .catch((err: unknown) => {
                if (err instanceof ApiRequestError && err.status === 404) return null;
                throw err;
              }),
          })),
        ),
      )
      .then((loaded) => !cancelled && setFiles(loaded))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id, lang]);

  const file = files?.[selected];

  useEffect(() => {
    if (!container.current || !file) return;
    const before = compare === 'yours' ? file.yours : file.starter;
    const language = languageFor(file.path);
    const original = monaco.editor.createModel(before ?? '', language);
    const modified = monaco.editor.createModel(file.solution, language);
    const diff = monaco.editor.createDiffEditor(container.current, {
      readOnly: true,
      // Shown on its own, a file can't see the rest of the project: type errors would be noise.
      renderValidationDecorations: 'off',
      originalEditable: false,
      automaticLayout: true,
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: false,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontFamily: "'JetBrains Mono Variable', monospace",
      fontSize: 12,
    });
    diff.setModel({ original, modified });
    return () => {
      diff.dispose();
      original.dispose();
      modified.dispose();
    };
  }, [file, compare]);

  useEffect(() => {
    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
  }, [theme]);

  if (error) return <p className="text-danger">Couldn't load the solution: {error}</p>;
  if (!files) return <Spinner className="text-muted" />;

  const label = compare === 'yours' ? 'Your code' : 'Starter code';

  return (
    <section aria-label="Reference solution" className="animate-fade-in flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {files.length > 1 &&
          files.map((f, i) => (
            <button
              key={f.path}
              type="button"
              aria-pressed={i === selected}
              onClick={() => setSelected(i)}
              className={`rounded px-2 py-1 font-mono text-[12px] focus-visible:outline-2 focus-visible:outline-accent ${
                i === selected ? 'bg-active' : 'text-muted hover:bg-hover'
              }`}
            >
              {f.path}
            </button>
          ))}
        {files.length === 1 && <span className="font-mono text-[12px]">{file?.path}</span>}

        <div role="group" aria-label="Compare" className="ml-auto flex rounded border border-line">
          {(['yours', 'starter'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={compare === value}
              onClick={() => setCompare(value)}
              className={`px-2 py-1 text-[12px] focus-visible:outline-2 focus-visible:outline-accent ${
                compare === value ? 'bg-active' : 'text-muted hover:bg-hover'
              }`}
            >
              {value === 'yours' ? 'Your code' : 'Starter'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between px-1 text-[11px] text-muted">
        <span>
          {label}
          {compare === 'yours' && file?.yours === null && ' (you deleted this file)'}
        </span>
        <span>Reference solution</span>
      </div>
      {file && (compare === 'yours' ? file.yours : file.starter) === file.solution ? (
        <p className="rounded border border-line p-3 text-muted">
          {compare === 'yours'
            ? 'Your code matches the reference solution exactly.'
            : 'This file is the same in the starter and the solution.'}
        </p>
      ) : (
        <div ref={container} className="h-[360px] overflow-hidden rounded border border-line" />
      )}
    </section>
  );
}
