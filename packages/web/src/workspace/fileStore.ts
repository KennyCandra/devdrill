import type { FileContent, SavedFile, SaveFileRequest } from '@bughunt/shared';
import { ApiRequestError } from '../api/client';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'conflict' | 'error';

export interface FileBuffer {
  content: string;
  /** Disk version this buffer is based on; sent as `baseMtimeMs` when saving. */
  mtimeMs: number;
  state: SaveState;
  /**
   * Bumped whenever the content is replaced from disk (load, "load their version").
   * The editor uses it to tell those apart from the user's own typing.
   */
  diskRevision: number;
  error?: string;
}

export interface FileApi {
  read: (path: string) => Promise<FileContent>;
  save: (path: string, body: SaveFileRequest) => Promise<SavedFile>;
}

const RETRY_DELAYS_MS = [1000, 2000, 4000];

/**
 * The open files of one workspace and their autosave.
 *
 * Every save of a file goes through one promise chain, so saves of the same file
 * never overlap: each one waits for the previous and uses the `mtimeMs` it returned.
 * The current state is readable synchronously, which React state is not.
 */
export class FileStore {
  private buffers: Record<string, FileBuffer> = {};
  private readonly chains = new Map<string, Promise<void>>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly retries = new Map<string, number>();
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly api: FileApi,
    private readonly autosaveMs = 600,
  ) {}

  // ---- useSyncExternalStore ----

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): Record<string, FileBuffer> => this.buffers;

  get(path: string): FileBuffer | undefined {
    return this.buffers[path];
  }

  // ---- Loading and editing ----

  /** Loads a file from disk unless it's already open. `force` replaces the open copy. */
  async load(path: string, { force = false } = {}): Promise<void> {
    if (this.buffers[path] && !force) return;
    if (force) await this.chains.get(path);
    const file = await this.api.read(path);
    this.set(path, {
      content: file.content,
      mtimeMs: file.mtimeMs,
      state: 'saved',
      diskRevision: (this.buffers[path]?.diskRevision ?? 0) + 1,
    });
  }

  /** Records the user's typing and schedules an autosave. */
  edit(path: string, content: string): void {
    const buf = this.buffers[path];
    if (!buf || buf.content === content) return;
    // While in conflict, keep typing locally until the user picks a version.
    const state = buf.state === 'conflict' ? 'conflict' : 'dirty';
    this.set(path, { ...buf, content, state });
    if (state === 'dirty') this.schedule(path, this.autosaveMs);
  }

  // ---- Saving ----

  /** Saves now. `overwrite` ignores a conflict and replaces what's on disk ("Keep mine"). */
  save(path: string, { overwrite = false } = {}): Promise<void> {
    this.clearTimer(path);
    const next = (this.chains.get(path) ?? Promise.resolve()).then(() =>
      this.saveNow(path, overwrite),
    );
    this.chains.set(path, next);
    return next;
  }

  /** Saves every file with unsaved changes and waits for saves already in flight. */
  async flush(): Promise<void> {
    await Promise.all(
      Object.entries(this.buffers).map(([path, buf]) =>
        buf.state === 'dirty' || buf.state === 'error'
          ? this.save(path)
          : (this.chains.get(path) ?? Promise.resolve()),
      ),
    );
  }

  /** True if anything isn't safely on disk. */
  hasUnsaved(): boolean {
    return Object.values(this.buffers).some((b) => b.state !== 'saved');
  }

  /** Files that still need saving; used for a last-chance save when the page closes. */
  unsaved(): { path: string; content: string; mtimeMs: number }[] {
    return Object.entries(this.buffers)
      .filter(([, b]) => b.state === 'dirty' || b.state === 'error' || b.state === 'saving')
      .map(([path, b]) => ({ path, content: b.content, mtimeMs: b.mtimeMs }));
  }

  /** Waits for in-flight saves, then forgets every file (after a reset). */
  async clear(): Promise<void> {
    for (const path of this.timers.keys()) this.clearTimer(path);
    await Promise.all(this.chains.values());
    this.chains.clear();
    this.retries.clear();
    this.buffers = {};
    this.emit();
  }

  /** Forgets a closed file, saving it first. */
  async close(path: string): Promise<void> {
    if (this.buffers[path]?.state === 'dirty') await this.save(path);
    else await this.chains.get(path);
    if (this.buffers[path]?.state !== 'saved') return; // keep unsaved work
    const { [path]: _closed, ...rest } = this.buffers;
    this.buffers = rest;
    this.emit();
  }

  private async saveNow(path: string, overwrite: boolean): Promise<void> {
    const buf = this.buffers[path];
    if (!buf) return;
    if (buf.state === 'saved' && !overwrite) return;
    if (buf.state === 'conflict' && !overwrite) return;

    const sent = buf.content;
    this.set(path, { ...buf, state: 'saving', error: undefined });
    try {
      const saved = await this.api.save(path, {
        content: sent,
        ...(overwrite ? {} : { baseMtimeMs: buf.mtimeMs }),
      });
      this.retries.delete(path);
      const current = this.buffers[path];
      if (!current) return;
      // Typing during the request leaves it dirty; its own timer saves it again.
      const state = current.content === sent ? 'saved' : 'dirty';
      this.set(path, { ...current, mtimeMs: saved.mtimeMs, state });
    } catch (err) {
      const current = this.buffers[path];
      if (!current) return;
      if (err instanceof ApiRequestError && err.status === 409) {
        this.set(path, { ...current, state: 'conflict' });
        return;
      }
      const attempt = this.retries.get(path) ?? 0;
      const message =
        err instanceof ApiRequestError ? err.message : "Can't reach the BugHunt server.";
      this.set(path, { ...current, state: 'error', error: message });
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) {
        this.retries.set(path, attempt + 1);
        this.schedule(path, delay);
      }
    }
  }

  private schedule(path: string, delayMs: number): void {
    this.clearTimer(path);
    this.timers.set(
      path,
      setTimeout(() => {
        this.timers.delete(path);
        void this.save(path);
      }, delayMs),
    );
  }

  private clearTimer(path: string): void {
    clearTimeout(this.timers.get(path));
    this.timers.delete(path);
  }

  private set(path: string, buf: FileBuffer): void {
    this.buffers = { ...this.buffers, [path]: buf };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
