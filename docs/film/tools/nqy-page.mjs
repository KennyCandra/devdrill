// A headless Chrome page over DevTools, for "Not quite yet": no dependencies, Node's global
// WebSocket. The page is DOM, so frames are screenshots rather than canvas reads.
/* global console, fetch, URL, WebSocket */
import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export const OUT = fileURLToPath(new URL('../out/', import.meta.url));
mkdirSync(OUT, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openChrome({ width = 1440, height = 810, scale = 1 } = {}) {
  const port = 9800 + Math.floor(Math.random() * 180);
  const profile = mkdtempSync(join(tmpdir(), 'nqy-chrome-'));
  const proc = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      `--window-size=${width},${height}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let target;
  for (let i = 0; i < 100 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((x) => x.type === 'page');
    } catch {
      // Chrome is still starting.
    }
    if (!target) await sleep(150);
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
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      logs.push(
        `EXC ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`,
      );
    } else if (m.method === 'Runtime.consoleAPICalled') {
      logs.push(`${m.params.type} ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
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
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: false,
  });
  const goto = async (url) => {
    await send('Page.navigate', { url });
  };
  const shot = async (format = 'png', quality) => {
    const r = await send('Page.captureScreenshot', {
      format,
      ...(quality ? { quality } : {}),
      captureBeyondViewport: false,
      fromSurface: true,
    });
    return Buffer.from(r.data, 'base64');
  };
  const close = async () => {
    await send('Browser.close').catch(() => {});
    proc.kill();
    ws.close();
    setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500);
  };
  return { send, evaluate, goto, shot, close, logs };
}

export const log = (...args) => console.log(...args);
