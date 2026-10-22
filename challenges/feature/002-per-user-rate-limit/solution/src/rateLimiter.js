// Fixed-window rate limiter: at most `limit` requests per `windowMs`, either shared or
// per user. `now` can be passed in so tests control time.
export function createRateLimiter({ limit, windowMs, now = () => Date.now() }) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('limit must be a whole number of at least 1');
  }
  if (!(windowMs > 0)) {
    throw new RangeError('windowMs must be positive');
  }

  // One counter and its window. The shared bucket's window starts now; a user's
  // bucket is created at their first request, so their window starts then.
  function createBucket() {
    return { windowStart: now(), count: 0 };
  }

  // Starts a new window once the current one has ended.
  function refresh(bucket) {
    const time = now();
    if (time - bucket.windowStart >= windowMs) {
      bucket.windowStart = time;
      bucket.count = 0;
    }
    return bucket;
  }

  const shared = createBucket();
  const users = new Map();

  function bucketFor(userId, { create = false } = {}) {
    if (userId === undefined) return refresh(shared);
    let bucket = users.get(userId);
    if (!bucket) {
      if (!create) return null; // never seen: a full, unstarted window
      bucket = createBucket();
      users.set(userId, bucket);
    }
    return refresh(bucket);
  }

  return {
    // Records a request if allowed. Returns false when over the limit.
    tryRequest(userId) {
      const bucket = bucketFor(userId, { create: true });
      if (bucket.count >= limit) return false;
      bucket.count++;
      return true;
    },

    remaining(userId) {
      const bucket = bucketFor(userId);
      return bucket ? limit - bucket.count : limit;
    },

    // 0 while requests are left, otherwise the ms until the window ends.
    retryAfterMs(userId) {
      const bucket = bucketFor(userId);
      if (!bucket || bucket.count < limit) return 0;
      return bucket.windowStart + windowMs - now();
    },
  };
}
