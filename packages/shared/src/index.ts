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
  /** Review challenges: the best self-graded score, 0–100. */
  bestScore?: number;
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
  /** Other issue types that also describe it fairly (e.g. off-by-one for a `>` vs `>=` bug). */
  alsoAccept?: string[];
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

/** What the review screen needs: the diff and the issue types to pick from. */
export interface ReviewPullRequest {
  files: ReviewFile[];
  issueTypes: IssueType[];
}

export type ReviewVerdict = 'approve' | 'request_changes';

/** A review comment: the lines it's on, and what's wrong in the player's words. */
export interface ReviewComment {
  id: string;
  file: string;
  lines: LineRange;
  why: string;
}

/** The review being written, autosaved in the workspace. */
export interface ReviewDraft {
  comments: ReviewComment[];
  verdict: ReviewVerdict | null;
}

/** One planted issue next to the player's review, shown after submitting. */
export interface IssueOutcome {
  issue: ReviewIssue;
  /** This issue's share of the score, in percent (by severity: must 3, should 2, nit 1). */
  weight: number;
  /** Ids of the player's comments on this issue's lines, to compare with. */
  nearby: string[];
  /** The player ticked "I caught this". */
  caught: boolean;
}

/**
 * A submitted review. Only the verdict is checked automatically (it decides "passed");
 * the player compares their comments with the answer key and ticks what they caught,
 * which gives the score. Saved in the workspace, so it can be reopened later.
 */
export interface ReviewResult {
  passed: boolean;
  verdict: { given: ReviewVerdict; expected: ReviewVerdict };
  issues: IssueOutcome[];
  /** Ids of comments near no issue: maybe good points the key doesn't have. */
  others: string[];
  comments: ReviewComment[];
  /** 0–100, from the ticks. A PR with no issues scores 100 when passed. */
  score: number;
  submittedAt: string;
  /** The AI's judgement of the comments, once the player asked for it. */
  ai?: AiReviewJudgement;
  progress: ProgressEntry;
}

export type AiIssueVerdict = 'caught' | 'partly' | 'missed';

/** What the AI made of the player's comments, issue by issue. */
export interface AiReviewJudgement {
  issues: { issueId: string; verdict: AiIssueVerdict; reason: string }[];
  judgedAt: string;
}

/** Whether AI features can be used right now (a provider is chosen and set up). */
export interface AiStatus {
  enabled: boolean;
}

export interface ReviewSubmitRequest {
  elapsedMs?: number;
}

/** The issues the player ticked as caught. */
export interface ReviewCaughtRequest {
  caught: string[];
}

// ---- AI ----

export type AiProviderId = 'claude' | 'openai' | 'ollama' | 'opencode' | 'custom';

/** What Settings needs to know to show a provider's form. */
export interface AiProviderInfo {
  id: AiProviderId;
  label: string;
  /** One line under the name, e.g. where to get a key. */
  description: string;
  needsKey: boolean;
  needsBaseUrl: boolean;
  defaultModel: string;
  defaultBaseUrl: string | null;
}

/** One provider's saved settings, as the browser sees them: the key itself never leaves the server. */
export interface AiProviderSettings {
  model: string;
  baseUrl: string | null;
  hasKey: boolean;
}

export interface AiSettings {
  /** The provider the AI features use, or null: AI is off. */
  active: AiProviderId | null;
  providers: Record<AiProviderId, AiProviderSettings>;
  /** Every provider DevDrill knows, in the order Settings shows them. */
  available: AiProviderInfo[];
}

/**
 * A change to the AI settings. `apiKey`: a new key, or null to remove the saved one;
 * leave it out to keep the current key.
 */
export interface AiSettingsPatch {
  active?: AiProviderId | null;
  provider?: AiProviderId;
  model?: string;
  baseUrl?: string | null;
  apiKey?: string | null;
}

export interface AiTestResult {
  ok: boolean;
  /** What the provider answered, or why it failed, in words for the player. */
  message: string;
  durationMs: number;
}
