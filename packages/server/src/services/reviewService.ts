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
import { REVIEW_DRAFT_FILE, type Target, type WorkspaceManager } from './workspaceManager.js';

const VERDICTS: readonly ReviewVerdict[] = ['approve', 'request_changes'];
const COMMENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function emptyDraft(): ReviewDraft {
  return { comments: [], verdict: null };
}

/** Review challenges: the pull request's diff, the answer key, and the player's draft. */
export class ReviewService {
  /** One store per workspace, so saves to the same draft queue up instead of racing. */
  private readonly drafts = new Map<string, JsonStore<ReviewDraft>>();
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
      return parseDraft(stored, await this.files(t), this.issueTypes(t));
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
    const draft = parseDraft(raw, await this.files(t), this.issueTypes(t));
    return this.workspaces.exclusive(t, async () => (await this.store(t)).update(() => draft));
  }

  private async store(t: Target): Promise<JsonStore<ReviewDraft>> {
    requireReview(t);
    const dir = this.workspaces.dirFor(t);
    if (!(await stat(dir).catch(() => null))?.isDirectory()) {
      throw new HttpError(404, 'Start the challenge first.');
    }
    const file = path.join(dir, REVIEW_DRAFT_FILE);
    let store = this.drafts.get(file);
    if (!store) {
      // A draft that doesn't parse (edited by hand) starts over rather than break the page.
      store = new JsonStore(file, (raw) => parseStoredDraft(raw), emptyDraft);
      this.drafts.set(file, store);
    }
    return store;
  }

  /** After a reset or "Reset progress" the file is gone; drop the cached copy too. */
  forget(t?: Target): void {
    if (!t) {
      this.drafts.clear();
      return;
    }
    this.drafts.delete(path.join(this.workspaces.dirFor(t), REVIEW_DRAFT_FILE));
  }
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
export function parseDraft(raw: unknown, files: ReviewFile[], types: IssueType[]): ReviewDraft {
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
  const typeIds = new Set(types.map((t) => t.id));
  const ids = new Set<string>();
  const parsed = comments.map((c: unknown, i): ReviewComment => {
    const where = `Comment ${i + 1}`;
    const comment = c as Partial<Record<keyof ReviewComment, unknown>> | null;
    if (typeof comment !== 'object' || comment === null) {
      throw new HttpError(400, `${where} must be an object.`);
    }
    const { id, file, lines, type, why } = comment;
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
    if (typeof type !== 'string' || !typeIds.has(type)) {
      throw new HttpError(400, `${where}: "type" must be one of the issue types.`);
    }
    if (typeof why !== 'string' || why.trim() === '') {
      throw new HttpError(400, `${where}: say why in "why".`);
    }
    if (why.length > MAX_COMMENT_CHARS) {
      throw new HttpError(400, `${where}: "why" can be at most ${MAX_COMMENT_CHARS} characters.`);
    }
    return { id, file: file as string, lines: [lines[0], lines[1]], type, why: why.trim() };
  });

  return { comments: parsed, verdict: verdict as ReviewVerdict | null };
}
