// Measures the film rather than judging by eye: node docs/film/tools/check.mjs
/* global console */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { OUT, openFilm } from './film-page.mjs';

const N = 840;
const page = await openFilm('t=0&scale=0.5');
if (page.logs.length) console.log(page.logs.slice(0, 20).join('\n'));

// ------------------------------------------------------------ geometry and pose
const probes = await page.evaluate(`(() => {
  const out = [];
  for (let f = 0; f < ${N}; f++) out.push(window.probe(f / 60));
  return out;
})()`);

let deepest = 0,
  deepFrame = -1,
  deepName = '',
  hit = 0;
let offKeyFrames = 0,
  offKeyMax = 0,
  offF = -1;
probes.forEach((p, f) => {
  if (p.deepest > 1e-4) hit++;
  if (p.deepest > deepest) {
    deepest = p.deepest;
    deepFrame = f;
    deepName = p.deepestName;
  }
  if (p.offKey > 0) {
    offKeyFrames++;
    if (p.offKey > offKeyMax) {
      offKeyMax = p.offKey;
      offF = f;
    }
  }
});
const contact = probes.filter((p) => p.soleGap !== null);
const minSole = Math.min(...contact.map((p) => p.soleGap));

console.log('--- collisions (all 840 frames, every duck vertex vs keycaps and deck)');
console.log(
  `frames with penetration > 0.001 mm: ${hit}; deepest ${(deepest * 10).toFixed(4)} mm at f${deepFrame} (${deepName})`,
);
console.log(
  `lowest sole vs key under it: min ${(minSole * 10).toFixed(4)} mm; frames standing: ${contact.length}`,
);
console.log(
  `planted-sole verts off the pressed key: ${offKeyFrames} frames, worst ${offKeyMax} verts at f${offF}`,
);

// camera speed
const ang = (a, b) =>
  (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI;
let maxCam = 0,
  maxCamF = -1;
for (let f = 0; f < N; f++) {
  const d = ang(probes[f].dir, probes[(f + 1) % N].dir);
  if (d > maxCam) {
    maxCam = d;
    maxCamF = f;
  }
}
console.log('--- camera');
console.log(`largest rotation ${maxCam.toFixed(3)} deg/frame at f${maxCamF} (limit 0.5)`);

// seam
const vec = (p) => [...p.pose, ...p.root, ...p.cam, ...p.dir, p.m];
const delta = (a, b) => vec(a).map((v, i) => Math.abs(v - vec(b)[i]));
const velDelta = (f) => {
  const a = probes[(f - 1 + N) % N],
    b = probes[f],
    c = probes[(f + 1) % N];
  return vec(a).map((v, i) => Math.abs(vec(c)[i] - vec(b)[i] - (vec(b)[i] - v)));
};
const seamPos = Math.max(...delta(probes[839], probes[0]));
const seamVel = Math.max(...velDelta(0));
const f14 = await page.evaluate(`window.probe(14)`);
const posEq = Math.max(...delta(f14, probes[0]));
const fm1 = await page.evaluate(`window.probe(14 + 1/60)`);
const velEq = Math.max(
  ...vec(fm1).map((v, i) => Math.abs(v - vec(f14)[i] - (vec(probes[1])[i] - vec(probes[0])[i]))),
);
const typicalVel = probes.map((_, f) => Math.max(...velDelta(f))).sort((a, b) => a - b)[420];
console.log('--- seam (pose vector: joints, root, camera, world mix)');
console.log(`renderAt(14) vs renderAt(0): pose diff ${posEq}, velocity diff ${velEq}`);
console.log(
  `frame 839 -> 0: largest parameter step ${seamPos.toFixed(5)}; largest velocity change ${seamVel.toFixed(5)} (median frame ${typicalVel.toFixed(5)})`,
);

// event table
console.log('--- beats');
const at = (f) => probes[f];
console.log('f0', at(0).panel, 'm', at(0).m, 'crouch', at(0).pose[4]);
for (const [f, label] of [
  [18, 'first stomp'],
  [420, 'belly flop'],
  [618, 'delete 1'],
  [654, 'delete 4'],
  [705, 'PASS'],
  [762, 'lens'],
  [816, 'next challenge'],
]) {
  console.log(
    `f${f} ${label}: panel ${at(f).panel}, press return ${at(f).pressReturn.toFixed(2)} delete ${at(f).pressDelete.toFixed(2)}, mix ${at(f).m.toFixed(2)}`,
  );
}

// ------------------------------------------------------------ pixels
if (!process.argv.includes('--no-image')) {
  const img = await page.evaluate(`(async () => {
    const c = document.querySelector('canvas');
    const gl = c.getContext('webgl2');
    const w = c.width, h = c.height;
    const px = new Uint8Array(w * h * 4);
    const res = { luma: [], red: [], minLuma: [], maxLuma: [], white: [], black: [], block: [] };
    let prev = null;
    let f0 = null, last = null;
    for (let f = 0; f < ${N}; f++) {
      window.renderAt(f / 60);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let sum = 0, redSum = 0, white = 0, black = 0, n = 0;
      const blocks = new Float64Array(16 * 9);
      const cnt = new Float64Array(16 * 9);
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sum += Y; n++;
        redSum += Math.max(0, r - Math.max(g, b));
        if (Y >= 254) white++;
        if (Y <= 1) black++;
        const bi = Math.floor(y / h * 9) * 16 + Math.floor(x / w * 16);
        blocks[bi] += Y; cnt[bi]++;
      }
      for (let i = 0; i < blocks.length; i++) blocks[i] /= cnt[i];
      res.luma.push(sum / n);
      res.red.push(redSum / n);
      res.white.push(white / n);
      res.black.push(black / n);
      if (prev) { let m = 0; for (let i = 0; i < blocks.length; i++) m = Math.max(m, Math.abs(blocks[i] - prev[i])); res.block.push(m); }
      prev = blocks;
      if (f === 0) f0 = px.slice();
      if (f === ${N - 1}) last = px.slice();
    }
    let m = 0;
    let d = 0;
    for (let i = 0; i < f0.length; i += 4) { const e = Math.abs(f0[i] - last[i]) + Math.abs(f0[i+1] - last[i+1]) + Math.abs(f0[i+2] - last[i+2]); d += e / 3; m = Math.max(m, e / 3); }
    res.seamMean = d / (f0.length / 4);
    res.seamMax = m;
    return res;
  })()`);
  let maxStep = 0,
    stepF = -1;
  for (let f = 0; f < N; f++) {
    const s = Math.abs(img.luma[(f + 1) % N] - img.luma[f]);
    if (s > maxStep) {
      maxStep = s;
      stepF = f;
    }
  }
  console.log('--- brightness (uncompressed, half-size, full-range 8-bit Y)');
  console.log(
    `mean luma per frame: min ${Math.min(...img.luma).toFixed(1)}, max ${Math.max(...img.luma).toFixed(1)}`,
  );
  console.log(`largest frame-to-frame step ${maxStep.toFixed(2)} levels at f${stepF} (limit 25)`);
  const b = [...img.block].sort((x, y) => y - x);
  console.log(`largest step in any 1/144 tile of the frame: ${b[0].toFixed(1)} levels`);
  console.log(
    `pure white pixels: max ${(Math.max(...img.white) * 100).toFixed(2)}%; pure black: max ${(Math.max(...img.black) * 100).toFixed(2)}%`,
  );
  console.log(
    `seam picture, f839 vs f0: mean abs diff ${img.seamMean.toFixed(3)}, max ${img.seamMax.toFixed(1)}`,
  );
  console.log(`seam luma step ${Math.abs(img.luma[0] - img.luma[839]).toFixed(3)}`);

  // Red flashes: a flash is red rising then falling by over 25% of its range. Worst 1 s window.
  const red = probes.map((p) => p.red);
  const countFlashes = (series) => {
    const lo0 = Math.min(...series),
      hi0 = Math.max(...series);
    const th = (hi0 - lo0) * 0.25;
    const peaks = [];
    let dir = 0,
      hi = series[0],
      lo = series[0],
      hiF = 0;
    series.forEach((v, f) => {
      if (v > hi) {
        hi = v;
        hiF = f;
      }
      if (v < lo) lo = v;
      if (dir >= 0 && hi - v > th) {
        peaks.push(hiF);
        dir = -1;
        lo = v;
        hi = v;
      } else if (dir <= 0 && v - lo > th) {
        dir = 1;
        hi = v;
        hiF = f;
        lo = v;
      }
    });
    let worst = 0,
      wf = 0;
    for (let f = 0; f < N; f++) {
      const c = peaks.filter((x) => x >= f && x < f + 60).length;
      if (c > worst) {
        worst = c;
        wf = f;
      }
    }
    return { worst, wf, total: peaks.length };
  };
  const a = countFlashes(red);
  const c = countFlashes(img.red.slice(0, 700));
  console.log('--- red flashes');
  console.log(`spill state: worst ${a.worst} per second at f${a.wf}, ${a.total} in the loop`);
  console.log(
    `measured red in pixels: worst ${c.worst} per second at f${c.wf}, ${c.total} in the loop (limit 3)`,
  );
}

// ------------------------------------------------------------ sound
const wav = Buffer.from(await page.evaluate('window.renderAudioWavBase64()'), 'base64');
writeFileSync(`${OUT}audio.wav`, wav);
const samples = new Float32Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) / 4);
const rmsDb = (a, b) => {
  let s = 0,
    n = 0;
  for (let i = Math.floor(a * 48000) * 2; i < Math.floor(b * 48000) * 2; i++) {
    s += samples[i] ** 2;
    n++;
  }
  return 10 * Math.log10(s / n + 1e-20);
};
let peak = 0;
for (const v of samples) peak = Math.max(peak, Math.abs(v));
const r = spawnSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-nostats',
    '-stream_loop',
    '4',
    '-i',
    `${OUT}audio.wav`,
    '-af',
    'ebur128=peak=true',
    '-f',
    'null',
    '-',
  ],
  { encoding: 'utf8' },
);
const tail = r.stderr.split('\n').slice(-16).join('\n');
const I = tail.match(/I:\s+(-?[\d.]+) LUFS/)?.[1];
const TP = tail.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1];
const r1 = spawnSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-nostats',
    '-i',
    `${OUT}audio.wav`,
    '-af',
    'ebur128=peak=true',
    '-f',
    'null',
    '-',
  ],
  { encoding: 'utf8' },
);
const tail1 = r1.stderr.split('\n').slice(-16).join('\n');
console.log('--- sound');
console.log(
  `integrated (looped 5x) ${I} LUFS, one pass ${tail1.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]} LUFS; true peak ${TP} dBTP; sample peak ${(20 * Math.log10(peak)).toFixed(2)} dBFS`,
);
console.log(
  `RMS 7.25-7.6 s (silence): ${rmsDb(7.25, 7.6).toFixed(1)} dB; 7.02-7.25 (flop tail) ${rmsDb(7.02, 7.25).toFixed(1)} dB; 5-6.8 s: ${rmsDb(5, 6.8).toFixed(1)} dB; seam last vs first sample diff ${Math.abs(samples[samples.length - 2] - samples[0]).toFixed(5)}`,
);

await page.close();
process.exit(0);
