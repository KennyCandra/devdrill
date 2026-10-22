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

/** The challenges that ship with the app: the repo's challenges/ folder. */
export function challengesDir(): string {
  return path.resolve(import.meta.dirname, '../../../challenges');
}
