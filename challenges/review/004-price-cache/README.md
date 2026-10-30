# Cache product prices

## What this PR does

The price service is slow (about **200 ms per call**) and checkout asks it for every item, every time. This PR remembers prices:

- **`getPrice(productId)` caches each price for one hour.** After an hour it asks the service again, since prices can change.
- **A price that failed to load must be asked for again next time.** The service has short outages; one failure must not stick.
- **`cartTotal(items)` is rewritten as a plain loop** that's easier to read.

Good to know:

- Carts have up to **50 items**, and checkout must stay fast.
- There are a few hundred products, so the cache stays small; no size limit is needed.
- `fetchPrice(productId)` resolves to a price in cents, or rejects when the service is down.
- `now` can be passed in so tests control time.

## How it was tested

- Tests for the cart total, for asking the service once within an hour, and for asking again after an hour.

## Your review

Review it like a teammate would. Comment on what must change before merging, and on anything worth improving. If the PR is good as it is, approve it.
