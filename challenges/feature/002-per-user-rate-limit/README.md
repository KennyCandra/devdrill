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

## Contract

`tryRequest(userId)`, `remaining(userId)` and `retryAfterMs(userId)` take an optional `userId` (text). Without one, they act on the shared counter, as they do today.

A window lasts from its start up to `windowStart + windowMs`. At exactly that time, a new window starts and the count starts over. Only `tryRequest` starts a window. `remaining` and `retryAfterMs` never do.

Each example uses a fake clock, and `t` is the time in ms. Every case gives the exact return value.

### Per user, the window starts at the first request

`createRateLimiter({ limit: 1, windowMs: 1000 })`:

```js
// t = 0
tryRequest('ana'); // true, Ana's window runs from t = 0 to t = 1000

// t = 500
tryRequest('ben'); // true, Ben's window runs from t = 500 to t = 1500

// t = 1000
tryRequest('ana'); // true, Ana's window has ended, so her count starts over
tryRequest('ben'); // false, Ben's window runs until t = 1500

// t = 1500
tryRequest('ben'); // true
```

### Asking about a user does not start their window

`createRateLimiter({ limit: 1, windowMs: 1000 })`:

```js
// t = 0
remaining('ana'); // 1
retryAfterMs('ana'); // 0

// t = 500
tryRequest('ana'); // true, Ana's window runs from t = 500 to t = 1500

// t = 1100
tryRequest('ana'); // false
```

### Remaining and retry time per user

`createRateLimiter({ limit: 1, windowMs: 1000 })`, first request at `t = 0`:

```js
tryRequest('ana'); // true

// t = 250
retryAfterMs('ana'); // 750
remaining('ana'); // 0
retryAfterMs('ben'); // 0, Ben has not made a request
remaining('ben'); // 1, Ben has not made a request
```

### The shared counter, without a user

`createRateLimiter({ limit: 1, windowMs: 1000 })`, created at `t = 0`:

```js
// t = 0
tryRequest('ana'); // true
tryRequest(); // true, the shared counter has its own limit
tryRequest(); // false
tryRequest('ben'); // true

// t = 600
tryRequest(); // false, still in the shared window from t = 0 to t = 1000

// t = 1000
tryRequest(); // true, the shared window has ended
```

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
