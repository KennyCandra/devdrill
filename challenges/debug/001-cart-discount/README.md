# Cart total ignores discount

Customers are complaining: they enter the coupon code **SAVE10** at checkout, but the total doesn't change.

Support confirmed that **FIVEOFF** (a fixed $5.00 discount) still works.

## Your task

Find out why some coupons are ignored and fix it. All tests must pass.

## What it should return

```js
const cart = createCart();
addItem(cart, { sku: 'TEE', name: 'T-shirt', priceCents: 2000, quantity: 2 });

applyCoupon(cart, 'SAVE10'); // true (the code was valid)
subtotal(cart);              // 4000
total(cart);                 // 3600: 10% off

applyCoupon(cart, 'NOPE');   // false, and the total doesn't change
```

- Percent coupons take that percent off the whole cart, rounded to the nearest cent.
- Fixed coupons take that many cents off, but the total never goes below `0`.
- Codes ignore upper/lower case and spaces around them (`' save10 '` works).

## Data

**Cart**

| Field    | Type             | Meaning                     |
| -------- | ---------------- | --------------------------- |
| `items`  | list of **Item** | What's in the cart          |
| `coupon` | **Coupon** or null | The applied coupon, if any |

**Item**

| Field        | Type                 | Meaning                                 |
| ------------ | -------------------- | --------------------------------------- |
| `sku`        | text                 | Product code; the same sku is one line  |
| `name`       | text                 | Product name                            |
| `priceCents` | whole number         | Price of one unit in cents (1999 = $19.99) |
| `quantity`   | whole number, 1 or more | How many                             |

**Coupon**

| Field   | Type                    | Meaning                                         |
| ------- | ----------------------- | ----------------------------------------------- |
| `code`  | text                    | What the customer types, e.g. `SAVE10`          |
| `type`  | `"percent"` or `"fixed"` | How the discount works                         |
| `value` | number                  | Percent off (10 = 10%), or cents off (500 = $5.00) |

**Functions**

| Function                                  | Returns                                       |
| ----------------------------------------- | --------------------------------------------- |
| `createCart()`                            | a new, empty **Cart**                         |
| `addItem(cart, item)`                     | the same **Cart**, with the item added or its quantity increased |
| `applyCoupon(cart, code)`                 | true if the code was valid and applied, else false |
| `subtotal(cart)`                          | whole number: cents before discount           |
| `total(cart)`                             | whole number: cents after discount            |
| `calculateDiscount(coupon or null, amountCents)` | whole number: cents taken off          |
| `findCoupon(code)`                        | the **Coupon**, or null if the code doesn't exist |

## Files

- `src/cart`: the cart (items, subtotal, total)
- `src/discount`: works out how much a coupon takes off
- `src/coupons`: the coupons the store offers
- `tests/cart.test`: the existing tests

Prices are stored in **cents** (`1999` = $19.99) to avoid floating-point rounding errors.
