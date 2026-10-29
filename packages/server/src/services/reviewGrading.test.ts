import { describe, expect, it } from 'vitest';
import type { ReviewComment, ReviewIssue } from '@devdrill/shared';
import { compareReview, withCaught } from './reviewGrading.js';

const issue = (over: Partial<ReviewIssue>): ReviewIssue => ({
  id: 'mutation',
  file: 'src/orders.js',
  lines: [18, 23],
  type: 'mutates-shared-state',
  severity: 'must',
  title: 'Mutates',
  explanation: 'Because.',
  ...over,
});

const MUST = issue({});
const SHOULD = issue({
  id: 'weak-test',
  file: 'tests/orders.test.js',
  lines: [24, 28],
  type: 'weak-test',
  severity: 'should',
});
const NIT = issue({ id: 'magic', lines: [12, 12], type: 'magic-value', severity: 'nit' });
const KEY = [NIT, SHOULD, MUST];

const comment = (id: string, over: Partial<ReviewComment> = {}): ReviewComment => ({
  id,
  file: 'src/orders.js',
  lines: [20, 20],
  why: 'It changes the order.',
  ...over,
});

const NOW = '2026-10-29T12:00:00.000Z';

describe('compareReview', () => {
  it('passes on the right verdict, whatever the comments say', () => {
    expect(compareReview(KEY, [], 'request_changes', NOW).passed).toBe(true);
    expect(compareReview(KEY, [comment('a')], 'approve', NOW)).toMatchObject({
      passed: false,
      verdict: { given: 'approve', expected: 'request_changes' },
    });
  });

  it('expects an approval for a pull request without must-fix issues', () => {
    expect(compareReview([NIT], [], 'approve', NOW).passed).toBe(true);
    expect(compareReview([], [], 'request_changes', NOW).passed).toBe(false);
  });

  it('lists the issues most serious first, with the comments on their lines', () => {
    const review = compareReview(
      KEY,
      [comment('on-must'), comment('elsewhere', { lines: [2, 3] })],
      'request_changes',
      NOW,
    );
    expect(review.issues.map((o) => o.issue.id)).toEqual(['mutation', 'weak-test', 'magic']);
    expect(review.issues[0]?.nearby).toEqual(['on-must']);
    expect(review.others).toEqual(['elsewhere']);
  });

  it('weighs issues by severity: must 3, should 2, nit 1', () => {
    const weights = compareReview(KEY, [], 'request_changes', NOW).issues.map((o) =>
      Math.round(o.weight),
    );
    expect(weights).toEqual([50, 33, 17]);
  });

  it('starts at 0, or 100 for a passed review of a clean pull request', () => {
    expect(compareReview(KEY, [], 'request_changes', NOW).score).toBe(0);
    expect(compareReview([], [], 'approve', NOW).score).toBe(100);
  });
});

describe('withCaught', () => {
  const review = compareReview(KEY, [], 'request_changes', NOW);

  it('scores the ticked issues', () => {
    expect(withCaught(review, ['mutation', 'magic']).score).toBe(67);
    expect(withCaught(review, ['mutation', 'weak-test', 'magic']).score).toBe(100);
  });

  it('can untick, and ignores ids that are not issues of this review', () => {
    const ticked = withCaught(review, ['mutation', 'made-up']);
    expect(ticked.score).toBe(50);
    expect(withCaught(ticked, []).score).toBe(0);
  });
});
