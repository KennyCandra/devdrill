// Frames at chosen times, for a look: node docs/film/tools/nqy-sheet.mjs 3.9 4.9 ...
/* global console, URL */
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { OUT, openChrome, sleep } from './nqy-page.mjs';

const FILM = fileURLToPath(new URL('../not-quite-yet.html', import.meta.url));
const times = process.argv.slice(2).map(Number);
const page = await openChrome({ width: 1440, height: 810, scale: 1 });
await page.goto(`${pathToFileURL(FILM)}?t=0`);
for (let i = 0; i < 200; i++) {
  if (await page.evaluate('typeof window.ready !== "undefined"').catch(() => false)) break;
  await sleep(50);
}
await page.evaluate('window.ready.then(() => true)');
for (const t of times) {
  await page.evaluate(`window.renderAt(${t})`);
  await sleep(60);
  writeFileSync(`${OUT}sheet-${t.toFixed(2)}.png`, await page.shot());
}
if (page.logs.length) console.log(page.logs.slice(0, 10).join('\n'));
await page.close();
process.exit(0);
