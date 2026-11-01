// Renders "Not quite yet": 3840x2160 frames from headless Chrome, then H.264 + AAC. Finished
// frames are kept, so a stopped render resumes. Text is laid out and rasterized at each crop,
// never scaled as pixels.
// node docs/film/tools/nqy-render.mjs
/* global console, URL */
import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { OUT, openChrome, sleep } from './nqy-page.mjs';
import { DURATION, FPS } from './nqy-script.mjs';

const FILM = fileURLToPath(new URL('../not-quite-yet.html', import.meta.url));
const N = Math.round(DURATION * FPS);
const FRAMES = `${OUT}nqy-frames/`;
const VIDEO = `${OUT}not-quite-yet.mp4`;
const WAV = `${OUT}not-quite-yet.wav`;
mkdirSync(FRAMES, { recursive: true });

const page = await openChrome({ width: 1920, height: 1080, scale: 2 });
await page.goto(`${pathToFileURL(FILM)}?t=0`);
for (let i = 0; i < 200; i++) {
  if (await page.evaluate('typeof window.ready !== "undefined"').catch(() => false)) break;
  await sleep(50);
}
await page.evaluate('window.ready.then(() => true)');

const only = process.argv[2] === '--audio';
if (!only) {
  const started = Date.now();
  for (let f = 0; f < N; f++) {
    const path = `${FRAMES}${String(f).padStart(4, '0')}.png`;
    if (existsSync(path)) continue;
    // Two animation frames: the second one is the first that shows this frame's DOM.
    await page.evaluate(
      `(window.renderFrame(${f}), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))`,
    );
    writeFileSync(path, await page.shot());
    if (f % 60 === 0)
      console.log(`frame ${f} of ${N}, ${Math.round((Date.now() - started) / 1000)} s`);
  }
}
writeFileSync(WAV, Buffer.from(await page.evaluate('window.renderAudioWavBase64()'), 'base64'));
await page.close();
if (only) process.exit(0);

// prettier-ignore
const r = spawnSync('ffmpeg', [
  '-hide_banner', '-y',
  '-framerate', String(FPS), '-i', `${FRAMES}%04d.png`,
  '-i', WAV,
  '-vf', 'scale=1920:1080:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
  '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '14',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+faststart',
  VIDEO,
], { encoding: 'utf8', maxBuffer: 1 << 28 });
if (r.status !== 0) throw new Error(r.stderr);
console.log(`wrote ${VIDEO}`);
process.exit(0);
