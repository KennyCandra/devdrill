// Installs the built package the way a user would and checks it works end to end:
// pack release/, install the tarball into an empty folder (no install scripts), start
// the server, load the UI, and solve challenge #1 through the API.
//
//   npm run build:release && npm run smoke:release
//
// Exits with code 1 on the first failed check. Used by CI on Linux and Windows.

import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { APP_NAME } from '../packages/server/src/config.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHALLENGE = 'debug-001-cart-discount';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Check failed: ${message}`);
  console.log(`  ✓ ${message}`);
}

function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32', // npm is npm.cmd on Windows
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

const work = await mkdtemp(path.join(tmpdir(), `${APP_NAME}-smoke-`));
const app = path.join(work, 'app');
const home = path.join(work, 'home');
let server: ReturnType<typeof spawn> | undefined;

try {
  console.log('Packing and installing…');
  run('npm', ['pack', path.join(ROOT, 'release'), '--pack-destination', work], ROOT);
  const tarball = (await readdir(work)).find((f) => f.endsWith('.tgz'));
  check(tarball, 'the package packs');
  await mkdir(app);
  await writeFile(path.join(app, 'package.json'), '{ "name": "smoke", "private": true }\n');
  run(
    'npm',
    ['install', path.join(work, tarball), '--ignore-scripts', '--no-audit', '--no-fund'],
    app,
  );

  const cli = path.join(app, 'node_modules', APP_NAME, 'dist', 'cli.js');
  const releasePkg = JSON.parse(
    await readFile(path.join(ROOT, 'release/package.json'), 'utf8'),
  ) as {
    version: string;
  };
  check(run(process.execPath, [cli, '--version'], app) === releasePkg.version, '--version works');

  console.log('Starting the server…');
  const port = await freePort();
  server = spawn(process.execPath, [cli, '--no-open', '--port', String(port)], {
    cwd: app,
    env: { ...process.env, BUGHUNT_HOME: home },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const token = await new Promise<string>((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Server didn't start:\n${output}`)), 30_000);
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const match = /#token=(\S+)/.exec(output);
      if (match?.[1]) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    };
    server!.stdout?.on('data', onData);
    server!.stderr?.on('data', onData);
    server!.on('exit', (code) => reject(new Error(`Server exited (${code}):\n${output}`)));
  });
  check(token.length > 16, 'the server prints a link with a token');

  const base = `http://127.0.0.1:${port}`;
  const api = async (method: string, route: string, body?: unknown) => {
    const res = await fetch(`${base}/api${route}`, {
      method,
      headers: {
        'x-bughunt-token': token,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) throw new Error(`${method} ${route}: ${res.status} ${await res.text()}`);
    return (await res.json()) as Record<string, unknown>;
  };

  const page = await fetch(`${base}/`);
  check(page.ok && (await page.text()).includes('<div id="root">'), 'the UI loads');
  check(
    page.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"),
    'the UI has a CSP',
  );

  const list = (await api('GET', '/challenges')) as unknown as unknown[];
  check(list.length >= 8, `the challenges load (${list.length})`);

  await api('POST', `/challenges/${CHALLENGE}/start`);
  const before = await api('POST', `/workspaces/${CHALLENGE}/run`);
  check(before.status === 'failed', 'the buggy starter fails its tests');

  const file = `/workspaces/${CHALLENGE}/files?path=src/discount.js`;
  const { content } = (await api('GET', file)) as { content: string };
  await api('PUT', file, { content: content.replace("'percentage'", "'percent'") });
  const submit = (await api('POST', `/workspaces/${CHALLENGE}/submit`, {})) as { solved: boolean };
  check(submit.solved, 'the fixed code solves the challenge, hidden tests included');

  console.log('Smoke test passed.');
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  server?.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await rm(work, { recursive: true, force: true }).catch(() => undefined);
}
