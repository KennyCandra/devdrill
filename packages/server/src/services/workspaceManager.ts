import { mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  FileContent,
  Language,
  SavedFile,
  SolutionFile,
  TestRunResult,
} from '@devdrill/shared';
import { HttpError } from '../httpError.js';
import type { Challenge } from './challengeLoader.js';

/** One challenge in one language: that's what a workspace belongs to. */
export interface Target {
  challenge: Challenge;
  lang: Language;
}

import {
  copyDir,
  fsErrorToHttp,
  isInSkippedDir,
  listFiles,
  resolveInside,
  toPosix,
} from './files.js';
import { withTempDir } from './tempDirs.js';
import { runTests } from './testRunner.js';

/** Workspace folders from before languages were named by challenge id, like this. */
const OLD_WORKSPACE_NAME = /^(?:debug|feature)-\d{3}-[a-z0-9-]+$/;

/** A review challenge's workspace holds only the review being written. */
export const REVIEW_DRAFT_FILE = 'review.json';

/** Editor files bigger than this are almost certainly a mistake (e.g. a pasted log). */
export const MAX_FILE_BYTES = 512 * 1024;

/**
 * The user's working copies: `root/<lang>/<challenge id>`.
 * Runs, submits and resets of the same workspace never overlap; a second one gets a 409.
 */
export class WorkspaceManager {
  private readonly busy = new Set<string>();
  /** In-flight first-time copies, so concurrent starts share one instead of racing. */
  private readonly starting = new Map<string, Promise<void>>();

  private migrated: Promise<void> | undefined;

  constructor(
    private readonly root: string,
    private readonly testTimeoutMs?: number,
  ) {}

  dirFor(t: Target): string {
    return path.join(this.root, t.lang, t.challenge.meta.id);
  }

  async exists(t: Target): Promise<boolean> {
    await this.migrateOldLayout();
    try {
      return (await stat(this.dirFor(t))).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Before languages, workspaces lived at `root/<challenge id>` and were all JavaScript.
   * Move those to `root/js/<challenge id>` once, so nobody loses their code.
   */
  private migrateOldLayout(): Promise<void> {
    // Never rejects: a folder that can't be moved is skipped, not a reason to break
    // every workspace. Runs once per server.
    this.migrated ??= (async () => {
      let entries;
      try {
        entries = await readdir(this.root, { withFileTypes: true });
      } catch {
        return; // no workspaces yet
      }
      const old = entries.filter((e) => e.isDirectory() && OLD_WORKSPACE_NAME.test(e.name));
      for (const entry of old) {
        const from = path.join(this.root, entry.name);
        const to = path.join(this.root, 'js', entry.name);
        try {
          if (await pathExists(to)) {
            // Both exist (e.g. an older version ran again): keep the newer layout, leave
            // the old folder alone so nothing is deleted.
            console.warn(`Not moving ${from}: ${to} already exists.`);
            continue;
          }
          await mkdir(path.dirname(to), { recursive: true });
          await rename(from, to);
        } catch (err) {
          console.warn(`Couldn't move ${from} to ${to}: ${(err as Error).message}`);
        }
      }
    })();
    return this.migrated;
  }

  /** A folder of the challenge in this language: starter, hidden-tests or solution. */
  private layer(t: Target, name: 'starter' | 'hidden-tests' | 'solution'): string {
    return path.join(t.challenge.dir, t.lang, name);
  }

  private key(t: Target): string {
    return `${t.lang}:${t.challenge.meta.id}`;
  }

  /** Creates the workspace from the starter files if it doesn't exist yet. Returns its files. */
  async start(t: Target): Promise<string[]> {
    const id = this.key(t);
    let pending = this.starting.get(id);
    if (!pending && !(await this.exists(t))) {
      pending =
        this.starting.get(id) ??
        this.exclusive(t, async () => {
          // Another start may have finished while this one waited.
          if (!(await this.exists(t))) await this.copyStarter(t);
        }).finally(() => this.starting.delete(id));
      this.starting.set(id, pending);
    }
    await pending;
    return listFiles(this.dirFor(t));
  }

  /** Throws away the user's changes and copies the starter files again. */
  async reset(t: Target): Promise<string[]> {
    return this.exclusive(t, async () => {
      await rm(this.dirFor(t), { recursive: true, force: true });
      await this.copyStarter(t);
      return listFiles(this.dirFor(t));
    });
  }

  /** Deletes every workspace. Refused while any test run is in progress. */
  async removeAll(): Promise<void> {
    if (this.busy.size > 0) {
      throw new HttpError(409, 'Tests are running. Wait for them to finish.');
    }
    await rm(this.root, { recursive: true, force: true });
  }

  async files(t: Target): Promise<string[]> {
    return listFiles(await this.requireDir(t));
  }

  async readFile(t: Target, relPath: unknown): Promise<FileContent> {
    const file = await resolveInside(await this.requireDir(t), relPath);
    const shown = String(relPath);
    try {
      const info = await stat(file);
      if (info.size > MAX_FILE_BYTES) {
        throw new HttpError(413, `${shown} is too big to open (over ${MAX_FILE_BYTES / 1024} KB).`);
      }
      const bytes = await readFile(file);
      if (bytes.includes(0)) throw new HttpError(415, `${shown} is a binary file.`);
      return {
        path: this.relative(t, file),
        content: bytes.toString('utf8'),
        mtimeMs: info.mtimeMs,
      };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw fsErrorToHttp(err, shown);
    }
  }

  async writeFile(
    t: Target,
    relPath: unknown,
    content: unknown,
    baseMtimeMs?: unknown,
  ): Promise<SavedFile> {
    if (typeof content !== 'string') throw new HttpError(400, '"content" must be a string.');
    if (baseMtimeMs !== undefined && typeof baseMtimeMs !== 'number') {
      throw new HttpError(400, '"baseMtimeMs" must be a number.');
    }
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) {
      throw new HttpError(413, `Files can be at most ${MAX_FILE_BYTES / 1024} KB.`);
    }
    const dir = await this.requireDir(t);
    const file = await resolveInside(dir, relPath);
    if (isInSkippedDir(path.relative(dir, file))) {
      throw new HttpError(400, 'Writing into node_modules or .git is not allowed.');
    }

    const shown = String(relPath);
    try {
      if (baseMtimeMs !== undefined) {
        const current = await stat(file).catch(() => null);
        if (current && current.mtimeMs !== baseMtimeMs) {
          throw new HttpError(409, `${shown} changed somewhere else. Reload it before saving.`);
        }
      }
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content);
      const info = await stat(file);
      return { path: this.relative(t, file), size: info.size, mtimeMs: info.mtimeMs };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw fsErrorToHttp(err, shown);
    }
  }

  async deleteFile(t: Target, relPath: unknown): Promise<void> {
    const file = await resolveInside(await this.requireDir(t), relPath);
    try {
      await unlink(file);
    } catch (err) {
      throw fsErrorToHttp(err, String(relPath));
    }
  }

  /** Runs the visible tests in the workspace. */
  async run(t: Target): Promise<TestRunResult> {
    const dir = await this.requireDir(t);
    return this.exclusive(t, () => runTests(dir, this.timeoutOptions()));
  }

  /**
   * Runs visible + hidden tests on a temporary copy, so hidden tests never
   * land in the user's workspace.
   */
  async submit(t: Target): Promise<TestRunResult> {
    const dir = await this.requireDir(t);
    const hiddenDir = this.layer(t, 'hidden-tests');
    const hiddenFiles = new Set(await listFiles(hiddenDir));

    return this.exclusive(t, () =>
      withTempDir('submit', async (work) => {
        await copyDir(dir, work);
        await copyDir(hiddenDir, work);
        const result = await runTests(work, this.timeoutOptions());
        return {
          ...result,
          tests: result.tests.map((t) => ({ ...t, hidden: hiddenFiles.has(t.file) })),
        };
      }),
    );
  }

  /** The reference solution: each changed file next to its starter version. */
  async solution(t: Target): Promise<SolutionFile[]> {
    const solutionDir = this.layer(t, 'solution');
    const starterDir = this.layer(t, 'starter');
    const files = await listFiles(solutionDir);
    return Promise.all(
      files.map(async (rel) => ({
        path: rel,
        starter: await readFile(path.join(starterDir, rel), 'utf8').catch(() => null),
        solution: await readFile(path.join(solutionDir, rel), 'utf8'),
      })),
    );
  }

  /** The hidden test files, for players who have solved the challenge. */
  async hiddenTests(t: Target): Promise<FileContent[]> {
    const dir = this.layer(t, 'hidden-tests');
    const files = await listFiles(dir);
    return Promise.all(
      files.map(async (rel) => {
        const file = path.join(dir, rel);
        return {
          path: rel,
          content: await readFile(file, 'utf8'),
          mtimeMs: (await stat(file)).mtimeMs,
        };
      }),
    );
  }

  private relative(t: Target, file: string): string {
    return toPosix(path.relative(this.dirFor(t), file));
  }

  private async copyStarter(t: Target): Promise<void> {
    if (t.challenge.meta.mode === 'review') {
      // Nothing to edit: the draft is created on the first save.
      await mkdir(this.dirFor(t), { recursive: true });
      return;
    }
    await mkdir(path.dirname(this.dirFor(t)), { recursive: true });
    await copyDir(this.layer(t, 'starter'), this.dirFor(t));
  }

  private async requireDir(t: Target): Promise<string> {
    if (!(await this.exists(t))) {
      throw new HttpError(404, 'Start the challenge first.');
    }
    return this.dirFor(t);
  }

  /** Runs `task` with this workspace to itself: nothing else runs, resets or deletes it. */
  async exclusive<T>(t: Target, task: () => Promise<T>): Promise<T> {
    const key = this.key(t);
    if (this.busy.has(key)) {
      throw new HttpError(
        409,
        'Something else is running on this challenge (tests, a reset or a save). Try again in a moment.',
      );
    }
    this.busy.add(key);
    try {
      return await task();
    } finally {
      this.busy.delete(key);
    }
  }

  private timeoutOptions() {
    return this.testTimeoutMs === undefined ? {} : { timeoutMs: this.testTimeoutMs };
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
