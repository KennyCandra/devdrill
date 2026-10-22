import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

/**
 * A small JSON file on disk with an in-memory copy.
 * Writes are queued and atomic (temp file + rename), so a crash never leaves half a file.
 * If the file is missing or unreadable, `fallback()` is used and the bad file is kept as `.bak`.
 * Only one server process uses the data folder at a time (see instanceLock.ts).
 */
export class JsonStore<T> {
  private value: T | undefined;
  private writes: Promise<void> = Promise.resolve();

  constructor(
    private readonly file: string,
    private readonly parse: (raw: unknown) => T,
    private readonly fallback: () => T,
  ) {}

  async get(): Promise<T> {
    if (this.value === undefined) this.value = await this.load();
    return this.value;
  }

  /** Applies `change` to a copy of the current value and saves it. */
  async update(change: (current: T) => T): Promise<T> {
    const result = this.writes.then(async () => {
      const next = change(structuredClone(await this.get()));
      await this.save(next);
      this.value = next;
      return next;
    });
    this.writes = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async load(): Promise<T> {
    let text: string;
    try {
      text = await readFile(this.file, 'utf8');
    } catch {
      return this.fallback();
    }
    try {
      return this.parse(JSON.parse(text));
    } catch {
      console.warn(`${this.file} is corrupt; starting fresh and keeping a copy as .bak.`);
      await rename(this.file, `${this.file}.bak`).catch(() => undefined);
      return this.fallback();
    }
  }

  private async save(value: T): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(value, null, 2) + '\n');
    await renameWithRetry(tmp, this.file);
  }
}

/** On Windows, antivirus or an open editor can briefly lock the target file. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (attempt >= 5 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw err;
      await sleep(50 * (attempt + 1));
    }
  }
}
