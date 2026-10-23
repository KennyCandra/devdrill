import { isOnline } from '../src/presence.js';

const NOW = Date.UTC(2026, 2, 21, 12, 0, 0);

describe('isOnline', () => {
  it('is online when seen a minute ago', () => {
    expect(isOnline(NOW - 60_000, NOW)).toBe(true);
  });

  it('is offline when seen five minutes ago', () => {
    expect(isOnline(NOW - 5 * 60_000, NOW)).toBe(false);
  });
});
