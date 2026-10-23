# Add coupons and free shipping to orders

## What this PR does

- **Free shipping:** orders with a subtotal of **$50 or more** ship for free. Below that, shipping stays $5.
- **Coupons:** a new `applyCoupon(order, coupon)` returns the order with the coupon's percent taken off every item's price. **The original order must stay unchanged**: the cart screen keeps showing it, without the coupon, until checkout.

## How it was tested

- Added a test for `applyCoupon`.
- The existing order tests still pass.

## Your review

Review it like a teammate would. Comment on what must change before merging, and on anything worth improving. If the PR is good as it is, approve it.
