import { describe, expect, it } from 'vitest';
import type { IssueType, ReviewComment, ReviewIssue } from '@devdrill/shared';
import { gradeReview } from './reviewGrading.js';

const TYPES: IssueType[] = [
  { id: 'mutates-shared-state', label: 'x', category: 'bug', description: 'x' },
  { id: 'weak-test', label: 'x', category: 'tests', description: 'x' },
  { id: 'missing-test', label: 'x', category: 'tests', description: 'x' },
  { id: 'magic-value', label: 'x', category: 'readability', description: 'x' },
];

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
  id: 'weak',
  file: 'tests/orders.test.js',
  lines: [19, 22],
  type: 'weak-test',
  alsoAccept: ['missing-test'],
  severity: 'should',
});
const NIT = issue({ id: 'magic', lines: [12, 12], type: 'magic-value', severity: 'nit' });
const KEY = [NIT, SHOULD, MUST];

let next = 0;
const comment = (over: Partial<ReviewComment>): ReviewComment => ({
  id: `c${next++}`,
  file: 'src/orders.js',
  lines: [20, 20],
  type: 'mutates-shared-state',
  why: 'It changes the order.',
  ...over,
});

describe('gradeReview', () => {
  it('solves a review that finds the must and asks for changes', () => {
    const result = gradeReview(KEY, [comment({})], 'request_changes', TYPES);
    expect(result.solved).toBe(true);
    expect(result.verdict).toEqual({ given: 'request_changes', correct: true });
    expect(result.issues.find((i) => i.id === 'mutation')).toMatchObject({
      found: true,
      category: 'bug',
    });
    // Solved: every issue shows where and what, found or not.
    expect(result.issues.every((i) => i.details)).toBe(true);
  });

  it('needs the right location and the right type', () => {
    const wrongType = gradeReview(
      KEY,
      [comment({ type: 'magic-value' })],
      'request_changes',
      TYPES,
    );
    const wrongPlace = gradeReview(KEY, [comment({ lines: [2, 3] })], 'request_changes', TYPES);
    expect(wrongType.solved).toBe(false);
    expect(wrongPlace.solved).toBe(false);
  });

  it('accepts an alsoAccept type', () => {
    const c = comment({ file: 'tests/orders.test.js', lines: [21, 21], type: 'missing-test' });
    const result = gradeReview(KEY, [c], 'request_changes', TYPES);
    expect(result.issues.find((i) => i.id === 'weak')?.found).toBe(true);
  });

  it('fails the wrong verdict', () => {
    const result = gradeReview(KEY, [comment({})], 'approve', TYPES);
    expect(result.solved).toBe(false);
    expect(result.verdict.correct).toBe(false);
  });

  it('allows one false alarm, not two', () => {
    const alarm = () => comment({ lines: [1, 1], type: 'magic-value' });
    const one = gradeReview(KEY, [comment({}), alarm()], 'request_changes', TYPES);
    const two = gradeReview(KEY, [comment({}), alarm(), alarm()], 'request_changes', TYPES);
    expect(one.solved).toBe(true);
    expect(one.falseAlarms).toHaveLength(1);
    expect(two.solved).toBe(false);
  });

  it('does not count a repeat of a found issue as a false alarm', () => {
    const result = gradeReview(KEY, [comment({}), comment({})], 'request_changes', TYPES);
    expect(result.falseAlarms).toEqual([]);
  });

  it('gives a comment that fits two issues to the more serious one', () => {
    // Overlaps both the nit (line 12) and the must (18-23), and names the must's type.
    const both = issue({ id: 'both-nit', lines: [12, 20], severity: 'nit' });
    const result = gradeReview(
      [both, MUST],
      [comment({ lines: [19, 19] })],
      'request_changes',
      TYPES,
    );
    expect(result.issues.find((i) => i.id === 'mutation')?.found).toBe(true);
  });

  it('hides where and what of missed issues until solved', () => {
    const result = gradeReview(KEY, [], 'request_changes', TYPES);
    expect(result.solved).toBe(false);
    expect(result.issues.every((i) => i.details === undefined)).toBe(true);
    expect(result.issues.map((i) => i.category).sort()).toEqual(['bug', 'readability', 'tests']);
  });

  it('solves a clean pull request with an approval and no false alarms', () => {
    expect(gradeReview([], [], 'approve', TYPES).solved).toBe(true);
    expect(gradeReview([], [], 'request_changes', TYPES).solved).toBe(false);
  });

  it('moves a must to its other comment when a lesser issue needs the first one', () => {
    // c1 fits the must and the should; c2 fits only the must. Both issues can be found.
    const should = issue({
      id: 'also-here',
      lines: [20, 20],
      type: 'magic-value',
      severity: 'should',
    });
    const must = issue({ alsoAccept: ['magic-value'] });
    const c1 = comment({ lines: [20, 20], type: 'magic-value' });
    const c2 = comment({ lines: [19, 19] });
    const result = gradeReview([should, must], [c1, c2], 'request_changes', TYPES);
    expect(result.issues.every((i) => i.found)).toBe(true);
  });

  it('gives missed issues opaque ids, in severity order, until solved', () => {
    const result = gradeReview(KEY, [], 'request_changes', TYPES);
    expect(result.issues.map((i) => i.id)).toEqual(['missed-1', 'missed-2', 'missed-3']);
    expect(result.issues.map((i) => i.severity)).toEqual(['must', 'should', 'nit']);
    expect(JSON.stringify(result)).not.toContain('mutation');
  });

  it('shows everything to someone who solved it before', () => {
    const result = gradeReview(KEY, [], 'approve', TYPES, true);
    expect(result.solved).toBe(false);
    expect(result.issues.every((i) => i.details)).toBe(true);
  });
});
