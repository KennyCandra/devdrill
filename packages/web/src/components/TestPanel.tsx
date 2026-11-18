import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  EyeOff,
  Timer,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useState, type Ref } from 'react';
import type { ConsoleLine, TestCaseResult, TestRunResult } from '@devdrill/shared';
import { Button, Kbd, modKey, Spinner } from './ui';

export function TestPanel({
  result,
  running,
  error,
  onHide,
  hideRef,
}: {
  result: TestRunResult | null;
  running: boolean;
  error: string | null;
  /** Shows the hide button, when the panel can be folded. */
  onHide?: () => void;
  hideRef?: Ref<HTMLButtonElement>;
}) {
  const [view, setView] = useState<'results' | 'console'>('results');
  // The Console switch is there after every run: an empty console is a clue too.
  const consoleLines = result ? consoleLineCount(result) : 0;
  const onConsole = view === 'console';

  return (
    <section aria-label="Test results" className="panel flex h-full flex-col">
      <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-line px-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="panel-title">Tests</span>
          {/* Only the summary is announced to screen readers, not every test. */}
          <span role="status" className="flex min-w-0 items-center gap-3 text-[13px]">
            {running && (
              <span className="muted flex items-center gap-2">
                <Spinner /> Running tests…
              </span>
            )}
            {!running && result && <RunSummary result={result} />}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!running && result && (
            <div className="seg shrink-0 p-[2px]" role="group" aria-label="Test output">
              <button
                type="button"
                aria-pressed={!onConsole}
                onClick={() => setView('results')}
                className={`seg-item h-6 ${onConsole ? '' : 'on'}`}
              >
                Results
              </button>
              <button
                type="button"
                aria-pressed={onConsole}
                onClick={() => setView('console')}
                className={`seg-item h-6 ${onConsole ? 'on' : ''}`}
              >
                Console {consoleLines > 0 && <span className="seg-count">{consoleLines}</span>}
              </button>
            </div>
          )}
          {onHide && (
            <Button
              ref={hideRef}
              variant="ghost"
              size="sm"
              onClick={onHide}
              aria-label="Hide tests panel"
              title={`Hide tests panel (${modKey} J)`}
              className="btn-icon"
            >
              <ChevronDown className="i i-sm" aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto py-1.5 font-mono text-[13px]">
        {error && <p className="px-4 py-2 text-danger">{error}</p>}

        {!error && !result && !running && (
          <p className="muted px-4 py-3 font-sans">
            Run the tests to see results. <Kbd>{modKey}</Kbd> <Kbd>Enter</Kbd>
          </p>
        )}

        {!running && result && !onConsole && (
          <>
            {isEveryVisibleTestPassing(result) && (
              <p className="animate-fade-in flex items-center gap-2 px-4 py-2 font-sans text-[14px]">
                <Check className="i i-sm ico-pass" aria-hidden="true" />
                Every visible test passes. Submit to run the hidden tests too.
              </p>
            )}
            <TestResultList result={result} showLogs={false} />
          </>
        )}

        {!running && result && onConsole && <ConsoleView result={result} />}
      </div>
    </section>
  );
}

/**
 * The Tests panel folded away: its title and last run summary, and a button to bring it back.
 * The whole bar is the target, so a click anywhere on it opens the panel.
 */
export function TestsBar({
  result,
  running,
  onShow,
  showRef,
}: {
  result: TestRunResult | null;
  running: boolean;
  onShow: () => void;
  showRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <div
      onClick={onShow}
      className="panel flex h-full cursor-pointer items-center justify-between gap-3 px-3 hover:bg-surface-hover"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="panel-title">Tests</span>
        <span className="flex min-w-0 items-center gap-3 text-[13px]">
          {running && (
            <span className="muted flex items-center gap-2">
              <Spinner /> Running tests…
            </span>
          )}
          {!running && result && <RunSummary result={result} />}
        </span>
      </div>
      {/* The click reaches the bar, so the button needs no handler of its own. */}
      <Button
        ref={showRef}
        variant="ghost"
        size="sm"
        aria-label="Show tests panel"
        title={`Show tests panel (${modKey} J)`}
        className="btn-icon shrink-0"
      >
        <ChevronUp className="i i-sm" aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Passed and failed counts with the duration, or why the run never got that far. */
export function RunSummary({ result }: { result: TestRunResult }) {
  if (result.status === 'timeout') {
    return (
      <span className="flex items-center gap-1.5 font-semibold text-warning">
        <Timer className="i i-sm" aria-hidden="true" />
        Timed out
      </span>
    );
  }
  if (result.status === 'error') {
    return (
      <span className="flex items-center gap-1.5 font-semibold text-danger">
        <TriangleAlert className="i i-sm" aria-hidden="true" />
        Couldn't run tests
      </span>
    );
  }
  return (
    <span className="flex items-center gap-3">
      <span className="flex items-center gap-1.5 font-medium text-success">
        <Check className="i i-sm" aria-hidden="true" />
        {result.passed} passed
      </span>
      {result.failed > 0 && (
        <span className="flex items-center gap-1.5 font-semibold text-danger">
          <X className="i i-sm" aria-hidden="true" />
          {result.failed} failed
        </span>
      )}
      <span className="mono subtle text-[12px]">{(result.durationMs / 1000).toFixed(1)} s</span>
    </span>
  );
}

/** Runner errors, files that couldn't load, then every test. Logs go inline unless shown elsewhere. */
export function TestResultList({
  result,
  showLogs = true,
}: {
  result: TestRunResult;
  /** Off when the console output has its own view. */
  showLogs?: boolean;
}) {
  return (
    <>
      {result.errorMessage && (
        <pre className="mx-4 my-2 whitespace-pre-wrap text-danger">{result.errorMessage}</pre>
      )}
      {showLogs && result.logs && result.logs.length > 0 && (
        <div className="mx-4 my-2">
          <p className="subtle font-sans text-[12px]">Printed outside a test</p>
          <ConsoleOutput lines={result.logs} />
        </div>
      )}
      {result.fileErrors.map((fe) => (
        <div key={fe.file} className="animate-fade-in trow">
          <X className="i i-sm ico-fail mt-0.5" aria-hidden="true" />
          <span className="trow-name">{fe.file} could not run</span>
          <pre className="trow-err">{fe.message}</pre>
        </div>
      ))}
      <ul>
        {sortForFixing(result.tests).map((t, i) => (
          <TestRow key={`${t.file}:${t.name}`} test={t} index={i} showLogs={showLogs} />
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

/** Every visible test ran and passed (the run itself has no errors). */
function isEveryVisibleTestPassing(result: TestRunResult): boolean {
  return result.status === 'passed' && result.failed === 0 && result.total > 0;
}

/** Lines printed outside tests plus lines printed inside each test. */
function consoleLineCount(result: TestRunResult): number {
  return (
    (result.logs?.length ?? 0) + result.tests.reduce((sum, t) => sum + (t.logs?.length ?? 0), 0)
  );
}

/** Everything the code printed: outside tests first, then each test's output under its name. */
function ConsoleView({ result }: { result: TestRunResult }) {
  const groups: { label: string; lines: ConsoleLine[] }[] = [];
  if (result.logs && result.logs.length > 0) {
    groups.push({ label: 'outside tests', lines: result.logs });
  }
  for (const t of result.tests) {
    if (t.logs && t.logs.length > 0) groups.push({ label: t.name, lines: t.logs });
  }
  if (groups.length === 0) {
    return (
      <p className="muted animate-fade-in px-4 py-3 font-sans">
        Nothing printed in this run. A console.log only prints if the code reaches it.
      </p>
    );
  }
  return (
    <div className="animate-fade-in flex flex-col gap-3 px-4 py-2">
      {groups.map((group, i) => (
        <div key={`${i}:${group.label}`} className="flex min-w-0 flex-col gap-1">
          <p className="subtle truncate text-[12px]">{group.label}</p>
          <ConsoleOutput lines={group.lines} />
        </div>
      ))}
    </div>
  );
}

function TestRow({
  test,
  index,
  showLogs,
}: {
  test: TestCaseResult;
  index: number;
  showLogs: boolean;
}) {
  const icon =
    test.status === 'passed' ? (
      <Check className="i ico-pass mt-0.5" role="img" aria-label="Passed" />
    ) : test.status === 'failed' ? (
      <X className="i ico-fail mt-0.5" role="img" aria-label="Failed" />
    ) : (
      <Circle className="i ico-skip mt-0.5" role="img" aria-label="Skipped" />
    );

  return (
    <li
      className={`trow animate-fade-in ${test.status === 'passed' ? 'trow-pass' : ''}`}
      style={{ animationDelay: `${Math.min(index, 20) * 15}ms` }}
    >
      {icon}
      <span className="trow-name flex flex-wrap items-center gap-2">
        {test.name}
        {test.hidden && (
          <span className="tag tag-hidden h-5">
            <EyeOff className="i" aria-hidden="true" />
            hidden
          </span>
        )}
      </span>
      {test.message && <pre className="trow-err">{test.message}</pre>}
      {test.rule && test.status === 'failed' && (
        <div className="trow-rule">
          <span className="flex gap-2">
            <BookOpen className="i i-sm subtle mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <span className="subtle">From the task: </span>“{test.rule}”
            </span>
          </span>
        </div>
      )}
      {test.detailsHidden && (
        <p className="subtle col-start-2 font-sans text-[12px]">
          Details unlock when you solve the challenge.
        </p>
      )}
      {showLogs && test.logs && test.logs.length > 0 && (
        <div className="col-start-2 min-w-0">
          <ConsoleOutput lines={test.logs} />
        </div>
      )}
    </li>
  );
}

/** console.log / console.error output, like a terminal. Errors are tinted as warnings. */
function ConsoleOutput({ lines }: { lines: ConsoleLine[] }) {
  return (
    <pre
      aria-label="Console output"
      className="max-h-48 overflow-auto rounded-md border border-line bg-bg px-3 py-2 whitespace-pre-wrap"
    >
      {lines.map((line, i) => (
        <span key={i} className={`block ${line.stream === 'stderr' ? 'text-warning' : 'text-fg'}`}>
          {line.text}
        </span>
      ))}
    </pre>
  );
}
