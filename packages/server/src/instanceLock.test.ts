import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { createServer as createNetServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { appPaths } from './config.js';
import { isRunning, readInstance, writeInstance } from './instanceLock.js';
import { loadChallenges } from './services/challengeLoader.js';

let dataDir: string;
let server: Server;
let port: number;

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'devdrill-instance-test-'));
  // Local mode: no token.
  const app = createApp({
    challenges: await loadChallenges(appPaths().challenges),
    dataDir,
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.close();
  await rm(dataDir, { recursive: true, force: true });
});

describe('instance file', () => {
  it('records the pid and port, with no token', async () => {
    await writeInstance(dataDir, { pid: process.pid, port });
    const raw = await readFile(path.join(dataDir, 'server.json'), 'utf8');
    expect(raw).not.toContain('token');
    expect(await readInstance(dataDir)).toEqual({ pid: process.pid, port });
  });

  it('reads an older file that still has a token, without crashing', async () => {
    await writeFile(
      path.join(dataDir, 'server.json'),
      JSON.stringify({ pid: 123, port: 3000, token: 'old-token-0123456789abcdef' }),
    );
    expect(await readInstance(dataDir)).toEqual({ pid: 123, port: 3000 });
  });

  it('treats a broken or missing file as no server', async () => {
    await writeFile(path.join(dataDir, 'server.json'), '{ not json');
    expect(await readInstance(dataDir)).toBeNull();
    await writeFile(path.join(dataDir, 'server.json'), JSON.stringify({ port: 3000 }));
    expect(await readInstance(dataDir)).toBeNull();
    expect(await readInstance(path.join(dataDir, 'nowhere'))).toBeNull();
  });
});

describe('isRunning', () => {
  it('finds a local server without any token', async () => {
    expect(await isRunning({ pid: process.pid, port })).toBe(true);
  });

  it('says no when the recorded process is gone', async () => {
    // A pid that can't be alive: above the usual range, so it's never a real process.
    expect(await isRunning({ pid: 2 ** 22 + 7, port })).toBe(false);
  });

  it('says no when nothing answers on the recorded port', async () => {
    // Ask the OS for a port that's free, then let it go.
    const free = await new Promise<number>((resolve) => {
      const probe = createNetServer().listen(0, '127.0.0.1', () => {
        const { port: taken } = probe.address() as AddressInfo;
        probe.close(() => resolve(taken));
      });
    });
    expect(await isRunning({ pid: process.pid, port: free })).toBe(false);
  });
});
