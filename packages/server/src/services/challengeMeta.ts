import type { ChallengeMeta, ChallengeMode, Difficulty } from '@devdrill/shared';

const MODES: readonly ChallengeMode[] = ['debug', 'feature'];
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** Folder names look like `001-cart-discount`. */
export const CHALLENGE_DIR_PATTERN = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ParseResult = { ok: true; meta: ChallengeMeta } | { ok: false; errors: string[] };

/**
 * Validates a parsed `challenge.json`.
 * `location` is where the file lives, so the id can be checked against it:
 * `challenges/debug/001-cart-discount` must have id `debug-001-cart-discount`.
 */
export function parseChallengeMeta(
  raw: unknown,
  location: { mode: string; dirName: string },
): ParseResult {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['challenge.json must be a JSON object.'] };
  }
  const data = raw as Record<string, unknown>;

  if (!CHALLENGE_DIR_PATTERN.test(location.dirName)) {
    errors.push(`Folder name "${location.dirName}" must look like "001-short-name".`);
  }

  const expectedId = `${location.mode}-${location.dirName}`;
  if (data.id !== expectedId) {
    errors.push(`"id" must be "${expectedId}" (mode + folder name).`);
  }

  if (!MODES.includes(data.mode as ChallengeMode)) {
    errors.push(`"mode" must be one of: ${MODES.join(', ')}.`);
  } else if (data.mode !== location.mode) {
    errors.push(`"mode" is "${String(data.mode)}" but the folder is under "${location.mode}/".`);
  }

  if (typeof data.title !== 'string' || data.title.trim() === '') {
    errors.push('"title" must be a non-empty string.');
  }

  if (!DIFFICULTIES.includes(data.difficulty as Difficulty)) {
    errors.push(`"difficulty" must be one of: ${DIFFICULTIES.join(', ')}.`);
  }

  if (
    typeof data.estimatedMinutes !== 'number' ||
    !Number.isInteger(data.estimatedMinutes) ||
    data.estimatedMinutes <= 0
  ) {
    errors.push('"estimatedMinutes" must be a positive whole number.');
  }

  if (!isStringArray(data.tags)) {
    errors.push('"tags" must be an array of strings.');
  }

  if (!isStringArray(data.hints) || data.hints.length === 0) {
    errors.push('"hints" must be a non-empty array of strings.');
  }

  const rules = data.hiddenTestRules;
  if (
    rules !== undefined &&
    (typeof rules !== 'object' ||
      rules === null ||
      Array.isArray(rules) ||
      !Object.values(rules).every((v) => typeof v === 'string' && v.trim() !== ''))
  ) {
    errors.push('"hiddenTestRules" must map hidden test names to non-empty strings.');
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    meta: {
      id: data.id as string,
      mode: data.mode as ChallengeMode,
      title: data.title as string,
      difficulty: data.difficulty as Difficulty,
      estimatedMinutes: data.estimatedMinutes as number,
      tags: data.tags as string[],
      hints: data.hints as string[],
      ...(rules ? { hiddenTestRules: rules as Record<string, string> } : {}),
    },
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}
