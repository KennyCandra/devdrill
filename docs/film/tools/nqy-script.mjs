// The session both the real app and the film play: every click, every key and the path of the
// mouse, on one clock. Pure functions of t, seeded noise only.

export const DURATION = 24;
export const FPS = 60;

// Where things are at 1440x810, measured from the real app. Code starts at x 642.2, a column
// is 7.8 wide, a line is 20 tall and line 1 starts at y 72.
const colX = (col) => 642.2 + (col - 1) * 7.8;
const lineY = (line) => 72 + (line - 1) * 20 + 10;
const POINTS = {
  line7: { x: colX(3), y: lineY(7) },
  forEach: { x: colX(33), y: lineY(7) },
  line14: { x: colX(5), y: lineY(14) },
  submit: { x: 1383, y: 788 },
  back: { x: 306, y: 249 },
  reportFile: { x: 432, y: 128 },
  push: { x: colX(12), y: lineY(9) },
  rowsStart: { x: colX(5), y: lineY(9) },
  rowsEnd: { x: colX(15), y: lineY(9) },
  line13: { x: colX(7), y: lineY(13) },
  line5: { x: colX(16), y: lineY(5) },
};

// The screens, in order. Each starts at its time and hides the one before.
export const SCREENS = [
  { at: 0, name: 'workspace1' },
  { at: 10.2, name: 'notQuiteYet' },
  { at: 15, name: 'workspace2' },
  { at: 20.1, name: 'solved' },
  { at: 22, name: 'terminal' },
];

const key = (t, ch) => ({ t, type: 'key', ch });
const word = (start, gaps, text) => {
  let t = start;
  return [...text].map((ch, i) => {
    const e = key(t, ch);
    t += gaps[i % gaps.length];
    return e;
  });
};

// Keys come faster on words the hands know ("await", "return") and slower after a mistake.
export const EVENTS = [
  { t: 3, type: 'click', ...POINTS.line7, count: 1 },
  ...word(3.14, [0.05, 0.05, 0.04, 0.05, 0.07], 'await '),
  ...word(3.52, [0.08, 0.07, 0.07, 0.1], 'Proms'),
  { t: 4.07, type: 'backspace' },
  ...word(4.19, [0.07, 0.07, 0.12, 0.08, 0.07, 0.06, 0.09], 'ise.all('),
  { t: 5.2, type: 'click', ...POINTS.forEach, count: 1 },
  { t: 5.31, type: 'click', ...POINTS.forEach, count: 2 },
  ...word(5.46, [0.06, 0.07], 'map'),
  { t: 6.05, type: 'click', ...POINTS.line14, count: 1 },
  key(6.18, ')'),
  { t: 6.5, type: 'run' },
  { t: 9.6, type: 'click', ...POINTS.submit, count: 1 },
  { t: 14.88, type: 'click', ...POINTS.back, count: 1 },
  { t: 15.62, type: 'click', ...POINTS.reportFile, count: 1 },
  { t: 17.02, type: 'press', ...POINTS.rowsStart },
  { t: 17.29, type: 'release', ...POINTS.rowsEnd },
  ...word(17.38, [0.04, 0.04, 0.04, 0.04, 0.04, 0.06], 'return '),
  { t: 17.95, type: 'click', ...POINTS.line13, count: 1 },
  { t: 18.05, type: 'backspace' },
  { t: 18.56, type: 'click', ...POINTS.line5, count: 1 },
  { t: 18.96, type: 'click', ...POINTS.line7, count: 1, shift: true },
  { t: 19.16, type: 'backspace' },
  { t: 19.5, type: 'submit' },
];

// What the terminal at the end types. Not part of the app session.
export const TERMINAL_TEXT = 'npx devdrill';
export const TERMINAL_KEYS = word(
  22.3,
  [0.07, 0.06, 0.11, 0.08, 0.06, 0.07, 0.07, 0.06, 0.05, 0.07, 0.06],
  TERMINAL_TEXT,
);

// The hand's moves. Between moves the mouse holds still. `over` is how far past the target the
// hand goes before correcting, `bend` how far the path bows off the straight line.
const MOVES = [
  { from: { x: 1120, y: 122 }, to: { x: 1085, y: 165 }, t0: 0.2, t1: 1.05, over: 0, bend: 5 },
  { to: { x: 1000, y: 182 }, t0: 1.25, t1: 2.0, over: 0, bend: -6 },
  { to: { x: 655.5, y: lineY(7) }, t0: 2.16, t1: 2.86, over: 4, bend: 7 },
  { to: POINTS.line7, t0: 2.9, t1: 2.97, over: 0, bend: 0 },
  { to: { x: POINTS.forEach.x - 1, y: POINTS.forEach.y }, t0: 4.9, t1: 5.17, over: 3, bend: 3 },
  { to: POINTS.forEach, t0: 5.17, t1: 5.19, over: 0, bend: 0 },
  { to: POINTS.line14, t0: 5.66, t1: 6.03, over: 3, bend: -8 },
  { to: POINTS.submit, t0: 8.34, t1: 9.38, over: 7, bend: -38 },
  { to: POINTS.back, t0: 13.95, t1: 14.84, over: 9, bend: 30 },
  { to: POINTS.reportFile, t0: 15.22, t1: 15.59, over: 4, bend: 10 },
  { to: POINTS.push, t0: 15.72, t1: 16.14, over: 4, bend: -10 },
  { to: POINTS.rowsStart, t0: 16.84, t1: 17, over: 1.5, bend: 2 },
  { to: POINTS.rowsEnd, t0: 17.05, t1: 17.27, over: 0, bend: 1 },
  { to: POINTS.line13, t0: 17.7, t1: 17.93, over: 2, bend: -6 },
  { to: POINTS.line5, t0: 18.12, t1: 18.54, over: 3.5, bend: 12 },
  { to: POINTS.line7, t0: 18.62, t1: 18.94, over: 2, bend: -7 },
];

const smooth = (u) => u * u * u * (10 + u * (-15 + 6 * u));
const clamp01 = (u) => Math.min(1, Math.max(0, u));

// Slow value noise, so moves carry a little tremor and never run on a perfect line.
const noise = (seed, t) => {
  const hash = (n) => {
    const s = Math.sin((n + seed * 37.7) * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(t);
  const u = t - i;
  const k = u * u * (3 - 2 * u);
  return hash(i) + (hash(i + 1) - hash(i)) * k - 0.5;
};

export function mouseAt(t) {
  let x = MOVES[0].from.x;
  let y = MOVES[0].from.y;
  for (const m of MOVES) {
    if (t < m.t0) break;
    const u = clamp01((t - m.t0) / (m.t1 - m.t0));
    const dx = m.to.x - x;
    const dy = m.to.y - y;
    const dist = Math.hypot(dx, dy) || 1;
    // The overshoot phase: reach past the target at 82% of the move, then settle back.
    const peak = 0.82;
    const ahead = m.over / dist;
    const along =
      u < peak ? smooth(u / peak) * (1 + ahead) : 1 + ahead * (1 - smooth((u - peak) / (1 - peak)));
    const sideways = Math.sin(Math.PI * u) * m.bend;
    const moving = Math.sin(Math.PI * u);
    const shakeX = noise(1 + m.t0, t * 19) * 0.9 * moving;
    const shakeY = noise(2 + m.t0, t * 23) * 0.9 * moving;
    const nx = x + dx * along - (dy / dist) * sideways + shakeX;
    const ny = y + dy * along + (dx / dist) * sideways + shakeY;
    if (u < 1) return { x: nx, y: ny };
    x = m.to.x;
    y = m.to.y;
  }
  return { x, y };
}

// The camera: a 2D crop of the page, one slow move per screen at most.
const FULL = { x: 0, y: 0, w: 1440 };
const CODE = { x: 240, y: 135, w: 1200 };
const FIRST_ROW = { x: 187, y: 122, w: 1067 };
const CAMERA = [
  { from: 0, to: 10.2, move: [3.05, 6.45], a: FULL, b: CODE },
  { from: 10.2, to: 15, move: [12, 14.2], a: FULL, b: FIRST_ROW },
  { from: 15, to: 20.1, move: [16.2, 19.3], a: FULL, b: CODE },
];

export function cameraAt(t) {
  const shot = CAMERA.find((c) => t >= c.from && t < c.to);
  if (!shot) return FULL;
  const u = smooth(clamp01((t - shot.move[0]) / (shot.move[1] - shot.move[0])));
  // Interpolate the zoom in log space so the move reads as constant in screen terms.
  const wa = Math.log(shot.a.w);
  const wb = Math.log(shot.b.w);
  const w = Math.exp(wa + (wb - wa) * u);
  const k = (shot.a.w - w) / (shot.a.w - shot.b.w);
  return {
    x: shot.a.x + (shot.b.x - shot.a.x) * k,
    y: shot.a.y + (shot.b.y - shot.a.y) * k,
    w,
  };
}

// When the real app gets screenshotted, to compare with the film's frame at the same time.
export const STATES = [
  { name: '1-bug', t: 2.88 },
  { name: '2-first-fix-green', t: 7.95 },
  { name: '3-not-quite-yet', t: 11.8 },
  { name: '4-real-fix', t: 19.34 },
  { name: '5-solved', t: 21.7 },
];
