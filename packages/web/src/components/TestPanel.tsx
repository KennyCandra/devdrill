import { Check, Circle, EyeOff, X } from 'lucide-react';
import type { ConsoleLine, TestCaseResult, TestRunResult } from '@devdrill/shared';
import { Kbd, modKey, Spinner } from './ui';

export function TestPanel({
  result,
  running,
  error,
}: {
  result: TestRunResult | null;
  running: boolean;
  error: string | null;
}) {
  return (
    <section aria-label="Test results" className="flex h-full flex-col bg-bg">
      <header className="flex h-8 shrink-0 items-center gap-3 border-b border-line px-3">
        <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">Tests</span>
        {/* Only the summary is announced to screen readers, not every test. */}
        <span role="status" className="flex items-center gap-2">
          {running && (
            <span className="flex items-center gap-2 text-muted">
              <Spinner /> Running tests…
            </span>
          )}
          {!running && result && <Summary result={result} />}
        </span>
      </header>

      <div className="flex-1 overflow-auto px-3 py-2 font-mono text-[12px]">
        {error && <p className="text-danger">{error}</p>}

        {!error && !result && !running && (
          <p className="font-sans text-muted">
            Run the tests to see results. <Kbd>{modKey}</Kbd> <Kbd>Enter</Kbd>
          </p>
        )}

        {!running && result && <TestResultList result={result} />}
      </div>
    </section>
  );
}

/** Runner errors, files that couldn't load, then every test. */
export function TestResultList({ result }: { result: TestRunResult }) {
  return (
    <>
      {result.errorMessage && (
        <pre className="mb-2 whitespace-pre-wrap text-danger">{result.errorMessage}</pre>
      )}
      {result.logs && result.logs.length > 0 && (
        <div className="mb-2">
          <p className="font-sans text-[11px] text-muted">Printed outside a test</p>
          <ConsoleOutput lines={result.logs} />
        </div>
      )}
      {result.fileErrors.map((fe) => (
        <div key={fe.file} className="animate-fade-in mb-2">
          <p className="text-danger">
            <X size={12} className="inline" aria-hidden="true" /> {fe.file} could not run
          </p>
          <pre className="mt-1 ml-4 whitespace-pre-wrap text-muted">{fe.message}</pre>
        </div>
      ))}
      <ul className="flex flex-col gap-1">
        {sortForFixing(result.tests).map((t, i) => (
          <TestRow key={`${t.file}:${t.name}`} test={t} index={i} />
        ))}
      </ul>
    </>
  );
}

/** Visible failures first (the ones you can debug), then hidden failures, then the rest. */
export function sortForFixing(tests: TestCaseResult[]): TestCaseResult[] {
  const rank = (t: TestCaseResult) => (t.status !== 'failed' ? 2 : t.hidden ? 1 : 0);
  return [...tests].sort((a, b) => rank(a) - rank(b));
}

function Summary({ result }: { result: TestRunResult }) {
  if (result.status === 'timeout') return <span className="text-danger">Timed out</span>;
  if (result.status === 'error') return <span className="text-danger">Couldn't run tests</span>;
  return (
    <span className="flex items-center gap-3">
      <span className="text-success">{result.passed} passed</span>
      {result.failed > 0 && <span className="text-danger">{result.failed} failed</span>}
      <span className="text-muted">{(result.durationMs / 1000).toFixed(1)}s</span>
    </span>
  );
}

function TestRow({ test, index }: { test: TestCaseResult; index: number }) {
  const icon =
    test.status === 'passed' ? (
      <Check size={13} className="shrink-0 text-success" role="img" aria-label="Passed" />
    ) : test.status === 'failed' ? (
      <X size={13} className="shrink-0 text-danger" role="img" aria-label="Failed" />
    ) : (
      <Circle size={13} className="shrink-0 text-muted" role="img" aria-label="Skipped" />
    );

  return (
    <li className="animate-fade-in" style={{ animationDelay: `${Math.min(index, 20) * 15}ms` }}>
      <div className="flex items-center gap-2">
        {icon}
        <span className={test.status === 'failed' ? 'text-fg' : 'text-muted'}>{test.name}</span>
        {test.hidden && (
          <span className="flex items-center gap-1 text-[11px] text-muted">
            <EyeOff size={11} aria-hidden="true" /> hidden
          </span>
        )}
      </div>
      {test.logs && test.logs.length > 0 && (
        <div className="ml-5">
          <ConsoleOutput lines={test.logs} />
        </div>
      )}
      {test.message && (
        <pre className="mt-1 mb-1 ml-5 whitespace-pre-wrap text-danger">{test.message}</pre>
      )}
      {test.detailsHidden && (
        <p className="mt-0.5 mb-1 ml-5 font-sans text-[12px] text-muted">
          Details unlock when you solve the challenge.
        </p>
      )}
    </li>
  );
}

/** console.log / console.error output, like a terminal. */
function ConsoleOutput({ lines }: { lines: ConsoleLine[] }) {
  return (
    <pre
      aria-label="Console output"
      className="my-1 max-h-48 overflow-auto rounded-sm border-l-2 border-line-strong bg-side px-2 py-1 whitespace-pre-wrap"
    >
      {lines.map((line, i) => (
        <span key={i} className={`block ${line.stream === 'stderr' ? 'text-warning' : 'text-fg'}`}>
          {line.text}
        </span>
      ))}
    </pre>
  );
}
