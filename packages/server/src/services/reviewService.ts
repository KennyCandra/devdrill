import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  IssueType,
  ReviewComment,
  ReviewDraft,
  ReviewFile,
  ReviewIssue,
  ReviewVerdict,
} from '@devdrill/shared';
import {
  lineCount,
  MAX_COMMENT_CHARS,
  MAX_COMMENT_LINES,
  MAX_REVIEW_COMMENTS,
} from '@devdrill/shared/review';
import { HttpError } from '../httpError.js';
import { listFiles } from './files.js';
import { JsonStore } from './jsonStore.js';
import { isLineRange } from './reviewFormat.js';
import { compareReview, withCaught, type SavedReview } from './reviewGrading.js';
import { REVIEW_DRAFT_FILE, type Target, type WorkspaceManager } from './workspaceManager.js';

/** The last submitted review, next to the draft in the workspace. */
const REVIEW_RESULT_FILE = 'review-result.json';

const VERDICTS: readonly ReviewVerdict[] = ['approve', 'request_changes'];
const COMMENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function emptyDraft(): ReviewDraft {
  return { comments: [], verdict: null };
}

/**
 * Review challenges: the pull request's diff, the answer key, the player's draft, and the
 * last submitted review with the issues they ticked as caught.
 */
export class ReviewService {
  /** One store per workspace, so saves to the same draft queue up instead of racing. */
  private readonly drafts = new Map<string, JsonStore<ReviewDraft>>();
  private readonly results = new Map<string, JsonStore<SavedReview | null>>();
  /** Challenge files don't change while the server runs, so each diff is read once. */
  private readonly diffs = new Map<string, Promise<ReviewFile[]>>();

  constructor(private readonly workspaces: WorkspaceManager) {}

  /** The files the pull request changes: head/ layered on base/, compared with base/. */
  files(t: Target): Promise<ReviewFile[]> {
    requireReview(t);
    const key = `${t.lang}:${t.challenge.meta.id}`;
    let files = this.diffs.get(key);
    if (!files) {
      files = this.readFiles(t);
      this.diffs.set(key, files);
      files.catch(() => this.diffs.delete(key));
    }
    return files;
  }

  private async readFiles(t: Target): Promise<ReviewFile[]> {
    const base = path.join(t.challenge.dir, t.lang, 'base');
    const head = path.join(t.challenge.dir, t.lang, 'head');
    const files: ReviewFile[] = [];
    for (const rel of await listFiles(head)) {
      const after = await readFile(path.join(head, rel), 'utf8');
      const before = await readFile(path.join(base, rel), 'utf8').catch(() => null);
      if (before !== after) files.push({ path: rel, base: before, head: after });
    }
    return files;
  }

  issueTypes(t: Target): IssueType[] {
    return requireReview(t).issueTypes[t.lang];
  }

  issues(t: Target): ReviewIssue[] {
    return requireReview(t).issues[t.lang] ?? [];
  }

  /**
   * The saved draft, checked again like a new one: review.json is a plain file that could
   * have been edited by hand. One that doesn't pass starts over rather than break grading.
   */
  async draft(t: Target): Promise<ReviewDraft> {
    const stored = await (await this.store(t)).get();
    try {
      return parseDraft(stored, await this.files(t));
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      console.warn(`Ignoring the saved review for ${t.challenge.meta.id}: ${err.message}`);
      return emptyDraft();
    }
  }

  /**
   * Checks a draft from the UI against the pull request and the limits, then saves it.
   * Holds the workspace while saving, so a reset can't run in between and be undone.
   */
  async saveDraft(t: Target, raw: unknown): Promise<ReviewDraft> {
    const draft = parseDraft(raw, await this.files(t));
    return this.workspaces.exclusive(t, async () => (await this.store(t)).update(() => draft));
  }

  /** Lays the saved draft next to the answer key, and keeps it as the last submitted review. */
  async submit(t: Target): Promise<SavedReview> {
    const draft = await this.draft(t);
    if (draft.verdict === null) {
      throw new HttpError(400, 'Pick a verdict (Approve or Request changes) before submitting.');
    }
    const verdict = draft.verdict;
    const review = compareReview(this.issues(t), draft.comments, verdict, new Date().toISOString());
    return this.workspaces
      .exclusive(t, async () => (await this.resultStore(t)).update(() => review))
      .then((saved) => saved ?? review);
  }

  /** The last submitted review, or null before the first submit. */
  async result(t: Target): Promise<SavedReview | null> {
    return (await this.resultStore(t)).get();
  }

  /** Saves which issues the player ticked as caught, and returns the new score. */
  async setCaught(t: Target, raw: unknown): Promise<SavedReview> {
    const caught = (raw as { caught?: unknown } | null)?.caught;
    if (!Array.isArray(caught) || !caught.every((id) => typeof id === 'string')) {
      throw new HttpError(400, '"caught" must be a list of issue ids.');
    }
    const updated = await this.workspaces.exclusive(t, async () =>
      (await this.resultStore(t)).update((saved) => (saved ? withCaught(saved, caught) : null)),
    );
    if (!updated) throw new HttpError(404, 'Submit the review first.');
    return updated;
  }

  private async workspaceDir(t: Target): Promise<string> {
    requireReview(t);
    const dir = this.workspaces.dirFor(t);
    if (!(await stat(dir).catch(() => null))?.isDirectory()) {
      throw new HttpError(404, 'Start the challenge first.');
    }
    return dir;
  }

  private async store(t: Target): Promise<JsonStore<ReviewDraft>> {
    const file = path.join(await this.workspaceDir(t), REVIEW_DRAFT_FILE);
    let store = this.drafts.get(file);
    if (!store) {
      // A draft that doesn't parse (edited by hand) starts over rather than break the page.
      store = new JsonStore(file, (raw) => parseStoredDraft(raw), emptyDraft);
      this.drafts.set(file, store);
    }
    return store;
  }

  private async resultStore(t: Target): Promise<JsonStore<SavedReview | null>> {
    const file = path.join(await this.workspaceDir(t), REVIEW_RESULT_FILE);
    let store = this.results.get(file);
    if (!store) {
      // An unreadable result (edited by hand, or from an older version) is no result.
      store = new JsonStore<SavedReview | null>(file, parseStoredResult, () => null);
      this.results.set(file, store);
    }
    return store;
  }

  /** After a reset or "Reset progress" the files are gone; drop the cached copies too. */
  forget(t?: Target): void {
    if (!t) {
      this.drafts.clear();
      this.results.clear();
      return;
    }
    const dir = this.workspaces.dirFor(t);
    this.drafts.delete(path.join(dir, REVIEW_DRAFT_FILE));
    this.results.delete(path.join(dir, REVIEW_RESULT_FILE));
  }
}

function parseStoredResult(raw: unknown): SavedReview | null {
  const review = raw as Partial<SavedReview> | null;
  if (
    !review ||
    typeof review.passed !== 'boolean' ||
    !Array.isArray(review.issues) ||
    !Array.isArray(review.comments) ||
    typeof review.score !== 'number'
  ) {
    throw new Error('not a review result');
  }
  return review as SavedReview;
}

function requireReview(t: Target): NonNullable<Target['challenge']['review']> {
  if (!t.challenge.review) throw new HttpError(400, 'This is not a review challenge.');
  return t.challenge.review;
}

function parseStoredDraft(raw: unknown): ReviewDraft {
  const draft = raw as Partial<ReviewDraft> | null;
  if (!draft || !Array.isArray(draft.comments)) throw new Error('not a draft');
  return { comments: draft.comments, verdict: draft.verdict ?? null };
}

/** Validates a draft sent by the UI. Throws a 400 that says what's wrong. */
export function parseDraft(raw: unknown, files: ReviewFile[]): ReviewDraft {
  const body = raw as { comments?: unknown; verdict?: unknown } | null;
  if (typeof body !== 'object' || body === null) {
    throw new HttpError(400, 'Send { comments, verdict }.');
  }
  const { comments, verdict } = body;
  if (verdict !== null && !VERDICTS.includes(verdict as ReviewVerdict)) {
    throw new HttpError(400, '"verdict" must be approve, request_changes or null.');
  }
  if (!Array.isArray(comments)) throw new HttpError(400, '"comments" must be an array.');
  if (comments.length > MAX_REVIEW_COMMENTS) {
    throw new HttpError(400, `A review can have at most ${MAX_REVIEW_COMMENTS} comments.`);
  }

  const lineCounts = new Map(files.map((f) => [f.path, lineCount(f.head)]));
  const ids = new Set<string>();
  const parsed = comments.map((c: unknown, i): ReviewComment => {
    const where = `Comment ${i + 1}`;
    const comment = c as Partial<Record<keyof ReviewComment, unknown>> | null;
    if (typeof comment !== 'object' || comment === null) {
      throw new HttpError(400, `${where} must be an object.`);
    }
    // Older drafts may carry an issue "type": no longer used, so dropped.
    const { id, file, lines, why } = comment;
    if (typeof id !== 'string' || !COMMENT_ID.test(id) || ids.has(id)) {
      throw new HttpError(400, `${where}: "id" must be a unique short id.`);
    }
    ids.add(id);
    const lineCount = typeof file === 'string' ? lineCounts.get(file) : undefined;
    if (lineCount === undefined) {
      throw new HttpError(400, `${where}: "file" must be a file the pull request changes.`);
    }
    if (!isLineRange(lines) || lines[1] > lineCount) {
      throw new HttpError(400, `${where}: "lines" must be [first, last] inside the file.`);
    }
    if (lines[1] - lines[0] + 1 > MAX_COMMENT_LINES) {
      throw new HttpError(400, `${where}: a comment covers at most ${MAX_COMMENT_LINES} lines.`);
    }
    if (typeof why !== 'string' || why.trim() === '') {
      throw new HttpError(400, `${where}: say why in "why".`);
    }
    if (why.length > MAX_COMMENT_CHARS) {
      throw new HttpError(400, `${where}: "why" can be at most ${MAX_COMMENT_CHARS} characters.`);
    }
    return { id, file: file as string, lines: [lines[0], lines[1]], why: why.trim() };
  });

  return { comments: parsed, verdict: verdict as ReviewVerdict | null };
}
