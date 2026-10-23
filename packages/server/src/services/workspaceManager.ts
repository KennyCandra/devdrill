import { mkdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FileContent, SavedFile, SolutionFile, TestRunResult } from '@devdrill/shared';
import { HttpError } from '../httpError.js';
import type { Challenge } from './challengeLoader.js';
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

/** Editor files bigger than this are almost certainly a mistake (e.g. a pasted log). */
export const MAX_FILE_BYTES = 512 * 1024;

/**
 * The user's working copies, one folder per challenge under `root`.
 * Runs, submits and resets of the same workspace never overlap; a second one gets a 409.
 */
export class WorkspaceManager {
  private readonly busy = new Set<string>();
  /** In-flight first-time copies, so concurrent starts share one instead of racing. */
  private readonly starting = new Map<string, Promise<void>>();

  constructor(
    private readonly root: string,
    private readonly testTimeoutMs?: number,
  ) {}

  dirFor(challenge: Challenge): string {
    return path.join(this.root, challenge.meta.id);
  }

  async exists(challenge: Challenge): Promise<boolean> {
    try {
      return (await stat(this.dirFor(challenge))).isDirectory();
    } catch {
      return false;
    }
  }

  /** Creates the workspace from `starter/` if it doesn't exist yet. Returns its files. */
  async start(challenge: Challenge): Promise<string[]> {
    const id = challenge.meta.id;
    let pending = this.starting.get(id);
    if (!pending && !(await this.exists(challenge))) {
      pending =
        this.starting.get(id) ??
        this.exclusive(challenge, async () => {
          // Another start may have finished while this one waited.
          if (!(await this.exists(challenge))) await this.copyStarter(challenge);
        }).finally(() => this.starting.delete(id));
      this.starting.set(id, pending);
    }
    await pending;
    return listFiles(this.dirFor(challenge));
  }

  /** Throws away the user's changes and copies `starter/` again. */
  async reset(challenge: Challenge): Promise<string[]> {
    return this.exclusive(challenge, async () => {
      await rm(this.dirFor(challenge), { recursive: true, force: true });
      await this.copyStarter(challenge);
      return listFiles(this.dirFor(challenge));
    });
  }

  /** Deletes every workspace. Refused while any test run is in progress. */
  async removeAll(): Promise<void> {
    if (this.busy.size > 0) {
      throw new HttpError(409, 'Tests are running. Wait for them to finish.');
    }
    await rm(this.root, { recursive: true, force: true });
  }

  async files(challenge: Challenge): Promise<string[]> {
    return listFiles(await this.requireDir(challenge));
  }

  async readFile(challenge: Challenge, relPath: unknown): Promise<FileContent> {
    const file = await resolveInside(await this.requireDir(challenge), relPath);
    const shown = String(relPath);
    try {
      const info = await stat(file);
      if (info.size > MAX_FILE_BYTES) {
        throw new HttpError(413, `${shown} is too big to open (over ${MAX_FILE_BYTES / 1024} KB).`);
      }
      const bytes = await readFile(file);
      if (bytes.includes(0)) throw new HttpError(415, `${shown} is a binary file.`);
      return {
        path: this.relative(challenge, file),
        content: bytes.toString('utf8'),
        mtimeMs: info.mtimeMs,
      };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw fsErrorToHttp(err, shown);
    }
  }

  async writeFile(
    challenge: Challenge,
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
    const dir = await this.requireDir(challenge);
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
      return { path: this.relative(challenge, file), size: info.size, mtimeMs: info.mtimeMs };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw fsErrorToHttp(err, shown);
    }
  }

  async deleteFile(challenge: Challenge, relPath: unknown): Promise<void> {
    const file = await resolveInside(await this.requireDir(challenge), relPath);
    try {
      await unlink(file);
    } catch (err) {
      throw fsErrorToHttp(err, String(relPath));
    }
  }

  /** Runs the visible tests in the workspace. */
  async run(challenge: Challenge): Promise<TestRunResult> {
    const dir = await this.requireDir(challenge);
    return this.exclusive(challenge, () => runTests(dir, this.timeoutOptions()));
  }

  /**
   * Runs visible + hidden tests on a temporary copy, so hidden tests never
   * land in the user's workspace.
   */
  async submit(challenge: Challenge): Promise<TestRunResult> {
    const dir = await this.requireDir(challenge);
    const hiddenDir = path.join(challenge.dir, 'hidden-tests');
    const hiddenFiles = new Set(await listFiles(hiddenDir));

    return this.exclusive(challenge, () =>
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
  async solution(challenge: Challenge): Promise<SolutionFile[]> {
    const solutionDir = path.join(challenge.dir, 'solution');
    const starterDir = path.join(challenge.dir, 'starter');
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
  async hiddenTests(challenge: Challenge): Promise<FileContent[]> {
    const dir = path.join(challenge.dir, 'hidden-tests');
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

  private relative(challenge: Challenge, file: string): string {
    return toPosix(path.relative(this.dirFor(challenge), file));
  }

  private async copyStarter(challenge: Challenge): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await copyDir(path.join(challenge.dir, 'starter'), this.dirFor(challenge));
  }

  private async requireDir(challenge: Challenge): Promise<string> {
    if (!(await this.exists(challenge))) {
      throw new HttpError(404, 'Start the challenge first.');
    }
    return this.dirFor(challenge);
  }

  private async exclusive<T>(challenge: Challenge, task: () => Promise<T>): Promise<T> {
    if (this.busy.has(challenge.meta.id)) {
      throw new HttpError(409, 'Tests or a reset are already running. Wait for them to finish.');
    }
    this.busy.add(challenge.meta.id);
    try {
      return await task();
    } finally {
      this.busy.delete(challenge.meta.id);
    }
  }

  private timeoutOptions() {
    return this.testTimeoutMs === undefined ? {} : { timeoutMs: this.testTimeoutMs };
  }
}
