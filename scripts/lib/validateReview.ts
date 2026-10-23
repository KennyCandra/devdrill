import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Language, ReviewIssue } from '@devdrill/shared';
import { lineCount, MAX_COMMENT_LINES } from '@devdrill/shared/review';
import {
  parseIssues,
  parseIssueTypes,
  type IssueTypeCatalog,
} from '../../packages/server/src/services/reviewFormat.js';
import { changedLines, functionSpans } from './lineDiff.js';
import {
  checkImports,
  checkPackageJson,
  CONFIG_FILE,
  EXPLICIT_ANY,
  firstLine,
  LANGUAGES,
  listFiles,
  readText,
  runLayers,
  SKIP_OR_FOCUS,
  TEST_LIKE_FILE,
  TS_ESCAPE,
  typeCheck,
  withoutComments,
} from './validateChallenge.js';

/**
 * Checks a review challenge (rules in docs/V1_1_PLAN.md, section 4): each language's
 * base/ → head/ pull request and its answer key, then that the answer keys agree.
 */
export async function validateReview(
  dir: string,
  languages: Language[],
  errors: string[],
): Promise<void> {
  const typesFile = path.join(dir, '..', 'issue-types.json');
  let catalog: IssueTypeCatalog;
  try {
    const parsed = parseIssueTypes(JSON.parse((await readText(typesFile)) ?? 'null'));
    if (!parsed.ok) {
      errors.push(...parsed.errors);
      return;
    }
    catalog = parsed.value;
  } catch {
    errors.push('review/issue-types.json is missing or not valid JSON.');
    return;
  }

  const keys = new Map<Language, ReviewIssue[]>();
  for (const lang of languages) {
    const issues = await validateReviewLanguage(path.join(dir, lang), lang, catalog, errors);
    if (issues) keys.set(lang, issues);
  }

  // Every language is the same review: the same issues, equally serious, of the same kind.
  const [[firstLang, firstIssues] = ['js' as Language, [] as ReviewIssue[]], ...others] = [...keys];
  const category = (lang: Language, type: string) =>
    catalog[lang].find((t) => t.id === type)?.category;
  for (const [lang, issues] of others) {
    const ids = new Set(issues.map((i) => i.id));
    for (const issue of firstIssues) {
      const other = issues.find((i) => i.id === issue.id);
      if (!other) {
        errors.push(`${lang}/issues.json is missing "${issue.id}" (it's in ${firstLang}/).`);
      } else if (other.severity !== issue.severity) {
        errors.push(
          `${lang}/issues.json: "${issue.id}" must have the same severity as in ${firstLang}/.`,
        );
      } else if ((other.function === undefined) !== (issue.function === undefined)) {
        errors.push(
          `${lang}/issues.json: "${issue.id}" must be a whole function in both languages, or in neither.`,
        );
      } else if (category(lang, other.type) !== category(firstLang, issue.type)) {
        errors.push(
          `${lang}/issues.json: "${issue.id}" must be in the same category as in ${firstLang}/.`,
        );
      }
      ids.delete(issue.id);
    }
    for (const id of ids)
      errors.push(`${lang}/issues.json has "${id}", which ${firstLang}/ doesn't.`);
  }
}

/** Checks one language folder; returns its answer key when everything in it is valid. */
async function validateReviewLanguage(
  langDir: string,
  lang: Language,
  catalog: IssueTypeCatalog,
  allErrors: string[],
): Promise<ReviewIssue[] | null> {
  const rules = LANGUAGES[lang];
  const errors: string[] = [];
  const flush = (): null => {
    allErrors.push(...errors.map((e) => `${lang}/${e}`));
    return null;
  };

  for (const entry of await readdir(langDir)) {
    if (!['base', 'head', 'issues.json'].includes(entry)) {
      errors.push(`${entry}: a review language folder has only base/, head/ and issues.json.`);
    }
  }

  const base = path.join(langDir, 'base');
  const head = path.join(langDir, 'head');
  const baseFiles = await listFiles(base, 'base', errors);
  const headFiles = await listFiles(head, 'head', errors);
  if (!baseFiles || !headFiles) return flush();

  // Plain code of this language, no dependencies, every test runs.
  await checkPackageJson(base, errors, 'base');
  if (headFiles.includes('package.json')) {
    errors.push('head/package.json: the pull request must not change package.json.');
  }
  for (const [layer, root, files] of [
    ['base', base, baseFiles],
    ['head', head, headFiles],
  ] as const) {
    for (const file of files) {
      const label = `${layer}/${file}`;
      if (rules.foreign.test(file)) errors.push(`${label}: only ${rules.name} files are allowed.`);
      if (CONFIG_FILE.test(file)) errors.push(`${label}: config files are not allowed.`);
      if (!rules.source.test(file)) continue;
      const source = await readFile(path.join(root, file), 'utf8');
      await checkImports(label, lang, source, errors);
      if (TEST_LIKE_FILE.test(file) && SKIP_OR_FOCUS.test(source)) {
        errors.push(`${label}: remove .skip/.only/.todo; every test must run.`);
      }
      // The existing code is held to the usual rules; the pull request may break them,
      // since that can be what the reviewer has to catch.
      if (layer === 'base' && lang === 'ts' && TS_ESCAPE.test(source)) {
        errors.push(`${label}: @ts-ignore, @ts-expect-error and @ts-nocheck are not allowed.`);
      }
      if (
        layer === 'base' &&
        lang === 'ts' &&
        !TEST_LIKE_FILE.test(file) &&
        EXPLICIT_ANY.test(withoutComments(source))
      ) {
        errors.push(`${label}: use a real type instead of any.`);
      }
    }
  }
  if (errors.length > 0) return flush();

  // What the pull request changes.
  const changed = new Map<string, Set<number>>();
  const headText = new Map<string, string>();
  for (const file of headFiles) {
    const after = await readFile(path.join(head, file), 'utf8');
    const before = baseFiles.includes(file) ? await readFile(path.join(base, file), 'utf8') : null;
    headText.set(file, after);
    if (before === after) {
      errors.push(`head/${file} is the same as base/${file}; leave it out of head/.`);
    } else {
      changed.set(file, changedLines(before, after));
    }
  }
  if (changed.size === 0) errors.push('head/ must change at least one file.');

  // The pull request compiles and its tests pass: CI is green, so what's wrong is what
  // tests and compilers miss.
  if (lang === 'ts') {
    for (const [label, layers] of [
      ['base', [base]],
      ['head', [base, head]],
    ] as const) {
      for (const message of await typeCheck(layers)) {
        errors.push(`type error on ${label}: ${message}`);
      }
    }
  }
  if ([...baseFiles, ...headFiles].some((f) => TEST_LIKE_FILE.test(f))) {
    const run = await runLayers([base, head]);
    if (run.status !== 'passed') {
      const failing = run.tests.filter((t) => t.status !== 'passed').map((t) => t.name);
      errors.push(
        "The pull request's tests must pass on base/ + head/: " +
          (failing.length > 0
            ? failing.join('; ')
            : firstLine(run.errorMessage ?? run.fileErrors[0]?.message ?? run.status)),
      );
    }
  }

  // The answer key points at what the pull request changed.
  let raw: unknown;
  try {
    raw = JSON.parse((await readText(path.join(langDir, 'issues.json'))) ?? '');
  } catch {
    errors.push('issues.json is missing or not valid JSON (use [] for a clean pull request).');
    return flush();
  }
  const parsed = parseIssues(raw, catalog[lang]);
  if (!parsed.ok) {
    errors.push(...parsed.errors);
    return flush();
  }
  for (const issue of parsed.value) {
    const where = `issues.json "${issue.id}"`;
    const lines = changed.get(issue.file);
    const text = headText.get(issue.file);
    if (!lines || text === undefined) {
      errors.push(`${where}: ${issue.file} isn't a file the pull request changes.`);
      continue;
    }
    const [first, last] = issue.lines;
    if (last > lineCount(text)) {
      errors.push(`${where}: lines ${first}-${last} go past the end of ${issue.file}.`);
      continue;
    }
    if (![...lines].some((n) => n >= first && n <= last)) {
      errors.push(
        `${where}: lines ${first}-${last} don't include a line the pull request changed.`,
      );
    }
    if (issue.function === undefined && last - first + 1 > MAX_COMMENT_LINES) {
      // A reviewer's comment can't be wider than this, so it could never cover the issue.
      errors.push(
        `${where}: lines ${first}-${last} span more than ${MAX_COMMENT_LINES} lines; use "function" for a whole function.`,
      );
    }
    if (issue.function !== undefined) {
      const spans = functionSpans(issue.file, text).get(issue.function) ?? [];
      if (!spans.some(([a, b]) => a === first && b === last)) {
        const actual = spans.map(([a, b]) => `${a}-${b}`).join(' or ') || 'not found';
        errors.push(
          `${where}: function ${issue.function} is at lines ${actual}, not ${first}-${last}.`,
        );
      }
    }
  }
  if (errors.length > 0) return flush();
  return parsed.value;
}
