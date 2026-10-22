import { describe, expect, it } from 'vitest';
import { addTick, formatDuration } from './timer';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [5_000, '0:05'],
    [65_000, '1:05'],
    [12 * 60_000 + 30_000, '12:30'],
    [3_723_000, '1:02:03'],
    [-10, '0:00'],
  ])('formats %i ms as %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe('addTick', () => {
  it('adds a normal tick', () => {
    expect(addTick(10_000, 1_000, 2_000)).toBe(11_000);
  });

  it('ignores a long gap from sleep or a frozen tab', () => {
    expect(addTick(10_000, 1_000, 1_000 + 60_000)).toBe(10_000);
  });

  it('ignores a clock that went backwards', () => {
    expect(addTick(10_000, 5_000, 4_000)).toBe(10_000);
  });
});
