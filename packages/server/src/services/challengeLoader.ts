import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChallengeMeta, Language, ReviewIssue } from '@devdrill/shared';
import { parseChallengeMeta } from './challengeMeta.js';
import { parseIssues, parseIssueTypes, type IssueTypeCatalog } from './reviewFormat.js';

export interface Challenge {
  meta: ChallengeMeta;
  readme: string;
  /** Absolute path to the challenge folder. */
  dir: string;
  /** The language folders it has (js/, ts/). */
  languages: Language[];
  /** Review challenges only: the answer key per language, and the issue types to pick from. */
  review?: {
    issues: Partial<Record<Language, ReviewIssue[]>>;
    issueTypes: IssueTypeCatalog;
  };
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
    const isReview = mode.name === 'review';
    let issueTypes: IssueTypeCatalog | null = null;
    if (isReview) {
      issueTypes = await loadIssueTypes(modeDir);
      if (!issueTypes) continue;
    }
    // A debug/feature challenge starts from starter/; a review shows base/ → head/.
    const firstLayer = isReview ? 'base' : 'starter';

    for (const entry of (await readdir(modeDir, { withFileTypes: true })).sort(byName)) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(modeDir, entry.name);
      try {
        const raw: unknown = JSON.parse(await readFile(path.join(dir, 'challenge.json'), 'utf8'));
        const parsed = parseChallengeMeta(raw, { mode: mode.name, dirName: entry.name });
        if (!parsed.ok) throw new Error(parsed.errors.join(' '));
        const readme = await readFile(path.join(dir, 'README.md'), 'utf8');
        const languages = LANGUAGES.filter((lang) => existsSync(path.join(dir, lang, firstLayer)));
        for (const lang of LANGUAGES) {
          if (existsSync(path.join(dir, lang)) && !languages.includes(lang)) {
            console.warn(
              `Challenge ${mode.name}/${entry.name}: ${lang}/ has no ${firstLayer}/, skipping it.`,
            );
          }
        }
        if (languages.length === 0) throw new Error('no js/ or ts/ folder');
        const challenge: Challenge = { meta: parsed.meta, readme, dir, languages };
        if (issueTypes) {
          const issues: Partial<Record<Language, ReviewIssue[]>> = {};
          for (const lang of languages) {
            const key: unknown = JSON.parse(
              await readFile(path.join(dir, lang, 'issues.json'), 'utf8'),
            );
            const result = parseIssues(key, issueTypes[lang]);
            if (!result.ok) throw new Error(`${lang}/${result.errors.join(' ')}`);
            issues[lang] = result.value;
          }
          challenge.review = { issues, issueTypes };
        }
        challenges.set(parsed.meta.id, challenge);
      } catch (err) {
        console.warn(`Skipping challenge ${mode.name}/${entry.name}: ${(err as Error).message}`);
      }
    }
  }

  return challenges;
}

/** `review/issue-types.json`, or null (review challenges are skipped) when it's broken. */
async function loadIssueTypes(reviewDir: string): Promise<IssueTypeCatalog | null> {
  try {
    const raw: unknown = JSON.parse(
      await readFile(path.join(reviewDir, 'issue-types.json'), 'utf8'),
    );
    const parsed = parseIssueTypes(raw);
    if (!parsed.ok) throw new Error(parsed.errors.join(' '));
    return parsed.value;
  } catch (err) {
    console.warn(`Skipping review challenges: ${(err as Error).message}`);
    return null;
  }
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}
