import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChallengeMeta } from '@devdrill/shared';
import { parseChallengeMeta } from './challengeMeta.js';

export interface Challenge {
  meta: ChallengeMeta;
  readme: string;
  /** Absolute path to the challenge folder. */
  dir: string;
}

/**
 * Loads every challenge under `challengesDir/<mode>/<NNN-name>/`, sorted by mode then number.
 * Broken challenges are skipped with a warning so one bad folder can't take the app down;
 * `npm run validate` is where they get reported properly.
 */
export async function loadChallenges(challengesDir: string): Promise<Map<string, Challenge>> {
  const challenges = new Map<string, Challenge>();

  for (const mode of (await readdir(challengesDir, { withFileTypes: true })).sort(byName)) {
    if (!mode.isDirectory()) continue;
    const modeDir = path.join(challengesDir, mode.name);

    for (const entry of (await readdir(modeDir, { withFileTypes: true })).sort(byName)) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(modeDir, entry.name);
      try {
        const raw: unknown = JSON.parse(await readFile(path.join(dir, 'challenge.json'), 'utf8'));
        const parsed = parseChallengeMeta(raw, { mode: mode.name, dirName: entry.name });
        if (!parsed.ok) throw new Error(parsed.errors.join(' '));
        const readme = await readFile(path.join(dir, 'README.md'), 'utf8');
        challenges.set(parsed.meta.id, { meta: parsed.meta, readme, dir });
      } catch (err) {
        console.warn(`Skipping challenge ${mode.name}/${entry.name}: ${(err as Error).message}`);
      }
    }
  }

  return challenges;
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}
