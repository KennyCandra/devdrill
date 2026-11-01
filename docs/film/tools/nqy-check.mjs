// Measures "Not quite yet" rather than judging it by eye: wording against session.json and the
// real app, text sharpness at the largest crop, the mouse's speed, loudness, and the encode.
// node docs/film/tools/nqy-check.mjs
/* global console, URL */
import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { OUT, openChrome, sleep } from './nqy-page.mjs';
import { DURATION, EVENTS, FPS, STATES, TERMINAL_KEYS, cameraAt, mouseAt } from './nqy-script.mjs';

const FILM = pathToFileURL(fileURLToPath(new URL('../not-quite-yet.html', import.meta.url)));
const SESSION = JSON.parse(readFileSync(new URL('../session.json', import.meta.url), 'utf8'));
const CAPTURE = JSON.parse(readFileSync(`${OUT}nqy-real/capture.dat`, 'utf8'));
const WAV = `${OUT}not-quite-yet.wav`;
const VIDEO = `${OUT}not-quite-yet.mp4`;
let failures = 0;
const verdict = (ok, text) => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`);
};
const open = async (query, size) => {
  const page = await openChrome(size);
  await page.goto(`${FILM}?${query}`);
  for (let i = 0; i < 200; i++) {
    if (await page.evaluate('typeof window.ready !== "undefined"').catch(() => false)) break;
    await sleep(50);
  }
  await page.evaluate('window.ready.then(() => true)');
  return page;
};
const paint = (page, t) =>
  page.evaluate(
    `(window.renderAt(${t}), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))`,
  );
const norm = (s) => s.replace(/\u00a0/g, ' ').trim();

// -------------------------------------------------------------- wording
console.log('--- wording, against session.json');
const page = await open('t=0&nocam=1&nomouse=1', { width: 1440, height: 810, scale: 1 });
const textAt = async (t) => {
  await paint(page, t);
  return page.evaluate(`document.getElementById('root').innerText`);
};
const expectTests = async (label, t, run, summary) => {
  const text = await textAt(t);
  const missing = [];
  for (const test of run.tests) {
    if (!text.includes(test.name)) missing.push(test.name);
    for (const line of (test.message ?? '').split('\n')) {
      if (line && !text.includes(line.trim())) missing.push(line.trim());
    }
    if (test.rule && test.status === 'failed' && !text.includes(test.rule)) missing.push(test.rule);
  }
  const hasSummary = summary.every((s) => text.includes(s));
  verdict(
    missing.length === 0 && hasSummary,
    `${label}: ${run.tests.length} tests, their messages and rules, and "${summary.join('", "')}"${missing.length ? `; missing: ${missing.join(' | ')}` : ''}`,
  );
};
const b = SESSION.bug.visible;
const f = SESSION.firstFix.visible;
const fs = SESSION.firstFix.submitted;
const rs = SESSION.realFix.submitted;
const seconds = (r) => `${(r.durationMs / 1000).toFixed(1)}s`;
await expectTests('BUG, visible', 2.9, b, [`${b.passed} passed`, `${b.failed} failed`, seconds(b)]);
await expectTests('FIRST FIX, visible', 7.9, f, [`${f.passed} passed`, seconds(f)]);
await expectTests('FIRST FIX, submitted', 11.8, fs, [
  'Not quite yet',
  `${fs.passed} / ${fs.total}`,
  `The visible tests pass, but ${fs.failed} hidden tests fail. Hidden tests check edge cases the visible ones don't; re-read the task for clues.`,
  'Details unlock when you solve the challenge.',
  'Back to the code',
]);
await expectTests('REAL FIX, submitted', 21.7, rs, [
  'Solved',
  `${rs.passed} / ${rs.total}`,
  'Every test passes, including the hidden ones.',
  'Next: Settings leak between users',
]);
const running = await textAt(6.6);
verdict(
  /Running tests…/.test(running) && /Running…/.test(running),
  '6.60 s: "Running tests…", "Running…"',
);
const submitting = await textAt(9.9);
verdict(/Submitting…/.test(submitting), '9.90 s: "Submitting…"');
const submitting2 = await textAt(19.8);
verdict(/Submitting…/.test(submitting2), '19.80 s: "Submitting…"');

verdict(
  (await textAt(21.7)).includes('11:54') && (await textAt(19.4)).includes('11:54'),
  'Active time on Solved matches the top bar when it was submitted (11:54)',
);
verdict(
  (await textAt(11.8)).includes('11:49') && (await textAt(9.55)).includes('11:49'),
  'Active time on Not quite yet matches the top bar when it was submitted (11:49)',
);

console.log('--- wording, against the real app');
for (const s of STATES) {
  const film = (await textAt(s.t)).split('\n').map(norm).filter(Boolean);
  const real = CAPTURE.seen[s.name].text.split('\n').map(norm).filter(Boolean);
  // The run time and the clock may differ by the run. "(unsaved)" is for screen readers only.
  const loose = (l) => /^\d+\.\ds$/.test(l) || /^\d+:\d\d$/.test(l) || l === '(unsaved)';
  const onlyFilm = film.filter((l) => !real.includes(l) && !loose(l));
  const onlyReal = real.filter((l) => !film.includes(l) && !loose(l));
  verdict(
    onlyFilm.length === 0 && onlyReal.length === 0,
    `${s.name}: ${real.length} lines${onlyFilm.length ? `; only in the film: ${onlyFilm.join(' | ')}` : ''}${onlyReal.length ? `; only in the app: ${onlyReal.join(' | ')}` : ''}`,
  );
}

// -------------------------------------------------------------- purity
console.log('--- renderAt is a pure function of t');
const hash = async (t) => {
  await paint(page, t);
  return createHash('sha1')
    .update(await page.shot())
    .digest('hex')
    .slice(0, 12);
};
const first = await hash(16.7);
await hash(4.1);
await hash(21);
await hash(11);
const second = await hash(16.7);
verdict(first === second, `16.70 s, drawn again after other frames: ${first} vs ${second}`);
await page.close();

// -------------------------------------------------------------- sharpness
console.log('--- text at the largest crop');
const widest = Array.from({ length: DURATION * FPS }, (_, i) => cameraAt(i / FPS).w);
const narrowest = Math.min(...widest);
const crop = 1440 / narrowest;
verdict(crop <= 1.3501, `largest crop ${crop.toFixed(3)}x (limit 1.35)`);
{
  const t = 14.2;
  const cam = cameraAt(t);
  const k = 3840 / cam.w;
  const filmPage = await open('t=14.2&nomouse=1', { width: 1920, height: 1080, scale: 2 });
  await paint(filmPage, t);
  const filmShot = `${OUT}nqy-sharp-film.png`;
  writeFileSync(filmShot, await filmPage.shot());
  await filmPage.close();
  // The same page rasterized at that resolution from the start: the sharpest it can be.
  const nativePage = await open('t=14.2&nomouse=1&nocam=1', { width: 1440, height: 810, scale: k });
  await paint(nativePage, t);
  const native = await nativePage.send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: cam.x, y: cam.y, width: 3840 / k, height: 2160 / k, scale: 1 },
  });
  const nativeShot = `${OUT}nqy-sharp-native.png`;
  writeFileSync(nativeShot, Buffer.from(native.data, 'base64'));
  await nativePage.close();
  const lowPage = await open('t=14.2&nomouse=1&nocam=1', { width: 1440, height: 810, scale: 1 });
  await paint(lowPage, t);
  const lowShot = `${OUT}nqy-sharp-pixels.png`;
  writeFileSync(lowShot, await lowPage.shot());
  await lowPage.close();
  const ffmpeg = (args) =>
    spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' }).stderr;
  const yavg = (input, pre) => {
    const r = spawnSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-nostats',
        '-i',
        input,
        '-vf',
        `${pre}format=gray,convolution=0 -1 0 -1 4 -1 0 -1 0:0 -1 0 -1 4 -1 0 -1 0:0 -1 0 -1 4 -1 0 -1 0:0 -1 0 -1 4 -1 0 -1 0,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-`,
        '-f',
        'null',
        '-',
      ],
      { encoding: 'utf8' },
    );
    return Number(/YAVG=([\d.]+)/.exec(r.stdout)?.[1]);
  };
  const ssim = /All:([\d.]+)/.exec(
    ffmpeg([
      '-i',
      filmShot,
      '-i',
      nativeShot,
      '-lavfi',
      'scale2ref[a][b];[a][b]ssim',
      '-f',
      'null',
      '-',
    ]),
  )?.[1];
  const fromPixels = `crop=${cam.w}:${(cam.w * 9) / 16}:${cam.x}:${cam.y},scale=3840:2160:flags=lanczos,`;
  const e1 = yavg(filmShot, '');
  const e2 = yavg(nativeShot, '');
  const e3 = yavg(lowShot, fromPixels);
  verdict(
    e1 > 0.9 * e2,
    `edge energy at ${crop.toFixed(2)}x: film ${e1.toFixed(2)}, re-rasterized ${e2.toFixed(2)}, scaled pixels ${e3.toFixed(2)}; SSIM against re-rasterized ${ssim}`,
  );
}

// -------------------------------------------------------------- the mouse
console.log('--- the mouse');
{
  const N = DURATION * FPS;
  const speeds = [];
  for (let i = 1; i < N; i++) {
    const a = mouseAt((i - 1) / FPS);
    const c = mouseAt(i / FPS);
    speeds.push(Math.hypot(c.x - a.x, c.y - a.y));
  }
  const moving = speeds.filter((s) => s > 0.01);
  const fastest = Math.max(...speeds);
  const at = speeds.indexOf(fastest) / FPS;
  // Runs of frames at the same speed would read as a machine.
  let longest = 0;
  let run = 0;
  for (let i = 1; i < speeds.length; i++) {
    if (speeds[i] > 0.5 && Math.abs(speeds[i] - speeds[i - 1]) < 0.02) run++;
    else run = 0;
    longest = Math.max(longest, run);
  }
  verdict(
    fastest * FPS < 3200,
    `fastest ${(fastest * FPS).toFixed(0)} px/s at ${at.toFixed(2)} s; moving on ${moving.length} of ${N} frames`,
  );
  verdict(longest < 4, `longest run of equal-speed frames: ${longest}`);
  const clicks = EVENTS.filter((e) => e.x !== undefined);
  const worst = Math.max(
    ...clicks.map((e) => {
      const m = mouseAt(e.t);
      return Math.hypot(m.x - e.x, m.y - e.y);
    }),
  );
  verdict(
    worst < 0.5,
    `mouse is on target at each of ${clicks.length} clicks: worst ${worst.toFixed(3)} px`,
  );
}

// -------------------------------------------------------------- sound
console.log('--- sound');
const loudness = (file) => {
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-vn', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  const t = r.stderr.split('\n').slice(-16).join('\n');
  return {
    i: Number(/I:\s+(-?[\d.]+) LUFS/.exec(t)?.[1]),
    tp: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(t)?.[1]),
  };
};
const rmsOf = (file, from, to) => {
  const r = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-ss',
      String(from),
      '-t',
      String(to - from),
      '-i',
      file,
      '-af',
      'astats=metadata=0',
      '-vn',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  );
  const a = [...r.stderr.matchAll(/RMS level dB: (-?[\d.]+)/g)].at(-1)?.[1];
  const p = [...r.stderr.matchAll(/Peak level dB: (-?[\d.]+)/g)].at(-1)?.[1];
  return { rms: Number(a), peak: Number(p) };
};
if (existsSync(WAV)) {
  const w = loudness(WAV);
  verdict(Math.abs(w.i + 16) <= 0.5, `master ${w.i} LUFS (target -16)`);
  verdict(w.tp <= -2, `master true peak ${w.tp} dBTP (limit -2)`);
  const quiet = rmsOf(WAV, 10.25, 14.85);
  verdict(
    quiet.peak < -40,
    `10.25 to 14.85 s, "Not quite yet", room tone only: RMS ${quiet.rms} dB, peak ${quiet.peak} dB`,
  );
  const solved = rmsOf(WAV, 20.15, 22.25);
  verdict(solved.peak < -40, `20.15 to 22.25 s, "Solved", no sting: peak ${solved.peak} dB`);
  const clicks = EVENTS.filter((e) => e.type === 'key' || e.type === 'click').length;
  console.log(
    `     ${clicks} app events and ${TERMINAL_KEYS.length} terminal keys, each sounding one frame after its event`,
  );
}

// -------------------------------------------------------------- the encode
console.log('--- the encode');
if (existsSync(VIDEO)) {
  const p = spawnSync(
    'ffprobe',
    ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', VIDEO],
    { encoding: 'utf8', maxBuffer: 1 << 26 },
  );
  const info = JSON.parse(p.stdout);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  verdict(v.width === 1920 && v.height === 1080, `${v.width}x${v.height}`);
  verdict(v.r_frame_rate === '60/1', `${v.r_frame_rate} fps`);
  verdict(Number(v.nb_read_frames) === 1440, `${v.nb_read_frames} frames`);
  verdict(Math.abs(Number(info.format.duration) - 24) < 0.05, `${info.format.duration} s`);
  verdict(
    v.codec_name === 'h264' && v.profile === 'High' && v.pix_fmt === 'yuv420p',
    `${v.codec_name} ${v.profile} ${v.pix_fmt}`,
  );
  verdict(
    v.color_space === 'bt709' && v.color_transfer === 'bt709' && v.color_primaries === 'bt709',
    `color ${v.color_space}/${v.color_transfer}/${v.color_primaries}`,
  );
  verdict(a.codec_name === 'aac', `audio ${a.codec_name} ${Math.round(a.bit_rate / 1000)}k`);
  const bytes = readFileSync(VIDEO);
  const moov = bytes.indexOf('moov');
  const mdat = bytes.indexOf('mdat');
  verdict(moov < mdat, `+faststart (moov at ${moov}, mdat at ${mdat})`);
  const m = loudness(VIDEO);
  verdict(Math.abs(m.i + 16) <= 0.5, `encoded audio ${m.i} LUFS`);
  verdict(m.tp <= -2, `encoded audio true peak ${m.tp} dBTP`);
  console.log(`     ${(bytes.length / 1e6).toFixed(1)} MB`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nevery check passed');
process.exit(failures ? 1 : 0);
