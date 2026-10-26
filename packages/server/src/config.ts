import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// The CLI and package name. Keep every user-facing use of the name behind this constant.
export const APP_NAME = 'devdrill';

export const HOST = '127.0.0.1';

export const DEFAULT_PORT = 3000;

export interface HostedConfig {
  /** Where people open the app, e.g. https://devdrill-ada.up.railway.app. */
  publicUrl: string;
  /** Fixed, so the link you share keeps working across restarts and deploys. */
  token: string;
  port: number;
}

/**
 * Hosted mode, for running on a server (e.g. Railway) for a few trusted people, set by
 * environment variables: DEVDRILL_PUBLIC_URL, DEVDRILL_TOKEN and the platform's PORT.
 * Null when DEVDRILL_PUBLIC_URL isn't set: the normal local app.
 * Everyone with the link shares one progress and can run code on the server, so give
 * each person their own deployment, and the link only to people you trust.
 */
export function hostedConfig(env: NodeJS.ProcessEnv = process.env): HostedConfig | null {
  const publicUrl = env.DEVDRILL_PUBLIC_URL?.trim();
  if (!publicUrl) return null;
  let url: URL;
  try {
    url = new URL(publicUrl);
  } catch {
    throw new Error(`DEVDRILL_PUBLIC_URL must be a full URL, like https://x.up.railway.app.`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('DEVDRILL_PUBLIC_URL must start with https:// or http://.');
  }
  const token = env.DEVDRILL_TOKEN?.trim() ?? '';
  // Anyone with the token can run code on the server: it must be hard to guess.
  if (!/^[A-Za-z0-9_-]{24,}$/.test(token)) {
    throw new Error(
      'Hosted mode needs DEVDRILL_TOKEN: at least 24 letters, digits, - or _ (e.g. from `openssl rand -base64 32 | tr "+/" "-_" | tr -d =`).',
    );
  }
  const port = Number(env.PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT must be a port number, not "${env.PORT}".`);
  }
  return { publicUrl: url.origin, token, port };
}

/** Workspaces, progress and settings. `DEVDRILL_HOME` overrides it (used by tests). */
export function dataDir(): string {
  return process.env.DEVDRILL_HOME ?? path.join(homedir(), `.${APP_NAME}`);
}

export interface AppPaths {
  /** The challenges that ship with the app. */
  challenges: string;
  /** The Vitest config every challenge run uses. */
  vitestConfig: string;
  /** The Vitest reporter that saves console output from a run. */
  consoleReporter: string;
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
  const published = pkg.name !== '@devdrill/server';
  const uiDir = process.env.DEVDRILL_UI_DIR ?? path.join(root, 'ui');

  cached = {
    challenges: published ? path.join(root, 'challenges') : path.resolve(root, '../../challenges'),
    vitestConfig: path.join(root, 'assets', 'vitest.config.mjs'),
    consoleReporter: path.join(root, 'assets', 'console-reporter.mjs'),
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
