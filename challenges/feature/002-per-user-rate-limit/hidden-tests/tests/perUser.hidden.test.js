import { createRateLimiter } from '../src/rateLimiter.js';

function clock(start = 0) {
  let time = start;
  return { now: () => time, advance: (ms) => (time += ms) };
}

describe('rate limiter (per user)', () => {
  it('gives each user their own limit', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: clock().now });
    limiter.tryRequest('ana');
    limiter.tryRequest('ana');
    expect(limiter.tryRequest('ana')).toBe(false);
    expect(limiter.tryRequest('ben')).toBe(true);
  });

  it("starts each user's window at their first request", () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
    limiter.tryRequest('ana'); // Ana's window: 0–1000
    c.advance(500);
    limiter.tryRequest('ben'); // Ben's window: 500–1500
    c.advance(500); // t = 1000
    expect(limiter.tryRequest('ana')).toBe(true);
    expect(limiter.tryRequest('ben')).toBe(false);
    c.advance(500); // t = 1500
    expect(limiter.tryRequest('ben')).toBe(true);
  });

  it('reports remaining requests per user', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now: clock().now });
    expect(limiter.remaining('new-user')).toBe(3);
    limiter.tryRequest('ana');
    expect(limiter.remaining('ana')).toBe(2);
    expect(limiter.remaining('ben')).toBe(3);
  });

  it('reports when a user can retry', () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
    expect(limiter.retryAfterMs('ana')).toBe(0);
    limiter.tryRequest('ana');
    c.advance(250);
    expect(limiter.retryAfterMs('ana')).toBe(750);
    expect(limiter.retryAfterMs('ben')).toBe(0);
  });

  it('keeps the shared counter separate from per-user counters', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: clock().now });
    expect(limiter.tryRequest('ana')).toBe(true);
    expect(limiter.tryRequest()).toBe(true);
    expect(limiter.tryRequest()).toBe(false);
    expect(limiter.tryRequest('ben')).toBe(true);
  });

  it('regression: the shared window still starts when the limiter is created', () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
    c.advance(600);
    limiter.tryRequest();
    c.advance(400); // t = 1000: the shared window (0–1000) has ended
    expect(limiter.tryRequest()).toBe(true);
  });
});
