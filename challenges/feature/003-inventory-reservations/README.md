# Hold stock during checkout

Two customers bought the last pair of sneakers at the same moment: one of them paid for shoes that didn't exist.

Add **reservations**: when a customer starts checkout, hold the units for a while so nobody else can buy them.

## What to build

On the object returned by `createInventory()`:

- **`reserve(sku, qty, { ttlMs })`** holds `qty` units and returns a reservation id (any unique string). `ttlMs` defaults to 15 minutes. Throws if fewer than `qty` units are available.
- **`confirm(id)`** completes the purchase: the units leave stock for good and the reservation ends. Throws if the reservation doesn't exist, has expired, or was already confirmed or released.
- **`release(id)`** cancels the reservation and the units become available again. Throws if there's no active reservation with that id.
- **Expiry:** once `ttlMs` has passed, a reservation no longer holds anything.

And keep the stock counts right:

- `available(sku)` = units on hand minus units held by active reservations.
- `onHand(sku)` still counts held units (they're still on the shelf).
- `sell(sku, qty)` can't sell units someone else is holding.

The existing tests pass now and must keep passing. Pass `now` to `createInventory` in tests to control time.

## Files

- `src/inventory.js`: the inventory
- `tests/inventory.test.js`: the existing tests
