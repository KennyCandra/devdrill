// Minimal Chrome DevTools client: no dependencies, Node's global WebSocket.
/* global console, fetch, URL, WebSocket */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FILM = fileURLToPath(new URL('../read-the-code.html', import.meta.url));

// Rendered output stays out of git (see docs/film/.gitignore).
export const OUT = fileURLToPath(new URL('../out/', import.meta.url));
mkdirSync(OUT, { recursive: true });

export async function openFilm(
  query = 't=0',
  { port = 9400 + Math.floor(Math.random() * 400) } = {},
) {
  const profile = mkdtempSync(join(tmpdir(), 'film-chrome-'));
  const proc = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--enable-gpu',
      '--use-angle=metal',
      '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--window-size=1920,1080',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let target;
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((x) => x.type === 'page');
      if (target) break;
    } catch {
      // Chrome is still starting.
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      logs.push(
        'EXC ' +
          (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text),
      );
    } else if (m.method === 'Runtime.consoleAPICalled') {
      logs.push(m.params.type + ' ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    } else if (m.method === 'Log.entryAdded') {
      logs.push('LOG ' + m.params.entry.text);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails)
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: `${pathToFileURL(FILM)}?${query}` });
  for (let i = 0; i < 300; i++) {
    const ok = await evaluate('typeof window.ready !== "undefined"').catch(() => false);
    if (ok) break;
    if (logs.some((l) => l.startsWith('EXC'))) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (logs.some((l) => l.startsWith('EXC'))) {
    console.error(logs.join('\n'));
  } else {
    await evaluate('window.ready.then(()=>true)');
  }
  const close = async () => {
    await send('Browser.close').catch(() => {});
    proc.kill();
    ws.close();
    setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500);
  };
  return { send, evaluate, close, logs };
}

export const grab = (page, type = 'image/png', q) =>
  page.evaluate(
    `document.querySelector('canvas').toDataURL('${type}'${q ? ',' + q : ''}).split(',')[1]`,
  );
