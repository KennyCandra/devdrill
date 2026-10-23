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

## Files

- `src/cart.js`: the cart (items, subtotal, total)
- `src/discount.js`: works out how much a coupon takes off
- `src/coupons.js`: the coupons the store offers
- `tests/cart.test.js`: the existing tests

Prices are stored in **cents** (`1999` = $19.99) to avoid floating-point rounding errors.
