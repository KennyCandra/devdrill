import { useEffect, useRef, useState } from 'react';
import type { Language, SolutionFile } from '@devdrill/shared';
import { api, ApiRequestError } from '../api/client';
import { Spinner } from '../components/ui';
import { editorThemeFor, languageFor, monaco } from '../editor/monacoSetup';
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
      fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
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
    monaco.editor.setTheme(editorThemeFor(theme));
  }, [theme]);

  if (error) return <p className="text-danger">Couldn't load the solution: {error}</p>;
  if (!files) return <Spinner className="subtle" />;

  const label = compare === 'yours' ? 'Your code' : 'Starter code';
  const identical = file && (compare === 'yours' ? file.yours : file.starter) === file.solution;

  return (
    <section aria-label="Reference solution" className="animate-fade-in flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="muted text-[13px]">Compare</span>
          <div className="seg" role="group" aria-label="Compare">
            {(['yours', 'starter'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={compare === value}
                onClick={() => setCompare(value)}
                className={`seg-item ${compare === value ? 'on' : ''}`}
              >
                {value === 'yours' ? 'Your code' : 'Starter'}
              </button>
            ))}
          </div>
          <span className="muted text-[13px]">with the reference</span>
        </div>
        <span className="tag tag-nit font-medium">Read only</span>
      </div>

      <div className="card overflow-hidden">
        <div className="flex overflow-x-auto border-b border-line bg-bar">
          {files.map((f, i) => (
            <button
              key={f.path}
              type="button"
              aria-pressed={i === selected}
              onClick={() => setSelected(i)}
              className={`ftab ${i === selected ? 'on' : ''}`}
            >
              {f.path}
            </button>
          ))}
        </div>

        {identical ? (
          <p className="muted p-4">
            {compare === 'yours'
              ? 'Your code matches the reference solution exactly.'
              : 'This file is the same in the starter and the solution.'}
          </p>
        ) : (
          <>
            <p className="subtle border-b border-line px-3 py-1.5 text-[12px]">
              {label}
              {compare === 'yours' && file?.yours === null && ' (you deleted this file)'}
            </p>
            <div ref={container} className="h-[360px] overflow-hidden" />
          </>
        )}
      </div>
    </section>
  );
}
