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

let failed = 0;

// Challenge numbers must be unique within a mode (001-a and 001-b would clash in ids and order).
const seen = new Map<string, string>();
for (const dir of dirs) {
  const key = `${path.basename(path.dirname(dir))}/${path.basename(dir).slice(0, 3)}`;
  const other = seen.get(key);
  if (other) {
    failed++;
    console.log(`❌ ${path.relative(ROOT, dir)}\n   - number already used by ${other}`);
  }
  seen.set(key, path.relative(ROOT, dir));
}

for (const dir of dirs) {
  const result = await validateChallenge(dir);
  const name = path.relative(ROOT, dir);
  if (result.ok) {
    console.log(`✅ ${name}`);
  } else {
    failed++;
    console.log(`❌ ${name}`);
    for (const error of result.errors) console.log(`   - ${error}`);
  }
}

console.log(`\n${dirs.length - failed}/${dirs.length} challenges valid.`);
process.exit(failed > 0 ? 1 : 0);
