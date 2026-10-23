# Rate limit each user separately

The API has one rate limiter for everybody: `limit` requests per `windowMs`. When one busy customer runs a script, **everyone else** gets "too many requests".

Make the limiter work per user, without breaking code that already calls it without a user.

## What to build

`tryRequest`, `remaining` and `retryAfterMs` all accept an optional `userId`:

- **With a `userId`**: that user has their own count and their own window. Their window starts at their **first request** and lasts `windowMs`; after that, their count starts over.
- **Without a `userId`**: works exactly as today (one shared counter whose window starts when the limiter is created). The shared counter and per-user counters don't affect each other.
- `remaining(userId)` for a user who hasn't made a request yet is `limit`.
- `retryAfterMs(userId)` is `0` while the user has requests left, otherwise the ms until their window ends.

```js
const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
limiter.tryRequest('ana'); // true
limiter.tryRequest('ana'); // true
limiter.tryRequest('ana'); // false, Ana is over her limit
limiter.tryRequest('ben'); // true, Ben has his own limit
```

The existing tests pass now and must keep passing.

## Data

**Options** for `createRateLimiter(options)`

| Field      | Type                       | Meaning                                       |
| ---------- | -------------------------- | --------------------------------------------- |
| `limit`    | whole number, 1 or more    | Requests allowed per window                   |
| `windowMs` | number, more than 0        | Window length in milliseconds                 |
| `now`      | function returning ms (optional) | The clock; tests pass a fake one       |

**Limiter** (what `createRateLimiter` returns). `userId` is text and optional everywhere:

| Method                  | Returns                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `tryRequest(userId)`    | true if the request is allowed (and counts it), false if over the limit |
| `remaining(userId)`     | whole number: requests left in the current window             |
| `retryAfterMs(userId)`  | number: 0 while requests are left, else ms until the window ends |

## Files

- `src/rateLimiter`: the limiter (`now` can be passed in so tests control time)
- `tests/rateLimiter.test`: the existing tests
