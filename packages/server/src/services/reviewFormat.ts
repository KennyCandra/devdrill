import type { IssueType, Language, ReviewIssue, ReviewSeverity } from '@devdrill/shared';
import { MAX_REVIEW_ISSUES, REVIEW_CATEGORIES } from '@devdrill/shared/review';

/** Issue types per language: the shared ones followed by that language's own. */
export type IssueTypeCatalog = Record<Language, IssueType[]>;

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const LANGUAGES: Language[] = ['js', 'ts'];
const SEVERITIES: readonly ReviewSeverity[] = ['must', 'should', 'nit'];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Validates `challenges/review/issue-types.json`: `{ shared: [...], js: [...], ts: [...] }`. */
export function parseIssueTypes(raw: unknown): Parsed<IssueTypeCatalog> {
  if (!isObject(raw)) return { ok: false, errors: ['issue-types.json must be a JSON object.'] };
  const errors: string[] = [];
  const list = (key: string): IssueType[] => {
    const value = raw[key] ?? [];
    if (!Array.isArray(value)) {
      errors.push(`issue-types.json: "${key}" must be an array.`);
      return [];
    }
    return value.filter((t, i): t is IssueType => {
      const where = `issue-types.json: ${key}[${i}]`;
      if (!isObject(t)) {
        errors.push(`${where} must be an object.`);
        return false;
      }
      const problems = [
        typeof t.id === 'string' && ID.test(t.id) ? null : '"id" must be kebab-case',
        nonEmpty(t.label) ? null : '"label" must be a non-empty string',
        REVIEW_CATEGORIES.includes(t.category as never)
          ? null
          : `"category" must be one of ${REVIEW_CATEGORIES.join(', ')}`,
        nonEmpty(t.description) ? null : '"description" must be a non-empty string',
      ].filter((p) => p !== null);
      for (const p of problems) errors.push(`${where}: ${p}.`);
      return problems.length === 0;
    });
  };

  const shared = list('shared');
  const catalog = Object.fromEntries(
    LANGUAGES.map((lang) => [lang, [...shared, ...list(lang)]]),
  ) as IssueTypeCatalog;
  for (const lang of LANGUAGES) {
    const seen = new Set<string>();
    for (const t of catalog[lang]) {
      if (seen.has(t.id)) errors.push(`issue-types.json: "${t.id}" is listed twice for ${lang}.`);
      seen.add(t.id);
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: catalog };
}

/**
 * Validates one language's `issues.json` (the answer key) against that language's issue
 * types. Checks the shape only; the validator also checks the lines against the diff.
 */
export function parseIssues(raw: unknown, types: IssueType[]): Parsed<ReviewIssue[]> {
  if (!Array.isArray(raw)) return { ok: false, errors: ['issues.json must be an array.'] };
  const errors: string[] = [];
  if (raw.length > MAX_REVIEW_ISSUES) {
    errors.push(`issues.json: at most ${MAX_REVIEW_ISSUES} issues (it has ${raw.length}).`);
  }
  const typeIds = new Set(types.map((t) => t.id));
  const ids = new Set<string>();

  raw.forEach((issue: unknown, i) => {
    const where = `issues.json[${i}]`;
    if (!isObject(issue)) {
      errors.push(`${where} must be an object.`);
      return;
    }
    if (typeof issue.id !== 'string' || !ID.test(issue.id)) {
      errors.push(`${where}: "id" must be kebab-case.`);
    } else if (ids.has(issue.id)) {
      errors.push(`${where}: "id" "${issue.id}" is used twice.`);
    } else {
      ids.add(issue.id);
    }
    if (!nonEmpty(issue.file) || issue.file.startsWith('/') || issue.file.includes('\\')) {
      errors.push(`${where}: "file" must be a relative path with / separators.`);
    }
    if (!isLineRange(issue.lines)) {
      errors.push(`${where}: "lines" must be [first, last], whole numbers from 1, first <= last.`);
    }
    if (issue.function !== undefined && !nonEmpty(issue.function)) {
      errors.push(`${where}: "function" must be a function name when set.`);
    }
    if (typeof issue.type !== 'string' || !typeIds.has(issue.type)) {
      errors.push(`${where}: "type" must be one of this language's issue types.`);
    }
    if (
      issue.alsoAccept !== undefined &&
      (!Array.isArray(issue.alsoAccept) ||
        !issue.alsoAccept.every((t) => typeof t === 'string' && typeIds.has(t)))
    ) {
      errors.push(`${where}: "alsoAccept" must list this language's issue types.`);
    }
    if (!SEVERITIES.includes(issue.severity as ReviewSeverity)) {
      errors.push(`${where}: "severity" must be one of ${SEVERITIES.join(', ')}.`);
    }
    if (!nonEmpty(issue.title)) errors.push(`${where}: "title" must be a non-empty string.`);
    if (!nonEmpty(issue.explanation)) {
      errors.push(`${where}: "explanation" must be a non-empty string.`);
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: raw as ReviewIssue[] };
}

export function isLineRange(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => Number.isInteger(n) && (n as number) >= 1) &&
    (value[0] as number) <= (value[1] as number)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}
