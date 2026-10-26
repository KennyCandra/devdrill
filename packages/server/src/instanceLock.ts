import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HOST } from './config.js';
import { TOKEN_HEADER } from './security.js';

/**
 * `<dataDir>/server.json` records the running server, so that:
 * - a second launch opens the running app instead of starting a rival server that
 *   would overwrite progress, and
 * - a restart reuses the token, so tabs that are already open keep working.
 */
export interface InstanceInfo {
  pid: number;
  port: number;
  token: string;
}

function lockFile(dataDir: string): string {
  return path.join(dataDir, 'server.json');
}

export async function readInstance(dataDir: string): Promise<InstanceInfo | null> {
  try {
    const raw = JSON.parse(await readFile(lockFile(dataDir), 'utf8')) as Partial<InstanceInfo>;
    if (typeof raw.pid !== 'number' || typeof raw.port !== 'number') return null;
    if (typeof raw.token !== 'string' || raw.token.length < 16) return null;
    return { pid: raw.pid, port: raw.port, token: raw.token };
  } catch {
    return null;
  }
}

/** True if the recorded server is alive and answers with the recorded token. */
export async function isRunning(info: InstanceInfo): Promise<boolean> {
  try {
    process.kill(info.pid, 0);
  } catch {
    return false;
  }
  try {
    const res = await fetch(`http://${HOST}:${info.port}/api/session`, {
      headers: { [TOKEN_HEADER]: info.token },
      signal: AbortSignal.timeout(1000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function writeInstance(dataDir: string, info: InstanceInfo): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  // Only the user can read it: the token lets anyone run code through the server.
  await writeFile(lockFile(dataDir), JSON.stringify(info, null, 2) + '\n', { mode: 0o600 });
}

/**
 * Hosted mode without DEVDRILL_TOKEN: the token made on the first start, kept in the data
 * folder (a volume), so the shared link survives restarts and deploys.
 */
export async function hostedToken(dataDir: string, create: () => string): Promise<string> {
  const file = path.join(dataDir, 'hosted-token');
  try {
    const saved = (await readFile(file, 'utf8')).trim();
    if (saved) return saved;
  } catch {
    // First start.
  }
  const token = create();
  await mkdir(dataDir, { recursive: true });
  await writeFile(file, token + '\n', { mode: 0o600 });
  return token;
}
