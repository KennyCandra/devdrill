// Validates every challenge under challenges/ (or only the ones passed as arguments).
//
//   npm run validate
//   npm run validate -- challenges/debug/001-cart-discount
//
// Exits with code 1 if any challenge is invalid.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { validateChallenge } from './lib/validateChallenge.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHALLENGES_DIR = path.join(ROOT, 'challenges');

async function findChallengeDirs(): Promise<string[]> {
  const dirs: string[] = [];
  for (const mode of await readdir(CHALLENGES_DIR, { withFileTypes: true })) {
    if (!mode.isDirectory()) continue;
    for (const entry of await readdir(path.join(CHALLENGES_DIR, mode.name), {
      withFileTypes: true,
    })) {
      if (entry.isDirectory()) dirs.push(path.join(CHALLENGES_DIR, mode.name, entry.name));
    }
  }
  return dirs.sort();
}

const args = process.argv.slice(2);
const dirs = args.length > 0 ? args.map((a) => path.resolve(a)) : await findChallengeDirs();

if (dirs.length === 0) {
  console.log('No challenges found.');
  process.exit(0);
}

const failedDirs = new Set<string>();

// Challenge numbers must be unique within a mode (001-a and 001-b would clash in ids and
// order). Compare against every challenge, even when only some are being validated.
const numberKey = (dir: string) =>
  `${path.basename(path.dirname(dir))}/${path.basename(dir).slice(0, 3)}`;
const allDirs = [...new Set([...(await findChallengeDirs()), ...dirs])];
for (const dir of dirs) {
  const clash = allDirs.find((other) => other !== dir && numberKey(other) === numberKey(dir));
  if (clash) {
    failedDirs.add(dir);
    console.log(
      `❌ ${path.relative(ROOT, dir)}\n   - number already used by ${path.relative(ROOT, clash)}`,
    );
  }
}

for (const dir of dirs) {
  const result = await validateChallenge(dir);
  const name = path.relative(ROOT, dir);
  if (result.ok) {
    if (!failedDirs.has(dir)) console.log(`✅ ${name}`);
  } else {
    failedDirs.add(dir);
    console.log(`❌ ${name}`);
    for (const error of result.errors) console.log(`   - ${error}`);
  }
}

const failed = failedDirs.size;
console.log(`\n${dirs.length - failed}/${dirs.length} challenges valid.`);
process.exit(failed > 0 ? 1 : 0);
