// Types only: this package is never imported at runtime.
// Always use `import type` from it.

export type ChallengeMode = 'debug' | 'feature' | 'review';

/** The languages a challenge can come in; each is a folder in the challenge. */
export type Language = 'js' | 'ts';

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
  /**
   * For each hidden test ("describe > test" name), the README sentence it checks.
   * Shown under a failing hidden test so you know which rule you missed. Server-side only.
   */
  hiddenTestRules?: Record<string, string>;
}

export type TestCaseStatus = 'passed' | 'failed' | 'skipped';

/** One console.log / console.error call during a test run. */
export interface ConsoleLine {
  stream: 'stdout' | 'stderr';
  text: string;
}

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
  /** What the test and the code it called printed, in order. */
  logs?: ConsoleLine[];
  /** For a hidden test: the sentence in the task (README) that it checks. */
  rule?: string;
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
  /** Output printed outside any test, e.g. while a file loads, or before a timeout. */
  logs?: (ConsoleLine & { file?: string })[];
  durationMs: number;
}

// ---- API ----

/** Every error response from the server has this shape. */
export interface ApiError {
  error: string;
}

/** Challenges come back in list order, which is also the "Next challenge" order. */
export interface ChallengeSummary extends Omit<ChallengeMeta, 'hints' | 'hiddenTestRules'> {
  /** Progress in the language that was asked for. */
  progress: ProgressEntry;
  languages: Language[];
}

export interface ChallengeDetail extends Omit<ChallengeMeta, 'hiddenTestRules'> {
  /** Progress in the language that was asked for. */
  progress: ProgressEntry;
  languages: Language[];
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
  /** The language challenges open in. */
  language: Language;
}

export interface SessionInfo {
  ok: true;
  appName: string;
}

// ---- Review mode ----

export type ReviewCategory = 'bug' | 'security' | 'performance' | 'readability' | 'tests';

/** `must` blocks merging, `should` is worth a comment, `nit` is an optional style point. */
export type ReviewSeverity = 'must' | 'should' | 'nit';

/** One kind of problem a review comment can name, e.g. "Missing await". */
export interface IssueType {
  id: string;
  label: string;
  category: ReviewCategory;
  /** One line on what it means, shown in the picker. */
  description: string;
}

/** A first and last line, both 1-based and inclusive, in the new (head) version of a file. */
export type LineRange = [number, number];

/** One planted issue in a review challenge's answer key (`issues.json`). */
export interface ReviewIssue {
  id: string;
  file: string;
  lines: LineRange;
  /** Set when the issue is the whole function: then `lines` is that function. */
  function?: string;
  /** An `IssueType` id. */
  type: string;
  severity: ReviewSeverity;
  title: string;
  explanation: string;
}

/** One file the pull request changes. */
export interface ReviewFile {
  path: string;
  /** Null when the pull request adds the file. */
  base: string | null;
  head: string;
}

export type ReviewVerdict = 'approve' | 'request_changes';

/** A structured review comment: where, what kind of issue, and why. */
export interface ReviewComment {
  id: string;
  file: string;
  lines: LineRange;
  /** An `IssueType` id. */
  type: string;
  /** In the player's words. Not graded here; the AI module will. */
  why: string;
}

/** The review being written, autosaved in the workspace. */
export interface ReviewDraft {
  comments: ReviewComment[];
  verdict: ReviewVerdict | null;
}

export interface IssueOutcome {
  id: string;
  severity: ReviewSeverity;
  category: ReviewCategory;
  found: boolean;
  /** The comment that found it. */
  commentId?: string;
  /**
   * Where and what: given for found issues, and for every issue once the challenge is solved.
   * A missed issue of an unsolved review shows only its severity and category.
   */
  details?: Omit<ReviewIssue, 'id' | 'severity'>;
}

export interface ReviewResult {
  solved: boolean;
  verdict: { given: ReviewVerdict; correct: boolean };
  issues: IssueOutcome[];
  /** Ids of comments that match no issue. */
  falseAlarms: string[];
  /** The comments that were graded, so the results screen can show them later. */
  comments: ReviewComment[];
  progress: ProgressEntry;
}

export interface ReviewSubmitRequest {
  elapsedMs?: number;
}
