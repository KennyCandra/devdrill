// The film's runtime. nqy-build.mjs places it in docs/film/not-quite-yet.html, after
// nqy-script.mjs and the data the real session produced:
//   SESSION  docs/film/session.json, what Vitest said
//   PAGES    the real app's page around each screen
//   KEYS/FRAGS  the recording of the real editor's DOM
// window.renderAt(t) is a pure function of t. ?t= freezes a frame; &nocam=1 and &nomouse=1 give
// a frame to compare with a screenshot of the real app.
/* global SESSION, PAGES, FRAGS, KEYS, ICONS, DURATION, FPS, SCREENS, EVENTS, TERMINAL_TEXT, TERMINAL_KEYS, mouseAt, cameraAt, OfflineAudioContext, window, document, location, URLSearchParams, performance, requestAnimationFrame, btoa */
const query = new URLSearchParams(location.search);
const NOCAM = query.has('nocam');
const NOMOUSE = query.has('nomouse');

const stage = document.getElementById('stage');
const root = document.getElementById('root');
const term = document.getElementById('term');
const mouseEl = document.getElementById('mouse');

// ------------------------------------------------------------ timing from the session
const RUN_AT = EVENTS.find((e) => e.type === 'run').t;
const RUN_END = RUN_AT + SESSION.firstFix.visible.durationMs / 1000;
const SUBMIT_AT = EVENTS.find((e) => e.type === 'click' && e.x > 1300).t;
const SUBMIT2_AT = EVENTS.find((e) => e.type === 'submit').t;
const WS2_AT = SCREENS.find((s) => s.name === 'workspace2').at;
const NQY_AT = SCREENS.find((s) => s.name === 'notQuiteYet').at;
const SOLVED_AT = SCREENS.find((s) => s.name === 'solved').at;
const REPORT_OPEN_AT = EVENTS.find((e) => e.type === 'click' && e.t > WS2_AT).t;
const TIMER_START_MS = 11 * 60_000 + 40_000;
// The timer only counts on the workspace, so it stands still on the results page.
const WS2_MOUNT = 14.94;

const elapsedMs = (t) => {
  const first = TIMER_START_MS + Math.floor(Math.min(t, NQY_AT)) * 1000;
  if (t < WS2_AT) return first;
  return first + Math.max(0, Math.floor(t - WS2_MOUNT)) * 1000;
};
const formatDuration = (ms) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const screenAt = (t) => {
  let s = SCREENS[0].name;
  for (const c of SCREENS) if (t >= c.at) s = c.name;
  return s;
};

const EDITS = EVENTS.filter((e) => e.type === 'key' || e.type === 'backspace').map((e) => e.t);
const FLUSHES = [RUN_AT, SUBMIT_AT, SUBMIT2_AT];
const AUTOSAVE = 0.6;
const SAVE_TAKES = 0.02;

/** The FileStore's state: 'saved', 'dirty' or 'saving'. */
const saveState = (t) => {
  let last = -1;
  for (const e of EDITS) if (e <= t) last = e;
  if (last < 0) return 'saved';
  let saveAt = last + AUTOSAVE;
  for (const f of FLUSHES) if (f >= last && f < saveAt) saveAt = f;
  if (t < saveAt) return 'dirty';
  return t < saveAt + SAVE_TAKES ? 'saving' : 'saved';
};

// ------------------------------------------------------------ the app's markup
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const icon = (name, size, cls, extra = '') =>
  ICONS[name]
    .replace(/width="\d+"/, `width="${size}"`)
    .replace(/height="\d+"/, `height="${size}"`)
    .replace(/class="[^"]*"/, `class="lucide lucide-${name} ${cls}"`)
    .replace('<svg', `<svg ${extra}`);
const SPINNER =
  '<span aria-hidden="true" class="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent "></span>';
const kbd = (s) =>
  `<kbd class="rounded border border-line-strong px-1 font-mono text-[10px] text-muted">${s}</kbd>`;

const BTN =
  'inline-flex h-7 items-center gap-1.5 rounded px-3 text-[13px] whitespace-nowrap transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60';

function footerHTML(running, submitting) {
  const busy = running || submitting;
  const off = busy ? ' disabled=""' : '';
  return `
<button type="button" class="${BTN} text-fg hover:bg-hover "${off}>${icon('rotate-ccw', 14, '')} Reset</button>
<button type="button" class="${BTN} bg-hover text-fg hover:bg-active border border-line-strong ml-auto" data-hover="run"${off}>${running ? SPINNER : icon('play', 14, '')}${running ? 'Running…' : 'Run tests'}${kbd('⌘ ↵')}</button>
<button type="button" class="${BTN} bg-accent-bg text-on-accent hover:bg-accent-bg-hover " data-hover="submit"${off}>${submitting ? SPINNER : icon('send', 14, '')}${submitting ? 'Submitting…' : 'Submit'}</button>`;
}

function testRowHTML(test, index) {
  const mark =
    test.status === 'passed'
      ? icon('check', 13, 'shrink-0 text-success')
      : test.status === 'failed'
        ? icon('x', 13, 'shrink-0 text-danger')
        : icon('circle', 13, 'shrink-0 text-muted');
  const delay = Math.min(index, 20) * 15;
  return `<li class="animate-fade-in" data-delay="${delay}">
<div class="flex items-center gap-2">${mark}<span class="${test.status === 'failed' ? 'text-fg' : 'text-muted'}">${esc(test.name)}</span>${
    test.hidden
      ? `<span class="flex items-center gap-1 text-[11px] text-muted">${icon('eye-off', 11, '')} hidden</span>`
      : ''
  }</div>${
    test.message
      ? `<pre class="mt-1 mb-1 ml-5 whitespace-pre-wrap text-danger">${esc(test.message)}</pre>`
      : ''
  }${
    test.rule && test.status === 'failed'
      ? `<p class="mt-1 mb-1 ml-5 flex gap-1.5 rounded-sm bg-warning-bg px-2 py-1 font-sans text-[12px] leading-relaxed text-fg">${icon('book-open', 13, 'mt-0.5 shrink-0 text-warning')}<span><span class="text-warning">From the task: </span>“${esc(test.rule)}”</span></p>`
      : ''
  }${
    test.detailsHidden
      ? '<p class="mt-0.5 mb-1 ml-5 font-sans text-[12px] text-muted">Details unlock when you solve the challenge.</p>'
      : ''
  }</li>`;
}

// Visible failures first, then hidden failures, then the rest, as TestPanel sorts them.
const sortForFixing = (tests) => {
  const rank = (t) => (t.status !== 'failed' ? 2 : t.hidden ? 1 : 0);
  return [...tests].sort((a, b) => rank(a) - rank(b));
};
const testListHTML = (run) =>
  `<ul class="flex flex-col gap-1">${sortForFixing(run.tests).map(testRowHTML).join('')}</ul>`;

function testPanelHTML(run, running) {
  const summary = running
    ? `<span class="flex items-center gap-2 text-muted">${SPINNER} Running tests…</span>`
    : run
      ? `<span class="flex items-center gap-3"><span class="text-success">${run.passed} passed</span>${
          run.failed > 0 ? `<span class="text-danger">${run.failed} failed</span>` : ''
        }<span class="text-muted">${(run.durationMs / 1000).toFixed(1)}s</span></span>`
      : '';
  const body = run
    ? running
      ? ''
      : testListHTML(run)
    : running
      ? ''
      : `<p class="font-sans text-muted">Run the tests to see results. ${kbd('⌘')} ${kbd('Enter')}</p>`;
  return `<header class="flex h-8 shrink-0 items-center gap-3 border-b border-line px-3"><span class="text-[11px] font-semibold tracking-wide text-muted uppercase">Tests</span><span role="status" class="flex items-center gap-2">${summary}</span></header><div class="flex-1 overflow-auto px-3 py-2 font-mono text-[12px]">${body}</div>`;
}

function tabsHTML(tabs, active, unsaved) {
  return tabs
    .map((path) => {
      const selected = path === active;
      const dirty = unsaved && selected;
      return `<div class="group flex items-center gap-1 border-r border-line pr-1 pl-3 font-mono text-[12px] ${selected ? 'bg-bg text-fg' : 'text-muted hover:bg-hover'}"><button type="button" class="rounded focus-visible:outline-2 focus-visible:outline-accent">${path}</button><button type="button" class="flex size-5 items-center justify-center rounded hover:bg-active focus-visible:outline-2 focus-visible:outline-accent">${
        dirty
          ? '<span aria-hidden="true" class="size-2 rounded-full bg-fg group-hover:hidden"></span>'
          : ''
      }${icon('x', 12, dirty ? 'hidden group-hover:block' : '')}</button></div>`;
    })
    .join('');
}

// ------------------------------------------------------------ the editor recording
const expanded = KEYS.map((k) => ({ t: k.t, parts: k.f }));
const editorHTML = (i) => expanded[i].parts.map((n) => FRAGS[n]).join('');
const keyframeAt = (t) => {
  // The second workspace plays the second part of the recording, from the click on "Back".
  const floor = t >= WS2_AT ? expanded.findIndex((k) => k.t >= 14.88) : 0;
  const lo = Math.max(0, floor);
  let found = lo;
  for (let i = lo; i < expanded.length; i++) {
    if (expanded[i].t > t) break;
    found = i;
  }
  return found;
};

const caretAt = (t) => {
  let reset = -1;
  for (const e of EVENTS) {
    if (e.t > t) break;
    if (['key', 'backspace', 'click', 'press', 'release'].includes(e.type)) reset = e.t;
  }
  return reset >= 0 && (t - reset) % 1 < 0.5;
};

const clamp01 = (u) => Math.min(1, Math.max(0, u));
const easeOut = (u) => 1 - (1 - u) ** 3;
// The app's pop-in: cubic-bezier(0.2, 0.9, 0.3, 1.2), solved for x.
function bezierY(x) {
  let lo = 0;
  let hi = 1;
  const bx = (s) => 3 * (1 - s) ** 2 * s * 0.2 + 3 * (1 - s) * s * s * 0.3 + s ** 3;
  const by = (s) => 3 * (1 - s) ** 2 * s * 0.9 + 3 * (1 - s) * s * s * 1.2 + s ** 3;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (bx(m) < x) lo = m;
    else hi = m;
  }
  return by((lo + hi) / 2);
}

// The app's only hover states the mouse meets on its way.
const HOVERS = {
  workspace1: [
    { sel: '[data-hover="submit"]', box: [1341, 775, 1428, 803], from: '#0e639c', to: '#1177bb' },
  ],
  workspace2: [
    { sel: '[data-hover="submit"]', box: [1341, 775, 1428, 803], from: '#0e639c', to: '#1177bb' },
    { sel: '[data-row="report.js"]', box: [346, 117, 576, 139], from: null, to: '#2a2d2e' },
  ],
  notQuiteYet: [
    { sel: '[data-hover="back"]', box: [232, 235, 380, 263], from: '#0e639c', to: '#1177bb' },
  ],
};
const inBox = (p, b) => p.x >= b[0] && p.x <= b[2] && p.y >= b[1] && p.y <= b[3];
const hoverMix = (box, t) => {
  // transition-colors duration-100, as a box over the last 100 ms of the mouse's path.
  let n = 0;
  for (let i = 0; i < 6; i++) if (inBox(mouseAt(t - i / FPS), box)) n++;
  return n / 6;
};
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixColor = (a, b, k) => {
  const [x, y] = [hex(a ?? b), hex(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
};

// ------------------------------------------------------------ rendering, only what changed
const memo = new WeakMap();
const setHTML = (el, html) => {
  if (memo.get(el) !== html) {
    el.innerHTML = html;
    memo.set(el, html);
  }
};
let shown = null;
let refs = {};

function mountScreen(name) {
  shown = name;
  term.style.display = name === 'terminal' ? 'block' : 'none';
  root.style.display = name === 'terminal' ? 'none' : 'block';
  if (name === 'terminal') return;
  const page =
    name === 'workspace1'
      ? PAGES['1-bug']
      : name === 'workspace2'
        ? PAGES['4-real-fix']
        : name === 'solved'
          ? PAGES['5-solved']
          : PAGES['3-not-quite-yet'];
  root.innerHTML = page;
  refs = {};
  if (name.startsWith('workspace')) {
    const ed = root.querySelector('.monaco-editor');
    refs.editorHost = ed.parentElement;
    refs.tests = root.querySelector('section[aria-label="Test results"]');
    refs.tabs = root.querySelector('nav[aria-label="Open files"]');
    refs.files = root.querySelector('nav[aria-label="Files"]');
    refs.footer = root.querySelector('footer');
    refs.saved = root.querySelector('header [role="status"]');
    refs.timer = root.querySelector('button[aria-label^="Time on this attempt"]');
    refs.key = -1;
    refs.rows = {};
    for (const b of refs.files.querySelectorAll('button')) {
      const label = b.querySelector('.truncate')?.textContent;
      if (!label) continue;
      refs.rows[label] = b;
      b.setAttribute('data-row', label);
      // The page was saved mid-edit: its unsaved marks are drawn from t below.
      b.querySelectorAll('.rounded-full, .sr-only').forEach((n) => n.remove());
    }
  } else {
    fillResults(name);
  }
}

function fillResults(name) {
  const data = name === 'solved' ? SESSION.realFix.submitted : SESSION.firstFix.submitted;
  const active = formatDuration(elapsedMs(name === 'solved' ? SUBMIT2_AT : SUBMIT_AT));
  const values = root.querySelectorAll('dl dd');
  values[0].textContent = `${data.passed} / ${data.total}`;
  values[1].textContent = active;
  values[2].textContent = name === 'solved' ? '2' : '1';
  if (values[3]) values[3].textContent = active;
  const hiddenFailed = data.tests.filter((x) => x.hidden && x.status !== 'passed').length;
  root.querySelector('[role="status"] p').textContent =
    data.status === 'passed'
      ? 'Every test passes, including the hidden ones.'
      : `The visible tests pass, but ${hiddenFailed} hidden ${hiddenFailed === 1 ? 'test' : 'tests'} ${hiddenFailed === 1 ? 'fails' : 'fail'}. Hidden tests check edge cases the visible ones don't; re-read the task for clues.`;
  root.querySelector('section[aria-label="Test results"]').innerHTML = testListHTML(data);
  for (const b of root.querySelectorAll('main button')) {
    if (/Back to the code/.test(b.textContent) && name !== 'solved')
      b.setAttribute('data-hover', 'back');
  }
  refs.fades = [...root.querySelectorAll('.animate-fade-in')];
  refs.pop = root.querySelector('.animate-pop-in');
}

function renderWorkspace(name, t) {
  const second = name === 'workspace2';
  const opened = second ? t >= REPORT_OPEN_AT + 0.03 : true;
  const active = opened ? 'report.js' : 'orders.js';
  const save = saveState(t);
  const unsaved = save !== 'saved';

  refs.saved.textContent =
    save === 'dirty' ? 'Edited' : save === 'saving' ? 'Saving…' : 'All changes saved';
  const clock = formatDuration(elapsedMs(t));
  const svg = refs.timer.querySelector('svg');
  if (refs.timerText !== clock) {
    refs.timer.textContent = clock;
    refs.timer.prepend(svg);
    refs.timerText = clock;
  }

  setHTML(
    refs.tabs,
    tabsHTML(opened ? ['orders.js', 'report.js'] : ['orders.js'], active, unsaved),
  );

  for (const [file, row] of Object.entries(refs.rows)) {
    const on = file === active;
    row.classList.toggle('bg-active', on);
    row.classList.toggle('text-fg', on);
    let dot = row.querySelector('[data-dot]');
    const wants = unsaved && on;
    if (wants && !dot) {
      dot = document.createElement('span');
      dot.setAttribute('data-dot', '');
      dot.className = 'ml-auto size-1.5 shrink-0 rounded-full bg-fg';
      row.appendChild(dot);
    } else if (!wants && dot) {
      dot.remove();
    }
  }

  const k = keyframeAt(t);
  if (k !== refs.key) {
    refs.editorHost.querySelector('.monaco-editor')?.remove();
    refs.editorHost.insertAdjacentHTML('afterbegin', editorHTML(k));
    refs.key = k;
  }
  root.dataset.caret = caretAt(t) ? '1' : '0';

  // The scrollbar shows while the mouse is over the editor, then fades over 800 ms.
  const m = mouseAt(t);
  const inEditor = (p) => p.x >= 577 && p.y >= 72 && p.y <= 533;
  let bar = 0;
  if (inEditor(m)) bar = 1;
  else {
    for (let back = 0; back < 0.8; back += 1 / FPS) {
      if (inEditor(mouseAt(t - back))) {
        bar = 1 - back / 0.8;
        break;
      }
    }
  }
  root.style.setProperty('--sb', bar.toFixed(3));

  const running = second ? false : t >= RUN_AT && t < RUN_END;
  const submitting = second ? t >= SUBMIT2_AT : t >= SUBMIT_AT;
  const run = second ? null : t < RUN_AT ? SESSION.bug.visible : SESSION.firstFix.visible;
  setHTML(refs.tests, testPanelHTML(run, running || submitting));
  setHTML(refs.footer, footerHTML(running, submitting));

  const appeared = second ? -10 : t < RUN_AT ? -10 : RUN_END;
  animateFades(refs.tests.querySelectorAll('.animate-fade-in'), t - appeared);
  for (const s of root.querySelectorAll('.animate-spin'))
    s.style.transform = `rotate(${(t * 360) % 360}deg)`;
}

function animateFades(list, since) {
  for (const li of list) {
    const u = clamp01((since - (Number(li.dataset.delay) || 0) / 1000) / 0.15);
    li.style.opacity = u >= 1 ? '' : easeOut(u).toFixed(3);
    li.style.transform = u >= 1 ? '' : `translateY(${(2 * (1 - easeOut(u))).toFixed(3)}px)`;
  }
}

function renderResults(name, t) {
  const since = t - (name === 'solved' ? SOLVED_AT : NQY_AT);
  animateFades(refs.fades, since);
  const u = clamp01(since / 0.18);
  const e = bezierY(u);
  refs.pop.style.opacity = u >= 1 ? '' : clamp01(e).toFixed(3);
  refs.pop.style.transform = u >= 1 ? '' : `scale(${(0.8 + 0.2 * e).toFixed(4)})`;
}

function renderHovers(name, t) {
  for (const h of HOVERS[name] ?? []) {
    const el = root.querySelector(h.sel);
    if (!el) continue;
    const k = hoverMix(h.box, t);
    if (h.sel.includes('data-row') && el.classList.contains('bg-active'))
      el.style.backgroundColor = '';
    else if (k <= 0) el.style.backgroundColor = '';
    else if (h.from) el.style.backgroundColor = mixColor(h.from, h.to, k);
    else el.style.backgroundColor = `rgba(42,45,46,${k.toFixed(3)})`;
  }
}

function renderTerminal(t) {
  let typed = 0;
  let last = 22;
  for (const e of TERMINAL_KEYS) {
    if (e.t <= t) {
      typed++;
      last = e.t;
    }
  }
  const on = (t - last) % 1 < 0.5;
  setHTML(
    term,
    `<span class="term-prompt">$ </span><span>${TERMINAL_TEXT.slice(0, typed)}</span><span class="term-caret" style="opacity:${on ? 1 : 0}"></span>`,
  );
}

const CURSORS = {
  arrow: { svg: 'cursor-arrow', x: 2, y: 2 },
  text: { svg: 'cursor-text', x: 6, y: 10 },
  hand: { svg: 'cursor-hand', x: 7, y: 2 },
};

const inside = (m, b) => m.x >= b[0] && m.x <= b[2] && m.y >= b[1] && m.y <= b[3];
function cursorShape(name, m) {
  if (name.startsWith('workspace')) {
    const clickable = [
      [346, 95, 576, 205], // the file tree's rows
      [1196, 775, 1333, 803],
      [1341, 775, 1428, 803],
      [12, 775, 90, 803],
    ];
    if (clickable.some((b) => inside(m, b))) return 'hand';
    if (m.x >= 642 && m.x < 1424 && m.y >= 72 && m.y <= 533) return 'text';
    return 'arrow';
  }
  if (name === 'notQuiteYet') {
    if (inside(m, [232, 235, 380, 263]) || inside(m, [388, 235, 543, 263])) return 'hand';
    return 'arrow';
  }
  return 'arrow';
}

function renderMouse(name, t) {
  if (NOMOUSE || name === 'terminal') {
    mouseEl.style.display = 'none';
    return;
  }
  const m = mouseAt(t);
  const shape = cursorShape(name, m);
  if (mouseEl.dataset.shape !== shape) {
    mouseEl.dataset.shape = shape;
    for (const c of mouseEl.children)
      c.style.display = c.id === CURSORS[shape].svg ? 'block' : 'none';
  }
  const { x, y } = CURSORS[shape];
  mouseEl.style.display = 'block';
  mouseEl.style.transform = `translate(${(m.x - x).toFixed(3)}px, ${(m.y - y).toFixed(3)}px)`;
}

function renderCamera(t) {
  const cam = NOCAM ? { x: 0, y: 0, w: 1440 } : cameraAt(t);
  const s = window.innerWidth / cam.w;
  stage.style.transform = `scale(${s.toFixed(6)}) translate(${(-cam.x).toFixed(3)}px, ${(-cam.y).toFixed(3)}px)`;
}

window.renderAt = (t) => {
  const time = Math.min(DURATION - 1e-6, Math.max(0, t));
  const name = screenAt(time);
  if (name !== shown) mountScreen(name);
  if (name === 'terminal') renderTerminal(time);
  else if (name.startsWith('workspace')) renderWorkspace(name, time);
  else renderResults(name, time);
  if (name !== 'terminal') renderHovers(name, time);
  renderMouse(name, time);
  renderCamera(time);
};
window.renderFrame = (f) => window.renderAt(f / FPS);

// ------------------------------------------------------------ sound
const SR = 48000;
const seeded = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let z = a;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
};

// A soft key or a trackpad click: a noise tick over a short body, each hit a little different.
function hit(ctx, r, { tick, tickTau, body, bodyHz, bodyTau, ring, ringHz }) {
  const n = Math.ceil(SR * 0.12);
  const b = ctx.createBuffer(1, n, SR);
  const d = b.getChannelData(0);
  const hz = bodyHz * (0.92 + r() * 0.16);
  const hz2 = ringHz * (0.9 + r() * 0.2);
  const amp = 0.84 + r() * 0.32;
  let low = 0;
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    const white = r() * 2 - 1;
    low += 0.45 * (white - low);
    d[i] =
      amp *
      ((white - low) * tick * Math.exp(-s / tickTau) +
        Math.sin(2 * Math.PI * hz * s) * body * Math.exp(-s / bodyTau) +
        Math.sin(2 * Math.PI * hz2 * s) * ring * Math.exp(-s / (bodyTau * 0.55)));
  }
  return b;
}

const SOFT_KEY = {
  tick: 0.34,
  tickTau: 0.0032,
  body: 0.62,
  bodyHz: 196,
  bodyTau: 0.028,
  ring: 0.14,
  ringHz: 1240,
};
const KEY_UP = {
  tick: 0.15,
  tickTau: 0.0024,
  body: 0.2,
  bodyHz: 260,
  bodyTau: 0.01,
  ring: 0.07,
  ringHz: 1500,
};
const SPACE_KEY = {
  tick: 0.26,
  tickTau: 0.004,
  body: 0.84,
  bodyHz: 128,
  bodyTau: 0.038,
  ring: 0.1,
  ringHz: 820,
};
const MOD_KEY = {
  tick: 0.22,
  tickTau: 0.003,
  body: 0.42,
  bodyHz: 170,
  bodyTau: 0.024,
  ring: 0.1,
  ringHz: 1060,
};
const CLICK_DOWN = {
  tick: 0.5,
  tickTau: 0.0014,
  body: 0.52,
  bodyHz: 104,
  bodyTau: 0.018,
  ring: 0.1,
  ringHz: 2300,
};
const CLICK_UP = {
  tick: 0.32,
  tickTau: 0.0012,
  body: 0.24,
  bodyHz: 130,
  bodyTau: 0.008,
  ring: 0.08,
  ringHz: 2800,
};

const ONE_FRAME = 1 / FPS;

/** Every sound and when, each one frame after its event. */
function soundEvents() {
  const out = [];
  const add = (t, shape, gain, pan = 0) => out.push({ t: t + ONE_FRAME, shape, gain, pan });
  const pressKey = (t, shape, gain, pan, hold) => {
    add(t, shape, gain, pan);
    add(t + hold, KEY_UP, gain * 0.8, pan);
  };
  const r = seeded(4321);
  const panFor = (ch) => (ch && /[a-gq-tv-xz ]/i.test(ch) ? -0.16 : 0.16) * (0.4 + r() * 0.6);
  for (const e of [...EVENTS, ...TERMINAL_KEYS]) {
    const hold = 0.058 + r() * 0.038;
    if (e.type === 'key') {
      pressKey(e.t, e.ch === ' ' ? SPACE_KEY : SOFT_KEY, 0.82 + r() * 0.3, panFor(e.ch), hold);
    } else if (e.type === 'backspace') {
      pressKey(e.t, SOFT_KEY, 1.04, 0.24, hold);
    } else if (e.type === 'run') {
      pressKey(e.t - 0.09, MOD_KEY, 0.86, 0.08, 0.2);
      pressKey(e.t, SOFT_KEY, 1.05, 0.24, hold);
    } else if (e.type === 'submit') {
      pressKey(e.t - 0.15, MOD_KEY, 0.84, 0.08, 0.26);
      pressKey(e.t - 0.08, MOD_KEY, 0.8, -0.2, 0.2);
      pressKey(e.t, SOFT_KEY, 1.05, 0.24, hold);
    } else if (e.type === 'click' || e.type === 'press') {
      add(e.t, CLICK_DOWN, e.count === 2 ? 0.78 : 0.92, 0.1);
      if (e.type === 'click') add(e.t + 0.068 + r() * 0.02, CLICK_UP, 0.72, 0.1);
    } else if (e.type === 'release') {
      add(e.t, CLICK_UP, 0.72, 0.1);
    }
  }
  return out;
}

// The master level, set from what ffmpeg's ebur128 measures on the result (nqy-check.mjs).
const MASTER_DB = 9;
const ROOM_DB = -52;
const CEILING = 10 ** (-3.4 / 20);

window.renderAudio = async (masterDb = MASTER_DB) => {
  const length = Math.round(DURATION * SR);
  const ctx = new OfflineAudioContext(2, length, SR);
  const bus = ctx.createGain();
  bus.gain.value = 10 ** (masterDb / 20);
  bus.connect(ctx.destination);

  // A small room around the hits, so they sit somewhere.
  const room = ctx.createConvolver();
  const ir = ctx.createBuffer(2, Math.round(SR * 0.22), SR);
  const rIr = seeded(99);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let low = 0;
    for (let i = 0; i < d.length; i++) {
      low += 0.28 * (rIr() * 2 - 1 - low);
      d[i] = low * Math.exp(-i / SR / 0.055);
    }
  }
  room.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.85;
  room.connect(wet).connect(bus);

  const r = seeded(20261101);
  for (const e of soundEvents()) {
    const src = ctx.createBufferSource();
    src.buffer = hit(ctx, r, e.shape);
    const g = ctx.createGain();
    g.gain.value = e.gain;
    const p = ctx.createStereoPanner();
    p.pan.value = e.pan;
    src.connect(g).connect(p);
    p.connect(bus);
    p.connect(room);
    src.start(e.t);
  }

  // Room tone: low, wide, and always there.
  const tone = ctx.createBuffer(2, length, SR);
  const rTone = seeded(777);
  const level = 10 ** (ROOM_DB / 20);
  for (let c = 0; c < 2; c++) {
    const d = tone.getChannelData(c);
    let a = 0;
    let b = 0;
    for (let i = 0; i < length; i++) {
      const w = rTone() * 2 - 1;
      a += 0.022 * (w - a);
      b += 0.11 * (a - b);
      const drift = 1 + 0.16 * Math.sin((2 * Math.PI * i) / SR / (c ? 7.3 : 9.1));
      d[i] = b * 9 * level * drift;
    }
  }
  const toneSrc = ctx.createBufferSource();
  toneSrc.buffer = tone;
  toneSrc.connect(ctx.destination);
  toneSrc.start(0);

  const done = await ctx.startRendering();
  const left = done.getChannelData(0);
  const right = done.getChannelData(1);

  // A look-ahead peak limiter, so a stack of keys can't cross the true-peak ceiling.
  const look = Math.round(SR * 0.002);
  const release = Math.exp(-1 / (SR * 0.04));
  const gain = new Float32Array(left.length).fill(1);
  for (let i = 0; i < left.length; i++) {
    const p = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    if (p > CEILING) {
      const want = CEILING / p;
      for (let j = Math.max(0, i - look); j <= i; j++) if (gain[j] > want) gain[j] = want;
    }
  }
  let g = 1;
  for (let i = 0; i < left.length; i++) {
    g = gain[i] < g ? gain[i] : gain[i] + (g - gain[i]) * release;
    left[i] *= g;
    right[i] *= g;
  }
  return [left, right];
};

window.renderAudioWavBase64 = async (masterDb) => {
  const [l, r] = await window.renderAudio(masterDb);
  const n = l.length;
  const buf = new ArrayBuffer(44 + n * 8);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 8, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 3, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 8, true);
  v.setUint16(32, 8, true);
  v.setUint16(34, 32, true);
  str(36, 'data');
  v.setUint32(40, n * 8, true);
  for (let i = 0; i < n; i++) {
    v.setFloat32(44 + i * 8, l[i], true);
    v.setFloat32(48 + i * 8, r[i], true);
  }
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 32768) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  }
  return btoa(bin);
};

// ------------------------------------------------------------ start
window.ready = document.fonts.ready.then(async () => {
  await Promise.all([
    document.fonts.load('13px "Inter Variable"'),
    document.fonts.load('600 13px "Inter Variable"'),
    document.fonts.load('13px "JetBrains Mono Variable"'),
    document.fonts.load('13px codicon', ''),
  ]);
  const fixed = query.get('t');
  window.renderAt(fixed === null ? 0 : Number(fixed));
  if (fixed === null) {
    const begun = performance.now();
    const tick = () => {
      window.renderAt(((performance.now() - begun) / 1000) % DURATION);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
});
