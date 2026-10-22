// Starts the API server and the Vite dev server together.
//
//   npm run dev
//
// Dev data lives in .dev-data/ (git-ignored), so it never touches your real ~/.bughunt.

import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEV_ORIGIN = 'http://localhost:5173';
const children: ChildProcess[] = [];

function start(command: string, args: string[], env: Record<string, string>): ChildProcess {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: process.platform === 'win32',
  });
  children.push(child);
  return child;
}

const server = start('npx', ['tsx', 'watch', 'packages/server/src/index.ts', '--no-open'], {
  BUGHUNT_HOME: path.join(ROOT, '.dev-data'),
  BUGHUNT_DEV_ORIGIN: DEV_ORIGIN,
});

let viteStarted = false;
let output = '';
server.stdout?.on('data', (chunk: Buffer) => {
  const text = chunk.toString();
  process.stdout.write(`[server] ${text}`);
  // Keep everything seen so far: the line we need can arrive split across chunks.
  if (!viteStarted) output += text;

  // The server prints "Open: http://127.0.0.1:<port>/#token=<token>"; reuse both for Vite.
  // It also prints this when a dev server is already running, so both cases work.
  const match = /Open: http:\/\/127\.0\.0\.1:(\d+)\/#token=(\S+)\n/.exec(output);
  if (!match || viteStarted) return;
  viteStarted = true;
  const [, port = '3000', token = ''] = match;

  const vite = start('npx', ['vite', 'packages/web'], { BUGHUNT_API_PORT: port });
  vite.stdout?.on('data', (c: Buffer) => process.stdout.write(`[web] ${c.toString()}`));
  console.log(`\nDev UI: ${DEV_ORIGIN}/#token=${token}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    for (const child of children) child.kill(signal);
    process.exit(0);
  });
}
