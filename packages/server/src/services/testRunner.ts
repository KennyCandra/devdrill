import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { realpath } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import type {
  ConsoleLine,
  TestCaseResult,
  TestCaseStatus,
  TestFileError,
  TestRunResult,
} from '@devdrill/shared';
import { appPaths } from '../config.js';
import { withTempDir } from './tempDirs.js';

export const DEFAULT_TIMEOUT_MS = 30_000;

/** Keep only the end of the runner's console output; tests can print a lot. */
const MAX_OUTPUT_CHARS = 64 * 1024;

/** Limits on console.log output shown to the user, so a log in a loop can't flood the UI. */
const MAX_LOG_ENTRIES = 300;
const MAX_LOG_ENTRY_CHARS = 2000;

export interface RunTestsOptions {
  timeoutMs?: number;
}

/** The subset of Vitest's JSON reporter output that we read. */
interface VitestJsonReport {
  testResults: {
    name: string;
    status: string;
    message?: string;
    assertionResults: {
      ancestorTitles: string[];
      title: string;
      status: string;
      duration?: number | null;
      failureMessages: string[];
    }[];
  }[];
}

interface SpawnOutcome {
  timedOut: boolean;
  exitCode: number | null;
  output: string;
}

const require = createRequire(import.meta.url);

/** Vitest runs that are still going, so they can be killed when the server stops. */
const liveRuns = new Set<ChildProcess>();

process.once('exit', killAllTestRuns);

/** Kills every running test process. Call it from the server's shutdown handler. */
export function killAllTestRuns(): void {
  for (const child of liveRuns) killTree(child);
  liveRuns.clear();
}

/** Path to Vitest's CLI script, run with `node` so it works the same on every OS. */
function vitestCliPath(): string {
  const pkgJsonPath = require.resolve('vitest/package.json');
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
    bin: string | Record<string, string>;
  };
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.vitest;
  if (!bin) throw new Error('Could not find the Vitest CLI.');
  return path.join(path.dirname(pkgJsonPath), bin);
}

/**
 * Runs every test in `dir` with the app's own Vitest.
 * `dir` needs no `node_modules`: tests use Vitest globals instead of imports.
 * Nothing is written into `dir`.
 */
const realpathNative = promisify(realpath.native);

export async function runTests(dir: string, options: RunTestsOptions = {}): Promise<TestRunResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = Date.now();

  return withTempDir('report', async (reportDir) => {
    const reportFile = path.join(reportDir, 'report.json');
    const consoleFile = path.join(reportDir, 'console.jsonl');
    // Run Vitest on the folder's real path, and make its paths relative to that same
    // path: otherwise symlinks (macOS /var -> /private/var) or Windows short names
    // (C:\Users\RUNNER~1) make the two differ, and every test file looks like ../../….
    const realDir = await realpathNative(dir);
    const outcome = await spawnVitest(realDir, reportFile, consoleFile, timeoutMs);
    const durationMs = Date.now() - started;
    const logs = await readConsoleLogs(consoleFile, realDir);

    if (outcome.timedOut) {
      return emptyResult(
        'timeout',
        durationMs,
        `Tests timed out after ${timeoutMs / 1000}s (infinite loop?)`,
        logs,
      );
    }

    let report: VitestJsonReport;
    try {
      report = JSON.parse(await readFile(reportFile, 'utf8')) as VitestJsonReport;
    } catch {
      return emptyResult(
        'error',
        durationMs,
        outputTail(outcome.output) || 'The test runner produced no results.',
        logs,
      );
    }

    return toRunResult(report, outcome, realDir, durationMs, logs);
  });
}

function spawnVitest(
  dir: string,
  reportFile: string,
  consoleFile: string,
  timeoutMs: number,
): Promise<SpawnOutcome> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        vitestCliPath(),
        'run',
        '--root',
        dir,
        // Always our own config, never one from the workspace.
        '--config',
        appPaths().vitestConfig,
        '--globals',
        '--reporter=json',
        `--reporter=${appPaths().consoleReporter}`,
        `--outputFile.json=${reportFile}`,
        // Caches would create node_modules/ inside the user's workspace.
        '--no-cache',
        '--no-fsModuleCache',
      ],
      {
        cwd: dir,
        env: {
          ...process.env,
          CI: '1',
          NO_COLOR: '1',
          FORCE_COLOR: '0',
          DEVDRILL_CONSOLE_FILE: consoleFile,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        // Own process group on POSIX so a timeout can kill Vitest's workers too.
        detached: process.platform !== 'win32',
        windowsHide: true,
      },
    );
    liveRuns.add(child);

    let output = '';
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > MAX_OUTPUT_CHARS) output = output.slice(-MAX_OUTPUT_CHARS);
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      liveRuns.delete(child);
      reject(err);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      liveRuns.delete(child);
      resolve({ timedOut, exitCode, output });
    });
  });
}

function killTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      windowsHide: true,
    });
    killer.on('error', () => child.kill());
    return;
  }
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

function toRunResult(
  report: VitestJsonReport,
  outcome: SpawnOutcome,
  dir: string,
  durationMs: number,
  logs: LogEntry[],
): TestRunResult {
  const tests: TestCaseResult[] = [];
  const fileErrors: TestFileError[] = [];

  for (const file of report.testResults) {
    const relFile = path.relative(dir, file.name).split(path.sep).join('/');

    // A file can fail outside any test: syntax error, throwing beforeAll/afterAll.
    const fileMessage = tidyMessage(file.message, dir);
    if (file.status === 'failed' && (fileMessage || file.assertionResults.length === 0)) {
      fileErrors.push({ file: relFile, message: fileMessage || 'Test file failed to load.' });
    }

    for (const t of file.assertionResults) {
      const message = t.failureMessages[0];
      tests.push({
        file: relFile,
        name: [...t.ancestorTitles, t.title].join(' > '),
        status: toCaseStatus(t.status),
        hidden: false,
        ...(message ? { message: tidyMessage(message, dir) } : {}),
        durationMs: Math.round(t.duration ?? 0),
      });
    }
  }

  // Each log goes under the test that printed it; the rest (e.g. printed while a file
  // loads) are listed for the whole run.
  const runLogs: (ConsoleLine & { file?: string })[] = [];
  for (const { file, test, ...line } of logs) {
    const owner = test ? tests.find((t) => t.file === file && t.name === test) : undefined;
    if (owner) (owner.logs ??= []).push(line);
    else runLogs.push({ ...line, ...(file ? { file } : {}) });
  }

  const passed = tests.filter((t) => t.status === 'passed').length;
  const failed = tests.filter((t) => t.status === 'failed').length;

  let errorMessage: string | undefined;
  if (tests.length === 0 && fileErrors.length === 0) {
    errorMessage = 'No tests found.';
  } else if (passed === 0 && failed === 0 && fileErrors.length === 0) {
    errorMessage = 'Every test was skipped.';
  } else if (outcome.exitCode !== 0 && failed === 0 && fileErrors.length === 0) {
    // E.g. an error thrown from a timer after the tests finished.
    errorMessage = outputTail(outcome.output) || `Tests exited with code ${outcome.exitCode}.`;
  }

  const ok = failed === 0 && fileErrors.length === 0 && errorMessage === undefined;

  return {
    status: ok ? 'passed' : 'failed',
    passed,
    failed,
    total: tests.length,
    tests,
    fileErrors,
    ...(errorMessage ? { errorMessage } : {}),
    ...(runLogs.length > 0 ? { logs: runLogs } : {}),
    durationMs,
  };
}

interface LogEntry extends ConsoleLine {
  /** Test file relative to the run folder, if known. */
  file?: string;
  /** "describe > test" name, for logs printed inside a test. */
  test?: string;
}

/** Reads what console-reporter.mjs saved, with paths made relative and size limits applied. */
async function readConsoleLogs(consoleFile: string, dir: string): Promise<LogEntry[]> {
  let text: string;
  try {
    text = await readFile(consoleFile, 'utf8');
  } catch {
    return []; // nothing was logged
  }
  const entries: LogEntry[] = [];
  const lines = text.split('\n').filter(Boolean);
  for (const raw of lines.slice(0, MAX_LOG_ENTRIES)) {
    try {
      const e = JSON.parse(raw) as { stream?: string; text?: string; file?: string; test?: string };
      let body = clean(e.text).replace(/\n$/, '');
      if (body.length > MAX_LOG_ENTRY_CHARS) body = `${body.slice(0, MAX_LOG_ENTRY_CHARS)}…`;
      entries.push({
        stream: e.stream === 'stderr' ? 'stderr' : 'stdout',
        text: body,
        ...(e.file ? { file: path.relative(dir, e.file).split(path.sep).join('/') } : {}),
        ...(e.test ? { test: e.test } : {}),
      });
    } catch {
      // A line cut off when the run was killed; skip it.
    }
  }
  if (lines.length > MAX_LOG_ENTRIES) {
    entries.push({
      stream: 'stderr',
      text: `… ${lines.length - MAX_LOG_ENTRIES} more console messages not shown`,
    });
  }
  return entries;
}

function toCaseStatus(status: string): TestCaseStatus {
  if (status === 'passed') return 'passed';
  if (status === 'failed') return 'failed';
  return 'skipped';
}

/**
 * Makes a failure message readable in the UI: paths relative to the run folder,
 * and no stack frames from Vitest or Node internals.
 */
function tidyMessage(message: string | undefined, dir: string): string {
  const prefixes = [dir + path.sep, `file://${dir}${path.sep}`];
  return (
    clean(message)
      .split('\n')
      .filter((line) => !/^\s*at .*(node_modules|node:internal|file:\/\/|<anonymous>)/.test(line))
      // Vite adds this to every parse error; challenges never use JSX.
      .filter((line) => !line.includes('If you are using JSX'))
      .map((line) => prefixes.reduce((l, prefix) => l.split(prefix).join(''), line))
      .join('\n')
  );
}

function clean(message: string | undefined): string {
  return stripVTControlCharacters(message ?? '').trim();
}

function outputTail(output: string): string {
  const lines = clean(output).split('\n');
  return lines.slice(-30).join('\n');
}

function emptyResult(
  status: 'timeout' | 'error',
  durationMs: number,
  errorMessage: string,
  logs: LogEntry[],
): TestRunResult {
  return {
    status,
    passed: 0,
    failed: 0,
    total: 0,
    tests: [],
    fileErrors: [],
    errorMessage,
    ...(logs.length > 0 ? { logs: logs.map(({ test: _test, ...line }) => line) } : {}),
    durationMs,
  };
}
