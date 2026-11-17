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
- Each product (sku) has its own stock and its own reservations.

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

## Contract

Every case below gives the exact result. "Throws" means the call throws an `Error`. Where the message is given, the message includes that text.

A reservation holds units from the time it's made until `ttlMs` ms have passed. At exactly `ttlMs` it has expired. An expired reservation can't be confirmed or released.

Each example uses a fake clock, and `t` is the time in ms.

### `reserve(sku, qty, { ttlMs })` (new)

Returns a reservation id, a text value. Any unique text is fine, so the examples call it `id`. Throws if fewer than `qty` units are available. `ttlMs` is optional and defaults to 15 minutes (900000 ms).

```js
// addStock('sneakers', 3)
const id = reserve('sneakers', 2); // returns the text id
available('sneakers'); // 1
onHand('sneakers'); // 3
reserve('sneakers', 2); // throws: only 1 is available
available('sneakers'); // 1
```

### `confirm(id)` (new)

Returns nothing. The held units leave stock for good. Throws if the reservation doesn't exist, has expired, or was already confirmed or released.

```js
// addStock('sneakers', 3), then const id = reserve('sneakers', 2)
confirm(id); // returns nothing
onHand('sneakers'); // 1
available('sneakers'); // 1
confirm(id); // throws: already confirmed
onHand('sneakers'); // 1
```

### `release(id)` (new)

Returns nothing. The units become available again. Throws if there's no active reservation with that id.

```js
// addStock('sneakers', 3), then const id = reserve('sneakers', 2)
release(id); // returns nothing
available('sneakers'); // 3
onHand('sneakers'); // 3
release(id); // throws: already released
release('nope'); // throws: no such reservation
```

### Expiry

```js
// t = 0: addStock('sneakers', 3), then
const id = reserve('sneakers', 2, { ttlMs: 1000 });

// t = 999
available('sneakers'); // 1

// t = 1000
available('sneakers'); // 3
confirm(id); // throws: expired
release(id); // throws: expired
```

The default is 15 minutes:

```js
// t = 0: addStock('sneakers', 1), then reserve('sneakers', 1)

// t = 899999
available('sneakers'); // 0

// t = 900000
available('sneakers'); // 1
```

### `sell(sku, qty)` (changed)

Returns nothing. Units held by a reservation can't be sold. Throws if fewer than `qty` are available. The message includes `Not enough`.

```js
// addStock('sneakers', 2), then reserve('sneakers', 2)
sell('sneakers', 1); // throws: message includes "Not enough"
available('sneakers'); // 0
onHand('sneakers'); // 2
```

### `available(sku)` and `onHand(sku)`

Both are whole numbers. A product that was never stocked has `0` of each.

```js
// addStock('sneakers', 3), then reserve('sneakers', 2)
available('sneakers'); // 1
onHand('sneakers'); // 3
available('hat'); // 0, never stocked
onHand('hat'); // 0, never stocked
```

Products are kept apart:

```js
// addStock('sneakers', 2), addStock('hat', 5), then reserve('hat', 4)
available('sneakers'); // 2
available('hat'); // 1
```

## Data

`sku` is text (a product code). `qty` is a whole number, 1 or more. A **reservation id** is text.

**Options** for `createInventory(options)`

| Field | Type                             | Meaning                                |
| ----- | -------------------------------- | -------------------------------------- |
| `now` | function returning ms (optional) | The clock; tests pass a fake one       |

**Inventory** (what `createInventory` returns)

| Method                        | Returns                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `addStock(sku, qty)`          | nothing                                                     |
| `sell(sku, qty)`              | nothing. Throws if fewer than `qty` are available           |
| `available(sku)`              | whole number: on hand minus held                            |
| `onHand(sku)`                 | whole number: on the shelf, held or not                     |
| `reserve(sku, qty, { ttlMs })`| a reservation id: **you build this**                        |
| `confirm(id)`                 | nothing: **you build this**                                 |
| `release(id)`                 | nothing: **you build this**                                 |

## Files

- `src/inventory`: the inventory
- `tests/inventory.test`: the existing tests
