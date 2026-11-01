// Plays the film's exact session in the real app, on the film's clock, with its data in a temp
// folder (never the real ~/.devdrill). Keeps what the app showed: screenshots of the five states
// at 1440x810, the page around them, the app's CSS, and a recording of the editor's DOM, which
// the film replays instead of imitating Monaco.
// node docs/film/tools/nqy-realapp.mjs
/* global URL */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { OUT, log, openChrome, sleep } from './nqy-page.mjs';
import { EVENTS, STATES, mouseAt } from './nqy-script.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ID = 'debug-004-async-report';
const DIR = `${OUT}nqy-real/`;
const VITE_ORIGIN = 'http://localhost:5173';
// Started early so setup can finish: the film's clock starts when this ticks over to 11:40.
const SEED_MS = 11 * 60_000 + 28_000;
const SESSION = JSON.parse(readFileSync(new URL('../session.json', import.meta.url), 'utf8'));
mkdirSync(DIR, { recursive: true });

const home = mkdtempSync(join(tmpdir(), 'nqy-home-'));
const kids = [];
const start = (cmd, args, env) => {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  kids.push(child);
  return child;
};
process.once('exit', () => {
  for (const k of kids) k.kill('SIGTERM');
});
const server = start('npx', ['tsx', 'packages/server/src/index.ts', '--no-open'], {
  DEVDRILL_HOME: home,
  DEVDRILL_DEV_ORIGIN: VITE_ORIGIN,
});
const opened = await new Promise((resolve, reject) => {
  let text = '';
  server.stdout.on('data', (c) => {
    text += c;
    const m = /Open: http:\/\/127\.0\.0\.1:(\d+)\/#token=(\S+)\n/.exec(text);
    if (m) resolve({ port: m[1], token: m[2] });
  });
  server.stderr.on('data', (c) => process.stderr.write(c));
  server.on('exit', () => reject(new Error(`server stopped: ${text}`)));
});
const vite = start('npx', ['vite', 'packages/web'], { DEVDRILL_API_PORT: opened.port });
await new Promise((resolve, reject) => {
  vite.stdout.on('data', (c) => /ready in/.test(String(c)) && resolve());
  vite.on('exit', () => reject(new Error('Vite stopped; is port 5173 in use?')));
});

const page = await openChrome({ width: 1440, height: 810, scale: 1 });
const done = async (code = 0) => {
  await page.close().catch(() => {});
  for (const k of kids) k.kill('SIGTERM');
  rmSync(home, { recursive: true, force: true });
  process.exit(code);
};

await page.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try { if (!localStorage.getItem('nqy-seeded')) { localStorage.setItem('nqy-seeded', '1'); localStorage.setItem('devdrill-time-js-${ID}', '${SEED_MS}'); } } catch {}`,
});
await page.goto(`${VITE_ORIGIN}/challenge/${ID}#token=${opened.token}`);
const waitFor = async (expr, what, ms = 90_000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await page.evaluate(expr).catch(() => false)) return;
    await sleep(15);
  }
  throw new Error(`Timed out waiting for ${what}`);
};
await waitFor(`!!document.querySelector('.view-lines .view-line')`, 'the editor');
await sleep(800);

// ------------------------------------------------------------------ input
const fire = (type, x, y, extra = {}) =>
  page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
const CODES = {
  ' ': ['Space', 32, 0],
  '(': ['Digit9', 57, 8],
  ')': ['Digit0', 48, 8],
  '.': ['Period', 190, 0],
};
const keyboard = async (text) => {
  const [code, keyCode, modifiers] = CODES[text] ?? [
    `Key${text.toUpperCase()}`,
    text.toUpperCase().charCodeAt(0),
    /[A-Z]/.test(text) ? 8 : 0,
  ];
  const base = { key: text, code, windowsVirtualKeyCode: keyCode, modifiers };
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    text,
    unmodifiedText: text,
    ...base,
  });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
};
const special = async (name, vk, modifiers = 0) => {
  const base = { key: name, code: name, windowsVirtualKeyCode: vk, modifiers };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
};
const META = 4;
const SHIFT = 8;
const center = (expr) =>
  page.evaluate(
    `(() => { const r = (${expr}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
  );
const button = (pattern) =>
  `[...document.querySelectorAll('button')].find((b) => ${pattern}.test(b.innerText))`;

let dragging = false;
const play = async (e) => {
  if (e.type === 'click') {
    const modifiers = e.shift ? SHIFT : 0;
    await fire('mousePressed', e.x, e.y, {
      button: 'left',
      buttons: 1,
      clickCount: e.count,
      modifiers,
    });
    await fire('mouseReleased', e.x, e.y, { button: 'left', clickCount: e.count, modifiers });
  } else if (e.type === 'press') {
    dragging = true;
    await fire('mousePressed', e.x, e.y, { button: 'left', buttons: 1, clickCount: 1 });
  } else if (e.type === 'release') {
    dragging = false;
    await fire('mouseReleased', e.x, e.y, { button: 'left', clickCount: 1 });
  } else if (e.type === 'key') {
    await keyboard(e.ch);
  } else if (e.type === 'backspace') {
    await special('Backspace', 8);
  } else if (e.type === 'run') {
    await special('Enter', 13, META);
  } else if (e.type === 'submit') {
    await special('Enter', 13, META | SHIFT);
  }
};

// ------------------------------------------------------------------ setup
const reportRow = `[...document.querySelectorAll('nav[aria-label=Files] button')].find((b) => b.innerText.trim() === 'report.js')`;
const file = await center(reportRow);
await fire('mousePressed', file.x, file.y, { button: 'left', buttons: 1, clickCount: 1 });
await fire('mouseReleased', file.x, file.y, { button: 'left', clickCount: 1 });
await waitFor(
  `/buildDailyReport/.test(document.querySelector('.view-lines').innerText)`,
  'report.js',
);
await sleep(400);
const run = await center(button('/Run tests/'));
await fire('mouseMoved', run.x, run.y);
await fire('mousePressed', run.x, run.y, { button: 'left', buttons: 1, clickCount: 1 });
await fire('mouseReleased', run.x, run.y, { button: 'left', clickCount: 1 });
await waitFor(`/2 failed/.test(document.body.innerText)`, 'the first run');
const startAt = mouseAt(0);
await fire('mouseMoved', startAt.x, startAt.y);
await sleep(400);

// The recorder: the editor's DOM each time it changes. Canvases become images; the hidden copy
// of the text Monaco keeps for the system is left out.
await page.evaluate(`(() => {
  window.__rec = [];
  window.__t0 = null;
  const snap = () => {
    const ed = document.querySelector('.monaco-editor');
    if (!ed || window.__t0 === null) return;
    const clone = ed.cloneNode(true);
    clone.querySelectorAll('.native-edit-context, textarea').forEach((n) => n.remove());
    const live = [...ed.querySelectorAll('canvas')];
    [...clone.querySelectorAll('canvas')].forEach((c, i) => {
      const img = document.createElement('img');
      img.setAttribute('src', live[i].width && live[i].height ? live[i].toDataURL() : '');
      img.setAttribute('style', live[i].getAttribute('style') ?? '');
      img.setAttribute('class', live[i].getAttribute('class') ?? '');
      c.replaceWith(img);
    });
    window.__rec.push({ t: (performance.now() - window.__t0) / 1000, html: clone.outerHTML });
  };
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; snap(); });
  }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  window.__snap = snap;
})()`);

// Start on the tick: the top bar shows 11:40 at the film's t = 0, like the film.
const readTimer = `document.querySelector('button[aria-label^="Time on this attempt"]')?.innerText.trim()`;
await waitFor(`${readTimer} === '11:40'`, 'the timer to reach 11:40', 30_000);
const t0 = Date.now();
await page.evaluate(`window.__t0 = performance.now(); window.__snap();`);

const trouble = [];
const pages = {};
const css = {};
const seen = {};
const sheetText = `[...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].map((r) => r.cssText); } catch { return []; } })`;
const keepCss = async () => {
  for (const rule of await page.evaluate(sheetText)) css[rule] = true;
};

try {
  const queue = [...EVENTS];
  const shots = [...STATES];
  let last = { x: -1, y: -1 };
  let late = 0;
  while (queue.length || shots.length) {
    const now = (Date.now() - t0) / 1000;
    const m = mouseAt(now);
    if (Math.hypot(m.x - last.x, m.y - last.y) > 0.2) {
      await fire('mouseMoved', m.x, m.y, dragging ? { button: 'left', buttons: 1 } : {});
      last = m;
    }
    if (queue[0] && now >= queue[0].t) {
      const e = queue.shift();
      late = Math.max(late, now - e.t);
      await play(e);
    }
    if (shots[0] && now >= shots[0].t) {
      const s = shots.shift();
      const shotAt = (Date.now() - t0) / 1000;
      writeFileSync(`${DIR}${s.name}.png`, await page.shot());
      pages[s.name] = await page.evaluate(`document.getElementById('root').outerHTML`);
      seen[s.name] = {
        t: shotAt,
        text: await page.evaluate(`document.getElementById('root').innerText`),
        timer: await page.evaluate(`${readTimer} ?? null`),
      };
      await keepCss();
    }
    await sleep(2);
  }
  const rec = await page.evaluate('window.__rec');
  if (
    !/const rows = await Promise\.all/.test(
      (seen['4-real-fix']?.text ?? '').replace(/\u00a0/g, ' '),
    )
  ) {
    trouble.push('the real fix did not land');
  }
  if (!/Solved/.test(seen['5-solved']?.text ?? '')) trouble.push('no Solved page');
  writeFileSync(
    `${DIR}capture.json`,
    JSON.stringify({ rec, pages, css: Object.keys(css), seen, late }),
  );
  log(`recorded ${rec.length} editor snapshots; latest event ${(late * 1000).toFixed(0)} ms late`);
  for (const [name, s] of Object.entries(seen)) log(name, `t ${s.t.toFixed(2)}`, 'timer', s.timer);
  log(trouble.length ? `TROUBLE: ${trouble.join('; ')}` : 'the session reached Solved');
  log(
    'session.json real fix submitted',
    SESSION.realFix.submitted.passed,
    'of',
    SESSION.realFix.submitted.total,
  );
  await done(trouble.length ? 1 : 0);
} catch (err) {
  log(String(err?.stack ?? err));
  writeFileSync(`${DIR}failed.png`, await page.shot());
  await done(1);
}
