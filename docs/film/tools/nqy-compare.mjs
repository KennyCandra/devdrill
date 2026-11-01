// Compares the film with the real app, state by state: the same moment at 1440x810, without the
// film's camera and mouse, pixel by pixel, plus a side-by-side PNG of each.
// node docs/film/tools/nqy-compare.mjs
/* global console, URL */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { OUT, openChrome, sleep } from './nqy-page.mjs';
import { STATES } from './nqy-script.mjs';

const FILM = fileURLToPath(new URL('../not-quite-yet.html', import.meta.url));
const DIR = `${OUT}nqy-compare/`;
spawnSync('mkdir', ['-p', DIR]);

const page = await openChrome({ width: 1440, height: 810, scale: 1 });
await page.goto(`${pathToFileURL(FILM)}?t=0&nocam=1&nomouse=1`);
for (let i = 0; i < 200; i++) {
  const ok = await page.evaluate('typeof window.ready !== "undefined"').catch(() => false);
  if (ok) break;
  await sleep(50);
}
const ready = await page.evaluate('typeof window.ready !== "undefined"').catch(() => false);
if (!ready) {
  console.log(page.logs.join('\n') || 'the film never set window.ready');
  await page.close();
  process.exit(1);
}
await page.evaluate('window.ready.then(() => true)');

const run = (args) => spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8' });

for (const s of STATES) {
  await page.evaluate(`window.renderAt(${s.t})`);
  await sleep(120);
  const film = `${DIR}${s.name}-film.png`;
  writeFileSync(film, await page.shot());
  const real = `${OUT}nqy-real/${s.name}.png`;
  const psnr = run(['-i', real, '-i', film, '-lavfi', 'psnr', '-f', 'null', '-']);
  const db = /average:([\d.]+|inf)/.exec(psnr.stderr)?.[1];
  const ssim = run(['-i', real, '-i', film, '-lavfi', 'ssim', '-f', 'null', '-']);
  const same = /All:([\d.]+)/.exec(ssim.stderr)?.[1];
  // Which pixels differ, and by how much at most, as an amplified picture.
  run([
    '-i',
    real,
    '-i',
    film,
    '-lavfi',
    "[0:v]format=gbrp[a];[1:v]format=gbrp[b];[a][b]blend=all_mode=difference,lutrgb=r='val*4':g='val*4':b='val*4'",
    '-frames:v',
    '1',
    `${DIR}${s.name}-diff.png`,
  ]);
  run([
    '-i',
    real,
    '-i',
    film,
    '-lavfi',
    'hstack=inputs=2',
    '-frames:v',
    '1',
    `${DIR}${s.name}-side.png`,
  ]);
  console.log(`${s.name}: t ${s.t}, PSNR ${db} dB, SSIM ${same}`);
}
if (page.logs.length) console.log(page.logs.slice(0, 10).join('\n'));
await page.close();
process.exit(0);
