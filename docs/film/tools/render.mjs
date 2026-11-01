// Renders the film: 3840x2160 frames, 8 linear-light sub-frames over 0.45 of a frame, then
// H.264 + AAC. Finished frames are kept, so a stopped render resumes:
// node docs/film/tools/render.mjs
/* global console */
import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { OUT, grab, openFilm } from './film-page.mjs';

const N = 840;
const FRAMES = `${OUT}frames/`;
const FILM = `${OUT}read-the-code.mp4`;
mkdirSync(FRAMES, { recursive: true });

const page = await openFilm('t=0&scale=2');
const started = Date.now();
for (let f = 0; f < N; f++) {
  const path = `${FRAMES}${String(f).padStart(4, '0')}.png`;
  if (existsSync(path)) continue;
  await page.evaluate(`window.renderFrame(${f}, { sub: 8, shutter: 0.45 })`);
  writeFileSync(path, Buffer.from(await grab(page), 'base64'));
  if (f % 60 === 0)
    console.log(`frame ${f} of ${N}, ${Math.round((Date.now() - started) / 1000)} s`);
}
const wav = Buffer.from(await page.evaluate('window.renderAudioWavBase64()'), 'base64');
writeFileSync(`${OUT}read-the-code.wav`, wav);
await page.close();

const run = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stderr;
};

// prettier-ignore
run([
  '-framerate', '60', '-i', `${FRAMES}%04d.png`,
  '-i', `${OUT}read-the-code.wav`,
  '-vf', 'scale=1920:1080:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
  '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '14',
  '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709',
  '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+faststart',
  FILM,
]);

// Brightness per frame on the encoded film, and the loudness of what got muxed.
const luma = spawnSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-i',
    FILM,
    '-vf',
    'signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-',
    '-an',
    '-f',
    'null',
    '-',
  ],
  { encoding: 'utf8', maxBuffer: 1 << 28 },
);
const ys = [...luma.stdout.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
let step = 0;
let at = 0;
ys.forEach((y, i) => {
  const d = Math.abs(ys[(i + 1) % ys.length] - y);
  if (d > step) {
    step = d;
    at = i;
  }
});
console.log(
  `encoded frames ${ys.length}, mean luma ${Math.min(...ys).toFixed(1)} to ${Math.max(...ys).toFixed(1)}`,
);
console.log(
  `largest step ${step.toFixed(2)} levels at f${at}; seam f${ys.length - 1} to f0 ${Math.abs(ys[ys.length - 1] - ys[0]).toFixed(2)}`,
);
const loud = run(['-i', FILM, '-af', 'ebur128=peak=true', '-vn', '-f', 'null', '-'])
  .split('\n')
  .slice(-14)
  .join('\n');
console.log(
  `encoded audio ${loud.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]} LUFS, ${loud.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]} dBTP`,
);
console.log(`wrote ${FILM}`);
process.exit(0);
