import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// The project name is a placeholder until release (see docs/V1_PLAN.md, section 13).
// Keep every user-facing use of the name behind this constant.
export const APP_NAME = 'bughunt';

export const HOST = '127.0.0.1';

export const DEFAULT_PORT = 3000;

/** Workspaces, progress and settings. `BUGHUNT_HOME` overrides it (used by tests). */
export function dataDir(): string {
  return process.env.BUGHUNT_HOME ?? path.join(homedir(), `.${APP_NAME}`);
}

export interface AppPaths {
  /** The challenges that ship with the app. */
  challenges: string;
  /** The Vitest config every challenge run uses. */
  vitestConfig: string;
  /** The built web UI, or null when it isn't built (in development, Vite serves it). */
  ui: string | null;
  version: string;
}

let cached: AppPaths | undefined;

/**
 * Where the app's files are. Two layouts:
 * - this repo: packages/server/{src,assets}, with challenges/ at the repo root;
 * - the published package: {dist,assets,challenges,ui}/ next to its package.json
 *   (built by scripts/build-release.ts).
 */
export function appPaths(): AppPaths {
  if (cached) return cached;
  const root = findPackageRoot(import.meta.dirname);
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    name?: string;
    version?: string;
  };
  const published = pkg.name !== '@bughunt/server';
  const uiDir = process.env.BUGHUNT_UI_DIR ?? path.join(root, 'ui');

  cached = {
    challenges: published ? path.join(root, 'challenges') : path.resolve(root, '../../challenges'),
    vitestConfig: path.join(root, 'assets', 'vitest.config.mjs'),
    ui: existsSync(path.join(uiDir, 'index.html')) ? uiDir : null,
    version: pkg.version ?? '0.0.0',
  };
  return cached;
}

/** The nearest folder at or above `start` that has a package.json. */
function findPackageRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`No package.json found above ${start}`);
    dir = parent;
  }
}
