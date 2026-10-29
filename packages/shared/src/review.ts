/**
 * Review-mode limits, shared by the server (which enforces them), the web UI (which shows
 * them) and the challenge validator. A runtime module, so it lives outside the types-only
 * index.ts.
 */
import type { ReviewCategory } from './index.js';

/** Comments allowed in one review. The same for every PR, so it never hints at the answer. */
export const MAX_REVIEW_COMMENTS = 7;

/** Issues a review challenge may plant: always fewer than the comments allowed. */
export const MAX_REVIEW_ISSUES = 5;

export const MAX_COMMENT_CHARS = 1000;

/** A comment covers at most this many lines (about one function). */
export const MAX_COMMENT_LINES = 40;

/** Lines in a file as an editor numbers them: a final newline doesn't start another line. */
export function lineCount(text: string): number {
  const lines = text.split('\n');
  return text.endsWith('\n') ? lines.length - 1 : lines.length;
}

/** How much each severity counts towards a review's score. */
export const SEVERITY_WEIGHTS = { must: 3, should: 2, nit: 1 } as const;

export const REVIEW_CATEGORIES: readonly ReviewCategory[] = [
  'bug',
  'security',
  'performance',
  'readability',
  'tests',
];

export const CATEGORY_LABELS: Record<ReviewCategory, string> = {
  bug: 'Bug',
  security: 'Security',
  performance: 'Performance',
  readability: 'Readability',
  tests: 'Tests',
};
