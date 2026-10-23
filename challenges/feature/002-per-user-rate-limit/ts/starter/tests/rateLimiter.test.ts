import { createRateLimiter } from '../src/rateLimiter';

function clock(start = 0) {
  let time = start;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

describe('rate limiter (shared)', () => {
  it('allows up to the limit, then refuses', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: clock().now });
    expect([limiter.tryRequest(), limiter.tryRequest(), limiter.tryRequest()]).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('starts over when the window ends', () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
    limiter.tryRequest();
    c.advance(999);
    expect(limiter.tryRequest()).toBe(false);
    c.advance(1);
    expect(limiter.tryRequest()).toBe(true);
  });

  it('reports what is left and when to retry', () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: c.now });
    expect(limiter.remaining()).toBe(2);
    limiter.tryRequest();
    limiter.tryRequest();
    c.advance(300);
    expect(limiter.remaining()).toBe(0);
    expect(limiter.retryAfterMs()).toBe(700);
  });

  it('rejects a bad limit', () => {
    expect(() => createRateLimiter({ limit: 0, windowMs: 1000 })).toThrow(RangeError);
  });
});
