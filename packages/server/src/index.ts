import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import open from 'open';
import { createApp } from './app.js';
import { APP_NAME, appPaths, dataDir, DEFAULT_PORT, HOST } from './config.js';
import { isRunning, readInstance, writeInstance } from './instanceLock.js';
import { createSessionToken } from './security.js';
import { loadChallenges } from './services/challengeLoader.js';
import { removeAllTempDirs } from './services/tempDirs.js';
import { killAllTestRuns } from './services/testRunner.js';

const args = new Set(process.argv.slice(2));
const home = dataDir();
const appUrl = (port: number, token: string) => `http://${HOST}:${port}/#token=${token}`;

// One server per data folder: two would overwrite each other's progress.
const previous = await readInstance(home);
if (previous && (await isRunning(previous))) {
  const url = appUrl(previous.port, previous.token);
  console.log(`${APP_NAME} is already running.\nOpen: ${url}`);
  if (!args.has('--no-open')) await openBrowser(url);
  process.exit(0);
}

// Reusing the last token keeps tabs from a previous run working after a restart.
const token = previous?.token ?? createSessionToken();
const challenges = await loadChallenges(appPaths().challenges);

const app = createApp({
  challenges,
  dataDir: home,
  token,
  // The Vite dev server (milestone M3) proxies /api from this origin.
  extraOrigins: process.env.BUGHUNT_DEV_ORIGIN ? [process.env.BUGHUNT_DEV_ORIGIN] : [],
});

const server = await listen(previous?.port ?? DEFAULT_PORT);
const { port } = server.address() as AddressInfo;
await writeInstance(home, { pid: process.pid, port, token });

// The token goes in the fragment so it never reaches server logs or Referer headers.
const url = appUrl(port, token);
console.log(`${APP_NAME} is running with ${challenges.size} challenges.`);
console.log(`Open: ${url}`);
console.log('Press Ctrl+C to stop.');
if (!args.has('--no-open')) await openBrowser(url);

// server.json stays on shutdown: the next start sees this pid is gone and reuses the token.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    killAllTestRuns();
    removeAllTempDirs();
    server.close();
    process.exit(0);
  });
}

async function openBrowser(target: string): Promise<void> {
  try {
    await open(target);
  } catch {
    console.log('Could not open a browser; open the link above yourself.');
  }
}

/** Listens on `preferred`, or on any free port if it's taken. */
function listen(preferred: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const first = app.listen(preferred, HOST);
    first.once('listening', () => resolve(first));
    first.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EADDRINUSE') return reject(err);
      const fallback = app.listen(0, HOST);
      fallback.once('listening', () => resolve(fallback));
      fallback.once('error', reject);
    });
  });
}
