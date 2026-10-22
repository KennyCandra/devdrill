import { describe, expect, it, vi } from 'vitest';
import { ActiveTimer, addTick, formatDuration } from './timer';

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

describe('ActiveTimer', () => {
  it('counts visible time and starts over on reset', () => {
    vi.useFakeTimers();
    try {
      localStorage.clear();
      const timer = new ActiveTimer('t1');
      timer.start();
      vi.advanceTimersByTime(3000);
      expect(timer.getSnapshot()).toBe(3000);
      expect(Number(localStorage.getItem('bughunt-time-t1'))).toBe(3000);

      timer.reset();
      expect(timer.get()).toBe(0);
      timer.stop();
      vi.advanceTimersByTime(3000);
      expect(timer.get()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('picks up where it left off after a reload', () => {
    localStorage.setItem('bughunt-time-t2', '42000');
    expect(new ActiveTimer('t2').get()).toBe(42000);
  });
});
