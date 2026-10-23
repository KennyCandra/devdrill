import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChallengeMeta, Language } from '@devdrill/shared';
import { parseChallengeMeta } from './challengeMeta.js';

export interface Challenge {
  meta: ChallengeMeta;
  readme: string;
  /** Absolute path to the challenge folder. */
  dir: string;
  /** The language folders it has (js/, ts/). */
  languages: Language[];
}

const LANGUAGES: Language[] = ['js', 'ts'];

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
        const languages = LANGUAGES.filter((lang) => existsSync(path.join(dir, lang, 'starter')));
        for (const lang of LANGUAGES) {
          if (existsSync(path.join(dir, lang)) && !languages.includes(lang)) {
            console.warn(
              `Challenge ${mode.name}/${entry.name}: ${lang}/ has no starter/, skipping it.`,
            );
          }
        }
        if (languages.length === 0) throw new Error('no js/ or ts/ folder');
        challenges.set(parsed.meta.id, { meta: parsed.meta, readme, dir, languages });
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
