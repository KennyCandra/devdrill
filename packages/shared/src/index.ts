// Types only: this package is never imported at runtime.
// Always use `import type` from it.

export type ChallengeMode = 'debug' | 'feature';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type ChallengeStatus = 'not_started' | 'in_progress' | 'solved';

/** Shape of a challenge's `challenge.json`. */
export interface ChallengeMeta {
  id: string;
  mode: ChallengeMode;
  title: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  tags: string[];
  hints: string[];
}

export type TestCaseStatus = 'passed' | 'failed' | 'skipped';

export interface TestCaseResult {
  /** Test file path relative to the run folder, always with `/` separators. */
  file: string;
  /** Describe blocks and test title joined, e.g. "cart total > applies coupon". */
  name: string;
  status: TestCaseStatus;
  /** True for hidden tests, which only run on Submit. */
  hidden: boolean;
  /** A failing hidden test whose message is withheld until the challenge is solved. */
  detailsHidden?: boolean;
  /** First failure message, without terminal colors. */
  message?: string;
  durationMs: number;
}

/** A test file that could not run at all, e.g. a syntax error. */
export interface TestFileError {
  file: string;
  message: string;
}

/**
 * - `passed`: every test passed.
 * - `failed`: at least one test failed or a test file could not load.
 * - `timeout`: the run was killed after the time limit.
 * - `error`: the runner itself failed and produced no results.
 */
export type TestRunStatus = 'passed' | 'failed' | 'timeout' | 'error';

export interface TestRunResult {
  status: TestRunStatus;
  passed: number;
  failed: number;
  total: number;
  tests: TestCaseResult[];
  fileErrors: TestFileError[];
  /** Why the run did not pass when no single test explains it (timeout, crash, all skipped). */
  errorMessage?: string;
  durationMs: number;
}

// ---- API ----

/** Every error response from the server has this shape. */
export interface ApiError {
  error: string;
}

/** Challenges come back in list order, which is also the "Next challenge" order. */
export interface ChallengeSummary extends Omit<ChallengeMeta, 'hints'> {
  progress: ProgressEntry;
}

export interface ChallengeDetail extends ChallengeMeta {
  progress: ProgressEntry;
  /** README.md as Markdown. */
  readme: string;
}

export interface WorkspaceInfo {
  challengeId: string;
  /** Every file in the workspace, relative, with `/` separators, sorted. */
  files: string[];
}

export interface FileContent {
  path: string;
  content: string;
  /** Last change time; send it back as `baseMtimeMs` when saving. */
  mtimeMs: number;
}

export interface SaveFileRequest {
  content: string;
  /**
   * The `mtimeMs` the editor loaded. If the file changed on disk since then
   * (another tab, the user's own editor), the save fails with 409.
   */
  baseMtimeMs?: number;
}

export interface SavedFile {
  path: string;
  size: number;
  mtimeMs: number;
}

export interface SubmitRequest {
  /** Time on the challenge so far, from the UI timer. */
  elapsedMs?: number;
}

export interface SubmitResult {
  /** Visible and hidden tests together; hidden ones have `hidden: true`. */
  run: TestRunResult;
  solved: boolean;
  progress: ProgressEntry;
}

/** One file of the reference solution, next to the starter version for a diff. */
export interface SolutionFile {
  path: string;
  /** Null when the solution adds a new file. */
  starter: string | null;
  solution: string;
}

export interface ProgressEntry {
  status: ChallengeStatus;
  /** Every Submit counts, including ones after the challenge was solved. */
  attempts: number;
  /** First time the challenge was started; lets the timer survive a page refresh. */
  startedAt?: string;
  bestTimeMs?: number;
  solvedAt?: string;
}

export interface Settings {
  timerEnabled: boolean;
  theme: 'system' | 'light' | 'dark';
}

export interface SessionInfo {
  ok: true;
  appName: string;
}
