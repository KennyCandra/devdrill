import { useEffect, useRef, useState } from 'react';
import type { FileContent } from '@devdrill/shared';
import { api } from '../api/client';
import { Spinner } from '../components/ui';
import { languageFor, monaco } from '../editor/monacoSetup';
import { useResolvedTheme } from '../theme';

const LINE_HEIGHT = 18;
const MAX_HEIGHT = 480;

/** The hidden test files, read-only. The server only sends them once the challenge is solved. */
export function HiddenTestsView({ id }: { id: string }) {
  const theme = useResolvedTheme();
  const [files, setFiles] = useState<FileContent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .hiddenTests(id)
      .then((loaded) => !cancelled && setFiles(loaded))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const file = files?.[selected];

  useEffect(() => {
    if (!container.current || !file) return;
    const model = monaco.editor.createModel(file.content, languageFor(file.path));
    const editor = monaco.editor.create(container.current, {
      model,
      readOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontFamily: "'JetBrains Mono Variable', monospace",
      fontSize: 12,
      lineHeight: LINE_HEIGHT,
    });
    return () => {
      editor.dispose();
      model.dispose();
    };
  }, [file]);

  useEffect(() => {
    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
  }, [theme]);

  if (error) return <p className="text-danger">Couldn't load the hidden tests: {error}</p>;
  if (!files || !file) return <Spinner className="text-muted" />;

  const height = Math.min(MAX_HEIGHT, (file.content.split('\n').length + 1) * LINE_HEIGHT);

  return (
    <section aria-label="Hidden tests" className="animate-fade-in flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {files.map((f, i) => (
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
      </div>
      <div
        ref={container}
        style={{ height }}
        className="overflow-hidden rounded border border-line"
      />
    </section>
  );
}
