import type { ChallengeSummary, Language, SubmitResult } from '@devdrill/shared';

export interface StoredResult {
  submit: SubmitResult;
  /** Active time on the challenge when it was submitted. */
  elapsedMs: number;
}

// Results are per language: solving in JavaScript says nothing about TypeScript.
const resultKey = (id: string, lang: Language) => `devdrill-result-${lang}-${id}`;

// Fallback for when sessionStorage is unavailable: the result still survives navigation.
const memory = new Map<string, StoredResult>(); // keyed like resultKey()

/** Keeps the last submit so the Results page can show it, including after a reload. */
export function saveResult(id: string, lang: Language, result: StoredResult): void {
  memory.set(resultKey(id, lang), result);
  try {
    sessionStorage.setItem(resultKey(id, lang), JSON.stringify(result));
  } catch {
    // Too big or storage blocked: the in-memory copy is enough for this visit.
  }
}

export function loadResult(id: string, lang: Language): StoredResult | null {
  try {
    const raw = sessionStorage.getItem(resultKey(id, lang));
    if (raw) return JSON.parse(raw) as StoredResult;
  } catch {
    // Fall through to memory.
  }
  return memory.get(resultKey(id, lang)) ?? null;
}

export function clearResult(id: string, lang: Language): void {
  memory.delete(resultKey(id, lang));
  try {
    sessionStorage.removeItem(resultKey(id, lang));
  } catch {
    // Nothing stored.
  }
}

/** Forgets every stored result (after "Reset all progress"). */
export function clearAllResults(): void {
  memory.clear();
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('devdrill-result-')) sessionStorage.removeItem(key);
    }
  } catch {
    // Nothing stored.
  }
}

/**
 * The challenge to suggest next: the first unsolved one after the current one in list
 * order, wrapping around; null when everything else is solved.
 */
export function nextChallenge(
  list: ChallengeSummary[],
  currentId: string,
): ChallengeSummary | null {
  const index = list.findIndex((c) => c.id === currentId);
  const ordered = [...list.slice(index + 1), ...list.slice(0, Math.max(index, 0))];
  return ordered.find((c) => c.id !== currentId && c.progress.status !== 'solved') ?? null;
}
