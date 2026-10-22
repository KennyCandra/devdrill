import { rmSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Temp folders still in use, so they can be removed even if the server is stopped mid-run. */
const live = new Set<string>();

/** Creates a temp folder, runs `task` with it, and always removes it afterwards. */
export async function withTempDir<T>(
  prefix: string,
  task: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), `devdrill-${prefix}-`));
  live.add(dir);
  try {
    return await task(dir);
  } finally {
    live.delete(dir);
    await rm(dir, { recursive: true, force: true });
  }
}

/** Synchronous so it can run in a signal handler right before the process exits. */
export function removeAllTempDirs(): void {
  for (const dir of live) rmSync(dir, { recursive: true, force: true });
  live.clear();
}
