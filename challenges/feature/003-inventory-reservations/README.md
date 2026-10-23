# Hold stock during checkout

Two customers bought the last pair of sneakers at the same moment: one of them paid for shoes that didn't exist.

Add **reservations**: when a customer starts checkout, hold the units for a while so nobody else can buy them.

## What to build

On the object returned by `createInventory()`:

- **`reserve(sku, qty, { ttlMs })`** holds `qty` units and returns a reservation id (any unique string). `ttlMs` defaults to 15 minutes. Throws if fewer than `qty` units are available.
- **`confirm(id)`** completes the purchase: the units leave stock for good and the reservation ends. Throws if the reservation doesn't exist, has expired, or was already confirmed or released.
- **`release(id)`** cancels the reservation and the units become available again. Throws if there's no active reservation with that id.
- **Expiry:** a reservation stops holding units as soon as `ttlMs` ms have passed (at exactly `ttlMs` it has already expired).

And keep the stock counts right:

- `available(sku)` = units on hand minus units held by active reservations.
- `onHand(sku)` still counts held units (they're still on the shelf).
- `sell(sku, qty)` can't sell units someone else is holding.

### Example

```js
let time = 0;
const inv = createInventory({ now: () => time });
inv.addStock('sneakers', 3);

const id = inv.reserve('sneakers', 2, { ttlMs: 60_000 }); // e.g. 'r1'
inv.available('sneakers'); // 1: two are held
inv.onHand('sneakers');    // 3: still on the shelf

inv.confirm(id);
inv.available('sneakers'); // 1
inv.onHand('sneakers');    // 1: sold

const late = inv.reserve('sneakers', 1, { ttlMs: 1000 });
time += 1000;              // exactly ttlMs later: expired
inv.available('sneakers'); // 1 again
inv.confirm(late);         // throws: no active reservation
```

The existing tests pass now and must keep passing. Pass `now` to `createInventory` in tests to control time.

## Files

- `src/inventory.js`: the inventory
- `tests/inventory.test.js`: the existing tests
