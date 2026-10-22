# Cart total ignores discount

Customers are complaining: they enter the coupon code **SAVE10** at checkout, but the total doesn't change.

Support confirmed that **FIVEOFF** (a fixed $5.00 discount) still works.

## Your task

Find out why some coupons are ignored and fix it. All tests must pass.

## Files

- `src/cart.js`: the cart (items, subtotal, total)
- `src/discount.js`: works out how much a coupon takes off
- `src/coupons.js`: the coupons the store offers
- `tests/cart.test.js`: the existing tests

Prices are stored in **cents** (`1999` = $19.99) to avoid floating-point rounding errors.
