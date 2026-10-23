export interface RateLimiterOptions {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** The clock, in ms; tests pass a fake one. */
  now?: () => number;
}

// Fixed-window rate limiter: at most `limit` requests per `windowMs`.
export function createRateLimiter({ limit, windowMs, now = () => Date.now() }: RateLimiterOptions) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('limit must be a whole number of at least 1');
  }
  if (!(windowMs > 0)) {
    throw new RangeError('windowMs must be positive');
  }

  let windowStart = now();
  let count = 0;

  // Starts a new window once the current one has ended.
  function refresh(): void {
    const time = now();
    if (time - windowStart >= windowMs) {
      windowStart = time;
      count = 0;
    }
  }

  return {
    // Records a request if allowed. Returns false when over the limit.
    tryRequest(): boolean {
      refresh();
      if (count >= limit) return false;
      count++;
      return true;
    },

    remaining(): number {
      refresh();
      return limit - count;
    },

    // 0 while requests are left, otherwise the ms until the window ends.
    retryAfterMs(): number {
      refresh();
      return count < limit ? 0 : windowStart + windowMs - now();
    },
  };
}
