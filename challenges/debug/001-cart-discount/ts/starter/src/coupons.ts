// Coupons currently offered by the store. They're edited in the admin panel and stored as
// JSON, so `type` is plain text there: "percent" or "fixed".
export interface Coupon {
  code: string;
  type: string;
  /** A percentage for percent coupons, cents for fixed coupons. */
  value: number;
}

export const COUPONS: Record<string, Coupon> = {
  SAVE10: { code: 'SAVE10', type: 'percent', value: 10 },
  SAVE25: { code: 'SAVE25', type: 'percent', value: 25 },
  FIVEOFF: { code: 'FIVEOFF', type: 'fixed', value: 500 },
};

export function findCoupon(code: string): Coupon | null {
  return COUPONS[code.trim().toUpperCase()] ?? null;
}
