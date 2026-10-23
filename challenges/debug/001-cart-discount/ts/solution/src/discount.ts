import type { Coupon } from './coupons';

// Returns how many cents a coupon takes off an amount.
export function calculateDiscount(coupon: Coupon | null, amountCents: number): number {
  if (!coupon) {
    return 0;
  }

  if (coupon.type === 'percent') {
    return Math.round((amountCents * coupon.value) / 100);
  }

  if (coupon.type === 'fixed') {
    // A fixed coupon can never take off more than the amount itself.
    return Math.min(coupon.value, amountCents);
  }

  return 0;
}
