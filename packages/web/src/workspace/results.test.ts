import { describe, expect, it } from 'vitest';
import type { ChallengeStatus, ChallengeSummary } from '@bughunt/shared';
import { nextChallenge } from './results';

function challenge(id: string, status: ChallengeStatus): ChallengeSummary {
  return {
    id,
    mode: 'debug',
    title: id,
    difficulty: 'easy',
    estimatedMinutes: 10,
    tags: [],
    progress: { status, attempts: 0 },
  };
}

describe('nextChallenge', () => {
  const list = [
    challenge('a', 'solved'),
    challenge('b', 'not_started'),
    challenge('c', 'solved'),
    challenge('d', 'in_progress'),
  ];

  it('picks the next unsolved challenge after the current one', () => {
    expect(nextChallenge(list, 'b')?.id).toBe('d');
  });

  it('wraps around to the start of the list', () => {
    expect(nextChallenge(list, 'd')?.id).toBe('b');
  });

  it('never suggests the current challenge', () => {
    expect(nextChallenge([challenge('a', 'not_started')], 'a')).toBeNull();
  });

  it('returns null when everything else is solved', () => {
    expect(nextChallenge([challenge('a', 'solved'), challenge('b', 'solved')], 'a')).toBeNull();
  });
});
