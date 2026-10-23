import { describe, expect, it } from 'vitest';
import type { IssueType } from '@devdrill/shared';
import { parseIssues, parseIssueTypes } from './reviewFormat.js';

const type = (id: string): IssueType => ({
  id,
  label: id,
  category: 'bug',
  description: 'x',
});

const issue = {
  id: 'missing-await',
  file: 'src/orders.js',
  lines: [3, 5],
  type: 'missing-await',
  severity: 'must',
  title: 'Not awaited',
  explanation: 'It returns a promise.',
};

describe('parseIssueTypes', () => {
  it('puts the shared types before each language’s own', () => {
    const result = parseIssueTypes({ shared: [type('a')], ts: [type('b')] });
    expect(result.ok && result.value.js.map((t) => t.id)).toEqual(['a']);
    expect(result.ok && result.value.ts.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('rejects a duplicate id and an unknown category', () => {
    const result = parseIssueTypes({
      shared: [type('a'), { ...type('c'), category: 'style' }],
      js: [type('a')],
    });
    expect(result.ok).toBe(false);
    const text = !result.ok ? result.errors.join('\n') : '';
    expect(text).toContain('"a" is listed twice');
    expect(text).toContain('"category" must be one of');
  });
});

describe('parseIssues', () => {
  const types = [type('missing-await')];

  it('accepts a valid answer key, and an empty one (a clean pull request)', () => {
    expect(parseIssues([issue], types).ok).toBe(true);
    expect(parseIssues([], types).ok).toBe(true);
  });

  it('rejects unknown types, bad lines, repeated ids and too many issues', () => {
    const bad = parseIssues(
      [
        { ...issue, type: 'off-by-one' },
        { ...issue, lines: [5, 3] },
        ...Array.from({ length: 4 }, () => issue),
      ],
      types,
    );
    expect(bad.ok).toBe(false);
    const text = !bad.ok ? bad.errors.join('\n') : '';
    expect(text).toContain('at most 5 issues');
    expect(text).toContain('"type" must be one of');
    expect(text).toContain('"lines" must be');
    expect(text).toContain('used twice');
  });
});
