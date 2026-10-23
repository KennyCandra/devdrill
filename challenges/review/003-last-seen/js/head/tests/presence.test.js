import { formatLastSeen, isOnline } from '../src/presence.js';

const NOW = Date.UTC(2026, 2, 21, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('isOnline', () => {
  it('is online when seen a minute ago', () => {
    expect(isOnline(NOW - 60_000, NOW)).toBe(true);
  });

  it('is offline when seen five minutes ago', () => {
    expect(isOnline(NOW - 5 * 60_000, NOW)).toBe(false);
  });
});

describe('formatLastSeen', () => {
  it.each([
    [30 * 1000, 'just now'],
    [59 * 1000, 'just now'],
    [1 * MINUTE, '1 minute ago'],
    [5 * MINUTE, '5 minutes ago'],
    [59 * MINUTE + 59 * 1000, '59 minutes ago'],
    [1 * HOUR, '1 hour ago'],
    [90 * MINUTE, '1 hour ago'],
    [3 * HOUR, '3 hours ago'],
    [1 * DAY, '1 day ago'],
    [6 * DAY + 23 * HOUR, '6 days ago'],
  ])('shows %i ms ago as "%s"', (elapsed, expected) => {
    expect(formatLastSeen(NOW - elapsed, NOW)).toBe(expected);
  });

  it('shows the date from one week on', () => {
    expect(formatLastSeen(NOW - 7 * DAY, NOW)).toBe('2026-03-14');
  });

  it('treats a time in the future as just now', () => {
    expect(formatLastSeen(NOW + 5 * MINUTE, NOW)).toBe('just now');
  });
});
